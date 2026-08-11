using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.Sqlite;

namespace Starflight.Server;

/// <summary>
/// Everything the service persists. One SQLite file, three tables, no ORM.
///
/// The shape is deliberately boring: a save is a JSON blob with a revision
/// number. The only interesting decision here is that <b>every revision is kept</b>
/// rather than overwritten. Cross-device sync's characteristic disaster is one
/// device silently flattening the other, and a history table is the difference
/// between "we can put that back" and an apology.
/// </summary>
public sealed class Store
{
    private readonly string _connectionString;

    /// Older revisions kept per captain. A save is ~21 KB, so 50 of them is about
    /// a megabyte per captain - cheap insurance against a bad merge.
    private const int HistoryDepth = 50;

    public Store(string dbPath)
    {
        var dir = Path.GetDirectoryName(Path.GetFullPath(dbPath));
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
        _connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = dbPath,
            Mode = SqliteOpenMode.ReadWriteCreate,
            Cache = SqliteCacheMode.Shared,
            Pooling = true
        }.ToString();
    }

    private SqliteConnection Open()
    {
        var c = new SqliteConnection(_connectionString);
        c.Open();
        // WAL so a read during a write does not block, and a busy timeout so two
        // devices syncing at the same instant wait rather than fail.
        using (var pragma = c.CreateCommand())
        {
            pragma.CommandText = "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=4000; PRAGMA foreign_keys=ON;";
            pragma.ExecuteNonQuery();
        }
        return c;
    }

    public void Initialise()
    {
        using var c = Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS captains (
                id           TEXT PRIMARY KEY,
                key_hash     TEXT NOT NULL UNIQUE,
                created_utc  TEXT NOT NULL,
                last_seen_utc TEXT
            );

            CREATE TABLE IF NOT EXISTS saves (
                captain_id  TEXT PRIMARY KEY REFERENCES captains(id) ON DELETE CASCADE,
                revision    INTEGER NOT NULL,
                updated_utc TEXT NOT NULL,
                device      TEXT NOT NULL DEFAULT '',
                payload     TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS save_history (
                captain_id  TEXT NOT NULL REFERENCES captains(id) ON DELETE CASCADE,
                revision    INTEGER NOT NULL,
                updated_utc TEXT NOT NULL,
                device      TEXT NOT NULL DEFAULT '',
                payload     TEXT NOT NULL,
                PRIMARY KEY (captain_id, revision)
            );

            -- Packs are immutable. A published (id, version) is never rewritten,
            -- because a save pins one and expects it to still be what it was.
            CREATE TABLE IF NOT EXISTS packs (
                pack_id       TEXT NOT NULL,
                version       TEXT NOT NULL,
                hash          TEXT NOT NULL,
                name          TEXT NOT NULL DEFAULT '',
                author        TEXT NOT NULL DEFAULT '',
                description   TEXT NOT NULL DEFAULT '',
                published_utc TEXT NOT NULL,
                payload       TEXT NOT NULL,
                PRIMARY KEY (pack_id, version)
            );
            """;
        cmd.ExecuteNonQuery();
    }

    // ---- captains ---------------------------------------------------------

    /// <summary>
    /// A captain key is 32 random bytes. Only its SHA-256 is stored, so the
    /// database cannot hand out anybody's saves if it leaks - the same reason
    /// you would not store a password in the clear. It is shown to the player
    /// exactly once, at creation.
    /// </summary>
    public (string CaptainId, string Key) CreateCaptain()
    {
        var key = "SFO-" + Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var id = Guid.NewGuid().ToString("n");

        using var c = Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = "INSERT INTO captains (id, key_hash, created_utc) VALUES ($id, $h, $t);";
        cmd.Parameters.AddWithValue("$id", id);
        cmd.Parameters.AddWithValue("$h", HashKey(key));
        cmd.Parameters.AddWithValue("$t", Now());
        cmd.ExecuteNonQuery();
        return (id, key);
    }

    public string? CaptainIdForKey(string? key)
    {
        if (string.IsNullOrWhiteSpace(key)) return null;
        using var c = Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT id FROM captains WHERE key_hash = $h;";
        cmd.Parameters.AddWithValue("$h", HashKey(key));
        var id = cmd.ExecuteScalar() as string;

        if (id is not null)
        {
            using var touch = c.CreateCommand();
            touch.CommandText = "UPDATE captains SET last_seen_utc = $t WHERE id = $id;";
            touch.Parameters.AddWithValue("$t", Now());
            touch.Parameters.AddWithValue("$id", id);
            touch.ExecuteNonQuery();
        }
        return id;
    }

    public static string HashKey(string key) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(key.Trim()))).ToLowerInvariant();

    // ---- saves ------------------------------------------------------------

    public SaveRecord? GetSave(string captainId)
    {
        using var c = Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT revision, updated_utc, device, payload FROM saves WHERE captain_id = $id;";
        cmd.Parameters.AddWithValue("$id", captainId);
        using var r = cmd.ExecuteReader();
        if (!r.Read()) return null;
        return new SaveRecord(r.GetInt64(0), r.GetString(1), r.GetString(2), r.GetString(3));
    }

    /// <summary>
    /// Store a save, but only if the client was working from the revision the
    /// server actually holds.
    ///
    /// This is the whole point of the service. Last-write-wins would mean the
    /// laptop you left running overwrites the evening you just played on the
    /// desktop, silently and unrecoverably. A mismatch returns the server's copy
    /// instead, and the decision goes to the player.
    /// </summary>
    public PutOutcome PutSave(string captainId, long baseRevision, string device, string payload)
    {
        using var c = Open();
        using var tx = c.BeginTransaction();

        long current = 0;
        using (var read = c.CreateCommand())
        {
            read.Transaction = tx;
            read.CommandText = "SELECT revision FROM saves WHERE captain_id = $id;";
            read.Parameters.AddWithValue("$id", captainId);
            current = read.ExecuteScalar() is long v ? v : 0;
        }

        if (current != baseRevision)
        {
            tx.Rollback();
            return new PutOutcome(false, current, GetSave(captainId));
        }

        var next = current + 1;
        var now = Now();

        using (var up = c.CreateCommand())
        {
            up.Transaction = tx;
            up.CommandText = """
                INSERT INTO saves (captain_id, revision, updated_utc, device, payload)
                VALUES ($id, $rev, $t, $dev, $p)
                ON CONFLICT(captain_id) DO UPDATE SET
                    revision = excluded.revision, updated_utc = excluded.updated_utc,
                    device = excluded.device, payload = excluded.payload;
                """;
            up.Parameters.AddWithValue("$id", captainId);
            up.Parameters.AddWithValue("$rev", next);
            up.Parameters.AddWithValue("$t", now);
            up.Parameters.AddWithValue("$dev", device);
            up.Parameters.AddWithValue("$p", payload);
            up.ExecuteNonQuery();
        }

        using (var hist = c.CreateCommand())
        {
            hist.Transaction = tx;
            hist.CommandText = """
                INSERT OR REPLACE INTO save_history (captain_id, revision, updated_utc, device, payload)
                VALUES ($id, $rev, $t, $dev, $p);
                DELETE FROM save_history WHERE captain_id = $id AND revision <= $cut;
                """;
            hist.Parameters.AddWithValue("$id", captainId);
            hist.Parameters.AddWithValue("$rev", next);
            hist.Parameters.AddWithValue("$t", now);
            hist.Parameters.AddWithValue("$dev", device);
            hist.Parameters.AddWithValue("$p", payload);
            hist.Parameters.AddWithValue("$cut", next - HistoryDepth);
            hist.ExecuteNonQuery();
        }

        tx.Commit();
        return new PutOutcome(true, next, null);
    }

    public List<HistoryEntry> History(string captainId)
    {
        using var c = Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = """
            SELECT revision, updated_utc, device, LENGTH(payload)
            FROM save_history WHERE captain_id = $id ORDER BY revision DESC;
            """;
        cmd.Parameters.AddWithValue("$id", captainId);
        using var r = cmd.ExecuteReader();
        var list = new List<HistoryEntry>();
        while (r.Read()) list.Add(new HistoryEntry(r.GetInt64(0), r.GetString(1), r.GetString(2), r.GetInt64(3)));
        return list;
    }

    public SaveRecord? HistoryAt(string captainId, long revision)
    {
        using var c = Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = """
            SELECT revision, updated_utc, device, payload
            FROM save_history WHERE captain_id = $id AND revision = $rev;
            """;
        cmd.Parameters.AddWithValue("$id", captainId);
        cmd.Parameters.AddWithValue("$rev", revision);
        using var r = cmd.ExecuteReader();
        if (!r.Read()) return null;
        return new SaveRecord(r.GetInt64(0), r.GetString(1), r.GetString(2), r.GetString(3));
    }

    // ---- packs ------------------------------------------------------------

    /// <summary>
    /// Publish a pack version. Refuses to alter one that already exists, even
    /// with identical content - a save pins (id, version) and trusts it not to
    /// move underneath. Republishing is a new version, always.
    /// </summary>
    public PublishOutcome PublishPack(string packId, string version, string hash,
                                      string name, string author, string description, string payload)
    {
        using var c = Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT hash FROM packs WHERE pack_id = $id AND version = $v;";
        cmd.Parameters.AddWithValue("$id", packId);
        cmd.Parameters.AddWithValue("$v", version);
        if (cmd.ExecuteScalar() is string existing)
            return new PublishOutcome(false, existing);

        using var ins = c.CreateCommand();
        ins.CommandText = """
            INSERT INTO packs (pack_id, version, hash, name, author, description, published_utc, payload)
            VALUES ($id, $v, $h, $n, $a, $d, $t, $p);
            """;
        ins.Parameters.AddWithValue("$id", packId);
        ins.Parameters.AddWithValue("$v", version);
        ins.Parameters.AddWithValue("$h", hash);
        ins.Parameters.AddWithValue("$n", name);
        ins.Parameters.AddWithValue("$a", author);
        ins.Parameters.AddWithValue("$d", description);
        ins.Parameters.AddWithValue("$t", Now());
        ins.Parameters.AddWithValue("$p", payload);
        ins.ExecuteNonQuery();
        return new PublishOutcome(true, hash);
    }

    public PackRecord? GetPack(string packId, string version)
    {
        using var c = Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = """
            SELECT pack_id, version, hash, name, author, description, published_utc, payload
            FROM packs WHERE pack_id = $id AND version = $v;
            """;
        cmd.Parameters.AddWithValue("$id", packId);
        cmd.Parameters.AddWithValue("$v", version);
        using var r = cmd.ExecuteReader();
        if (!r.Read()) return null;
        return new PackRecord(r.GetString(0), r.GetString(1), r.GetString(2), r.GetString(3),
                              r.GetString(4), r.GetString(5), r.GetString(6), r.GetString(7));
    }

    public List<PackSummary> ListPacks()
    {
        using var c = Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = """
            SELECT pack_id, version, hash, name, author, description, published_utc, LENGTH(payload)
            FROM packs ORDER BY pack_id, published_utc DESC;
            """;
        using var r = cmd.ExecuteReader();
        var list = new List<PackSummary>();
        while (r.Read())
            list.Add(new PackSummary(r.GetString(0), r.GetString(1), r.GetString(2), r.GetString(3),
                                     r.GetString(4), r.GetString(5), r.GetString(6), r.GetInt64(7)));
        return list;
    }

    private static string Now() => DateTime.UtcNow.ToString("O");
}

public record SaveRecord(long Revision, string UpdatedUtc, string Device, string Payload);
public record HistoryEntry(long Revision, string UpdatedUtc, string Device, long Bytes);
public record PutOutcome(bool Stored, long Revision, SaveRecord? ServerCopy);
public record PublishOutcome(bool Published, string ExistingHash);
public record PackRecord(string Id, string Version, string Hash, string Name,
                         string Author, string Description, string PublishedUtc, string Payload);
public record PackSummary(string Id, string Version, string Hash, string Name,
                          string Author, string Description, string PublishedUtc, long Bytes);
