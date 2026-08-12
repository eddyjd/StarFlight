# Implementation Plan - Full-Browser Layout, Command Manual, Larger Planet Surface & Top-Down Surface Landing Map

This update introduces four major user enhancements:
1. **100% Full-Browser Window Layout**: Expand the game container (`.crt-screen` / `.dashboard`) to utilize **100vw x 100vh** (100% of available browser width & height), filling the screen completely with fluid responsive canvas viewports.
2. **Interactive Help / Command Manual Modal**: Add a header button (`HELP [?]` / `[?]` key) opening a comprehensive **SHIP COMMANDER MANUAL** covering controls, navigation, planetary mining, space combat, barter trading, and mission objectives.
3. **Enlarged Planet Surface Viewport**: Scale up surface cell dimensions (`cellW: 42px`, `cellH: 36px`, 24px font icons) so terrain tiles, mountains `▲`, resource deposits (`🔋`, `🪙`, `💎`, `🧱`), and the Rover `◎` render significantly larger, bolder, and more vibrant.
4. **Realistic Top-Down Planetary Surface Selection Map**: Upgrade `#landingSiteCanvas` in the landing picker modal to render a top-down planetary surface map preview with terrain elevation colors, mountain ridges, mineral density hotspots, and golden Lander markers `[H]`.

---

## User Review Required

> [!IMPORTANT]
> - **Full-Browser Window Experience**: The game frame will dynamically expand to `100vw x 100vh`, removing border padding and allowing all flight canvases, starmaps, and planet surface views to use the maximum possible screen area.
> - **Help Manual Access**: Pressing `[?]` or clicking `HELP [?]` in the top header opens the interactive manual at any point during gameplay.

---

## Proposed Changes

### Layout & CSS Design

#### [MODIFY] [css/style.css](file:///c:/Users/edutrisac/OneDrive%20-%20CORPSERVICES/Documents/Antigravity/StarFlight/css/style.css)
- Change `.crt-screen` and `.dashboard` dimensions to `width: 100vw; height: 100vh; max-width: 100vw; max-height: 100vh; border-radius: 0; border: none;` for full-screen view.
- Update `.main-display` and `#gameCanvas` flex sizing to fill maximum window height.
- Add styling for the interactive **Help Command Manual Modal** (`#help-modal`).

---

### User Interface & Manual

#### [MODIFY] [index.html](file:///c:/Users/edutrisac/OneDrive%20-%20CORPSERVICES/Documents/Antigravity/StarFlight/index.html)
- Add `HELP [?]` button in console header bar.
- Add `#help-modal` HTML container with tabbed sections for Flight Controls, Planetary Mining, Tactical Combat, Trading, and Objectives.

#### [MODIFY] [js/ui.js](file:///c:/Users/edutrisac/OneDrive%20-%20CORPSERVICES/Documents/Antigravity/StarFlight/js/ui.js)
- Add `UI.openHelpModal()` and `UI.closeHelpModal()`.
- Add `?` key listener to toggle the Help Manual.
- Update `updateScreenScale()` to auto-resize canvas viewports dynamically to full window width & height.

---

### Planet Surface & Top-Down Landing Map

#### [MODIFY] [js/planet.js](file:///c:/Users/edutrisac/OneDrive%20-%20CORPSERVICES/Documents/Antigravity/StarFlight/js/planet.js)
- **Larger Surface Viewport**: Increase cell dimensions (`cellW: 42`, `cellH: 36`) and text font sizes (20px-24px icons for minerals, fauna, flora, ruins, lander `[H]`, and rover `◎`).
- **Realistic Top-Down Planetary Surface Selection Map**: Update `drawLandingSiteCanvas()` to render:
  - Topographic surface terrain colors (rocky crags, frozen ice plains, volcanic soil, lush biomes).
  - Mountain range peaks `▲`.
  - Resource density heatmap overlays (`*`).
  - Lander sites `[H]`.

---

## Verification Plan

### Automated / Manual Verification
1. **Full-Browser Window Verification**:
   - Open application in browser; verify that the game dashboard occupies 100% of window width and height with no wasted space.
2. **Help / Manual Verification**:
   - Click `HELP [?]` or press `[?]`; verify the Commander Manual opens cleanly with interactive tabs and control guides.
3. **Enlarged Surface View Verification**:
   - Land on a planet; verify that terrain tiles, rover, lander, and deposit icons render much larger and clearer.
4. **Top-Down Surface Landing Map Verification**:
   - Press `[L]` to launch lander; verify `#landingSiteCanvas` shows a rich planetary surface map with mountains, resource hotspots, and descent targets.
