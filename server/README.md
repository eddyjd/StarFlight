# StarFlight: Odyssey — save service

A small .NET service that holds a captain's save so the same game continues on another device.

**The game does not need it.** `index.html` still runs off `file://` with no network, no account and
no server, exactly as before. Everything here is opt-in, and every failure path ends with the player
still playing from `localStorage`.

## Run it

```powershell
cd C:\Data\Dev\Starflight\server\Starflight.Server
dotnet run                        # http://localhost:8792
dotnet run --launch-profile lan   # http://0.0.0.0:8792, reachable from other machines
```

Build output and the database both live outside the repo — `%LOCALAPPDATA%\StarflightServerBuild`
and `%LOCALAPPDATA%\StarflightServer\starflight.db`. Override the database with
`Starflight:DbPath` in configuration.

## Why the game can reach it from `file://`

Opening `index.html` directly gives the page an opaque origin, and it sends `Origin: null`. That is
fine for calling an HTTP API — the restriction people remember is on `fetch`ing *local files*, not
on calling a server. Verified from the real client: preflight passes with an `Authorization` header
and a full 57-field save round-trips.

CORS is therefore wide open, on purpose. There is no origin to allowlist. Authorisation is the
bearer captain key and no cookies are used, so a wide CORS policy grants nothing the key does not
already grant.

## Captain keys

`POST /api/captains` returns a 32-byte key, shown **once**. Only its SHA-256 is stored, so the
database cannot hand out saves if it leaks. Anyone holding the key can read and overwrite that save
— it is a password, and it is the only credential, because the service stores no email, no name and
no other personal data.

## Two devices

Writes use optimistic concurrency, never last-write-wins. A `PUT` carries the revision it was based
on; if the server has moved on, it answers **409 with its own copy** instead of picking a winner:

```json
{ "error": "revision_conflict", "yourBaseRevision": 1, "serverRevision": 2,
  "serverDevice": "laptop", "serverSave": { ... } }
```

The player decides. `PUT /api/saves/force` is the deliberate "I looked at both and I want mine" —
a separate endpoint so it can never happen by accident or by a retry.

Every revision is kept (last 50). Cross-device sync's characteristic disaster is one device silently
flattening the other, and the history table is the difference between putting it back and an apology.

## Endpoints

| | |
|---|---|
| `GET /api/health` | liveness |
| `POST /api/captains` | new captain key, returned once |
| `GET /api/saves` | latest save, or `{ revision: 0, empty: true }` |
| `PUT /api/saves` | store if `baseRevision` matches, else 409 with the server's copy |
| `PUT /api/saves/force` | overwrite deliberately; the replaced revision stays in history |
| `GET /api/saves/history` | revisions, when, from which device, size |
| `GET /api/saves/history/{revision}` | one earlier revision in full |
| `GET /api/packs` | published packs |
| `GET /api/packs/{id}/{version}` | one pack version, with its content hash |
| `POST /api/packs` | publish; **immutable** — an existing `(id, version)` is refused |

All save endpoints take `Authorization: Bearer <captain key>` (or `X-Captain-Key`).

## Packs are data, never code

A pack served from here is JSON, merged through the same validator every pasted pack goes through.
It is never evaluated as script. A save service able to push executable code into a player's game
would be a remote code execution channel wearing a convenience feature's hat.

Published versions are immutable because saves pin `(id, version)` and trust it not to move
underneath them. Republishing is a new version, always.

## Before exposing it beyond your own machine

- Put it behind HTTPS. The captain key is a bearer token and plain HTTP hands it to the network.
- `POST /api/captains` is unauthenticated, so anyone who can reach it can create slots. Fine on a
  LAN; put it behind something on the public internet.
- There is no rate limiting.
