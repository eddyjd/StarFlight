# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**StarFlight: Odyssey** — a single-player retro space-exploration game (Starflight homage) built as a
zero-dependency browser app: plain HTML5 Canvas, vanilla CSS, and non-module ES5/ES6 script files
loaded via `<script src>` tags. There is **no package.json, no build step, no test framework, and no
linter**. Do not introduce npm tooling or ES modules without being asked — the whole design premise is
that `index.html` runs directly off the filesystem.

`PROJECT_DOCUMENTATION.md` is a long, chronological changelog/handover document (52+ numbered
feature-and-bugfix entries). It is the historical record of *why* things are shaped the way they are;
consult it when a piece of code looks odd, but treat this file as the current architectural summary.

## Running and verifying

```powershell
# Simplest: open directly (file:// works — no fetch/XHR anywhere)
Start-Process "C:\Data\Dev\Starflight\index.html"

# Or serve locally if you want a clean cache/origin
python -m http.server 8080   # then browse to http://localhost:8080
```

Verification is manual, in-browser. There are no automated tests. A useful smoke path:
intro screen → `🚀 INITIALIZE DISPATCH JUMP` (launches straight into hyperspace at `250,250`) →
fly with `W`/`A`/`D` → `[S]` radar scan → `[M]` star map → approach a system and `[ENTER]` →
orbit a planet and `[L]` to land → mine with `[ENTER]` → drive to `[H]` and `[L]` to ascend →
fly back to `(250, 250)` and `[L]` to dock. Also exercise `🏢 ENTER STARPORT FACILITY` and
export/import save.

**Debugging:** open DevTools console. `GameManager.init()` wraps every subsystem init in its own
try/catch, collects failures, and writes them into `document.title` as `INIT ERRORS: ...` — so a
broken tab title is the fastest signal that a module failed to boot. The main loop also swallows
per-frame exceptions (see below), so a silently blank canvas usually means a caught draw error, not
a stopped loop.

## Version bump ritual (required on every user-visible change)

The game is loaded from `file://` or a static host, so browser caching is the #1 source of
"my fix didn't apply". Every release bumps the version in **three** places in `index.html`:

1. The `?v=1.9.8` cache-busting query string on **all eight** `<script src="js/*.js?v=...">` tags.
2. The `v1.9.8` span in `.header-title`.
3. The `VER 1.9.8` span in `.header-decor`.

Commit messages follow `vX.Y.Z: <summary>`, and significant changes get a new numbered entry appended
to `PROJECT_DOCUMENTATION.md` section 6.

## Architecture

### Global singletons, load-order dependent

Each `js/*.js` file defines one object literal and assigns it to `window` at the bottom
(`window.Navigation = Navigation;`). There are no imports; everything is a global reached by name.
**Script order in `index.html` matters** — `data.js` → `audio.js` → `ui.js` → `spaceport.js` →
`navigation.js` → `planet.js` → `encounter.js` → `game.js`. `game.js` is last because
`window.onload → GameManager.init()` wires all the others together.

| Global | File | Responsibility |
| --- | --- | --- |
| `GameData` | `js/data.js` | Static content DB: 30+ `starSystems` (each with planets), `upgrades`, `crewCandidates`, `commodities`, `aliens`, `nebulae`, `wormholes`, `blackHoles`, `derelicts`, `asteroidFields`, `distressSignals`, `spaceWrecks`, `techParts`, `hqLogs` |
| `AudioController` | `js/audio.js` | Web Audio API synthesizer — all SFX are generated oscillators, no audio files |
| `UI` | `js/ui.js` | DOM element cache (`UI.elements`), log terminal, sidebars, view switching, and most modals |
| `Spaceport` | `js/spaceport.js` | Starbase Prime: depot upgrades, hiring, commodity market, HQ logs, `launchShip()` |
| `Navigation` | `js/navigation.js` | Space physics + rendering for both hyperspace and in-system flight; star map; space combat; deep-space encounters (largest file) |
| `PlanetExploration` | `js/planet.js` | Surface exploration: 50×35 tile grid, rover driving, mining, landing-site picker |
| `Encounter` | `js/encounter.js` | Alien dialogue state machine, tactical combat, bartering |
| `GameManager` | `js/game.js` | Owns all state, the rAF loop, keyboard routing, save/load. Aliased as `window.game` |

### State: one object, one localStorage key

`GameManager.ship` is the single source of truth for everything persistent — coordinates, credits,
fuel, module levels, `cargo`, `crew`, `discoveredSystems`, `exploredSectors`, `encounterHistory`,
`artifactsCollected`, and `exploredPlanets` (per-planet mined/dropped/explored/analyzed tile maps
lazily created by `PlanetExploration.getPlanetState()`). `saveGame()` serializes that whole object to
`localStorage["starflight_odyssey_save"]`; `loadGame()` merges it back with `Object.assign` over the
defaults, which is also where **save migrations** live (e.g. the v1.8.0 `100,100 → 250,250` galaxy
re-center). Export/import produce a wrapper `{title, version, timestamp, ship}` JSON file.

**Gotcha:** mutable runtime flags on `GameData` — notably `derelicts[].searched` and
`spaceWrecks[].searched` — are *not* part of `ship` and therefore reset on page reload. If you add a
world-state flag that should persist, put it under `ship`, not on `GameData`.

