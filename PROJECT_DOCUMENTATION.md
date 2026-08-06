# STARFLIGHT: ODYSSEY — PROJECT DOCUMENTATION & AGENT HANDOVER GUIDE

This document serves as a complete technical guide, architectural reference, and state summary for **StarFlight: Odyssey**. Any AI assistant or developer taking over this project should read this guide to understand the codebase structure, game systems, implemented features, key bindings, and recent bug fixes.

---

## 1. Project Overview & Technology Stack

* **Technology**: Pure HTML5 Canvas, Vanilla CSS3, and Modular ES6 JavaScript.
* **Dependencies**: None (Zero external libraries or npm build steps required). Runs natively in any modern web browser by opening `index.html`.
* **Visual Style**: Retro Sci-Fi CRT Terminal aesthetic with scanline overlays, neon green phosphor styling (`hsl(140, 100%, 50%)`), custom Google Fonts (*Share Tech Mono* & *Orbitron*), and dynamic screen-scaling transforms.
* **Audio**: Real-time Web Audio API synthesizer (`js/audio.js`) producing engine pitch bends, radar sweeps, laser blaster bursts, alarm sirens, and UI confirmation beeps without external sound files.

---

## 2. Architecture & File Structure

```
StarFlight/
├── index.html                # Main CRT terminal UI shell, DOM layouts, and modal overlays
├── css/
│   └── style.css             # CRT styling, aspect-ratio viewport scaling, retro buttons & layout
└── js/
    ├── data.js               # Star systems, planets, crew candidates, ship modules, commodities
    ├── audio.js              # Synthesized Web Audio API sound controller (AudioController)
    ├── ui.js                 # Terminal log, diagnostic panels, scale transforms, modal handlers
    ├── spaceport.js          # Spaceport Command (Depot upgrades, Hiring, Commodity Market, HQ logs)
    ├── navigation.js         # Physics engine for Hyperspace & Solar System space flight, Star Map
    ├── planet.js             # 2D surface exploration engine (Rover TV, hazards, cargo transfers)
    ├── encounter.js          # Alien interaction, dialogue state machine, real-time tactical combat
    └── game.js               # Core GameManager state machine, main loop tick(), save/load handlers
```

---

## 3. Core Game Loop & State Machine

The master controller is `window.game` (`GameManager` in `js/game.js`).

### Game View States (`game.viewState`)
* `"intro"`: Main Title Screen with Start Game, Import Save, Export Save, Reset Game options.
* `"spaceport"`: Starbase Prime terminal command (Ship Dept, Personnel Office, Commodity Market, HQ Logs).
* `"navigation"`: Space navigation canvas (Hyperspace interstellar travel & Solar System orbital navigation).
* `"landing"`: Planetary surface exploration grid (Terrain Vehicle TV driving, sample gathering, hazard avoidance).
* `"encounter"`: Alien communication and tactical combat view.
* `"barter"`: Commodity trading dialogue overlay during alien encounters.

### Space Flight Modes (`game.spaceState`)
* `"hyper"`: Hyperspace map navigation. Starbase Prime located at `(100.0, 100.0)`. Coordinates are in Light Years (LY). 1 LY = 14px on canvas.
* `"system"`: In-system orbital navigation centered on star at canvas coordinates `(300, 190)`. Orbiting planets follow physics rotation angles.

---

## 4. Subsystem Details & Key Features Implemented

### A. Viewport Aspect-Ratio Scaling & Fullscreen
* Dynamically scales `#game-container` in `css/style.css` to fill window space while maintaining a crisp retro CRT aspect ratio.
* Includes a native HTML5 Fullscreen API toggle button (`FULLSCREEN: ON/OFF`) in the upper-right header console.

### B. Hardened Main Animation Loop (`js/game.js`)
* `requestAnimationFrame((t) => this.tick(t))` is scheduled **FIRST** at the top of `tick(timestamp)`.
* All rendering and state updates are wrapped inside a `try ... catch` block.
* If a transient rendering or calculation exception occurs, it is logged safely to the console without interrupting the 60 FPS starfield animation loop.

### C. Save File Export & Import (`js/game.js`)
* **Auto-Save**: Saves game state to `localStorage` on major state transitions (docking, landing, market transactions).
* **Export Save**: Download save state as a readable `.json` file (`starflight_save_YYYY-MM-DD.json`).
* **Import Save**: File picker upload on the title screen or spaceport menu to restore game state from a saved `.json` file.

### D. Commodity Market & Realistic Cargo Mass System (`js/data.js` & `js/ui.js`)
* Each commodity has distinct, realistic mass attributes (0.1 T to 4.0 T):
  * `Iron`: 2.0 T | `Gold`: 3.0 T | `Platinum`: 3.5 T | `Endurium`: 1.5 T | `Precursor Alloy`: 4.0 T | `Flora`: 0.5 T | `Fauna`: 1.0 T | `Art`: 0.8 T | `Contraband`: 0.5 T | `Fuel`: 0.1 T.
* **Ship Manifest (`CARGO LOG [I]`)**: Inspect ship cargo hold mass, volume, item list, with `JETTISON 1` and `JETTISON ALL` action buttons.
* **Commodity Exchange (`js/spaceport.js`)**: Sell gathered minerals and biological samples at Starbase Prime for M.U. credits.

### F. Full-Screen Interactive Nav-Computer Star Map & Star Discovery (`#starmap-modal` & `js/navigation.js`)
* **Open via `STAR MAP [M]` Button or `[M]` Key**: Displays a full-screen vector Starmap Matrix filling 94% of the CRT console viewport.
* **Automatic Star System Proximity Discovery**: Flying within 18.0 Light Years of any star system in Hyperspace automatically discovers the star system, logs it to `ship.discoveredSystems`, plays a discovery chime, and prints a terminal log (`NAV DISCOVERY: STAR SYSTEM SIRIUS SECTOR (COORD: X 120, Y 85) LOGGED TO MAP.`).
* **Radar Scan Discovery (`RADAR SCAN [S]`)**: Emitting a Radar Scan (`[S]`) sweeps space up to 35.0 Light Years away, discovering and logging all star systems within sensor range.
* **Discovered System Mapping**: All discovered star systems are permanently mapped on the Nav-Computer Star Map with glowing star spectral colors, system names, and exact coordinates. Uncovers Fog of War sectors around discovered systems.
* **Flashing Position Marker**: Displays a pulsing cyan **`▶ YOU ARE HERE`** targeting reticle centered at `(shipX, shipY)`.

