using System.Text.Json;
using System.Text.Json.Nodes;
using Starflight.Server;

// ---------------------------------------------------------------------------
// StarFlight: Odyssey - save service
//
// One job: hold a captain's save so the same game continues on another device.
// It is deliberately small and deliberately optional. The game is a zero
// dependency browser app that runs off file:// with no network at all, and that
// has to stay true - everything here is opt-in, and every failure mode ends with
// the player still playing from localStorage.
//
// Two things are worth knowing before reading further:
//
//   CORS is wide open, on purpose. The game is opened as file://, which sends
//   "Origin: null". There is no origin to allowlist. Authorisation is the bearer
//   captain key, never the origin, and no cookies are used - so a wide CORS
//   policy grants nothing that the key does not already grant.
//
//   Writes use optimistic concurrency, not last-write-wins. Two devices are the
//   entire point of this service, and silently flattening one with the other is
//   the failure that would make it worse than no service at all.
// ---------------------------------------------------------------------------

var builder = WebApplication.CreateBuilder(args);

var dbPath = builder.Configuration["Starflight:DbPath"]
    ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "StarflightServer", "starflight.db");

// A save measures about 21 KB. The ceiling is generous enough for a heavily
// explored game with several content packs, and low enough that the endpoint is
// not a free file host.
const int MaxSaveBytes = 4 * 1024 * 1024;
const int MaxPackBytes = 8 * 1024 * 1024;

var store = new Store(dbPath);
store.Initialise();
builder.Services.AddSingleton(store);

builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .SetIsOriginAllowed(_ => true)      // includes "null", which is what file:// sends
    .AllowAnyHeader()
    .AllowAnyMethod()));                // no AllowCredentials - the key travels in a header

var app = builder.Build();
app.UseCors();

var json = new JsonSerializerOptions(JsonSerializerDefaults.Web);

// ---- helpers --------------------------------------------------------------