Modules keep their own transient physics/render state (`Navigation.shipX/shipY/shipVx/shipVy`,
`PlanetExploration.roverX/roverY/energy/grid`) and sync the authoritative values back into
`ship.coordinates`. Any code that repositions the ship must update both.

### View state machine

`GameManager.viewState` ∈ `intro | spaceport | navigation | landing | encounter | barter` and
`GameManager.spaceState` ∈ `hyper | system`.

Important asymmetry: **`landing` is not its own DOM panel.** `UI.switchView()` only knows the five
panels in `index.html`; planet surface exploration calls `UI.switchView("navigation")` while setting
`viewState = "landing"`. Consequently `#gameCanvas` is **shared** by `Navigation.draw()` and
`PlanetExploration.draw()`, and `GameManager.tick()`'s `viewState` branch is what decides which one
owns the canvas that frame. Never assume the canvas contents belong to Navigation.

### Main loop

`GameManager.tick(timestamp)` schedules `requestAnimationFrame` **first**, then does all work inside a
try/catch. This is deliberate hardening (see PROJECT_DOCUMENTATION §6.5): a thrown draw error must
never kill the 60 FPS loop. `dt` is clamped to `[0.001, 0.05]`. When adding loop work, preserve both
properties — put new logic inside the existing try block, don't wrap the rAF call.

### Coordinates

The galaxy is a **500×500 light-year quadrant** with Starbase Prime at `(250, 250)`. In hyperspace,
`Navigation.shipX/shipY` are galaxy LY coordinates. In system mode and on planets, they hold *local
canvas pixel* coordinates instead — so anything needing galaxy position (star map, discovery,
save) must call `Navigation.getShipGalaxyCoords()`, which resolves back through
`ship.currentSystem.x/y`. This was a real bug once; don't regress it.

Planet surfaces are 50×35 tiles, procedurally generated per planet from
`getSeededRandom(planet.name)` so a given planet always looks the same, with player modifications
layered on top from `ship.exploredPlanets[name]`.

### Input and event wiring

Two coexisting styles, both intentional:

* **Inline `onclick` attributes** in `index.html` wrapped in `try{...}catch(e){alert(...)}` — used for
  intro buttons and modal buttons as a fail-proof fallback (added in v1.9.8 after listener-attachment
  bugs). `GameManager.dispatchLaunch()` / `enterStarport()` exist specifically as inline-callable
  entry points and duplicate the logic in the corresponding `addEventListener` handlers in
  `setupGlobalListeners()`. If you change launch behavior, change **both**.
* **`addEventListener`** in each module's `setupListeners()` for the control bar and gameplay.

Keyboard handling is centralized in `GameManager.setupGlobalListeners()`. It short-circuits when any
of the tracked modals is open (`cargo-modal`, `transfer-modal`, `tv-cargo-modal`, `starmap-modal`) —
**a new modal that should block gameplay keys must be added to that `isModalOpen` check.** Navigation
keys (`W`/`A`/`D`/`SHIFT` continuous movement) are tracked separately in `Navigation.setupListeners()`
by both `e.key` and `e.code`.

There are thin **delegator duplicates** near the bottom of `navigation.js`
(`Navigation.toggleShields`/`toggleWeapons`/`enterSpacebase`) that forward to `window.game`. Note
`Navigation.enterSpacebase` is defined **twice** in the same object literal — the later, simpler one
wins, so the docking logic that restores hull and heals crew (the earlier definition, ~line 763) is
dead code. Be careful when editing docking behavior.

### Modals

All modals are `div.modal.hidden` in `index.html`, toggled by adding/removing the `hidden` class,
with content injected via `innerHTML` from JS. Adding a modal means: markup in `index.html`, open/close
methods on `UI` (or the owning module), an `Esc` path, and the `isModalOpen` registration above.

## Conventions

* Terminal output goes through `UI.addLog(text)`, which **uppercases everything** and keeps the last
  30 lines. Write log strings in in-world voice ("DOCKING CLEARED. TRANSITING TO STARPORT BAY 1.").
* Canvas rendering is all hand-rolled `ctx` primitives plus emoji glyphs for surface icons
  (🔋 endurium, 🪙 gold, 💎 platinum, 🧱 iron, 💠 precursor, 🌱 flora, 👾 fauna, 🏛️ ruins, 🛸 wreck,
  `[H]` lander, `◎` rover). The legend modal in `index.html` must stay in sync with
  `PlanetExploration.getItemIconAndBadge()`.
* Colors come from the CSS custom properties in `css/style.css` (`--primary-color` phosphor green
  `#00ff66`, `--secondary-color` cyan `#00ccff`, `--warning-color` amber, `--danger-color` crimson);
  canvas code uses the same hex values inline.
* `body` carries mode classes toggled from `UI`: `crisp-mode` vs retro CRT effects
  (`UI.toggleDisplayMode()`), and `font-large` / `font-xlarge` (`UI.cycleFontSize()`). Font scaling
  uses **explicit non-compounding pixel rules** per element class — never percentage font-size on
  generic selectors like `div`/`span`, which caused exponential nesting blowup previously. Canvas text
  scales via the `UI.getFontScale()` multiplier instead.
* Defensive coding is the house style throughout: `typeof X !== 'undefined'` guards before touching
  other globals, array-bounds clamping on upgrade-level lookups, `NaN` guards on physics values, and
  fallback regeneration when a grid or starfield is missing. Keep it — saves from older versions
  routinely lack newer fields.
