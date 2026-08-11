# StarFlight: Odyssey — Content Packs

**This document is the prompt.** Paste it into any AI along with what you want, and you should
get back a pack that loads first time.

> Read CONTENT_PACKS.md below, then write me a content pack for a quadrant themed
> around a derelict generation ship that never arrived.

The game is data-driven by design: 28 `GameData` collections, and the engines never need editing
to add content. A pack is one file of pure data. Everything in it is checked by 17 rules before
a single record is merged — a pack that fails is **refused with a readable report and the game
boots as if it were not there**.

---

## 1. The shape of a pack

```js
ContentPacks.register({
  id: "my_quadrant",              // required, unique, lower_snake_case
  name: "The Quadrant",           // shown in the CONTENT PACKS screen
  version: "1",                   // bump this whenever you change a published pack
  author: "you",
  description: "One line.",

  add:    { /* brand new records */ },
  extend: { /* changes to records that already exist */ }
});
```

**`version` is a promise to the saves.** Every save records the id, version and a content
fingerprint of each pack that built it. Change a published pack without bumping the version and
the game will notice and say so on load — `SAVED AGAINST 1, NOW RUNNING 1 — SAME VERSION,
DIFFERENT CONTENT` — because the fingerprint is of the content, not the label. Nothing breaks,
but a captain's charted systems may now describe somewhere that no longer exists.

Treat a published pack as immutable and ship changes as a new version. Renaming or removing a
region, system, quest or commodity is the change that actually costs someone their progress.

Two ways to install it:

| | |
|---|---|
| **File** | Save as `js/content/packs/<name>.js` (exactly as above, calling `ContentPacks.register`) and add `"<name>.js"` to `js/content/packs/manifest.js`. |
| **Paste** | Strip the `ContentPacks.register(` wrapper so it is **pure JSON**, then paste it into `CONTENT PACKS → INSTALL`. Pasted packs are stored as data and are never executed as code. |

`fetch()` does not work from `file://`, so the manifest is a `.js` file and there is no folder
auto-discovery. That is a browser limit, not a design choice.

---

## 2. `add` — new records

Keyed by collection. Arrays take a list; maps take an object keyed by id.

**Array collections:** `starSystems` `blackHoles` `derelicts` `spaceWrecks` `distressSignals`
`alienPorts` `nebulae` `asteroidFields` `quests` `archives` `puzzles` `resourceProfiles`
`signalTemplates` `crewCandidates` `hqLogs`

**Map collections:** `regions` `commodities` `techParts` `aliens` `consumables` `archiveLocations`

Anything else is refused. A pack **cannot overwrite an existing record** — same-id records are
rejected, so a pack can never hijack authored content.

---

## 3. `extend` — changing what already exists

```js
extend: {
  <collection>: {
    <recordId>: {
      push:  { <field>: [ ...records ] },   // append to an array field
      set:   { <field>: value },            // replace a value
      merge: { <field>: { key: value } }    // add keys to an object field
    }
  }
}
```

Field names may be **dotted paths** — `"dialogue.nodes"` reaches two levels down. Without that,
`merge: { nodes: … }` writes to a field nothing reads, the loader reports success, and the
content silently is not there. That mistake is why the feature exists.

`regions.core` refers to the Corps Quadrant, whose collections live at the top level of
`GameData` rather than inside `regions`.

### Two gates, not one

**A quadrant needs a way in and a way out, and they are different objects.** Getting this wrong
builds a trap, so it is worth being exact.

**The way in** is an `extend` — a singularity pushed onto an existing region, with `leadsTo`
naming yours. Without it your quadrant is unreachable:

```js
extend: {
  regions: {
    core: {
      push: {
        blackHoles: [{
          id: "bh_to_mine", name: "The Long Silence", x: 60, y: 200,
          gravityRadius: 32, coreRadius: 4, pullForce: 42,
          destX: 60, destY: 200,
          leadsTo: "my_region",
          desc: "A fold the Corps has logged as a duplicate reading for four hundred years."
        }]
      }
    }
  }
}
```