static string? BearerKey(HttpRequest req)
{
    var h = req.Headers.Authorization.ToString();
    if (h.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return h[7..].Trim();
    // Convenience for a game that has to work from a plain text box.
    var alt = req.Headers["X-Captain-Key"].ToString();
    return string.IsNullOrWhiteSpace(alt) ? null : alt.Trim();
}

IResult Unauthorised() => Results.Json(
    new { error = "unknown_captain", message = "That captain key is not recognised." },
    statusCode: StatusCodes.Status401Unauthorized);

// ---- health ---------------------------------------------------------------

app.MapGet("/api/health", () => Results.Json(new
{
    ok = true,
    service = "starflight-odyssey-saves",
    version = "1",
    utc = DateTime.UtcNow.ToString("O")
}));

// ---- captains -------------------------------------------------------------

// The key is returned exactly once and only its hash is kept. Losing it means
// losing access to that slot, which is stated plainly in the response so the
// client can say so too.
app.MapPost("/api/captains", (Store s) =>
{
    var (id, key) = s.CreateCaptain();
    return Results.Json(new
    {
        captainId = id,
        captainKey = key,
        notice = "Write this key down. It is shown once, it is stored only as a hash, " +
                 "and anyone holding it can read and overwrite this save."
    });
});

// ---- saves ----------------------------------------------------------------

app.MapGet("/api/saves", (HttpRequest req, Store s) =>
{
    var captain = s.CaptainIdForKey(BearerKey(req));
    if (captain is null) return Unauthorised();

    var save = s.GetSave(captain);
    if (save is null)
        return Results.Json(new { revision = 0L, empty = true },
                            statusCode: StatusCodes.Status200OK);

    return Results.Json(new
    {
        revision = save.Revision,
        updatedUtc = save.UpdatedUtc,
        device = save.Device,
        empty = false,
        save = JsonNode.Parse(save.Payload)
    });
});

app.MapPut("/api/saves", async (HttpRequest req, Store s) =>
{
    var captain = s.CaptainIdForKey(BearerKey(req));
    if (captain is null) return Unauthorised();

    using var reader = new StreamReader(req.Body);
    var raw = await reader.ReadToEndAsync();
    if (raw.Length > MaxSaveBytes)
        return Results.Json(new { error = "too_large", limitBytes = MaxSaveBytes },
                            statusCode: StatusCodes.Status413PayloadTooLarge);

    JsonNode? body;
    try { body = JsonNode.Parse(raw); }
    catch (Exception e)
    {
        return Results.Json(new { error = "bad_json", message = e.Message },
                            statusCode: StatusCodes.Status400BadRequest);
    }

    var payload = body?["save"];
    if (payload is null)
        return Results.Json(new { error = "no_save", message = "Body must be { baseRevision, device, save }." },
                            statusCode: StatusCodes.Status400BadRequest);

    var baseRevision = body?["baseRevision"]?.GetValue<long>() ?? 0L;
    var device = body?["device"]?.GetValue<string>() ?? "";

    var outcome = s.PutSave(captain, baseRevision, device, payload.ToJsonString());

    if (!outcome.Stored)
    {
        // Not an error - the other device got there first. Hand back what the
        // server holds so the player can choose, rather than picking for them.
        var server = outcome.ServerCopy;
        return Results.Json(new
        {
            error = "revision_conflict",
            message = "This save was written from another device since you last synced.",
            yourBaseRevision = baseRevision,
            serverRevision = outcome.Revision,
            serverUpdatedUtc = server?.UpdatedUtc,
            serverDevice = server?.Device,
            serverSave = server is null ? null : JsonNode.Parse(server.Payload)
        }, statusCode: StatusCodes.Status409Conflict);
    }

    return Results.Json(new { revision = outcome.Revision, storedUtc = DateTime.UtcNow.ToString("O") });
});

// Forcing a write is legitimate - the player has looked at both and chosen. It
// is a separate endpoint so it can never happen by accident or by retry.
app.MapPut("/api/saves/force", async (HttpRequest req, Store s) =>
{
    var captain = s.CaptainIdForKey(BearerKey(req));
    if (captain is null) return Unauthorised();

    using var reader = new StreamReader(req.Body);
    var raw = await reader.ReadToEndAsync();
    if (raw.Length > MaxSaveBytes)
        return Results.Json(new { error = "too_large", limitBytes = MaxSaveBytes },
                            statusCode: StatusCodes.Status413PayloadTooLarge);

    JsonNode? body;
    try { body = JsonNode.Parse(raw); }
    catch (Exception e)
    {
        return Results.Json(new { error = "bad_json", message = e.Message },
                            statusCode: StatusCodes.Status400BadRequest);
    }

    var payload = body?["save"];
    if (payload is null)
        return Results.Json(new { error = "no_save" }, statusCode: StatusCodes.Status400BadRequest);

    var device = body?["device"]?.GetValue<string>() ?? "";
    var current = s.GetSave(captain)?.Revision ?? 0L;
    var outcome = s.PutSave(captain, current, device, payload.ToJsonString());

    // The overwritten revision is still in history, so this is reversible.
    return Results.Json(new { revision = outcome.Revision, overwroteRevision = current, forced = true });
});

app.MapGet("/api/saves/history", (HttpRequest req, Store s) =>
{
    var captain = s.CaptainIdForKey(BearerKey(req));
    if (captain is null) return Unauthorised();
    return Results.Json(new { history = s.History(captain) });
});

app.MapGet("/api/saves/history/{revision:long}", (long revision, HttpRequest req, Store s) =>
{
    var captain = s.CaptainIdForKey(BearerKey(req));
    if (captain is null) return Unauthorised();

    var rec = s.HistoryAt(captain, revision);
    if (rec is null) return Results.Json(new { error = "no_such_revision", revision },
                                         statusCode: StatusCodes.Status404NotFound);
    return Results.Json(new
    {
        revision = rec.Revision,
        updatedUtc = rec.UpdatedUtc,
        device = rec.Device,
        save = JsonNode.Parse(rec.Payload)
    });
});

// ---- packs ----------------------------------------------------------------
//
// Data only. A pack served from here is JSON that the game merges through the
// same validator every pasted pack goes through - it is never evaluated as
// script. A save service able to push executable code into a player's game
// would be a remote code execution channel wearing a convenience feature's hat.

app.MapGet("/api/packs", (Store s) => Results.Json(new { packs = s.ListPacks() }));

app.MapGet("/api/packs/{packId}/{version}", (string packId, string version, Store s) =>
{
    var pack = s.GetPack(packId, version);
    if (pack is null)
        return Results.Json(new { error = "no_such_pack", packId, version },
                            statusCode: StatusCodes.Status404NotFound);

    return Results.Json(new
    {
        id = pack.Id,
        version = pack.Version,
        hash = pack.Hash,          // the client re-computes this and refuses a mismatch
        name = pack.Name,
        author = pack.Author,
        description = pack.Description,
        publishedUtc = pack.PublishedUtc,
        pack = JsonNode.Parse(pack.Payload)
    });
});

app.MapPost("/api/packs", async (HttpRequest req, Store s) =>
{
    // Publishing needs the same bearer key as a save. This is a personal service,
    // not an open registry; opening it up is a decision to make deliberately.
    var captain = s.CaptainIdForKey(BearerKey(req));
    if (captain is null) return Unauthorised();

    using var reader = new StreamReader(req.Body);
    var raw = await reader.ReadToEndAsync();
    if (raw.Length > MaxPackBytes)
        return Results.Json(new { error = "too_large", limitBytes = MaxPackBytes },
                            statusCode: StatusCodes.Status413PayloadTooLarge);

    JsonNode? body;
    try { body = JsonNode.Parse(raw); }
    catch (Exception e)
    {
        return Results.Json(new { error = "bad_json", message = e.Message },
                            statusCode: StatusCodes.Status400BadRequest);
    }

    var pack = body?["pack"];
    var hash = body?["hash"]?.GetValue<string>();
    if (pack is null || string.IsNullOrWhiteSpace(hash))
        return Results.Json(new { error = "bad_request", message = "Body must be { hash, pack }." },
                            statusCode: StatusCodes.Status400BadRequest);

    var packId = pack["id"]?.GetValue<string>();
    var version = pack["version"]?.GetValue<string>() ?? "1";
    if (string.IsNullOrWhiteSpace(packId))
        return Results.Json(new { error = "no_pack_id" }, statusCode: StatusCodes.Status400BadRequest);

    var outcome = s.PublishPack(packId, version, hash,
        pack["name"]?.GetValue<string>() ?? packId,
        pack["author"]?.GetValue<string>() ?? "",
        pack["description"]?.GetValue<string>() ?? "",
        pack.ToJsonString());

    if (!outcome.Published)
        return Results.Json(new
        {
            error = "version_exists",
            message = $"{packId} version {version} is already published and packs are immutable. " +
                      "Publish a new version instead - saves pin the one they were built with.",
            existingHash = outcome.ExistingHash
        }, statusCode: StatusCodes.Status409Conflict);

    return Results.Json(new { published = true, id = packId, version, hash });
});

app.Run();

// Exposed so the integration tests can drive the same pipeline the game will.
public partial class Program { }