### G. Alien Ships in Space Navigation, Radar Scanning & Encounter Markers (`js/navigation.js` & `js/encounter.js`)
* **Visible Alien Spacecraft in Space Navigation**: Alien starships (Spemin Scouts, Veloxi Battlecruisers, Uhlek Interceptors) fly along real-time vectors across the main space flight canvas with glowing thrusters, radar aura rings, and coordinate labels.
* **Radar Scan Alien Detection (`RADAR SCAN [S]`)**: Running a Radar Scan (`[S]`) detects all active alien vessels in space up to 40.0 Light Years away, logging their name, exact `(X, Y)` coordinates, distance, and bearing vector to the terminal.
* **Active Alien Vessels on Star Map**: The full-screen Nav-Computer Star Map (`[M]`) renders active alien starships currently in flight as color-coded triangle markers (`▲ SPEMIN SCOUT (78.0, 72.0)`).
* **Past Alien Encounter History Markers**: Every alien meeting or battle is recorded in `ship.encounterHistory` and displayed on the Star Map with yellow battle icons (`⚔ [ENCOUNTER: SPEMIN BLOBS]`).
* **Proximity Comms Control (`COMMS [C]`)**: When an alien ship flies near your vessel (< 6.5 LY), a `COMMS [C]: <ALIEN SHIP>` button appears on your dashboard. Comms are no longer forced automatically for neutral/friendly ships—players can press **`[C]`** to open comms or simply fly past.
* **Encounter Cooldown Immunity (25 Seconds)**: Added `game.encounterCooldown = 25.0` upon concluding comms, fleeing, or winning combat. Prevents alien encounters from restarting frame-after-frame.