**The way out** is a singularity in **your own region's** `blackHoles`, carrying `returnsTo`:

```js
blackHoles: [{
  id: "bh_mine_home", name: "The Way Back", x: 130, y: 370,
  gravityRadius: 28, coreRadius: 4, pullForce: 38,
  destX: 130, destY: 370,
  returnsTo: "core",
  desc: "The same fold from the other side, if the readings are honest."
}]
```

**`returnTo` on the region record is not a gate.** It is only the *coordinates* a `returnsTo`
singularity drops you at. A region with a `returnTo` and no singularity of its own is a
one-way trip with no exit — the validator warns `has no singularity - nothing can leave it`,
and that warning means the quadrant is unfinished.

Optional on any gate: `oneWay: true` (no return through this throat) and `exitAt: {x,y}` (land
somewhere other than the destination's default).

---

## 4. The rules — what will get your pack refused

All 17 were written after a real bug in this game. They are not style preferences.

**References must resolve**
- Every commodity key — in asteroid ores, derelict loot, port `wants`, resource profiles,
  dialogue `swap`/`buy`/`requires.cargo` — must exist in `commodities`.
- Every `techPartKey` must exist in `techParts`.
- Every dialogue `next` must name a node that exists.
- Every port's `archive` must exist **and hold at least one volume**, and no archive may be
  stocked by ports in two different regions.
- Every `puzzleId` on a site, and every quest objective naming a puzzle, volume, region or race,
  must resolve.
- Every gate's `leadsTo`/`returnsTo` must name a real region, and **every region must have a gate
  leading into it**.

**Coordinates**
- Everything sits inside `5..495` on both axes.
- Any clue with `coords` must point within 3 LY of a real object — a system, singularity,
  derelict, wreck, beacon, port, nebula, asteroid field, or Starbase Prime at `(250, 250)`.
- **No gate may drop a ship inside a gravity well** — a landing point must be at least
  `gravityRadius` away from every singularity in the destination.

  **The trap to avoid**: the obvious place to put `returnTo` is where the player left from, and
  where they left from is the entry gate you just added — which is itself a well. Getting this
  wrong is an inescapable loop between two regions. It shipped for real in v1.14.1, the
  reference pack repeated it, and the first pack written from *this document* repeated it again.

  `gravityRadius` clears the error. **Clear `gravityRadius × 2.4` to actually be safe** — pull
  starts at 2.4× and merely clearing the well means arriving already drifting back in. The game
  nudges arrivals out to that distance at runtime, so authoring inside it means your coordinates
  are not the ones the player sees.

**Uniqueness**
- Record ids unique within a collection, across all regions.
- System names and singularity names unique across the whole galaxy.
- **Planet names unique.** A planet surface is generated from its name, so two planets sharing a
  name are literally the same world.

**Completeness**
- Commodities need `name`, `sellVal`, `mass` and a `tier` (`common` `uncommon` `rare` `exotic`).
  Add an `icon` and it will be used on planet surfaces.
- Nebulae need an `effect` that exists: `shield_boost` `scanner_blind` `fuel_rich` `radiation`
  `hull_stress` `stealth` `bio_rich` `safe`.
- Consumables need an `effect` that exists: `fold` `survey` `refuel` `repair` `shields` `cloak`.
- Every race that appears in `traffic.races` must have an entry in `aliens` with `aggression` and
  `dialogue` — otherwise hailing it does nothing.
- A `cipher` puzzle's `ciphertext` must actually decode to its `plaintext` under some rotation.
  **The player's answer is the rotation number, not the text**, so the `prompt` must give them a
  way to work it out.

---

## 5. Record shapes

Copy `js/content/packs/the-tessellation.js` — it is the worked example and exercises every
operation. Abbreviated shapes:

**Types are enforced.** `name`, `blurb` and `danger` are strings; coordinates, `gravity`,
`temp` and `sellVal` are numbers. Writing `danger: 3` looks reasonable and is not — see the
region shape below.

```js
// region
{ id, name, blurb,
  danger,                                   // A SENTENCE, not a rating. It is read out
                                            // as "ADVISORY: <danger>" on arrival.
  arrival: {x,y},                           // where a gate leading here drops you
  returnTo: {region,x,y},                   // where THIS region's returnsTo gate lands you
  wormholeCfg: { pairs, solos },            // throats rolled per save
  traffic: { count, races: [...] },
  starSystems: [], blackHoles: [], derelicts: [], spaceWrecks: [],
  distressSignals: [], nebulae: [], alienPorts: [] }

// star system + planet
{ name, x, y, starClass, starColor, descr, planets: [
  { name, radius, speed, color, size, gravity, temp, atmosphere,
    bio, minerals, hasRuins, artifact }        // gravity >= 3, temp >= 450 or <= -180
]}                                             // means no lander can reach it

// derelict          loot.type "endurium" goes to the fuel tank; anything else is cargo
{ id, name, x, y, searched: false, puzzleId?,
  loot: { type, amount, credits, artifact, tech, techPartKey } }

// alien port
{ id, name, raceKey, archive, x, y, color, icon: "⌂",
  fuelPrice, wants: [], wantMult, baseMult, tradeLine, greeting }

// puzzle - three types exist, and a pack may not invent a fourth
{ id, title, prompt, type: "cipher",   ciphertext, plaintext }   // answer = the rotation
{ id, title, prompt, type: "sequence", glyphs: [], solution: [] } // answer = press them in order
{ id, title, prompt, type: "assembly", setId, fragments: [] }     // answer = hold every fragment
// all three also take: grantsClue, reward: { credits, artifact }

// quest
{ id, title, autoStart, stages: [
  { brief, clues: [], objectives: [ { type, text, ... } ], reward: {} }
]}
// objective types: collect_artifact | collect_all_artifacts | dock_at | visit_coords
//                  visit_region | talk_to_race | solve_puzzle | assemble_set
//                  read_volume | salvage_site | have_credits

// dialogue choice (inside extend → aliens → <race> → merge → "dialogue.nodes")
{ text, response?, next?, clue?, once?, highlight?, hideWhenBlocked?,
  requires: { clue, volume, artifact, artifacts, cargo, credits, quest, region },
  action: "exit"|"combat"|"trade"|"swap"|"buy"|...,
  swap: { give: {key,count}, get: {key,count} },
  buy:  { key, count, price } }
```

---

## 6. Writing it well

The rules make a pack *load*. These make it worth playing.

- **Write in the game's voice** — dry, concrete, understated. Read `js/content/regions.js` and
  `js/content/archives.js` first. No exclamation marks except from the Spemin, who are made of
  them.
- **Give the player a reason to cross.** A region behind a one-way gate needs something the core
  does not have.
- **Clues should point somewhere specific**, and the coordinates must be real — the validator
  enforces that, but only you can make the destination worth the flight.
- **Let some things be empty.** Not every ruin holds an artifact and not every system holds a
  site. A quadrant where everything pays out has no texture.
- **Say what a thing is, not how the player should feel about it.**

---

## 7. Check it

Paste into `CONTENT PACKS → CHECK ONLY`. You get either the exact problems, or the record count
it would add. It changes nothing either way. `INSTALL` then persists it; reload to bring it in.

**Read the warnings.** Errors block the install; warnings do not, and they are where the
unplayable-but-valid mistakes show up — a quadrant with no way out, a region with no systems in
it. A pack that installs is not the same as a pack that is finished.

If a save was made with a pack and you later remove it, **nothing is deleted** — the ship is
recovered to Starbase Prime, the region's chart and salvage record are kept, and re-installing
the pack resumes it exactly where it was.