### H. Crew Medical & Healing System (`js/game.js` & `js/navigation.js`)
* **Starbase Infirmary Docking Healing**: Docking at Starbase Prime (`[L]`) automatically treats and fully restores all crew members to 100% full health (`MEDICAL INFIRMARY: ALL CREW MEMBERS TREATED AND RESTORED TO 100% HEALTH`).
* **Passive Doctor Healing in Flight**: Having a Doctor officer assigned to your crew (`ship.crew.doctor`) passively heals all injured crew members during flight (healing rate scales with Doctor's medical skill).
* **Natural Recovery**: Even without a Doctor, injured crew members slowly recover health over time while flying in space.

---

## 5. Controls & Keyboard Shortcuts

| Context | Action | Key Binding |
| :--- | :--- | :--- |
| **Space Navigation** | Thrust Forward | `W` or `Up Arrow` |
| | Rotate Left / Right | `A` / `D` or `Left` / `Right Arrow` |
| | Enter System / Radar Scan | `S` (or `Enter` near system) |
| | Land Vehicle / Dock at Base | `L` (or `Enter` near Starbase Prime) |
| | Toggle Shields / Weapons | `K` (Shields) / `F` (Weapons) |
| | Interactive Star Map Modal | `M` |
| | Ship Cargo Manifest Modal | `I` |
| **Surface Exploration** | Drive Rover | `W`, `A`, `S`, `D` or `Arrow Keys` |
| | Surface TV Cargo Manifest | `I` |
| | Unload TV Cargo at Lander Tile `[H]` | `U` |
| | Return to Ship / Ascend to Orbit | `L` (on Lander Tile `[H]`) |
| **Global Modals** | Close Manifest / Starmap Modals | `Esc` |

---

## 6. Important Bug Fixes Implemented

1. **Elimination of Random Alien Auto-Spawns**: Removed random `Math.random()` auto-trigger encounter loops in `js/game.js`. Friendly and neutral alien ships fly in space on vectors without forcing open the communication screen. Communication is only opened voluntarily via `COMMS [C]`.
2. **Missing Alien Spacecraft Graphics**: Added procedural starship canvas rendering right alongside the alien commander portrait during comms and combat.
3. **Star Map Scan vs Modal**: Replaced simple text radar log output with full interactive Nav-Computer Starmap modal showing Fog of War and visited star systems.
4. **Space Steering Key Collision**: Removed `D` / `d` from docking key check in `navigation.js`. Steering right with `D` near Starbase Prime no longer triggers accidental docking state changes mid-flight.
5. **Space Flight Loop Hardening**: `requestAnimationFrame` placed at start of `tick()`, `NaN` velocity/coordinate guards added in `navigation.js`, and `updateSystem()` sanitized against null system objects.
6. **Crew Console HP Progress Bar & Integer Formatting**: Fixed missing `maxHp` properties on crew objects and added `Math.round()` integer formatting to eliminate trailing floating point decimals e.g. `HP: 95/100` in the sidebar panel.
7. **Planetary Surface Dropped Items (`js/planet.js`)**: Discarding items on a planet surface drops them onto the terrain grid as golden crate icons (`📦`), allowing players to pick them back up by driving over them later.
8. **Starbase Prime System Navigation Symmetry (`js/spaceport.js` & `js/navigation.js`)**: Starbase Prime is now treated symmetrically like all other star systems. Launching from Starport disengages into Hyperspace right outside Starbase Prime (`100, 100`), and flying near Starbase Prime in Hyperspace allows pressing `[ENTER]` to enter the Starbase Prime solar system or `[L]` to dock.
9. **Configurable Launch Protocols (`js/spaceport.js`)**: Added launch deployment protocol configuration (`AUTO-RAISE SHIELDS ON LAUNCH: [ON/OFF]`, `AUTO-ARM WEAPONS ON LAUNCH: [ON/OFF]`) at Starport Depot. Terminal logs, control buttons, and ship diagnostics now accurately match the player's configured launch state.
10. **Interactive Control Bar Click Binding (`js/ui.js` & `index.html`)**: Bound mouse click handlers to all bottom control bar buttons (`STAR MAP [M]`, `CARGO LOG [I]`, `TOGGLE SHIELDS [K]`, `WEAPONS READY [F]`, `LAND [L]`, `SCAN [S]`) and removed initial `disabled` lock on the Star Map button so mouse clicking works everywhere alongside keyboard shortcuts.
12. **Star Map Text Overlap Fix & Interactive Hover Tooltips (`js/navigation.js`, `index.html`, `css/style.css`)**: Removed duplicate Starbase Prime draw call and offset player marker label (`▲ YOU ARE HERE`) above ship icon to eliminate label collisions. Removed static text labels from alien encounters and active ships, replacing them with race-specific alien icons (`👾` Spemin, `▲` Veloxi, `▼` Uhlek, `◆` Thrynn) and an interactive floating CRT hover tooltip (`#starmap-tooltip`) that inspects star systems, alien ships, past encounter records, and player coordinates on mouse hover.
13. **Expanded Planetary Surface & Camera Viewport (`js/planet.js`)**: Expanded planet surface maps from 20x14 to 50x35 sectors (1,750 terrain tiles per planet) with smooth scrolling camera tracking centered on the TV Rover.
14. **Planetary Landing Site Selection (`js/planet.js` & `index.html`)**: Interactive planetary landing site picker modal (`#landing-site-modal`) allows selecting surface descent coordinates `(X, Y)` before landing. Past landing sites are marked with gold lander indicators (`[H1]`, `[H2]`).
15. **Persistent Planet State (`js/planet.js`)**: Mined and collected resource tiles stay harvested permanently on return visits, discarded items remain on surface tiles, and past landing sites persist across sessions.
16. **Spectrographic Deposit Analysis & Explicit Mining (`js/planet.js`)**: Removed automatic item pickup on movement so players can drive over deposits without filling cargo. Pressing `[V]` or `ANALYZE DEPOSIT` inspects ore composition without harvesting. Pressing `[ENTER]`, `[SPACE]`, `[M]`, or clicking `MINE / HARVEST` explicitly mines/harvests the deposit into the TV Rover cargo bed.
17. **Prominent Cargo $ Value Displays (`js/planet.js` & `js/ui.js`)**: All cargo manifest modals (TV Surface Bed, Ship Hold, and Orbit Transfer) now feature prominent, gold-glowing `$ Market Value` displays: unit prices (e.g. `$280 / unit`), total stack values (e.g. `$1,400 M.U.`), and top summary banners with total hold valuation (e.g. `ESTIMATED TOTAL VALUE: $4,850 M.U.`).
18. **Control Panel Activation & Dynamic Label Audit (`js/ui.js` & `js/navigation.js`)**: Conducted a full audit of all bottom control bar buttons (`LAND VEHICLE [L]`, `SCAN [S]`, `SHIELDS [K]`, `WEAPONS [F]`, `COMMS [C]`, `STAR MAP [M]`). Button labels and active/disabled states now update dynamically and accurately for all 5 game environments (Hyperspace near base, Hyperspace open space, Solar System orbital proximity, Planet surface exploration, and Alien Comms). When orbiting a planet, buttons dynamically change to `LAND VEHICLE [L]` and `SCAN PLANET_NAME [S]`.
19. **Gold '✕' Landing Markers & Traveled Area Highlights (`js/planet.js`)**: All past landing sites now render as glowing gold **`✕`** markers on both the surface terrain view and the landing site map preview. As the TV Rover explores a planet, all traveled/scanned sectors within a 2-tile radius are saved in `pState.exploredTiles` and rendered with a sci-fi green/cyan scan grid highlight on both the live surface viewport and the full landing preview map!
20. **Launch Vessel Scope Bugfix (`js/spaceport.js`)**: Fixed missing `const ship = game.ship;` scope reference inside `Spaceport.launchShip()` that previously caused a silent `ReferenceError: ship is not defined` crash when clicking the **LAUNCH VESSEL** button.
21. **Default Shield & Weapon Module Outfitting (`js/game.js`)**: Configured newly commissioned flagship vessels to start outfitted with Class 1 Deflector Shield Matrix (`shieldLevel: 1`, `maxShields: 100`) and Class 1 Blaster Cannons (`blasterLevel: 1`). Upon launch from Starport Depot, shields raise and weapons arm automatically according to launch protocols, with `btnShields` and `btnWeapons` fully enabled and active.
22. **Full Browser Window Star Map (`index.html` & `js/navigation.js`)**: Configured `#starmap-modal` overlay to fill 100% of the browser window (`100vw x 100vh`), removing fixed size boundaries. `starmapCanvas` dynamically resizes to fill full viewport dimensions on open and resize.
23. **Solar System Centering & Ship Visibility (`js/navigation.js`)**: Replaced static 300x190 star coordinates with dynamic `canvas.width / 2` and `canvas.height / 2` centering. Upgraded vector ship rendering with neon green hull outline (`#00ff66`), dark green body, and glowing orange thruster trail (`#ffaa00`), ensuring the flagship is always 100% brightly visible and centered in solar system travel.
24. **High-Speed Solar Travel & Impulse Overdrive (`js/data.js` & `js/navigation.js`)**:
    * **Impulse Overdrive (`[SHIFT]` Key)**: Pressing or holding `SHIFT` in space activates a 2.5x thrust boost with an intense cyan plasma thruster trail (`#00ccff`) for instant fast-travel across solar systems.
    * **Tiered Engine Upgrades**: Expanded Engine Cores in Starport Depot up to Class 5 Sub-Space Fold Drive ($22,000 M.U.), giving players a major end-game progression goal that permanently increases base sub-warp velocity up to 3.3x faster!
25. **Continuous Keyboard Movement & Button Focus Release (`js/navigation.js` & `js/ui.js`)**:
    * **Dual Key/Code Tracking**: Key listener now tracks both `e.key` and `e.code` (e.g. `KeyW`, `KeyA`, `ArrowUp`), guaranteeing smooth, uninterrupted continuous movement while holding down direction keys.
    * **Automatic Button Blur**: Clicking any HTML button automatically releases focus (`element.blur()`) so keyboard focus never traps arrow keys or spacebar inputs.
26. **Engine Fuel Burn Scope Reference Fix (`js/navigation.js`)**: Fixed missing `const engine` scope reference in `Navigation.updateHyper()` that previously triggered a silent `ReferenceError: engine is not defined` exception on every frame while `isThrusting` was true (causing forward movement animation to stall until key release). Thrusting while holding `W` or `ArrowUp` now renders continuously and smoothly.
27. **Identified Resource Deposit Icons & Badges (`js/planet.js`)**:
    * When a surface deposit is analyzed (`[V]`) or driven past/scanned (1-sector radius), it transitions from generic symbols (`*` or `&`) to **distinct resource icons and text badges** on the terrain map:
      * **Endurium Ore**: **`🔋`** `ENDURIUM` (Neon Green)
      * **Precursor Alloy**: **`💠`** `PRECURSOR` (Cyan)
      * **Gold**: **`🪙`** `GOLD` (Gold)
      * **Platinum**: **`💎`** `PLATINUM` (Platinum)
      * **Iron Ore**: **`🧱`** `IRON ORE` (Bronze)
      * **Alien Fauna**: **`👾`** `FAUNA` (Pink)
      * **Alien Flora**: **`🌱`** `FLORA` (Green)
      * **Precursor Ruins**: **`🏛️`** `RUIN` (Primary Green)
28. **Lander Waypoint & Return Power Autonomy Telemetry HUD (`js/planet.js`)**:
    * **Direction & Distance**: Real-time compass heading (`↗ NE`, `➡ E`, `⬇ S`, `↖ NW`) and exact sector distance to the Lander pad (`[H]`).
    * **Power Autonomy Calculation**: Calculates exact energy required to drive back based on TV Engine level and Engineer skill (`REQ POWER: 14%`).
    * **Return Safety Status**: Displays real-time return safety margin: **`SAFE (+46% MARGIN)`** (Green), **`WARNING! LOW MARGIN`** (Yellow), or **`CRITICAL! INSUFFICIENT RETURN POWER`** (Pulsing Red)!
29. **Navigation Viewport Render Guard & Safe Star Color Parsing (`js/navigation.js`)**:
    * **Safe Color Extraction**: Added hex validation for `starColor` RGB extraction to prevent invalid `rgba(NaN, NaN, 0)` canvas fill styles on non-standard star colors.
    * **Robust Loop Guard**: Wrapped `drawHyper()` and `drawSystem()` in safety `try/catch` handlers and added auto-generation fallback for background stars to guarantee space viewports never freeze or render blank.
30. **Planet Surface TV Upgrades Array Index Safeguard (`js/planet.js`)**:
    * **Root Cause Fix**: Fixed `TypeError: Cannot read properties of undefined (reading 'cap')` where legacy or initialized save data had missing/zero-indexed `ship.tvUpgrades` fields, causing `PlanetExploration.draw()` to throw an exception and blank out the planetary terrain viewport.
    * **Defensive Boundary**: Added array bounds checking (`Math.max(0, index - 1)` and default fallback objects) across `draw()`, `moveRover()`, and `updateStorms()`.
31. **Star Map System Coordinate Resolution & Planet Grid Recovery (`js/navigation.js` & `js/planet.js`)**:
    * **Root Cause Fix**: When in solar system mode or landed on a planet, `this.shipX` / `this.shipY` held local canvas pixel coordinates (e.g. `455, 190`). Opening the Star Map or clicking **CENTER SHIP** attempted to map `455, 190` onto the 200 LY galaxy grid, causing the camera to center hundreds of light years out into blank void with `▲ YOU ARE HERE` pushed into the top-left margin.
    * **Galaxy Coordinate Translation**: Created `Navigation.getShipGalaxyCoords()` to automatically resolve system orbit coordinates (`currentSystem.x, currentSystem.y`) whenever in a solar system or on a planet.
    * **Planet Terrain Auto-Recovery**: Added automatic terrain grid initialization fallback to `PlanetExploration.draw()` so loading or reloading a surface exploration session never renders an un-instantiated grid.
32. **Global Version Badge (v1.4.2) & Planet Method Definition Fix (`index.html` & `js/planet.js`)**:
    * **Root Cause Solved**: Added missing `getItemIconAndBadge` method definition to `PlanetExploration` object in `js/planet.js`. Previously, when rendering mineral/bio deposit tiles on the planet surface, a `TypeError: this.getItemIconAndBadge is not a function` exception aborted `PlanetExploration.draw()` mid-frame (after rendering soil and mountain triangles `▲ ▲ ▲`, but before rendering deposits, Rover `◎`, Lander `[H]`, or Telemetry HUD banner).
    * **Visible Version Indicator**: Added prominent **`VER 1.4.2`** version text badges to the console header and dashboard interface so players can immediately verify they are running the latest codebase release.
33. **Planet Telemetry HUD Column Spacing & Overlap Fix (`js/planet.js`)**:
    * **Root Cause Solved**: Separated Line 1 and Line 2 telemetry HUD text metrics into clean, non-overlapping columns across the 600px canvas width (`SECTOR: (x,y)` at `x=12`, `POWER: %` at `x=120`, `HULL: %` at `x=200`, `CARGO: %` at `x=280`, `ANALYZE: [A]` at `x=440`), preventing text overlap between Power and Hull values.
34. **Compass Direction Angle Math & Version v1.4.3 (`js/planet.js` & `index.html`)**:
    * **Root Cause Fix**: Corrected screen-coordinate `Math.atan2(dy, dx)` angle mapping. Previously `angleDeg == 0°` (Lander located directly East of Rover) fell through unmapped conditional bounds, defaulting to `⬆ N`. Re-mapped 0°/360° to **`➡ E`**, 90° to **`⬇ S`**, 180° to **`⬅ W`**, and 270° to **`⬆ N`**.
    * **Non-Overlapping Text Column Offsets**: Updated Line 1 & Line 2 HUD text column positions (`POWER` at `x=130`, `HULL` at `x=215`, `CARGO` at `x=295`, `ANALYZE` at `x=460`, `REQ POWER` at `x=215`, `STATUS` at `x=335`) so metrics never overlap regardless of value string length.
    * **Cache-Busting Version Bump**: Updated header version badge to **`VER 1.4.3`** and appended `?v=1.4.3` parameters to script tags in `index.html` to prevent stale browser caching.
35. **Crisp UI Mode, Proportional Star Map Zoom, Captain's Log & Real-Time Hyperspace Combat (v1.5.0)**:
    * **Crisp High-Contrast UI Mode (`css/style.css` & `js/ui.js`)**: Disabled fuzzy CRT scanlines, flicker, curvature glare, and text blur by default. Added `DISPLAY: CRISP / RETRO` header toggle button.
    * **Proportional Star Map Zoom Scaling (`js/navigation.js`)**: Scaled star system icons, base halos, alien markers, encounter symbols, and text labels proportionally with `mapZoom` (`Math.sqrt(this.mapZoom)`).
    * **Captain's Exploration Log Modal (`index.html` & `js/ui.js`)**: Implemented tabbed archive (`[G]` key) documenting Star Systems, Surveyed Planets (atmosphere, gravity, temp, minerals, bio), Precursor Relics, and Alien Diplomacy history.
    * **Real-Time Hyperspace Space Combat & Evasion (`js/navigation.js`)**: Implemented real-time tactical space dogfighting with phaser blaster firing (`[F]`), homing missiles (`[V]`), impulse boost evasion (`SHIFT`), alien plasma torpedoes, deflector shield impact flashes, and optional comms dialogue (`[C]`).
36. **100% Full-Browser Layout, Command Manual, Larger Surface View & Top-Down Landing Map (v1.6.0)**:
    * **100% Full-Browser Window Layout (`css/style.css`)**: Expanded `.crt-screen` and `.dashboard` to `100vw x 100vh`, utilizing maximum available screen space and removing outer frame padding.
    * **Interactive Help Command Manual (`index.html` & `js/ui.js`)**: Added `HELP [?]` header button and `[?]` key shortcut opening the tabbed Commander Manual covering navigation, planetary mining, space dogfighting, commerce, and precursor lore.
    * **Enlarged Surface Viewport (`js/planet.js`)**: Scaled up planetary grid cell dimensions to `cellW: 42px`, `cellH: 36px` and font sizes (20px-24px) for bold, vivid terrain features, deposits, lander, and Rover `◎`.
    * **Top-Down Surface Terrain Landing Map (`js/planet.js`)**: Upgraded `#landingSiteCanvas` in the descent picker modal to render a top-down planetary terrain surface map preview with atmospheric theme colors (volcanic, ice, desert, lush), mountain peaks `▲`, mineral/bio hotspots, and gold lander sites `[H]`.
37. **Native 100% Viewport Scale Fix & Dynamic Canvas Auto-Resize (v1.6.1)**:
    * **Root Cause Fix**: Removed legacy `transform: scale(...)` calculation from `UI.updateScreenScale()` in `js/ui.js`. Previously, `scale(1.77)` was applied to an already `100vw` container, magnifying the dashboard to 177% (3233px wide) and requiring manual browser zooming to 200%.
    * **100% Native Layout**: `.crt-screen` now renders at 100% native browser scale with `transform: none !important;`, fitting any monitor resolution perfectly without overflow.
38. **Starbase Safety Protocol & Docked Weapons/Shield Lock (`js/game.js` & `js/ui.js`)**:
    * **Safety Override**: Lowered shields and disarmed weapons automatically upon docking at Starbase Prime.
    * **Docked Lockout**: Disabled `btnShields` and `btnWeapons` controls (`SHIELDS LOCKED [K]` & `WEAPONS LOCKED [F]`) while in `spaceport` view, outputting `"STARBASE SAFETY PROTOCOL: Tactical weapons and deflector shields locked offline while docked at Station Facility."` if key shortcuts `[K]` or `[F]` are pressed.
39. **Font Size Scaling Accessibility System (v1.6.2)**:
    * **Header Control Button**: Added `FONT: NORMAL` (`UI.cycleFontSize()`) toggle button in console header cycling through `NORMAL` (14px base), `LARGE` (16px base), and `XLARGE` (18px base).
    * **Dynamic UI Rescaling (`css/style.css` & `js/ui.js`)**: Automatically scales crew stats, log terminal, depot items, and Captain's Log archives seamlessly across screen sizes.
40. **Full-Height HQ Logs Expansion & Dynamic Starfield Coverage (v1.6.3)**:
    * **HQ Logs Vertical Expansion (`css/style.css`)**: Converted `.spaceport-content` and `#spaceport-hq` to flexbox columns with `.hq-logs-scroll { flex-grow: 1; height: 0; min-height: 200px; }`. Starport Command HQ Logs now expand smoothly to fill 100% of the available vertical height in the main display with no empty black space below.
    * **Full Canvas Starfield Coverage (`js/navigation.js`)**: Updated background stars and nebulae to use normalized relative coordinates (`u: 0.0-1.0`, `v: 0.0-1.0`). Stars and nebulae now spread uniformly across 100% of the expanded space canvas resolution instead of clumping in the top-left 600x450 quadrant.
41. **Universal Multi-Element Font Size Scaling System (v1.6.4)**:
    * **Universal Coverage (`css/style.css`)**: Expanded `body.font-large` (118% scale) and `body.font-xlarge` (138% scale) selectors to cover ALL buttons, input controls, navigation menus, titles, descriptions, table cells, modal cards, and subtext elements universally.
    * **Canvas Font Scaling Helper (`js/ui.js`)**: Added `UI.getFontScale()` helper returning `1.18` or `1.38` multiplier so text scaling applies cleanly across HTML elements and canvas rendering contexts alike.
42. **Controlled Non-Compounding Font Size Scaling Fix (v1.6.5)**:
    * **Root Cause Solved**: Removed transitive percentage multipliers (`p, div, span { font-size: 118% !important }`) that caused exponential font multiplication down nested DOM nodes (producing giant 48px overlapping text in logs and menus).
    * **Clean Explicit Pixel Rules**: Replaced percentage selectors with explicit, non-compounding pixel rules per element class (`15px` for `body.font-large` and `16px` for `body.font-xlarge`, with +1px to +2px adjustments for headers, buttons, log entries, and sidebar lists).
43. **Dynamic Full-Canvas Planet Surface Expansion & Scaling (v1.6.6)**:
    * **Dynamic Grid Auto-Scaling (`js/planet.js`)**: Replaced fixed 42px x 36px cell dimensions with dynamic viewport calculations (`cellW = Math.floor(availableW / 20)`, `cellH = Math.floor(availableH / 14)`). Planetary surface tiles now expand dynamically (e.g. 66px x 52px per tile), filling 100% of the canvas area without empty black borders.
    * **Full-Width Telemetry HUD & Icon Scaling (`js/planet.js`)**: Expanded the top telemetry HUD banner across 100% of the canvas width (`hudW = canvas.width - 24`) and scaled HUD text (12px-16px) alongside surface icons (28px-40px for identified minerals, fauna, flora, ruins, lander `[H]`, and Rover `◎`) based on `UI.getFontScale()`.
44. **High-Contrast Deposit Icons, Scaled Text Badges & Unknown Resource Icons (v1.6.7)**:
    * **Traveled Area Contrast Fix (`js/planet.js`)**: Replaced dark green tile fill overlay on traveled territory with a clean high-contrast inner border outline (`rgba(0, 255, 102, 0.22)`). Kept tile background dark so all icons pop out with 100% clarity.
    * **Unknown Resource Icons**: Completely removed text symbols `*` and `&`. Replaced unknown minerals with glowing pickaxes **`⛏️ UNKNOWN`** (`#ffcc00`) and unknown bio specimens with glowing DNA strands **`🧬 UNKNOWN`** (`#00e5ff`).
    * **Scaled Text Badges**: Scaled up deposit badge text labels underneath identified items (`FLORA`, `FAUNA`, `IRON ORE`, `PLATINUM`, `GOLD`, `RUIN`) to **bold 12px–14px** with dark drop shadow outlines for crisp readability.
45. **Canvas Initial Load Resolution Sync, Icon-Only Tiles, Surface Legend Modal & Glowing Lander Direction Badge (v1.7.0)**:
    * **Initial Canvas Zoom Resolution Fix (`js/navigation.js` & `js/planet.js`)**: Added `resizeCanvas()` called automatically on game initialization and canvas rendering (`canvas.width = clientWidth`, `canvas.height = clientHeight`). Fixes the initial zoomed-in/blurry view when entering planet or hyperspace views on first load without requiring manual browser zooming.
    * **Icon-Only Surface Tiles (`js/planet.js`)**: Removed text labels underneath icons on planetary surface tiles. Tiles now feature clean, large, vibrant deposit icons (`🔋`, `🪙`, `💎`, `🧱`, `💠`, `🌱`, `👾`, `⛏️`, `🧬`, `📦`, `🏛️`, `[H]`) centered on each tile without text clutter.
    * **Interactive Surface Legend Modal (`index.html` & `js/ui.js`)**: Added `LEGEND` button in the top console header bar and an interactive **`PLANETARY SURFACE ICON LEGEND`** pop-up modal (`UI.openLegendModal()`) displaying descriptions for all deposit icons, ruins, and terrain markers.
    * **Large Glowing Lander Direction Badge (`js/planet.js`)**: Replaced inline text compass reading with a prominent **20px bold glowing direction symbol** (**`➡`**, **`↘`**, **`⬇`**, **`↙`**, **`⬅`**, **`↖`**, **`⬆`**, **`↗`**, **`🎯`**) in the telemetry HUD banner for instant lander orientation.
46. **Dynamic Viewport Tile Coverage Scaling (v1.7.1)**:
    * **Dynamic Tile Count (`js/planet.js`)**: Calculated `viewportW` and `viewportH` dynamically based on canvas dimensions (`viewportW = Math.floor(availableW / 48)`, `viewportH = Math.floor(availableH / 44)`). Expanding the browser window now reveals **more sectors and more of the planetary surface map** (e.g. 38x20 viewable sectors on 1080p widescreen displays vs 20x14 on smaller windows) without stretching or compressing surface tiles!
47. **500x500 Galaxy Map, 30+ Star Systems, Deep Space Nebulae & Quantum Wormholes (v1.8.0)**:
    * **500x500 Light-Year Galaxy Quadrant (`js/data.js` & `js/navigation.js`)**: Expanded the universe dimensions from 200x200 to a massive 500x500 light-year galaxy quadrant map centered at Starbase Prime `(250, 250)`. Updated Star Map canvas camera zoom, drag pan, and grid lines (every 25 LY).
    * **30+ Unique Star Systems & Planets (`js/data.js`)**: Added 30+ unique star systems (classes M, K, G, F, A, B, O) with 3 to 6 unique orbiting planets each (Volcanic, Desert, Oceanic, Ice World, Terran, Toxic, Gas Giant, Precursor Ruin World).
    * **Deep Space Nebulae (`js/data.js` & `js/navigation.js`)**: Added 8 interactive, colorful Nebulae (Tarantula Nebula, Crimson Cloud, Emerald Veil, Orion Expanse, Cygnus Rift, Phoenix Dust Field, Aquila Dark Veil, Precursor Core Mist) rendered with glowing gas clouds and radial gradient particle bursts.
    * **Quantum Wormhole Teleporters (`js/data.js` & `js/navigation.js`)**: Added 8 interactive Quantum Wormholes (`Wormhole Alpha-1/2`, `Beta-1/2`, `Gamma-1/2`, `Delta-1/2`) linking distant outer quadrants. Approaching a Wormhole displays `ENTER WORMHOLE [W]` and teleports the ship across hundreds of light-years.
48. **Landing State Sanitization**: `ship.currentPlanet` is explicitly cleared to `null` whenever entering Hyperspace or docking at base to prevent persistent landing state bugs upon page reload.
49. **Deep Space Features: Asteroid Mining, Derelict Stations, Black Holes & Distress Signals (v1.9.0)**:
    * **Asteroid Mining (`js/data.js` & `js/navigation.js`)**: Added interactive asteroid fields (`GameData.asteroidFields`). Firing lasers `[F]` or missiles `[V]` breaks space rocks into floating mineral ore chunks (`⛏️ ENDURIUM ORE`, `💎 PLATINUM`, `🧱 TITANIUM`, `🪙 GOLD`). Flying close to chunks automatically scoops them into cargo via tractor beam.
    * **Derelict Precursor Stations (`js/data.js`, `js/navigation.js` & `js/ui.js`)**: Added 6 ancient derelict space stations and abandoned starships (`Derelict Station Kronos-9`, `Precursor Quantum Relay`, `Ghost Vessel Vanguard`, etc.). Approaching displays `BOARD DERELICT STATION [B]`, opening a scavenging modal (`UI.openDerelictModal()`) to recover Endurium fuel, precursor artifacts, credits, and tech modules.
    * **Supermassive Black Holes (`js/data.js` & `js/navigation.js`)**: Added 3 Singularity Black Holes (`Cygnus Singularity`, `Abyssal Gate Void`, `Precursor Singularity`) featuring distorted gravitational fields `🕳️`. Within gravity range, continuous inward pull drags the ship toward the core. Entering the event horizon teleports the vessel across distant light-years!
    * **Subspace Distress Signals (`js/data.js`, `js/navigation.js` & `js/ui.js`)**: Added random distress beacons `📡`. Approaching displays `INVESTIGATE SIGNAL [E]`, opening a choice dialog (`UI.openDistressModal()`) to transfer Endurium to stranded traders for credit bounties, salvage survey probes, or rescue cryo-pod crew members.
50. **Rare Wrecked Alien Ships & Precursor Tech Parts Recovery (v1.9.5)**:
    * **Rare Tech Components (`js/data.js` & `js/ui.js`)**: Defined rare functional ship upgrade modules (`Precursor Warp Conduit` ⚡, `Quantum Shield Matrix Core` 🛡️, `Titanium Composite Armor` 🧱, `Plasma Blaster Overcharger` 🔫, `Subspace Cargo Compressor` 📦).
    * **Planetary Surface Wrecks & Tech Vaults (`js/planet.js`)**: Generated rare Alien Ship Wrecks (`🛸`) and Tech Vaults (`🏛️`) on ~18% of planet surfaces. Inspecting a wreck opens `UI.openTechPartModal()`.
    * **Deep Space Alien Debris (`js/data.js` & `js/navigation.js`)**: Added 5 drifting Alien Space Wrecks (`🛸`) across outer space. Approaching displays `SALVAGE ALIEN WRECK [B]`.
    * **Instant Ship Installation or Cargo Cash-In (`js/ui.js`)**: Players can choose to **INSTALL IMMEDIATELY** to permanently boost Engine Speed, Max Shields (+30), Max Hull (+25), Blaster Level (+15 DMG), or Cargo Capacity (+15 slots), or store the module in cargo to sell for 2,500 M.U. at Starbase Prime!
51. **Button Listener Delegation & Dispatch Jump Fix (v1.9.6)**:
    * **Initialize Dispatch Jump (`js/game.js`)**: Fixed `startGameBtn` on intro screen. Added auto-assigning starter Captain & Navigator so game launch is never blocked. Wrapped audio and view transitions in error handlers.
    * **Spaceport Launch Alias (`js/spaceport.js`)**: Added `Spaceport.launchVessel()` alias to match `Spaceport.launchShip()`. Auto-assigns starter Captain & Navigator if unassigned so launching from Starbase is always smooth.
    * **Control Bar Buttons (`js/ui.js` & `js/navigation.js`)**: Fixed button delegation for `TOGGLE SHIELDS [K]`, `WEAPONS READY [F]`, and `LAND VEHICLE [L] / DOCK AT STARBASE` to delegate directly to `GameManager` and handle all landing/docking/space-wreck states. Added fallback delegators to `Navigation`.
52. **Title Screen Direct Space Launch & Hardened Web Audio Launch (v1.9.7)**:
    * **Direct Space Launch Button (`index.html` & `js/game.js`)**: Updated `INITIALIZE DISPATCH JUMP (LAUNCH INTO SPACE)` 🚀 to launch directly into space flight at Starbase Prime `(250, 250)`. Added a dedicated `ENTER STARPORT FACILITY` 🏢 button to access ship upgrades and personnel.
    * **Hardened Audio Launch (`js/spaceport.js`)**: Wrapped Web Audio API calls during `Spaceport.launchShip()` in safe error handlers to prevent suspended AudioContext states from hanging the launch sequence in Chrome/Edge browsers.
53. **Duplicate `enterSpacebase()` Shadowing & Restored Docking Services (v1.9.9)**:
    * **Root Cause Solved**: `Navigation.enterSpacebase()` was declared **twice** inside the same object literal — the full docking routine at the top of the file and a thin delegator added near the bottom. In JavaScript the later duplicate key silently wins, so every dock ran the stub: hull damage was never repaired, injured crew were never treated, and shields/weapons were never stood down. Removed the shadowing duplicate and left an inline warning comment in its place.
    * **Restored Docking Services**: Docking at Starbase Prime again repairs the hull to `maxHull` and restores all crew to full HP with the `MEDICAL INFIRMARY: ALL CREW MEMBERS TREATED AND RESTORED TO 100% HEALTH.` transmission.
    * **Safety Protocol Lockout Applied on Arrival (`js/navigation.js`)**: Added the missing `UI.updateControlPanel(false, null, false, false)` call so `SHIELDS LOCKED [K]` and `WEAPONS LOCKED [F]` engage immediately on docking (previously the buttons kept their in-flight labels until another refresh).
    * **Landing State Sanitization**: `ship.currentSystem` and `ship.currentPlanet` are now explicitly cleared on docking so a page reload can never resume a stale surface exploration session.
54. **CRITICAL: Unclosed `wormholes` Array Broke The Entire Game (v1.9.9)**:
    * **Root Cause Solved**: The `GameData.wormholes` array in `js/data.js` was never closed — the `Wormhole Delta-1` / `Delta-2` pair and the terminating `],` had been lost in an edit, so the parser hit `blackHoles:` while still inside the array literal and threw `SyntaxError: Unexpected token ':'` at line 189. **`data.js` therefore never executed and `window.GameData` was never defined**, taking down every downstream system: `Spaceport.init()` aborted, `Navigation.update()` threw on `GameData.upgrades.engines` every single frame (so `Navigation.draw()` was never reached and the hyperspace viewport stayed **completely black**), and `drawStarMapCanvas()` failed, leaving the **`STAR MAP [M]` button dead**. The failure was masked because `GameManager.tick()` silently swallows per-frame exceptions.
    * **Fix**: Closed the array and restored the missing `Wormhole Delta-1` (50, 250) ↔ `Wormhole Delta-2` (450, 250) east-west pair, bringing the count back to the 8 wormholes documented in §47.
    * **Diagnostic Reminder**: `GameManager.init()` writes any subsystem boot failure into `document.title` as `INIT ERRORS: ...`. A browser tab reading `INIT ERRORS: Spaceport.init: GameData is not defined` is the fastest signal that `js/data.js` failed to parse. Run `node --check js/*.js` before shipping any `data.js` edit.
55. **Key Binding Conflicts, Persistent Salvage Ledger & Reset Regression (v1.9.10)**:
    * **`[K]` / `[F]` Double-Duty Removed (`js/navigation.js` & `js/game.js`)**: `[K]` fired **both** `GameManager.toggleShields()` and `UI.openLegendModal()`, and `[F]` fired **both** `GameManager.toggleWeapons()` and `Navigation.firePlayerBlaster()`. `[K]` is now shields only, `[F]` is fire blasters only. The surface icon Legend opens from its header button, and arming weapons is done from the `ARM WEAPONS` control button or automatically at launch via `ship.launchConfig.autoWeapons`. Weapon button labels no longer advertise `[F]`.
    * **Persistent Salvage Ledger (`js/game.js`, `js/navigation.js`, `js/ui.js`)**: Looted derelicts, alien wrecks and distress beacons set `searched` / `active` flags directly on `GameData`, which is **never saved**, so every page reload refilled every site — unlimited credits, artifacts and rare tech modules. Added `ship.salvagedIds` (persisted with the save), `GameManager.markSalvaged(id)` at every loot site, and `GameManager.applySalvageState()` which rehydrates the `GameData` flags after load, import and reset. Saves from before this version simply start with an empty ledger.
    * **Reset Regression Fixed (`js/game.js`)**: `resetGame()` rebuilt `ship` without `launchConfig`, `discoveredSystems`, `exploredSectors`, `encounterHistory` or `exploredPlanets`. Because `Spaceport.launchShip()` reads `ship.launchConfig.autoShields` unguarded, **NEW GAME followed by LAUNCH VESSEL threw a TypeError**. All default keys are now restored on reset.
56. **Rover Cargo Never Reached The Ship Hold (v1.9.11)**:
    * **Root Cause Solved**: The two large buttons on the cargo transfer modal, **`UNLOAD & CONTINUE EXPLORING`** and **`UNLOAD & ASCEND TO ORBIT`**, called `confirmTransferAndStay()` / `confirmTransferAndAscend()`, which only closed the modal, logged `UNLOAD COMPLETED` and saved. **Neither function moved a single item.** The function that actually performs the transfer, `transferAllFittingToShip()`, was wired only to the small `TRANSFER ALL (FIT)` button. Players unloaded at the Lander, saw a success message, and silently kept everything in the Rover bed - and ascending to orbit carried the samples back up unbanked.
    * **Fix**: Extracted `PlanetExploration.moveFittingCargoToShip()` returning `{ moved, left }`, and both `UNLOAD` buttons now call it before closing. Logs report exactly how many samples moved and how many did not fit.
    * **No More Silent Refusals**: `transferItemToShip()` previously did nothing at all when an item did not fit - no beep, no message. It now reports the exact shortfall (`TRANSFER BLOCKED: GOLD NUGGETS NEEDS 3 T BUT ONLY 0.0 T OF HOLD REMAINS.`). `transferAllOfKeyToShip()` and `transferAllFittingToShip()` now report moved / remaining counts too.
57. **Star Map Zoom, Pan & Hover Tooltips Restored + Missile Ammo Field (v1.9.12)**:
    * **`Navigation.drawStarMap()` Never Existed (`js/navigation.js`)**: The mouse-wheel zoom and click-drag pan handlers both called `this.drawStarMap()`, but the real method is `drawStarMapCanvas()`. Every wheel scroll and every drag threw `TypeError: this.drawStarMap is not a function`, so the map never redrew. Corrected both call sites.
    * **Zoomed-In First Open**: `openStarMapModal()` called `drawStarMapCanvas()` **before** removing the `hidden` class. Because `.modal.hidden` is `display: none !important`, the canvas container reported `clientWidth/clientHeight` of 0, the resize guard was skipped, and the canvas kept its default **300x150** backing store which CSS then stretched across the full screen - a hugely magnified, blurry map. The modal is now unhidden first, then drawn. NOTE: this bug was previously masked by the duplicate control-bar button binding (see entry 54) which called `openStarMapModal()` twice; the second call redrew while visible and accidentally corrected the size.
    * **Hover Inspection Tooltips Implemented**: `drawStarMapCanvas()` populates `this.mapTargets[]` with `{type, x, y, radius, title, details}` for all 40 markers, and both `#starmap-tooltip` and its `.starmap-tooltip` CSS existed - but **no code ever read them**. Added `findStarMapTargetAt()`, `updateStarMapTooltip()` and `hideStarMapTooltip()`, wired to `mousemove` / `mouseleave` on the star map canvas. Mouse coordinates are scaled from CSS pixels into the canvas backing store, and the tooltip flips away from the right/bottom edges. Hit-testing prefers the **smallest** matching marker so a point icon wins over a large nebula cloud drawn around the same coordinates (Precursor Core Mist sits directly on Starbase Prime).
    * **Homing Missiles Were Unfirable (`js/navigation.js`)**: `firePlayerMissile()` read and decremented `ship.missiles`, but every other subsystem - initial state in `game.js`, purchase in `spaceport.js`, the sidebar in `ui.js`, and tactical combat in `encounter.js` - uses `ship.missilesAmmo`. `[V]` therefore always reported "Out of homing missiles" regardless of ammo purchased, making missile ammo a pure waste of credits. Renamed to `ship.missilesAmmo` in all 3 places.
58. **Star Map Readouts Gated By Detection & Anchored To The Marker (v1.9.13)**:
    * **Fog Of War Applied To Hover Readouts (`js/navigation.js`)**: Nebulae, wormholes, black holes, derelicts, alien wrecks and distress beacons were pushed into `mapTargets` unconditionally, so hovering any of them revealed full intel on space the player had never visited. Added `Navigation.isMapSectorKnown(x, y)`, which reuses the exact fog-of-war rule the star systems already apply (the 25 LY `ship.exploredSectors` bucket, or the charted home region within 40 LY of Starbase Prime). Every one of the 11 `mapTargets.push()` sites now declares a `known` flag, and `findStarMapTargetAt()` skips undetected contacts entirely. Star systems (only drawn once discovered), the player's own logged encounters, live alien radar contacts and the flagship itself are always `known`.
    * **Anchored, Non-Following Readout**: The tooltip previously tracked the cursor on every `mousemove`. It is now anchored beside the marker itself, converting canvas pixels back to CSS pixels, and only re-renders when the hovered contact actually **changes** (tracked via `this.hoveredTargetKey`), so it holds still while the mouse moves within the same icon. It still flips away from the right and bottom edges.
    * **Reliable Dismissal**: The readout clears when the cursor moves off the marker, on `mouseleave`, and on **every redraw** (open, wheel zoom, drag pan, zoom buttons, center, reset) since any redraw invalidates the anchor position.
    * **Note On Overlapping Markers**: A detected marker overlapping an undetected one still shows its own readout, which is correct - no undetected contact ever names itself.
59. **Two-Tier Sensor System & Deep Space Interaction Prompt (v1.9.14)**:
    * **Deep Space Boarding Was Unreachable (`js/navigation.js`)**: The v1.9.5 salvage system worked, but no player could find it. Proximity detection correctly set `nearbySpaceWreck` / `nearbyDerelict` / `nearbyDistressSignal` / `nearbyWormhole`, yet the on-screen prompt was written to **`UI.elements.btnEnterSystem` - an element that has never existed** in `UI.elements` (referenced 11 times, defined nowhere). The `LAND` control therefore stayed `LAND VEHICLE [L]` and **disabled**, leaving the entire feature reachable only through undocumented `[B]` / `[E]` / `[W]` keypresses. Additionally, a first fix attempt failed because the later `nearStarbase / nearSystem / nearbyAlien` chain re-disables `btnLand` every frame in its trailing `else`; the prompt now lives **inside** that chain, ranked directly beneath docking.
    * **Short Range Scan `[S]`**: Fully identifies and logs every contact within sensor range - name, type, coordinates, bearing and distance.
    * **Long Range Sweep `[SHIFT+S]` / `LONG RANGE SWEEP` button**: Registers distant objects as **unidentified contacts only**. You learn something is out there, not what it is. Carries a 6 second recharge shown live on the button (`SENSORS RECHARGING 4.2s`).
    * **Range Formula**: `base x scannerMult x (1 + navSkill/100)`, where `scannerMult` runs 1.00 to 2.00 across the four Depot Scanner classes. A rookie (nav 65, Standard Scanner) reaches **41 LY short / 116 LY long**; an expert (nav 95, Mineral Resonance Scan) reaches **97 LY / 273 LY**. This finally gives the Scanner upgrades a real purpose.
    * **Three Visibility Tiers On The Star Map**: `ship.contactLog` (persisted) records each contact as tier 1 or 2. **Tier 0** - never detected: not drawn at all. **Tier 1** - long range return: a dim grey dashed `?` blip with no icon and no name, whose readout refuses to classify it. **Tier 2** - short range identified: full icon, name and details. Flying within 4 LY of an object, or through its 25 LY sector, also identifies it outright.
    * **New Control**: added the `LONG RANGE SWEEP` button to the control bar rather than leaving the sweep on a keyboard-only binding - the exact mistake that hid the boarding feature for four releases.
60. **Solar System Orbital Layout & Context-Aware Cargo Control (v1.9.15)**:
    * **Every Planet Started At The Same Angle (`js/navigation.js`)**: No planet in `js/data.js` carries a starting `orbitAngle` - there are **zero** occurrences in the file - so `planet.orbitAngle = (planet.orbitAngle || 0) + speed * dt` began every planet at angle 0, which is **dead right of its star**. Entire systems spawned as a straight horizontal line, and because orbital speeds are tiny (0.003-0.02 rad/s, a full orbit taking 5-35 minutes) they stayed that way for the whole session. Added `Navigation.ensureOrbitAngles(system)`, seeding a stable phase per planet from a hash of `system|planet|index`, so every system has a believable scattered layout that is still **identical on every visit**. Verified across all 29 systems / 78 planets: 0 aligned systems, 0 planets left at 0°.
    * **Outer Planets Were Unreachable**: orbit radii used a hardcoded `planet.radius * 1.6` that ignored canvas size. With a 186px system boundary, `Titanis` orbited at **256px** - beyond the auto-exit radius, so flying out to it dumped the player back into hyperspace, and once the planets were spread it also rendered off screen entirely. Added `Navigation.getOrbitScale(system)`, which scales each system so its outermost planet sits at 82% of the boundary. All 78 planets are now reachable and on screen.
    * **TV Cargo Button Opened The Wrong Hold (`js/ui.js`)**: `[I]` is context-aware - Rover cargo bed on a planet surface, ship hold everywhere else - but the `CARGO LOG [I]` **button** always called `UI.openCargoModal()`. On the surface it therefore opened the (usually empty) ship manifest instead of the Rover bed, which read as the button being broken. The button now mirrors the key exactly, and its label switches to `TV CARGO BED [I]` while landed.
61. **Deflector Shields Had No Recovery Path At All (v1.9.16)**:
    * **Root Cause Solved**: `ship.shieldsCharge` was written in only four places - buying a shield upgrade, installing the Quantum Shield Matrix Core, an old-save migration, and `Spaceport.launchShip()` when `AUTO-RAISE SHIELDS` is enabled. **Nothing regenerated it and docking did not restore it.** Raised shields drain at `2 * (1 - doctorSkill/200)` per second, so with no Doctor aboard a full 100-point matrix emptied in about **62 seconds** and then sat at 0 permanently. A captain who launched via the title screen `DISPATCH JUMP` (which never touches `shieldsCharge`) or who launched with auto-shields off had no way back to a charged shield short of buying a new module.
    * **Passive Recharge (`js/game.js`)**: added `GameManager.updateShieldRegen(dt)`, called from `tick()` so it applies in flight, on a planet surface and mid-encounter alike. Capacitors trickle-charge **only while the shields are lowered** - raised shields still drain, preserving the tactical trade-off. The rate is a fraction of capacity, `maxShields * (0.008 + engineerSkill/12000)` per second, so larger shield classes do not take proportionally longer, and an Engineer on the crew speeds it up. Measured: **1.05/sec** with no Engineer (~95s from empty to full) versus **1.26/sec** with an Engineer at skill 55 (~79s), against a **1.6/sec** drain while raised.
    * **Docking Recharges (`js/navigation.js`)**: `Navigation.enterSpacebase()` repaired the hull and treated the crew but silently ignored the shields. It now tops the capacitors back to `maxShields`, which finally makes the on-screen advice true.
    * **Honest Messaging (`js/game.js`)**: the old refusal read `"Charge is at 0%. Let shields charge at base."` - advice that did not work. It now reads `"SHIELDS FAILED: CAPACITORS AT 0%. THEY RECHARGE SLOWLY WHILE LOWERED, OR INSTANTLY WHEN YOU DOCK AT STARBASE PRIME."`
    * **Crew Panel Hardening (`js/ui.js`)**: `updateCrew()` read `member.race.substring(0,3)` unguarded. A crew member lacking `race` threw and **aborted whatever called it midway** - surfaced during testing as a dock that set the hull and shields but never switched view or rendered the Starport. Both `name` and `race` now fall back safely.

---

## 7. Verification & Testing Instructions

To verify game features locally:
1. Open `index.html` in any web browser.
2. Click **INITIALIZE DISPATCH JUMP** to enter Starbase Prime Spaceport.
3. Click **LAUNCH VESSEL** to enter Hyperspace.
4. Fly around in space using `W`, `A`, `S`, `D`. Approach Starbase Prime (`100, 100`) and press `[L]` to dock, or fly to Sirius Sector (`120, 85`) and press `[Enter]` to enter the solar system.
5. Orbit a planet and press `[L]` to land. On the surface, harvest minerals (`*`), press `[I]` to inspect TV cargo, drive to Lander (`[H]`), press `[U]` to unload without launching, or press `[L]` to ascend back to orbit.
6. Test Export & Import save files on the title screen.
