/**
 * Space Navigation Controller for StarFlight: Odyssey
 * Implements 2D Canvas space flight, inertia physics, Hyperspace map,
 * Solar systems, orbiting planets, and docking detection.
 */

const Navigation = {
  canvas: null,
  ctx: null,
  keys: {},

  // Physics state (500x500 Galaxy Quadrant Map)
  shipX: 250.0,
  shipY: 250.0,
  shipVx: 0,
  shipVy: 0,
  shipAngle: -Math.PI / 2, // facing up
  
  // Starfield backdrop
  bgStars: [],
  nebulae: [],
  
  // Radar sonar sweep
  sonarRadius: 0,
  sonarActive: false,
  longScanCooldown: 0,

  // Active Alien Spacecraft flying in space
  alienShips: [
    { raceKey: "spemin", name: "Spemin Scout", x: 125.0, y: 165.0, vx: 0.8, vy: 0.5, angle: 0, color: "#00ff66" },
    { raceKey: "veloxi", name: "Veloxi Cruiser", x: 375.0, y: 265.0, vx: -0.6, vy: 0.7, angle: Math.PI / 4, color: "#ff5533" },
    { raceKey: "uhlek", name: "Uhlek Interceptor", x: 435.0, y: 415.0, vx: 0.3, vy: -0.8, angle: Math.PI, color: "#ff3333" }
  ],
  nearbyAlien: null,
  nearbyWormhole: null,

  // Starmap Zoom & Pan State
  mapZoom: 1.0,
  mapOffsetX: 0,
  mapOffsetY: 0,
  isDraggingMap: false,
  dragStartX: 0,
  dragStartY: 0,

  init() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    
    this.resizeCanvas();
    this.generateBackground();
    this.setupListeners();
  },

  resizeCanvas() {
    if (!this.canvas || !this.canvas.parentElement) return;
    const w = this.canvas.parentElement.clientWidth;
    const h = this.canvas.parentElement.clientHeight - 24;
    if (w > 100 && h > 100 && (this.canvas.width !== w || this.canvas.height !== h)) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.generateBackground();
    }
  },

  setupListeners() {
    // Keyboard inputs - track both e.key and e.code for smooth continuous holding
    window.addEventListener("keydown", (e) => {
      this.keys[e.key] = true;
      if (e.code) this.keys[e.code] = true;
      
      // Action Key Shortcuts
      if (e.key === "?" || e.key === "/") {
        UI.openHelpModal();
      }
      if (e.key === "g" || e.key === "G") {
        UI.openCaptainsLogModal();
      }
      // NOTE: [K] is reserved for TOGGLE SHIELDS (routed via GameManager). The surface
      // icon legend opens from its LEGEND header button - do not bind it to a gameplay key.
      if (e.key === "w" || e.key === "W") {
        if (this.nearbyWormhole) {
          this.enterNearbyWormhole();
        }
      }
      if ((e.key === "s" || e.key === "S") && e.shiftKey) {
        e.preventDefault();
        this.triggerLongRangeScan();
      }
      if (e.key === "b" || e.key === "B") {
        if (this.nearbySpaceWreck) {
          this.salvageSpaceWreck();
        } else if (this.nearbyDerelict) {
          this.boardNearbyDerelict();
        }
      }
      if (e.key === "e" || e.key === "E") {
        if (this.nearbyDistressSignal) {
          this.investigateDistressSignal();
        }
      }
      if (e.key === "f" || e.key === "F") {
        this.firePlayerBlaster();
      }
      if (e.key === "v" || e.key === "V") {
        this.firePlayerMissile();
      }

      // Prevent browser scrolling on arrow keys and space
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Space"].includes(e.key) || ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.key] = false;
      if (e.code) this.keys[e.code] = false;
    });

    // Reset keys when window loses focus to prevent stuck keys
    window.addEventListener("blur", () => {
      this.keys = {};
    });

    // Starmap Canvas Mouse Wheel Zoom & Drag Pan Listeners
    const starmapCanvas = document.getElementById("starmapCanvas");
    if (starmapCanvas) {
      starmapCanvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
        this.mapZoom = Math.max(0.4, Math.min(4.0, this.mapZoom * zoomFactor));
        this.drawStarMapCanvas();
      });

      starmapCanvas.addEventListener("mousedown", (e) => {
        this.isDraggingMap = true;
        this.dragStartX = e.clientX - this.mapOffsetX;
        this.dragStartY = e.clientY - this.mapOffsetY;
        this.hideStarMapTooltip();
      });

      window.addEventListener("mousemove", (e) => {
        if (this.isDraggingMap) {
          this.mapOffsetX = e.clientX - this.dragStartX;
          this.mapOffsetY = e.clientY - this.dragStartY;
          this.drawStarMapCanvas();
        }
      });

      // Hover inspection: hit-test the markers collected by drawStarMapCanvas()
      starmapCanvas.addEventListener("mousemove", (e) => {
        if (this.isDraggingMap) return;
        this.updateStarMapTooltip(e);
      });

      starmapCanvas.addEventListener("mouseleave", () => this.hideStarMapTooltip());

      window.addEventListener("mouseup", () => {
        this.isDraggingMap = false;
      });
    }
  },

  // Records a wormhole or singularity the ship has actually passed through.
  markLinkTraversed(id) {
    const ship = window.game && window.game.ship;
    if (!ship || !id) return;
    if (!ship.traversedLinks) ship.traversedLinks = {};
    if (!ship.traversedLinks[id]) {
      ship.traversedLinks[id] = true;
      UI.addLog("NAV-COMPUTER: EXIT VECTOR PLOTTED AND SAVED TO STAR MAP.");
      window.game.saveGame();
    }
  },

  // Star map layer visibility. Defaults to visible for any unknown layer so a new
  // layer never silently disappears for players with an older save.
  getMapLayers() {
    const ship = window.game && window.game.ship;
    if (!ship) return {};
    if (!ship.mapLayers) {
      ship.mapLayers = { systems: true, anomalies: true, salvage: true, aliens: true, nebulae: true, unknown: true };
    }
    return ship.mapLayers;
  },

  isLayerOn(name) {
    const layers = this.getMapLayers();
    return layers[name] !== false;
  },

  toggleMapLayer(name) {
    const layers = this.getMapLayers();
    layers[name] = layers[name] === false;
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
    this.refreshMapLayerButtons();
    this.drawStarMapCanvas();
    if (window.game && window.game.saveGame) window.game.saveGame();
  },

  refreshMapLayerButtons() {
    const defs = [
      ["systems", "systems"], ["anomalies", "anomalies"], ["salvage", "salvage"],
      ["aliens", "aliens"], ["nebulae", "nebulae"], ["unknown", "unknown"]
    ];
    defs.forEach(([key]) => {
      const btn = document.getElementById("layer-" + key);
      if (!btn) return;
      const on = this.isLayerOn(key);
      btn.classList.toggle("green-glow", on);
      btn.style.opacity = on ? "1" : "0.42";
      btn.style.textDecoration = on ? "none" : "line-through";
    });
  },

  // Dashed route lines for every rift the ship has actually been through. Drawn
  // beneath the markers so icons stay readable on top.
  drawTraversedLinks(ctx, toCanvasX, toCanvasY, zScale) {
    const ship = window.game && window.game.ship;
    if (!ship || !ship.traversedLinks) return;
    if (!this.isLayerOn("anomalies")) return;

    const links = [];
    if (GameData.wormholes) {
      GameData.wormholes.forEach(wh => {
        if (ship.traversedLinks[wh.id]) {
          links.push({ x: wh.x, y: wh.y, tx: wh.targetX, ty: wh.targetY, color: "#00e5ff", label: "RIFT EXIT" });
        }
      });
    }
    if (GameData.blackHoles) {
      GameData.blackHoles.forEach(bh => {
        if (ship.traversedLinks[bh.id]) {
          links.push({ x: bh.x, y: bh.y, tx: bh.destX, ty: bh.destY, color: "#b46bff", label: "DISPLACEMENT" });
        }
      });
    }
    if (!links.length) return;

    ctx.save();
    links.forEach(l => {
      const x1 = toCanvasX(l.x), y1 = toCanvasY(l.y);
      const x2 = toCanvasX(l.tx), y2 = toCanvasY(l.ty);

      ctx.strokeStyle = l.color;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = Math.max(1, 1.4 * zScale);
      ctx.setLineDash([7 * zScale, 5 * zScale]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrow head at the exit end
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const head = Math.max(6, 8 * zScale);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = l.color;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - head * Math.cos(ang - 0.4), y2 - head * Math.sin(ang - 0.4));
      ctx.lineTo(x2 - head * Math.cos(ang + 0.4), y2 - head * Math.sin(ang + 0.4));
      ctx.closePath();
      ctx.fill();

      // Exit marker ring
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = l.color;
      ctx.lineWidth = Math.max(1, 1.2 * zScale);
      ctx.beginPath();
      ctx.arc(x2, y2, Math.max(4, 5 * zScale), 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 0.8;
      ctx.fillStyle = l.color;
      ctx.font = `${Math.max(8, Math.round(9 * zScale))}px Share Tech Mono`;
      ctx.fillText(l.label, x2 + 8 * zScale, y2 - 6 * zScale);
    });
    ctx.restore();
  },

  // Orbit radii in GameData are abstract units. The old fixed x1.6 scale ignored
  // the canvas size, so outer planets orbited beyond the system boundary - e.g.
  // Titanis at 256px with a 186px boundary - making them unreachable, because
  // flying out there auto-exits to hyperspace, and often off screen too. Scale each
  // system so its outermost planet sits comfortably inside the boundary.
  getOrbitScale(system) {
    const starX = this.canvas ? this.canvas.width / 2 : 480;
    const starY = this.canvas ? this.canvas.height / 2 : 240;
    const systemRadius = Math.min(starX, starY) * 0.92;
    let maxOrbit = 0;
    if (system && system.planets) {
      system.planets.forEach(pl => { if (pl.radius > maxOrbit) maxOrbit = pl.radius; });
    }
    if (!maxOrbit) return 1.6;
    return Math.min(1.6, (systemRadius * 0.82) / maxOrbit);
  },

  // No planet in GameData carries a starting orbital phase, so the old
  // `planet.orbitAngle || 0` placed every planet at angle 0 - which is dead right
  // of its star. Whole systems therefore spawned as a straight horizontal line,
  // and because orbit speeds are tiny (0.003-0.02 rad/s) they stayed that way.
  // Seed a stable phase per planet so each system has a believable layout that is
  // still identical every time you visit it.
  ensureOrbitAngles(system) {
    if (!system || !system.planets) return;
    system.planets.forEach((planet, idx) => {
      if (typeof planet.orbitAngle === "number" && !isNaN(planet.orbitAngle)) return;
      const key = `${system.name || "sys"}|${planet.name || "planet"}|${idx}`;
      let hash = 0;
      for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
      planet.orbitAngle = ((Math.abs(hash) % 36000) / 36000) * Math.PI * 2;
    });
  },

  // Sensor reach. Range scales with the assigned Navigator's skill and with the
  // Scanner module fitted at the Depot, so both upgrade paths stack:
  //   nav 65 + scanner 1  ->  short  41 LY | long 116 LY
  //   nav 95 + scanner 4  ->  short  97 LY | long 273 LY
  getScanRanges() {
    const ship = (window.game && window.game.ship) || {};
    const nav = (ship.crew && ship.crew.navigator) ? ship.crew.navigator.skill : 30;
    const lvl = Math.max(1, Math.min(4, ship.scannerLevel || 1));
    const scannerMult = 1 + (lvl - 1) / 3; // 1.00, 1.33, 1.67, 2.00
    const navBonus = 1 + nav / 100;
    return {
      short: 25 * scannerMult * navBonus,
      long: 70 * scannerMult * navBonus,
      navSkill: nav,
      scannerLevel: lvl
    };
  },

  // Every scannable deep space object, flattened with a stable id.
  getDeepSpaceContacts() {
    const D = GameData, out = [];
    const add = (arr, label) => {
      if (!arr) return;
      arr.forEach(o => out.push({ id: o.id, x: o.x, y: o.y, name: o.name, label: label, obj: o }));
    };
    add(D.derelicts, "DERELICT STATION");
    add(D.spaceWrecks, "ALIEN WRECK");
    add(D.distressSignals, "DISTRESS BEACON");
    add(D.wormholes, "QUANTUM WORMHOLE");
    add(D.blackHoles, "GRAVITATIONAL SINGULARITY");
    add(D.nebulae, "NEBULA FIELD");
    return out;
  },

  // Identification tier for a deep space contact:
  //   0 = never picked up      -> not drawn on the star map at all
  //   1 = long range contact   -> dim grey unlabelled blip
  //   2 = short range identify -> full icon, name and readout
  getContactTier(id, x, y) {
    const ship = window.game && window.game.ship;
    if (!ship) return 0;
    if (this.isMapSectorKnown(x, y)) return 2; // flew straight through it
    return (ship.contactLog && ship.contactLog[id]) || 0;
  },

  // Tier 1 render: a long range sweep tells you something is out there and nothing
  // else. Dim grey, no icon, no name - and a readout that refuses to identify it.
  drawUnknownContact(ctx, px, py, zScale, gx, gy) {
    if (!this.isLayerOn("unknown")) return;
    const r = Math.max(3, 4 * zScale);
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = "#7a8a80";
    ctx.fillStyle = "rgba(120, 138, 128, 0.20)";
    ctx.lineWidth = Math.max(1, 1.2 * zScale);
    ctx.setLineDash([3 * zScale, 3 * zScale]);
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#9aa8a0";
    ctx.font = `bold ${Math.max(8, Math.round(9 * zScale))}px Share Tech Mono`;
    ctx.textAlign = "center";
    ctx.fillText("?", px, py + r * 0.55);
    ctx.textAlign = "left";
    ctx.restore();

    this.mapTargets.push({
      type: "unknown",
      known: true, // the blip itself is a known sensor return
      x: px, y: py, radius: Math.max(9, r + 4),
      title: "? UNIDENTIFIED CONTACT",
      details: `Approximate Position: (${Math.round(gx)}, ${Math.round(gy)})\nClassification: UNKNOWN\nLong range sensors registered a return here.\nClose to short range and run SCAN [S] to identify.`
    });
  },

  markContact(id, level) {
    const ship = window.game && window.game.ship;
    if (!ship || !id) return false;
    if (!ship.contactLog) ship.contactLog = {};
    if ((ship.contactLog[id] || 0) < level) {
      ship.contactLog[id] = level;
      return true; // newly upgraded
    }
    return false;
  },

  // Wide sweep: paints distant objects as unidentified contacts only. You learn
  // that something is out there, not what it is - fly closer and short-scan to ID.
  triggerLongRangeScan() {
    const game = window.game;
    if (game.viewState !== "navigation" || game.spaceState !== "hyper") {
      AudioController.playBeep('error');
      UI.addLog("LONG RANGE SWEEP UNAVAILABLE: DEEP SPACE SENSORS REQUIRE HYPERSPACE.");
      return;
    }
    if (this.longScanCooldown > 0) {
      AudioController.playBeep('error');
      UI.addLog(`SENSOR ARRAY RECHARGING... ${this.longScanCooldown.toFixed(1)}s REMAINING.`);
      return;
    }

    const r = this.getScanRanges();
    this.longScanCooldown = 6.0;
    this.sonarActive = true;
    this.sonarRadius = 0;
    AudioController.playScan();

    UI.addLog(`LONG RANGE SWEEP EMITTED. RANGE ${r.long.toFixed(1)} LY (NAV SKILL ${r.navSkill} / SCANNER CLASS ${r.scannerLevel}).`);

    let fresh = 0, already = 0;
    this.getDeepSpaceContacts().forEach(c => {
      const dist = Math.hypot(this.shipX - c.x, this.shipY - c.y);
      if (dist > r.long) return;
      if (this.getContactTier(c.id, c.x, c.y) >= 2) { already++; return; }
      if (this.markContact(c.id, 1)) {
        fresh++;
        const bearing = Math.round(((Math.atan2(c.y - this.shipY, c.x - this.shipX) * 180 / Math.PI) + 360) % 360);
        UI.addLog(`UNIDENTIFIED CONTACT LOGGED: BEARING ${bearing}° - RANGE ${dist.toFixed(1)} LY.`);
      } else already++;
    });

    // Distant stars register as contacts too, but stay unnamed until identified
    let sysFresh = 0;
    GameData.starSystems.forEach(sys => {
      const dist = Math.hypot(this.shipX - sys.x, this.shipY - sys.y);
      if (dist <= r.long && !game.ship.discoveredSystems[sys.name]) {
        if (this.markContact("sys_" + sys.name, 1)) sysFresh++;
      }
    });

    if (fresh + sysFresh > 0) {
      AudioController.playBeep('success');
      UI.addLog(`SWEEP COMPLETE: ${fresh + sysFresh} NEW UNIDENTIFIED CONTACT(S). CLOSE TO ${r.short.toFixed(0)} LY AND RUN A SHORT RANGE SCAN TO IDENTIFY.`);
    } else {
      UI.addLog(`SWEEP COMPLETE: NO NEW CONTACTS WITHIN ${r.long.toFixed(1)} LY.`);
    }
    game.saveGame();
  },

  // Has the player actually swept this part of space? Mirrors the same fog-of-war
  // rule the star systems use: the 25 LY sector must be logged in
  // ship.exploredSectors, or it must sit inside the charted home region.
  isMapSectorKnown(x, y) {
    const ship = window.game && window.game.ship;
    if (!ship) return false;
    if (Math.hypot(x - 250, y - 250) < 40) return true; // charted home space
    if (!ship.exploredSectors) return false;
    const sx = Math.floor(x / 25) * 25;
    const sy = Math.floor(y / 25) * 25;
    return !!ship.exploredSectors[`${sx}_${sy}`];
  },

  // Find the marker under the cursor. mapTargets holds canvas-space pixel
  // coordinates, so mouse position must be scaled from CSS pixels to the
  // canvas backing store before comparing.
  findStarMapTargetAt(e) {
    const canvas = document.getElementById("starmapCanvas");
    if (!canvas || !this.mapTargets || !this.mapTargets.length) return null;

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);

    // Prefer the most specific marker: a small point icon must win over a huge
    // nebula cloud drawn around the same coordinates (e.g. Precursor Core Mist
    // sits directly on top of Starbase Prime at 250,250). Smallest hit radius
    // wins, ties broken by distance to centre.
    let best = null, bestR = Infinity, bestDist = Infinity;
    this.mapTargets.forEach(t => {
      if (!t.known) return; // undetected contacts stay unidentified - no readout
      const hitR = Math.max(10, t.radius || 10);
      const d = Math.hypot(mx - t.x, my - t.y);
      if (d > hitR) return;
      if (hitR < bestR || (hitR === bestR && d < bestDist)) { bestR = hitR; bestDist = d; best = t; }
    });
    return best;
  },

  updateStarMapTooltip(e) {
    const tip = document.getElementById("starmap-tooltip");
    const canvas = document.getElementById("starmapCanvas");
    if (!tip || !canvas) return;

    const target = this.findStarMapTargetAt(e);
    if (!target) { this.hideStarMapTooltip(); return; }

    // The readout is anchored to the marker, not the cursor. Re-render only when
    // the hovered contact actually changes, so it stays put while the mouse moves
    // around inside the same icon instead of trailing the pointer.
    const key = `${target.type}|${target.title}|${Math.round(target.x)}|${Math.round(target.y)}`;
    if (this.hoveredTargetKey === key) return;
    this.hoveredTargetKey = key;

    tip.innerHTML = `<strong>${target.title || "UNKNOWN CONTACT"}</strong><span class="subtext">${(target.details || "").replace(/</g, "&lt;")}</span>`;
    tip.classList.remove("hidden");

    // Anchor beside the marker itself, converting canvas pixels back to CSS pixels
    const host = canvas.parentElement;
    const hostRect = host.getBoundingClientRect();
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width / canvas.width;
    const sy = rect.height / canvas.height;
    const markerLeft = (rect.left - hostRect.left) + target.x * sx;
    const markerTop = (rect.top - hostRect.top) + target.y * sy;
    const gap = Math.max(12, (target.radius || 10) * sx * 0.6);

    let left = markerLeft + gap;
    let top = markerTop + gap;

    const tw = tip.offsetWidth, th = tip.offsetHeight;
    if (left + tw > hostRect.width) left = Math.max(4, markerLeft - gap - tw);
    if (top + th > hostRect.height) top = Math.max(4, markerTop - gap - th);

    tip.style.left = Math.round(left) + "px";
    tip.style.top = Math.round(top) + "px";
    canvas.style.cursor = "pointer";
  },

  hideStarMapTooltip() {
    this.hoveredTargetKey = null;
    const tip = document.getElementById("starmap-tooltip");
    if (tip) tip.classList.add("hidden");
    const canvas = document.getElementById("starmapCanvas");
    if (canvas) canvas.style.cursor = "crosshair";
  },

  enterNearbyWormhole() {
    if (!this.nearbyWormhole) return;
    const wh = this.nearbyWormhole;
    if (typeof AudioController !== "undefined" && AudioController.playBeep) AudioController.playBeep("powerup");
    UI.addLog(`QUANTUM RIFT DETECTED! ENTERING ${wh.name.toUpperCase()}...`);
    UI.addLog(`SPACE-TIME WARP COMPLETED. ARRIVED AT ${wh.destName.toUpperCase()} (${wh.targetX}, ${wh.targetY}).`);
    this.shipX = wh.targetX;
    this.shipY = wh.targetY;
    this.shipVx = 0;
    this.shipVy = 0;
    window.game.ship.coordinates.x = this.shipX;
    window.game.ship.coordinates.y = this.shipY;

    // Log the route so the star map can draw where this rift comes out
    this.markLinkTraversed(wh.id);
    this.markContact(wh.id, 2);
  },

  boardNearbyDerelict() {
    if (!this.nearbyDerelict) return;
    UI.openDerelictModal(this.nearbyDerelict);
  },

  salvageSpaceWreck() {
    if (!this.nearbySpaceWreck || this.nearbySpaceWreck.searched) return;
    const sw = this.nearbySpaceWreck;
    sw.searched = true;
    if (window.game && window.game.markSalvaged) window.game.markSalvaged(sw.id);
    const part = GameData.techParts[sw.techPartKey] || GameData.techParts.warp_conduit;
    UI.openTechPartModal(part);
  },

  investigateDistressSignal() {
    if (!this.nearbyDistressSignal) return;
    UI.openDistressModal(this.nearbyDistressSignal);
  },

  updateAsteroidMining(dt) {
    if (!this.activeAsteroids) this.activeAsteroids = [];
    if (!this.floatingOreChunks) this.floatingOreChunks = [];

    // Populate active space asteroids if near asteroid fields
    if (GameData.asteroidFields && this.activeAsteroids.length === 0) {
      GameData.asteroidFields.forEach(field => {
        const dist = Math.hypot(this.shipX - field.x, this.shipY - field.y);
        if (dist < 25.0) {
          for (let i = 0; i < field.count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * 18.0;
            this.activeAsteroids.push({
              id: `${field.id}_${i}`,
              x: field.x + Math.cos(angle) * r,
              y: field.y + Math.sin(angle) * r,
              vx: (Math.random() - 0.5) * 0.4,
              vy: (Math.random() - 0.5) * 0.4,
              size: Math.random() * 6 + 6,
              hp: 20,
              ores: field.ores
            });
          }
        }
      });
    }

    // Move active asteroids
    this.activeAsteroids.forEach(ast => {
      ast.x += ast.vx * dt;
      ast.y += ast.vy * dt;
    });

    // Check Projectile Hits on Asteroids
    if (this.spaceProjectiles && this.spaceProjectiles.length > 0) {
      this.spaceProjectiles.forEach(p => {
        if (!p.isPlayer) return;
        this.activeAsteroids.forEach(ast => {
          if (ast.hp <= 0) return;
          const dist = Math.hypot(p.x - ast.x, p.y - ast.y);
          if (dist < (ast.size / 2.5)) {
            ast.hp -= p.damage || 25;
            p.lifetime = 0; // destroy projectile
            if (ast.hp <= 0) {
              if (typeof AudioController !== "undefined" && AudioController.playBeep) AudioController.playBeep("hit");
              UI.addLog(`ASTEROID SHATTERED! ORE DEPOSIT DISLODGED INTO VACUUM!`);
              // Spawn floating mineral ore chunk
              const oreType = ast.ores[Math.floor(Math.random() * ast.ores.length)];
              this.floatingOreChunks.push({
                x: ast.x,
                y: ast.y,
                type: oreType,
                lifetime: 20.0
              });
            }
          }
        });
      });

      // Filter out destroyed asteroids
      this.activeAsteroids = this.activeAsteroids.filter(ast => ast.hp > 0);
    }

    // Update Floating Ore Chunks & Scoop into Cargo
    this.floatingOreChunks = this.floatingOreChunks.filter(chunk => {
      chunk.lifetime -= dt;
      const shipDist = Math.hypot(this.shipX - chunk.x, this.shipY - chunk.y);
      if (shipDist < 3.0) {
        // Tractor Beam Scoop Ore Chunk into Cargo!
        const ship = window.game.ship;
        const typeName = chunk.type.replace("_ore", "").toUpperCase();
        if (!ship.cargo) ship.cargo = {};
        ship.cargo[chunk.type] = (ship.cargo[chunk.type] || 0) + 1;

        if (typeof AudioController !== "undefined" && AudioController.playBeep) AudioController.playBeep("powerup");
        UI.addLog(`TRACTOR SCOOP: RECOVERED 1 UNIT OF ${typeName} ORE INTO CARGO!`);
        UI.updateShip(ship);
        return false;
      }
      return chunk.lifetime > 0;
    });
  },

  // Twinkling background star coordinates (normalized 0.0 - 1.0 across full canvas)
  generateBackground() {
    if (!this.canvas) return;

    this.bgStars = [];
    const count = 180;
    for (let i = 0; i < count; i++) {
      this.bgStars.push({
        u: Math.random(),
        v: Math.random(),
        size: Math.random() * 1.8 + 0.5,
        twinkleSpeed: Math.random() * 2 + 1,
        color: ["#ffffff", "#00ff66", "#00ccff", "#ffaa33", "#ff77ff"][Math.floor(Math.random() * 5)]
      });
    }

    this.nebulae = [
      { u: 0.20, v: 0.24, rRatio: 0.18, color: "rgba(255, 50, 120, 0.08)" },
      { u: 0.80, v: 0.64, rRatio: 0.22, color: "rgba(255, 80, 50, 0.08)" },
      { u: 0.32, v: 0.76, rRatio: 0.20, color: "rgba(50, 255, 120, 0.08)" },
      { u: 0.56, v: 0.30, rRatio: 0.18, color: "rgba(80, 120, 255, 0.08)" },
      { u: 0.86, v: 0.20, rRatio: 0.24, color: "rgba(180, 80, 255, 0.08)" }
    ];
  },

  // Reset ship velocities on state transit
  resetPhysics(x, y) {
    this.shipX = x;
    this.shipY = y;
    this.shipVx = 0;
    this.shipVy = 0;
    this.keys = {};
  },

  update(dt) {
    const game = window.game;
    const ship = game.ship;

    // Check if shields are draining energy
    if (ship.shieldsActive) {
      // Shield efficiency is an engineering discipline: the Engineer both slows the
      // drain here and speeds the recharge in GameManager.updateShieldRegen().
      // The Doctor governs crew healing, not the deflector matrix.
      const engSkill = ship.crew.engineer ? ship.crew.engineer.skill : 40;
      const drainRate = 2 * (1 - engSkill / 200) * dt;
      ship.shieldsCharge = Math.max(0, ship.shieldsCharge - drainRate);
      if (ship.shieldsCharge <= 0) {
        ship.shieldsActive = false;
        AudioController.playBeep('error');
        UI.addLog("SHIELD ENERGY DEPLETED. SHIELDS COLLAPSED!");
      }
    }

    if (game.spaceState === "hyper") {
      this.updateHyper(dt);
    } else {
      this.updateSystem(dt);
    }

    // Long range sensor array recharge
    if (this.longScanCooldown > 0) {
      this.longScanCooldown = Math.max(0, this.longScanCooldown - dt);
    }

    // Sonar sweep update
    if (this.sonarActive) {
      this.sonarRadius += 300 * dt;
      if (this.sonarRadius > 500) {
        this.sonarActive = false;
      }
    }
  },

  updateHyper(dt) {
    const game = window.game;
    const ship = game.ship;
    ship.currentPlanet = null; // No planet orbit in Hyperspace

    // Standard physics updates
    const engine = GameData.upgrades.engines[(ship.engineLevel || 1) - 1] || GameData.upgrades.engines[0];
    const mass = 1.0 + (UI.calculateCargoMass(ship.cargo) / 100);
    const isBoosting = this.keys["Shift"] || this.keys["ShiftLeft"] || this.keys["ShiftRight"];
    const boostMult = isBoosting ? 2.5 : 1.0;
    const baseThrust = (10.0 + (ship.engineLevel * 8)) / mass;
    const thrust = baseThrust * boostMult;
    const friction = isBoosting ? 0.96 : 0.94;

    // Keyboard rotation & thrust
    if (this.keys["ArrowLeft"] || this.keys["KeyA"] || this.keys["a"] || this.keys["A"]) {
      const navSkill = ship.crew.navigator ? ship.crew.navigator.skill : 40;
      this.shipAngle -= (3.0 + (navSkill / 50)) * dt;
    }
    if (this.keys["ArrowRight"] || this.keys["KeyD"] || this.keys["d"] || this.keys["D"]) {
      const navSkill = ship.crew.navigator ? ship.crew.navigator.skill : 40;
      this.shipAngle += (3.0 + (navSkill / 50)) * dt;
    }

    let isThrusting = false;
    if (this.keys["ArrowUp"] || this.keys["KeyW"] || this.keys["w"] || this.keys["W"]) {
      this.shipVx += Math.cos(this.shipAngle) * thrust * dt;
      this.shipVy += Math.sin(this.shipAngle) * thrust * dt;
      isThrusting = true;
    }

    // Apply drift friction
    this.shipVx *= friction;
    this.shipVy *= friction;

    // Position updates
    this.shipX += this.shipVx * dt;
    this.shipY += this.shipVy * dt;

    // Keep coordinates within bounds of 500x500 Light-Year Galaxy Quadrant
    this.shipX = Math.max(5, Math.min(495, this.shipX));
    this.shipY = Math.max(5, Math.min(495, this.shipY));

    // Update global ship coordinates
    ship.coordinates.x = this.shipX;
    ship.coordinates.y = this.shipY;

    // Track explored sectors in Fog of War
    if (!ship.exploredSectors) ship.exploredSectors = { "250_250": true };
    if (!ship.discoveredSystems) ship.discoveredSystems = { "Starbase Prime": true };
    const secX = Math.floor(this.shipX / 25) * 25;
    const secY = Math.floor(this.shipY / 25) * 25;
    ship.exploredSectors[`${secX}_${secY}`] = true;

    // 1. Singularity Black Hole Gravitational Pull Physics
    this.nearbyBlackHole = null;
    if (GameData.blackHoles) {
      GameData.blackHoles.forEach(bh => {
        const dist = Math.hypot(this.shipX - bh.x, this.shipY - bh.y);
        if (dist < bh.gravityRadius) {
          this.nearbyBlackHole = bh;
          // Apply continuous gravitational pull toward singularity core
          const angle = Math.atan2(bh.y - this.shipY, bh.x - this.shipX);
          const pullIntensity = (1 - (dist / bh.gravityRadius)) * bh.pullForce;
          this.shipVx += Math.cos(angle) * pullIntensity * dt;
          this.shipVy += Math.sin(angle) * pullIntensity * dt;

          // Check if pulled inside event horizon core
          if (dist < bh.coreRadius) {
            if (typeof AudioController !== "undefined" && AudioController.playBeep) AudioController.playBeep("powerup");
            UI.addLog(`CRITICAL WARP DISPLACEMENT! PULLED INTO ${bh.name.toUpperCase()} EVENT HORIZON!`);
            UI.addLog(`REEMERGED AT DISPLACED COORDINATES (${bh.destX}, ${bh.destY}).`);
            this.shipX = bh.destX;
            this.shipY = bh.destY;
            this.shipVx = 0;
            this.shipVy = 0;
            this.markLinkTraversed(bh.id);
            this.markContact(bh.id, 2);
          }
        }
      });
    }

    // 2. Derelict Station Proximity
    this.nearbyDerelict = null;
    if (GameData.derelicts) {
      GameData.derelicts.forEach(der => {
        const dist = Math.hypot(this.shipX - der.x, this.shipY - der.y);
        if (dist < 4.0) {
          this.nearbyDerelict = der;
        }
      });
    }

    // 3. Subspace Distress Signal Proximity
    this.nearbyDistressSignal = null;
    if (GameData.distressSignals && this.isLayerOn("salvage")) {
      GameData.distressSignals.forEach(sig => {
        if (sig.active) {
          const dist = Math.hypot(this.shipX - sig.x, this.shipY - sig.y);
          if (dist < 4.0) {
            this.nearbyDistressSignal = sig;
          }
        }
      });
    }

    // 4. Update Asteroid Mining & Floating Mineral Ore Chunks
    this.updateAsteroidMining(dt);

    // Check Proximity to Quantum Wormholes
    this.nearbyWormhole = null;
    if (GameData.wormholes) {
      GameData.wormholes.forEach(wh => {
        const dist = Math.hypot(this.shipX - wh.x, this.shipY - wh.y);
        if (dist < 4.0) {
          this.nearbyWormhole = wh;
        }
      });
    }

    // 5. Drifting Alien Space Wrecks Proximity
    this.nearbySpaceWreck = null;
    if (GameData.spaceWrecks) {
      GameData.spaceWrecks.forEach(sw => {
        if (!sw.searched) {
          const dist = Math.hypot(this.shipX - sw.x, this.shipY - sw.y);
          if (dist < 4.0) {
            this.nearbySpaceWreck = sw;
          }
        }
      });
    }

    // Anything close enough to board is close enough to identify outright
    if (this.nearbySpaceWreck) this.markContact(this.nearbySpaceWreck.id, 2);
    if (this.nearbyDerelict) this.markContact(this.nearbyDerelict.id, 2);
    if (this.nearbyDistressSignal) this.markContact(this.nearbyDistressSignal.id, 2);
    if (this.nearbyWormhole) this.markContact(this.nearbyWormhole.id, 2);
    if (this.nearbyBlackHole) this.markContact(this.nearbyBlackHole.id, 2);

    // NOTE: the deep space interaction prompt is applied further down, inside the
    // nearStarbase / nearSystem / nearbyAlien chain. Setting it here does not work -
    // that chain's trailing `else` unconditionally re-disables btnLand every frame.

    // Automatic Proximity Star System Discovery
    GameData.starSystems.forEach(sys => {
      const dist = Math.hypot(this.shipX - sys.x, this.shipY - sys.y);
      if (dist < 18.0) {
        if (!ship.discoveredSystems[sys.name]) {
          ship.discoveredSystems[sys.name] = true;
          AudioController.playBeep('success');
          UI.addLog(`NAV DISCOVERY: STAR SYSTEM ${sys.name.toUpperCase()} (COORD: X ${sys.x}, Y ${sys.y}) LOGGED TO MAP.`);
        }
      }
    });

    // Fuel Consumption based on thrust and engine efficiency
    if (isThrusting && ship.fuel > 0) {
      const engSkill = ship.crew.engineer ? ship.crew.engineer.skill : 40;
      const fuelCost = (engine.fuelMult * (1.2 - engSkill / 200)) * dt;
      ship.fuel = Math.max(0, ship.fuel - fuelCost);
      AudioController.updateEnginePitch(0.8);
      
      if (ship.fuel <= 0) {
        AudioController.stopEngine();
        UI.addLog("REACTOR FAILURE: ENDURIUM OUT OF FUEL.");
      }
    } else {
      AudioController.updateEnginePitch(0.1);
    }

    // Ensure physics values are clean and not NaN
    if (isNaN(this.shipVx)) this.shipVx = 0;
    if (isNaN(this.shipVy)) this.shipVy = 0;
    if (isNaN(this.shipX)) this.shipX = 250.0;
    if (isNaN(this.shipY)) this.shipY = 250.0;

    // Update active space projectiles (phasers, missiles, plasma bolts)
    if (!this.spaceProjectiles) this.spaceProjectiles = [];
    this.spaceProjectiles = this.spaceProjectiles.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.lifetime -= dt;

      if (p.isPlayer) {
        this.alienShips.forEach(alien => {
          if (alien.x < 0) return;
          const dist = Math.hypot(p.x - alien.x, p.y - alien.y);
          if (dist < 4.0) {
            p.lifetime = 0;
            if (typeof AudioController !== 'undefined') AudioController.playExplosion();
            UI.addLog(`DIRECT HIT ON ${alien.name.toUpperCase()}! (${p.damage} DAMAGE)`);
            alien.hp = (alien.hp || 100) - p.damage;
            if (alien.hp <= 0) {
              UI.addLog(`TACTICAL VICTORY: ${alien.name.toUpperCase()} DESTROYED IN SPACE!`);
              ship.credits += 300;
              UI.updateShip(ship);
              alien.x = -999;
            }
          }
        });
      } else {
        const dist = Math.hypot(p.x - this.shipX, p.y - this.shipY);
        if (dist < 3.0) {
          p.lifetime = 0;
          if (typeof AudioController !== 'undefined') AudioController.playExplosion();
          if (ship.shieldsActive && ship.shieldsCharge > 0) {
            ship.shieldsCharge = Math.max(0, ship.shieldsCharge - p.damage);
            UI.addLog(`DEFLECTOR SHIELDS ABSORBED ALIEN PLASMA BOLT! (CHARGE: ${Math.round(ship.shieldsCharge)}%)`);
          } else {
            ship.hull = Math.max(0, ship.hull - p.damage);
            UI.addLog(`CRITICAL DAMAGE: ALIEN PLASMA BOLT IMPACT ON HULL! (HULL: ${Math.round(ship.hull)}%)`);
          }
          UI.updateShip(ship);
        }
      }

      return p.lifetime > 0;
    });

    // Animate Alien Spacecraft flying through space & tactical engagement
    this.nearbyAlien = null;
    this.alienShips.forEach(alien => {
      if (alien.x < 0) return;
      alien.x += alien.vx * dt;
      alien.y += alien.vy * dt;

      // Bounce at galaxy borders
      if (alien.x < 15 || alien.x > 185) alien.vx *= -1;
      if (alien.y < 15 || alien.y > 185) alien.vy *= -1;
      alien.angle = Math.atan2(alien.vy, alien.vx);

      const dist = Math.hypot(this.shipX - alien.x, this.shipY - alien.y);
      if (dist < 6.5) {
        this.nearbyAlien = alien;
      }

      // Alien Tactical Firing
      if (dist < 18.0) {
        alien.fireCooldown = (alien.fireCooldown || 2.0) - dt;
        if (alien.fireCooldown <= 0) {
          alien.fireCooldown = 3.5;
          const fireAngle = Math.atan2(this.shipY - alien.y, this.shipX - alien.x);
          const pSpeed = 16.0;
          this.spaceProjectiles.push({
            x: alien.x,
            y: alien.y,
            vx: Math.cos(fireAngle) * pSpeed,
            vy: Math.sin(fireAngle) * pSpeed,
            color: "#ff3333",
            isPlayer: false,
            lifetime: 3.0,
            damage: 12
          });
          if (typeof AudioController !== 'undefined') AudioController.playLaser();
          UI.addLog(`WARNING: ${alien.name.toUpperCase()} FIRED PLASMA TORPEDO! EVADE OR ENGAGE [F/V]!`);
        }
      }
    });

    // Detect proximity to solar systems or Starbase Prime
    let nearSystem = null;
    let nearStarbase = false;

    GameData.starSystems.forEach(sys => {
      const dist = Math.hypot(this.shipX - sys.x, this.shipY - sys.y);
      if (sys.name === "Starbase Prime") {
        if (dist < 4.0) {
          nearStarbase = true;
          nearSystem = sys;
        }
      } else if (dist < 3.0) {
        nearSystem = sys;
      }
    });

    // A boardable deep space object in range claims the LAND control. Previously
    // this prompt was written to UI.elements.btnEnterSystem, an element that has
    // never existed, so salvaging and boarding were reachable only via undocumented
    // [B]/[E]/[W] keys with nothing on screen to hint at them.
    const deepActionLabel =
        this.nearbySpaceWreck     ? "SALVAGE ALIEN WRECK [B]"
      : this.nearbyDerelict       ? "BOARD DERELICT [B]"
      : this.nearbyDistressSignal ? "INVESTIGATE SIGNAL [E]"
      : this.nearbyWormhole       ? "ENTER WORMHOLE [W]"
      : null;

    if (nearStarbase) {
      UI.elements.btnLand.disabled = false;
      UI.elements.btnLand.textContent = "DOCK AT BASE [L]";
      UI.elements.btnScan.disabled = false;
      UI.elements.btnScan.textContent = "ENTER SYSTEM [ENTER]";

      if (this.keys["l"] || this.keys["L"]) {
        this.keys["l"] = false;
        this.keys["L"] = false;
        this.enterSpacebase();
        return;
      }
      if (this.keys["Enter"]) {
        this.keys["Enter"] = false;
        this.enterSystem(nearSystem);
        return;
      }
    } else if (deepActionLabel) {
      UI.elements.btnLand.disabled = false;
      UI.elements.btnLand.textContent = deepActionLabel;
      UI.elements.btnScan.disabled = false;
      UI.elements.btnScan.textContent = nearSystem ? "ENTER SYSTEM [ENTER]" : "RADAR SCAN [S]";

      if (nearSystem && this.keys["Enter"]) {
        this.keys["Enter"] = false;
        this.enterSystem(nearSystem);
        return;
      }
    } else if (nearSystem) {
      UI.elements.btnLand.disabled = true;
      UI.elements.btnLand.textContent = "LAND VEHICLE [L]";
      UI.elements.btnScan.disabled = false;
      UI.elements.btnScan.textContent = "ENTER SYSTEM [ENTER]";
      if (this.keys["Enter"]) {
        this.keys["Enter"] = false;
        this.enterSystem(nearSystem);
      }
    } else if (this.nearbyAlien) {
      UI.elements.btnLand.disabled = false;
      UI.elements.btnLand.textContent = `COMMS [C]: ${this.nearbyAlien.name.toUpperCase()}`;
      UI.elements.btnScan.disabled = false;
      UI.elements.btnScan.textContent = "RADAR SCAN [S]";

      if (this.keys["c"] || this.keys["C"]) {
        this.keys["c"] = false;
        this.keys["C"] = false;
        Encounter.trigger(this.nearbyAlien.raceKey);
        return;
      }
    } else {
      UI.elements.btnLand.disabled = true;
      UI.elements.btnLand.textContent = "LAND VEHICLE [L]";
      UI.elements.btnScan.disabled = false;
      UI.elements.btnScan.textContent = "RADAR SCAN [S]";
    }

    // HUD bindings
    document.getElementById("hud-coord-x").textContent = this.shipX.toFixed(1);
    document.getElementById("hud-coord-y").textContent = this.shipY.toFixed(1);
    document.getElementById("hud-velocity").textContent = (Math.hypot(this.shipVx, this.shipVy) * 0.1).toFixed(2);
  },

  updateSystem(dt) {
    const game = window.game;
    const ship = game.ship;
    const system = ship.currentSystem;

    if (!system || !system.planets) {
      this.exitToHyper();
      return;
    }

    const starX = this.canvas ? this.canvas.width / 2 : 480;
    const starY = this.canvas ? this.canvas.height / 2 : 240;
    const systemRadius = Math.min(starX, starY) * 0.92;

    // Move in solar system space coordinates (relative to star)
    const isBoosting = this.keys["Shift"] || this.keys["ShiftLeft"] || this.keys["ShiftRight"];
    const boostMult = isBoosting ? 2.5 : 1.0;
    const baseThrust = 30.0 + (ship.engineLevel * 30.0);
    const thrust = baseThrust * boostMult;
    const friction = isBoosting ? 0.96 : 0.94;

    if (this.keys["ArrowLeft"] || this.keys["KeyA"] || this.keys["a"] || this.keys["A"]) {
      this.shipAngle -= 4.0 * dt;
    }
    if (this.keys["ArrowRight"] || this.keys["KeyD"] || this.keys["d"] || this.keys["D"]) {
      this.shipAngle += 4.0 * dt;
    }

    let isThrusting = false;
    if (this.keys["ArrowUp"] || this.keys["KeyW"] || this.keys["w"] || this.keys["W"]) {
      this.shipVx += Math.cos(this.shipAngle) * thrust * dt;
      this.shipVy += Math.sin(this.shipAngle) * thrust * dt;
      isThrusting = true;
    }

    this.shipVx *= friction;
    this.shipVy *= friction;

    this.shipX += this.shipVx * dt;
    this.shipY += this.shipVy * dt;

    // Check if player exited system border
    const distFromCenter = Math.hypot(this.shipX - starX, this.shipY - starY);
    if (distFromCenter > systemRadius + 20) {
      this.exitToHyper();
      return;
    }

    if (isThrusting && ship.fuel > 0) {
      const engSkill = ship.crew.engineer ? ship.crew.engineer.skill : 40;
      const fuelCost = (0.2 * (1.2 - engSkill / 200)) * dt;
      ship.fuel = Math.max(0, ship.fuel - fuelCost);
      AudioController.updateEnginePitch(0.8);
      
      if (ship.fuel <= 0) {
        AudioController.stopEngine();
        UI.addLog("REACTOR FAILURE: ENDURIUM OUT OF FUEL.");
      }
    } else {
      AudioController.updateEnginePitch(0.1);
    }

    // Animate planet orbits angles
    this.ensureOrbitAngles(system);
    system.planets.forEach(planet => {
      planet.orbitAngle += planet.speed * dt;
      
      // Calculate planet X, Y relative to star center
      const radiusPx = planet.radius * this.getOrbitScale(system);
      const px = starX + Math.cos(planet.orbitAngle) * radiusPx;
      const py = starY + Math.sin(planet.orbitAngle) * radiusPx;
      
      const distToPlanet = Math.hypot(this.shipX - px, this.shipY - py);
      if (distToPlanet < 18) {
        ship.currentPlanet = planet;
      }
    });

    // Check if we walked out of planet gravity
    if (ship.currentPlanet) {
      const planet = ship.currentPlanet;
      const radiusPx = planet.radius * this.getOrbitScale(system);
      const px = starX + Math.cos(planet.orbitAngle) * radiusPx;
      const py = starY + Math.sin(planet.orbitAngle) * radiusPx;
      if (Math.hypot(this.shipX - px, this.shipY - py) > 24) {
        ship.currentPlanet = null;
      }
    }

    // HUD bindings
    document.getElementById("hud-coord-x").textContent = ship.coordinates.x.toFixed(1);
    document.getElementById("hud-coord-y").textContent = ship.coordinates.y.toFixed(1);
    document.getElementById("hud-velocity").textContent = (Math.hypot(this.shipVx, this.shipVy) * 0.05).toFixed(2);
    
    // Enable buttons on HUD based on orbital proximity
    UI.updateControlPanel(true, ship.currentPlanet, ship.shieldsActive, ship.weaponsArmed);
  },

  // Dock at base (repairs hull, treats crew, locks tactical systems, loads Spaceport View)
  enterSpacebase() {
    const game = window.game;
    if (!game) return;

    if (typeof AudioController !== 'undefined' && AudioController.playBeep) {
      AudioController.playBeep('success');
    }
    UI.addLog("DOCKING CLEARED. TRANSITING TO STARPORT BAY 1.");

    game.ship.isInSpacebase = true;
    game.ship.shieldsActive = false;
    game.ship.weaponsArmed = false;
    game.viewState = "spaceport";

    // Clear landing state so a page reload never resumes a stale surface session
    game.ship.currentSystem = null;
    game.ship.currentPlanet = null;

    // Auto restore hull on docking
    game.ship.hull = game.ship.maxHull;

    // Starbase power couplings top the deflector capacitors right back up
    game.ship.shieldsCharge = game.ship.maxShields;

    // Full medical treatment for crew upon docking
    if (game.ship.crew) {
      Object.values(game.ship.crew).forEach(member => {
        if (member) member.hp = member.maxHp || member.hp || 100;
      });
      UI.updateCrew(game.ship);
      UI.addLog("MEDICAL INFIRMARY: ALL CREW MEMBERS TREATED AND RESTORED TO 100% HEALTH.");
    }

    UI.switchView("spaceport");
    UI.updateShip(game.ship);
    // Apply Starbase safety protocol lockout to the shield & weapon controls
    UI.updateControlPanel(false, null, false, false);

    if (typeof Spaceport !== 'undefined') Spaceport.renderAll();
    game.saveGame();
  },

  firePlayerBlaster() {
    const game = window.game;
    const ship = game.ship;
    if (game.viewState !== "navigation") return;
    if (!ship.blasterLevel || ship.blasterLevel === 0) {
      if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('error');
      UI.addLog("WEAPON ALERT: No phaser blaster module installed.");
      return;
    }
    if (typeof AudioController !== 'undefined' && AudioController.playLaser) AudioController.playLaser();
    const speed = 25.0;
    if (!this.spaceProjectiles) this.spaceProjectiles = [];
    this.spaceProjectiles.push({
      x: this.shipX,
      y: this.shipY,
      vx: Math.cos(this.shipAngle) * speed,
      vy: Math.sin(this.shipAngle) * speed,
      color: "#00ff66",
      isPlayer: true,
      lifetime: 2.0,
      damage: 15 * ship.blasterLevel
    });
    UI.addLog(`TACTICAL: PHASER BLASTER FIRED!`);
  },

  firePlayerMissile() {
    const game = window.game;
    const ship = game.ship;
    if (game.viewState !== "navigation") return;
    if (!ship.missilesAmmo || ship.missilesAmmo <= 0) {
      if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('error');
      UI.addLog("WEAPON ALERT: Out of homing missiles.");
      return;
    }
    ship.missilesAmmo -= 1;
    if (typeof AudioController !== 'undefined' && AudioController.playExplosion) AudioController.playExplosion();
    const speed = 18.0;
    if (!this.spaceProjectiles) this.spaceProjectiles = [];
    this.spaceProjectiles.push({
      x: this.shipX,
      y: this.shipY,
      vx: Math.cos(this.shipAngle) * speed,
      vy: Math.sin(this.shipAngle) * speed,
      color: "#ff8800",
      isPlayer: true,
      isMissile: true,
      lifetime: 3.5,
      damage: 35
    });
    UI.addLog(`TACTICAL: HOMING MISSILE LAUNCHED! (REMAINING: ${ship.missilesAmmo})`);
    UI.updateShip(ship);
  },

  enterSystem(system) {
    const game = window.game;
    AudioController.playBeep('success');
    UI.addLog(`ENTERED SOLAR SYSTEM: ${system.name.toUpperCase()}`);
    UI.addLog("ORBITAL PLANE GRID DETECTED.");

    // Spread the planets around their star before the first frame renders
    this.ensureOrbitAngles(system);
    
    game.spaceState = "system";
    game.ship.currentSystem = system;
    game.ship.currentPlanet = null;

    const starX = this.canvas ? this.canvas.width / 2 : 480;
    const starY = this.canvas ? this.canvas.height / 2 : 240;
    const spawnRad = Math.min(starX, starY) * 0.82;

    // Reset physics in solar system coordinates
    const angleToStar = Math.atan2(this.shipY - system.y, this.shipX - system.x);
    this.shipX = starX + Math.cos(angleToStar) * spawnRad;
    this.shipY = starY + Math.sin(angleToStar) * spawnRad;
    this.shipVx = 0;
    this.shipVy = 0;
  },

  exitToHyper() {
    const game = window.game;
    const sys = game.ship.currentSystem;
    AudioController.playBeep('success');
    UI.addLog(`EXITED SOLAR SYSTEM: ${sys.name.toUpperCase()}`);
    UI.addLog("INTERSTELLAR COORDINATES DEPLOYED.");

    game.spaceState = "hyper";
    game.ship.currentPlanet = null;

    // Spawn ship in Hyperspace close to system coordinates
    this.shipX = sys.x + Math.cos(this.shipAngle) * 2.0;
    this.shipY = sys.y + Math.sin(this.shipAngle) * 2.0;
    this.shipVx = 0;
    this.shipVy = 0;
  },

  zoomStarMap(factor) {
    this.mapZoom = Math.min(5.0, Math.max(0.6, this.mapZoom * factor));
    const zoomText = document.getElementById("starmap-zoom-level");
    if (zoomText) {
      zoomText.textContent = `ZOOM: ${Math.round(this.mapZoom * 100)}%`;
    }
    this.drawStarMapCanvas();
  },

  getShipGalaxyCoords() {
    const game = window.game;
    if (game.spaceState === "system" && game.ship.currentSystem) {
      return { x: game.ship.currentSystem.x, y: game.ship.currentSystem.y };
    }
    return { x: this.shipX, y: this.shipY };
  },

  centerStarMapOnShip() {
    const coords = this.getShipGalaxyCoords();
    this.mapOffsetX = (250 - coords.x) * 2.0;
    this.mapOffsetY = (250 - coords.y) * 2.0;
    this.drawStarMapCanvas();
  },

  resetStarMapPanZoom() {
    this.mapZoom = 1.0;
    this.mapOffsetX = 0;
    this.mapOffsetY = 0;
    const zoomText = document.getElementById("starmap-zoom-level");
    if (zoomText) {
      zoomText.textContent = "ZOOM: 100%";
    }
    this.drawStarMapCanvas();
  },

  openStarMapModal() {
    AudioController.playBeep('click');
    const modal = document.getElementById("starmap-modal");
    if (!modal) return;

    // Unhide FIRST. `.modal.hidden` is `display:none`, so while hidden the canvas
    // container reports clientWidth/Height of 0, the resize guard in
    // drawStarMapCanvas() is skipped, and the canvas keeps its default 300x150
    // backing store - which CSS then stretches to full screen, producing a
    // massively zoomed in, blurry map on first open.
    modal.classList.remove("hidden");
    this.refreshMapLayerButtons();
    this.drawStarMapCanvas();
  },

  closeStarMapModal() {
    AudioController.playBeep('click');
    const modal = document.getElementById("starmap-modal");
    if (modal) modal.classList.add("hidden");
    this.hideStarMapTooltip();
  },

  drawStarMapCanvas() {
    const canvas = document.getElementById("starmapCanvas");
    if (!canvas) return;

    // Any redraw (open, zoom, pan, center, reset) moves every marker, so the
    // anchored readout is stale by definition - drop it and let the next
    // mousemove re-acquire whatever is now under the cursor.
    this.hideStarMapTooltip();
    
    // Sync pixel resolution with container element dimensions
    if (canvas.parentElement) {
      const parentW = canvas.parentElement.clientWidth;
      const parentH = canvas.parentElement.clientHeight;
      if (parentW > 0 && parentH > 0) {
        canvas.width = parentW;
        canvas.height = parentH;
      }
    }

    const ctx = canvas.getContext("2d");
    const ship = window.game.ship;
    if (!ship.exploredSectors) ship.exploredSectors = { "250_250": true };
    if (!ship.discoveredSystems) ship.discoveredSystems = { "Starbase Prime": true };

    const zoomText = document.getElementById("starmap-zoom-level");
    if (zoomText) {
      zoomText.textContent = `ZOOM: ${Math.round(this.mapZoom * 100)}%`;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Map bounds: 0 to 200 LY coordinates mapped onto full canvas with clean margins & zoom transform
    const originX = 40;
    const originY = 25;
    const mapW = canvas.width - 80;
    const mapH = canvas.height - 55;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const toCanvasX = (coordX) => {
      const basePx = originX + (coordX / 500) * mapW;
      return centerX + (basePx - centerX + this.mapOffsetX) * this.mapZoom;
    };

    const toCanvasY = (coordY) => {
      const basePy = originY + (coordY / 500) * mapH;
      return centerY + (basePy - centerY + this.mapOffsetY) * this.mapZoom;
    };

    // Draw Background Grid Lines (every 25 LY in 500x500 Galaxy Map)
    ctx.strokeStyle = "rgba(0, 255, 102, 0.12)";
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= 500; gx += 25) {
      const px = toCanvasX(gx);
      ctx.beginPath();
      ctx.moveTo(px, originY);
      ctx.lineTo(px, originY + mapH);
      ctx.stroke();

      // Axis numeric labels
      ctx.font = "9px Share Tech Mono";
      ctx.fillStyle = "rgba(0, 255, 102, 0.4)";
      ctx.fillText(gx, px - 6, originY + mapH + 14);
    }
    for (let gy = 0; gy <= 500; gy += 25) {
      const py = toCanvasY(gy);
      ctx.beginPath();
      ctx.moveTo(originX, py);
      ctx.lineTo(originX + mapW, py);
      ctx.stroke();

      ctx.font = "9px Share Tech Mono";
      ctx.fillStyle = "rgba(0, 255, 102, 0.4)";
      ctx.fillText(gy, originX - 25, py + 3);
    }

    this.mapTargets = [];

    // Proportional zoom scale factor
    const zScale = Math.sqrt(this.mapZoom);

    // Traversed rift routes sit beneath every marker
    this.drawTraversedLinks(ctx, toCanvasX, toCanvasY, zScale);

    const fontSize = Math.min(18, Math.max(9, Math.round(10 * zScale)));

    // Draw Deep Space Nebulae Gas Clouds on Star Map
    if (GameData.nebulae && this.isLayerOn("nebulae")) {
      GameData.nebulae.forEach(neb => {
        const nx = toCanvasX(neb.x);
        const ny = toCanvasY(neb.y);
        const tier = this.getContactTier(neb.id, neb.x, neb.y);
        if (tier === 0) return;
        if (tier === 1) { this.drawUnknownContact(ctx, nx, ny, zScale, neb.x, neb.y); return; }
        const nr = Math.max(15, neb.radius * (mapW / 500) * zScale);

        const grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
        grad.addColorStop(0, neb.color);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(nx, ny, nr, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = `${fontSize}px Share Tech Mono`;
        ctx.fillStyle = "rgba(255, 150, 220, 0.85)";
        ctx.fillText(`☁ ${neb.name.toUpperCase()}`, nx - nr/2, ny);

        this.mapTargets.push({
          type: "nebula",
          known: this.isMapSectorKnown(neb.x, neb.y),
          x: nx, y: ny, radius: nr,
          title: `☁ NEBULA: ${neb.name.toUpperCase()}`,
          details: `Location: (${neb.x}, ${neb.y})\nType: Deep Space Cloud Field\nProperties: ${neb.desc}`
        });
      });
    }

    // Draw Quantum Wormholes Portals on Star Map
    if (GameData.wormholes && this.isLayerOn("anomalies")) {
      GameData.wormholes.forEach(wh => {
        const whPx = toCanvasX(wh.x);
        const whPy = toCanvasY(wh.y);
        const tier = this.getContactTier(wh.id, wh.x, wh.y);
        if (tier === 0) return;
        if (tier === 1) { this.drawUnknownContact(ctx, whPx, whPy, zScale, wh.x, wh.y); return; }
        const pulseRad = (7 + Math.abs(Math.sin(Date.now() / 250)) * 4) * zScale;

        ctx.strokeStyle = "#00e5ff";
        ctx.lineWidth = Math.max(1.5, 2 * zScale);
        ctx.shadowBlur = 10 * zScale;
        ctx.shadowColor = "#00e5ff";
        ctx.beginPath();
        ctx.arc(whPx, whPy, pulseRad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.font = `${fontSize + 4}px Share Tech Mono`;
        ctx.fillStyle = "#00e5ff";
        ctx.fillText("🌀", whPx - (fontSize / 2), whPy + (fontSize / 3));

        this.mapTargets.push({
          type: "wormhole",
          known: this.isMapSectorKnown(wh.x, wh.y),
          x: whPx, y: whPy, radius: 14 * zScale,
          title: `🌀 QUANTUM WORMHOLE: ${wh.name.toUpperCase()}`,
          details: `Coordinates: (${wh.x}, ${wh.y})\nTarget Jump Destination: ${wh.destName}\nStatus: Active Space-Time Fold Portal`
        });
      });
    }

    // Draw Supermassive Black Holes on Star Map
    if (GameData.blackHoles && this.isLayerOn("anomalies")) {
      GameData.blackHoles.forEach(bh => {
        const bhPx = toCanvasX(bh.x);
        const bhPy = toCanvasY(bh.y);
        const tier = this.getContactTier(bh.id, bh.x, bh.y);
        if (tier === 0) return;
        if (tier === 1) { this.drawUnknownContact(ctx, bhPx, bhPy, zScale, bh.x, bh.y); return; }
        const gravRad = Math.max(12, bh.gravityRadius * (mapW / 500) * zScale);

        const grad = ctx.createRadialGradient(bhPx, bhPy, 2, bhPx, bhPy, gravRad);
        grad.addColorStop(0, "#000000");
        grad.addColorStop(0.4, "rgba(180, 0, 255, 0.45)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(bhPx, bhPy, gravRad, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = `${fontSize + 2}px Share Tech Mono`;
        ctx.fillStyle = "#d870ff";
        ctx.fillText("🕳", bhPx - (fontSize / 2), bhPy + (fontSize / 3));

        this.mapTargets.push({
          type: "blackhole",
          known: this.isMapSectorKnown(bh.x, bh.y),
          x: bhPx, y: bhPy, radius: gravRad,
          title: `🕳 BLACK HOLE: ${bh.name.toUpperCase()}`,
          details: `Location: (${bh.x}, ${bh.y})\nHazard: Extreme Gravitational Core\nProperties: ${bh.desc}`
        });
      });
    }

    // Draw Derelict Space Stations on Star Map
    if (GameData.derelicts && this.isLayerOn("salvage")) {
      GameData.derelicts.forEach(der => {
        const derPx = toCanvasX(der.x);
        const derPy = toCanvasY(der.y);
        const tier = this.getContactTier(der.id, der.x, der.y);
        if (tier === 0) return;
        if (tier === 1) { this.drawUnknownContact(ctx, derPx, derPy, zScale, der.x, der.y); return; }

        ctx.font = `${fontSize + 3}px Share Tech Mono`;
        ctx.fillStyle = der.searched ? "#888888" : "#00e5ff";
        ctx.fillText("🛰️", derPx - (fontSize / 2), derPy + (fontSize / 3));

        this.mapTargets.push({
          type: "derelict",
          known: this.isMapSectorKnown(der.x, der.y),
          x: derPx, y: derPy, radius: 12 * zScale,
          title: `🛰️ PRECURSOR DERELICT: ${der.name.toUpperCase()}`,
          details: `Location: (${der.x}, ${der.y})\nStatus: ${der.searched ? 'Salvaged' : 'Unsearched Artifact Vault'}\nDetails: ${der.desc}`
        });
      });
    }

    // Draw Drifting Space Alien Wrecks on Star Map
    if (GameData.spaceWrecks && this.isLayerOn("salvage")) {
      GameData.spaceWrecks.forEach(sw => {
        const swPx = toCanvasX(sw.x);
        const swPy = toCanvasY(sw.y);
        const tier = this.getContactTier(sw.id, sw.x, sw.y);
        if (tier === 0) return;
        if (tier === 1) { this.drawUnknownContact(ctx, swPx, swPy, zScale, sw.x, sw.y); return; }

        ctx.font = `${fontSize + 3}px Share Tech Mono`;
        ctx.fillStyle = sw.searched ? "#777777" : "#00ffcc";
        ctx.fillText("🛸", swPx - (fontSize / 2), swPy + (fontSize / 3));

        this.mapTargets.push({
          type: "space_wreck",
          known: this.isMapSectorKnown(sw.x, sw.y),
          x: swPx, y: swPy, radius: 12 * zScale,
          title: `🛸 ALIEN WRECK: ${sw.name.toUpperCase()}`,
          details: `Location: (${sw.x}, ${sw.y})\nStatus: ${sw.searched ? 'Salvaged' : 'Unsearched Tech Component Wreck'}`
        });
      });
    }

    // Draw Subspace Distress Beacons on Star Map
    if (GameData.distressSignals) {
      GameData.distressSignals.forEach(sig => {
        if (!sig.active) return;
        const sigPx = toCanvasX(sig.x);
        const sigPy = toCanvasY(sig.y);
        const tier = this.getContactTier(sig.id, sig.x, sig.y);
        if (tier === 0) return;
        if (tier === 1) { this.drawUnknownContact(ctx, sigPx, sigPy, zScale, sig.x, sig.y); return; }
        const pulse = (6 + Math.abs(Math.sin(Date.now() / 250)) * 4) * zScale;

        ctx.strokeStyle = "#ffaa33";
        ctx.lineWidth = Math.max(1, 1.5 * zScale);
        ctx.beginPath();
        ctx.arc(sigPx, sigPy, pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.font = `${fontSize + 2}px Share Tech Mono`;
        ctx.fillStyle = "#ffaa33";
        ctx.fillText("📡", sigPx - (fontSize / 2), sigPy + (fontSize / 3));

        this.mapTargets.push({
          type: "distress",
          known: this.isMapSectorKnown(sig.x, sig.y),
          x: sigPx, y: sigPy, radius: 12 * zScale,
          title: `📡 DISTRESS BEACON: ${sig.name.toUpperCase()}`,
          details: `Location: (${sig.x}, ${sig.y})\nBroadcast: ${sig.desc}`
        });
      });
    }

    // Check if any star system in a sector is discovered
    const systemInSectorDiscovered = (sx, sy) => {
      return GameData.starSystems.some(sys => {
        return sys.x >= sx && sys.x < sx + 25 && sys.y >= sy && sys.y < sy + 25 && ship.discoveredSystems[sys.name];
      });
    };

    // Draw Fog of War over unexplored 25x25 LY sectors
    for (let sx = 0; sx < 500; sx += 25) {
      for (let sy = 0; sy < 500; sy += 25) {
        const secKey = `${sx}_${sy}`;
        const isExplored = ship.exploredSectors[secKey] || systemInSectorDiscovered(sx, sy) || (Math.hypot(sx - 250, sy - 250) < 40);
        if (!isExplored) {
          const px1 = toCanvasX(sx);
          const py1 = toCanvasY(sy);
          const px2 = toCanvasX(sx + 25);
          const py2 = toCanvasY(sy + 25);

          ctx.fillStyle = "rgba(4, 12, 6, 0.88)";
          ctx.fillRect(px1, py1, px2 - px1, py2 - py1);

          ctx.strokeStyle = "rgba(0, 50, 20, 0.25)";
          ctx.beginPath();
          ctx.moveTo(px1, py1); ctx.lineTo(px2, py2);
          ctx.stroke();
        }
      }
    }

    // Draw Explored/Discovered Star Systems (including Starbase Prime)
    if (this.isLayerOn("systems")) GameData.starSystems.forEach(sys => {
      const secX = Math.floor(sys.x / 25) * 25;
      const secY = Math.floor(sys.y / 25) * 25;
      const isDiscovered = ship.discoveredSystems && ship.discoveredSystems[sys.name];
      const isExplored = isDiscovered || ship.exploredSectors[`${secX}_${secY}`] || (Math.hypot(sys.x - 250, sys.y - 250) < 40);

      // A long range sweep registers a distant star as an unidentified return.
      // It stays a dim grey blip until a short range scan classifies it.
      if (!isExplored && !isDiscovered) {
        if ((ship.contactLog && ship.contactLog["sys_" + sys.name]) === 1) {
          this.drawUnknownContact(ctx, toCanvasX(sys.x), toCanvasY(sys.y), zScale, sys.x, sys.y);
        }
        return;
      }

      if (isExplored || isDiscovered) {
        const sysPx = toCanvasX(sys.x);
        const sysPy = toCanvasY(sys.y);
        const isBase = (sys.name === "Starbase Prime");

        if (isBase) {
          // Special Starbase Station Icon
          const baseRadius = Math.min(20, Math.max(7, 8 * zScale));
          ctx.fillStyle = "#ffcc00";
          ctx.shadowBlur = 10 * zScale;
          ctx.shadowColor = "#ffcc00";
          ctx.beginPath();
          ctx.arc(sysPx, sysPy, baseRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          ctx.font = `${fontSize}px Share Tech Mono`;
          ctx.fillStyle = "#ffcc00";
          ctx.fillText("★ STARBASE PRIME (250, 250)", sysPx + baseRadius + 4, sysPy + 4);

          this.mapTargets.push({
            type: "system",
            known: true,
            x: sysPx, y: sysPy, radius: (baseRadius + 6) * zScale,
            title: "★ STARBASE PRIME HQ",
            details: `Location: (250.0, 250.0)\nStatus: Operational Galactic Hub\nFacility: Refuel, Repairs, Upgrades & Personnel Command`
          });
        } else {
          const starRadius = Math.min(16, Math.max(4, 5.5 * zScale));
          ctx.fillStyle = sys.starColor || "#00ff66";
          ctx.shadowBlur = 8 * zScale;
          ctx.shadowColor = sys.starColor || "#00ff66";
          ctx.beginPath();
          ctx.arc(sysPx, sysPy, starRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          ctx.font = `${fontSize}px Share Tech Mono`;
          ctx.fillStyle = "rgba(0, 255, 102, 0.95)";
          ctx.fillText(`${sys.name} (${sys.x}, ${sys.y})`, sysPx + starRadius + 4, sysPy + 3);

          this.mapTargets.push({
            type: "system",
            known: true,
            x: sysPx, y: sysPy, radius: (starRadius + 6) * zScale,
            title: `⭐ STAR SYSTEM: ${sys.name.toUpperCase()}`,
            details: `Location: (${sys.x}, ${sys.y})\nPrimary Bodies: ${sys.planets ? sys.planets.length : 'Uncharted'} Planets`
          });
        }
      }
    });

    // Draw Past Alien Encounter History Markers
    if (ship.encounterHistory && this.isLayerOn("aliens")) {
      const encFontSize = Math.min(22, Math.max(11, Math.round(13 * zScale)));
      ship.encounterHistory.forEach(enc => {
        const encPx = toCanvasX(enc.x);
        const encPy = toCanvasY(enc.y);

        let encColor = "#ffcc00";
        let iconSymbol = "⚔";
        const rKey = (enc.raceKey || "").toLowerCase();
        if (rKey.includes("spemin")) { encColor = "#00ff66"; iconSymbol = "👾"; }
        else if (rKey.includes("veloxi")) { encColor = "#ff8800"; iconSymbol = "▲"; }
        else if (rKey.includes("uhlek")) { encColor = "#ff3333"; iconSymbol = "▼"; }
        else if (rKey.includes("thrynn")) { encColor = "#ffcc00"; iconSymbol = "◆"; }

        ctx.fillStyle = encColor;
        ctx.shadowBlur = 6 * zScale;
        ctx.shadowColor = encColor;
        ctx.font = `${encFontSize}px Share Tech Mono`;
        ctx.fillText(iconSymbol, encPx - (encFontSize / 2), encPy + (encFontSize / 3));
        ctx.shadowBlur = 0;

        this.mapTargets.push({
          type: "encounter",
          known: true,
          x: encPx, y: encPy, radius: 12 * zScale,
          title: `⚔ LOGGED ALIEN CONTACT: ${String(enc.raceName || enc.raceKey || "UNKNOWN").toUpperCase()}`,
          details: `Coordinates: (${Number(enc.x || 0).toFixed(1)}, ${Number(enc.y || 0).toFixed(1)})\nClassification: Subspace Meeting Log\nStatus: Verified Record`
        });
      });
    }

    // Draw Active Alien Spacecraft flying in space on Starmap
    // Live alien vessels are radar contacts, not omniscient tracking: only plot the
    // ones currently inside sensor reach. The radius matches the alien detection
    // range triggerSonar() uses, so the map shows exactly what the scanner can see.
    const alienReach = this.getScanRanges().short * 1.15;
    const selfPos = this.getShipGalaxyCoords();
    if (this.isLayerOn("aliens")) this.alienShips.forEach(alien => {
      if (Math.hypot(selfPos.x - alien.x, selfPos.y - alien.y) > alienReach) return;
      const alienPx = toCanvasX(alien.x);
      const alienPy = toCanvasY(alien.y);
      const shipSize = 6 * zScale;

      ctx.save();
      ctx.translate(alienPx, alienPy);
      ctx.rotate(alien.angle + Math.PI / 2);
      ctx.fillStyle = alien.color;
      ctx.shadowBlur = 8 * zScale;
      ctx.shadowColor = alien.color;
      ctx.beginPath();
      ctx.moveTo(0, -shipSize);
      ctx.lineTo(shipSize * 0.8, shipSize);
      ctx.lineTo(0, shipSize * 0.3);
      ctx.lineTo(-shipSize * 0.8, shipSize);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Pulsing radar tracking ring
      const alienAura = (6 + Math.abs(Math.sin(Date.now() / 250)) * 4) * zScale;
      ctx.strokeStyle = alien.color;
      ctx.lineWidth = Math.max(1, zScale);
      ctx.beginPath();
      ctx.arc(alienPx, alienPy, alienAura, 0, Math.PI * 2);
      ctx.stroke();

      this.mapTargets.push({
        type: "alien",
        known: true,
        x: alienPx, y: alienPy, radius: 14 * zScale,
        title: `🛸 ACTIVE ALIEN VESSEL: ${alien.name.toUpperCase()}`,
        details: `Coordinates: (${alien.x.toFixed(1)}, ${alien.y.toFixed(1)})\nSpecies: ${alien.raceKey.toUpperCase()}\nStatus: Active Space Trajectory`
      });
    });

    // Draw Vessel Position Flashing Marker ("YOU ARE HERE")
    const galCoords = this.getShipGalaxyCoords();
    const shipPx = toCanvasX(galCoords.x);
    const shipPy = toCanvasY(galCoords.y);

    const pulseRadius = (8 + Math.abs(Math.sin(Date.now() / 250)) * 6) * zScale;
    ctx.strokeStyle = "#00ccff";
    ctx.lineWidth = Math.max(1.5, 1.5 * zScale);
    ctx.shadowBlur = 8 * zScale;
    ctx.shadowColor = "#00ccff";
    ctx.beginPath();
    ctx.arc(shipPx, shipPy, pulseRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#00ccff";
    ctx.beginPath();
    ctx.arc(shipPx, shipPy, Math.max(3, 4 * zScale), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Position "YOU ARE HERE" ABOVE the ship icon
    ctx.font = `${fontSize}px Share Tech Mono`;
    ctx.fillStyle = "#00ccff";
    ctx.fillText("▲ YOU ARE HERE", shipPx - (32 * zScale), shipPy - (14 * zScale));

    this.mapTargets.push({
      type: "ship",
      known: true,
      x: shipPx, y: shipPy, radius: 16 * zScale,
      title: "🚀 ISS ODYSSEY (FLAGSHIP)",
      details: `Current Coords: (${galCoords.x.toFixed(1)}, ${galCoords.y.toFixed(1)})\nNavigation State: ${window.game.spaceState.toUpperCase()}`
    });

    // Count total discovered systems & encounters
    const discoveredCount = Object.keys(ship.discoveredSystems || {}).length;
    const encounterCount = (ship.encounterHistory || []).length;

    // Update bottom info text
    const infoText = document.getElementById("starmap-info-text");
    if (infoText) {
      const stateStr = (window.game.spaceState === "system" && ship.currentSystem) ? `ORBITING ${ship.currentSystem.name.toUpperCase()}` : "HYPERSPACE";
      infoText.textContent = `VESSEL POSITION: X ${galCoords.x.toFixed(1)}, Y ${galCoords.y.toFixed(1)} (${stateStr}) | SYSTEMS LOGGED: ${discoveredCount} / ${GameData.starSystems.length} | SECTORS: ${Object.keys(ship.exploredSectors).length} / 100`;
    }
  },

  triggerSonar() {
    if (this.sonarActive) return;
    AudioController.playScan();
    this.sonarActive = true;
    this.sonarRadius = 0;

    const game = window.game;
    if (!game.ship.discoveredSystems) game.ship.discoveredSystems = { "Starbase Prime": true };

    // Scan coordinates
    if (game.spaceState === "hyper") {
      const r = this.getScanRanges();
      UI.addLog(`SHORT RANGE SCAN EMITTED. RANGE ${r.short.toFixed(1)} LY (NAV SKILL ${r.navSkill} / SCANNER CLASS ${r.scannerLevel}).`);

      GameData.starSystems.forEach(sys => {
        const dist = Math.hypot(this.shipX - sys.x, this.shipY - sys.y);
        if (dist < r.short) {
          this.markContact("sys_" + sys.name, 2);
          if (!game.ship.discoveredSystems[sys.name]) {
            game.ship.discoveredSystems[sys.name] = true;
            AudioController.playBeep('success');
            UI.addLog(`NEW STAR SYSTEM DISCOVERED: ${sys.name.toUpperCase()} (COORD: X ${sys.x}, Y ${sys.y}) - CLASS ${sys.starClass}`);
          } else {
            UI.addLog(`STAR DETECTED: ${sys.name.toUpperCase()} (COORD: X ${sys.x}, Y ${sys.y}) - CLASS ${sys.starClass}`);
          }
        }
      });

      // Resolve deep space contacts inside short range into full identifications
      let identified = 0;
      this.getDeepSpaceContacts().forEach(c => {
        const dist = Math.hypot(this.shipX - c.x, this.shipY - c.y);
        if (dist > r.short) return;
        const wasNew = this.markContact(c.id, 2);
        if (wasNew) {
          identified++;
          const bearing = Math.round(((Math.atan2(c.y - this.shipY, c.x - this.shipX) * 180 / Math.PI) + 360) % 360);
          UI.addLog(`CONTACT IDENTIFIED - ${c.label}: ${c.name.toUpperCase()} AT (${c.x}, ${c.y}) - ${dist.toFixed(1)} LY BEARING ${bearing}°`);
        }
      });
      if (identified > 0) AudioController.playBeep('success');

      // Scan active alien spacecraft in space
      this.alienShips.forEach(alien => {
        const dist = Math.hypot(this.shipX - alien.x, this.shipY - alien.y);
        if (dist < r.short * 1.15) {
          const bearing = Math.round(((Math.atan2(alien.y - this.shipY, alien.x - this.shipX) * 180 / Math.PI) + 360) % 360);
          UI.addLog(`RADAR CONTACT: ${alien.name.toUpperCase()} DETECTED AT (COORD: X ${alien.x.toFixed(1)}, Y ${alien.y.toFixed(1)}) - DIST ${dist.toFixed(1)} LY - BEARING ${bearing}°`);
        }
      });

      game.saveGame();
    } else {
      const sys = game.ship.currentSystem;
      UI.addLog(`SCANNING SOLAR BODIES IN ${sys.name.toUpperCase()} ORBIT:`);
      sys.planets.forEach(planet => {
        UI.addLog(`PLANET: ${planet.name.toUpperCase()} (ORBITAL OFFSET: ${planet.radius} MILLION MILES)`);
      });
    }
  },

  draw() {
    if (!this.ctx || !this.canvas) return;
    this.resizeCanvas();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const game = window.game;

    const w = this.canvas.width;
    const h = this.canvas.height;

    if (!this.bgStars || this.bgStars.length === 0) {
      this.generateBackground();
    }

    // Twinkling stars drawing across full canvas resolution
    this.bgStars.forEach(s => {
      s.twinkle += 0.05;
      const alpha = 0.3 + Math.abs(Math.sin(s.twinkle)) * 0.7;
      const sx = (s.u !== undefined ? s.u * w : s.x);
      const sy = (s.v !== undefined ? s.v * h : s.y);
      this.ctx.fillStyle = `rgba(0, 255, 102, ${alpha})`;
      this.ctx.fillRect(sx, sy, s.size, s.size);
    });

    // Nebula drawing across full canvas resolution
    if (this.nebulae) {
      this.nebulae.forEach(n => {
        const nx = (n.u !== undefined ? n.u * w : n.x);
        const ny = (n.v !== undefined ? n.v * h : n.y);
        const nr = (n.rRatio !== undefined ? n.rRatio * Math.min(w, h) : n.r);
        this.ctx.beginPath();
        this.ctx.arc(nx, ny, nr, 0, Math.PI * 2);
        this.ctx.fillStyle = n.color;
        this.ctx.fill();
      });
    }

    try {
      if (game.spaceState === "hyper") {
        this.drawHyper();
      } else {
        this.drawSystem();
      }
    } catch (err) {
      console.error("Navigation draw error caught safely:", err);
    }

    // Draw Radar sweep
    if (this.sonarActive) {
      this.ctx.beginPath();
      this.ctx.arc(this.canvas.width / 2, this.canvas.height / 2, this.sonarRadius, 0, Math.PI * 2);
      this.ctx.strokeStyle = "rgba(0, 255, 102, 0.4)";
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }
  },

  drawHyper() {
    // Scroll map view centered on ship
    const viewWidth = this.canvas.width;
    const viewHeight = this.canvas.height;
    
    // Scale factor: 1 Light Year = 30 Pixels
    const scale = 14;
    const centerX = viewWidth / 2;
    const centerY = viewHeight / 2;

    // Draw grid lines
    this.ctx.strokeStyle = "rgba(0, 255, 102, 0.03)";
    this.ctx.lineWidth = 1;
    
    const startGridX = Math.floor(this.shipX - 20);
    const endGridX = Math.ceil(this.shipX + 20);
    for (let gx = startGridX; gx <= endGridX; gx += 5) {
      const px = centerX + (gx - this.shipX) * scale;
      this.ctx.beginPath();
      this.ctx.moveTo(px, 0);
      this.ctx.lineTo(px, viewHeight);
      this.ctx.stroke();
    }
    const startGridY = Math.floor(this.shipY - 15);
    const endGridY = Math.ceil(this.shipY + 15);
    for (let gy = startGridY; gy <= endGridY; gy += 5) {
      const py = centerY + (gy - this.shipY) * scale;
      this.ctx.beginPath();
      this.ctx.moveTo(0, py);
      this.ctx.lineTo(viewWidth, py);
      this.ctx.stroke();
    }

    // Draw all Star Systems in viewport
    GameData.starSystems.forEach(sys => {
      const dx = (sys.x - this.shipX) * scale;
      const dy = (sys.y - this.shipY) * scale;
      
      const px = centerX + dx;
      const py = centerY + dy;

      // Draw star only if in viewport limits
      if (px > -20 && px < viewWidth + 20 && py > -20 && py < viewHeight + 20) {
        if (sys.name === "Starbase Prime") {
          // Special Starbase Station Icon
          this.ctx.beginPath();
          this.ctx.arc(px, py, 16, 0, Math.PI * 2);
          this.ctx.strokeStyle = "#00ccff";
          this.ctx.lineWidth = 1.5;
          this.ctx.shadowBlur = 8;
          this.ctx.shadowColor = "#00ccff";
          this.ctx.stroke();
          this.ctx.shadowBlur = 0;

          this.ctx.beginPath();
          this.ctx.arc(px, py, 5, 0, Math.PI * 2);
          this.ctx.fillStyle = "#ffffff";
          this.ctx.fill();

          this.ctx.font = "bold 10px Share Tech Mono";
          this.ctx.fillStyle = "#00ccff";
          this.ctx.fillText(`★ STARBASE PRIME (250, 250)`, px + 12, py + 4);
        } else {
          // Draw orbital halos
          this.ctx.beginPath();
          this.ctx.arc(px, py, 14, 0, Math.PI * 2);
          this.ctx.strokeStyle = "rgba(0, 255, 102, 0.15)";
          this.ctx.stroke();

          // Draw star core
          this.ctx.beginPath();
          this.ctx.arc(px, py, 6, 0, Math.PI * 2);
          this.ctx.fillStyle = sys.starColor;
          this.ctx.shadowBlur = 10;
          this.ctx.shadowColor = sys.starColor;
          this.ctx.fill();
          this.ctx.shadowBlur = 0; // reset

          // Draw label
          this.ctx.font = "10px Share Tech Mono";
          this.ctx.fillStyle = "rgba(0, 255, 102, 0.8)";
          this.ctx.fillText(`${sys.name} (${sys.x}, ${sys.y})`, px + 10, py + 4);
        }
      }
    });

    // Render Supermassive Black Holes in Viewport
    if (GameData.blackHoles) {
      GameData.blackHoles.forEach(bh => {
        const dx = (bh.x - this.shipX) * scale;
        const dy = (bh.y - this.shipY) * scale;
        const px = centerX + dx;
        const py = centerY + dy;

        if (px > -100 && px < viewWidth + 100 && py > -100 && py < viewHeight + 100) {
          const gravRadPx = bh.gravityRadius * scale * 0.4;
          const coreRadPx = bh.coreRadius * scale * 0.4;

          // Accretion disk distortion gradient
          const grad = this.ctx.createRadialGradient(px, py, 2, px, py, gravRadPx);
          grad.addColorStop(0, "#000000");
          grad.addColorStop(0.3, "rgba(180, 0, 255, 0.4)");
          grad.addColorStop(0.7, "rgba(0, 229, 255, 0.2)");
          grad.addColorStop(1, "rgba(0,0,0,0)");
          this.ctx.fillStyle = grad;
          this.ctx.beginPath();
          this.ctx.arc(px, py, gravRadPx, 0, Math.PI * 2);
          this.ctx.fill();

          // Black hole core horizon
          this.ctx.beginPath();
          this.ctx.arc(px, py, coreRadPx, 0, Math.PI * 2);
          this.ctx.fillStyle = "#000000";
          this.ctx.strokeStyle = "#a020f0";
          this.ctx.lineWidth = 3;
          this.ctx.shadowBlur = 15;
          this.ctx.shadowColor = "#a020f0";
          this.ctx.fill();
          this.ctx.stroke();
          this.ctx.shadowBlur = 0;

          this.ctx.font = "bold 10px Share Tech Mono";
          this.ctx.fillStyle = "#d870ff";
          this.ctx.fillText(`🕳 ${bh.name.toUpperCase()} (${bh.x}, ${bh.y})`, px + coreRadPx + 6, py + 3);
        }
      });
    }

    // Render Space Alien Wrecks in Viewport
    if (GameData.spaceWrecks) {
      GameData.spaceWrecks.forEach(sw => {
        const dx = (sw.x - this.shipX) * scale;
        const dy = (sw.y - this.shipY) * scale;
        const px = centerX + dx;
        const py = centerY + dy;

        if (px > -40 && px < viewWidth + 40 && py > -40 && py < viewHeight + 40) {
          this.ctx.font = "16px Share Tech Mono";
          this.ctx.fillStyle = sw.searched ? "#777777" : "#00ffcc";
          this.ctx.shadowBlur = sw.searched ? 0 : 10;
          this.ctx.shadowColor = "#00ffcc";
          this.ctx.fillText("🛸", px - 8, py + 6);
          this.ctx.shadowBlur = 0;

          this.ctx.font = "bold 10px Share Tech Mono";
          this.ctx.fillStyle = sw.searched ? "#777777" : "#00ffcc";
          this.ctx.fillText(`${sw.name.toUpperCase()} ${sw.searched ? '[SALVAGED]' : ''}`, px + 12, py + 3);
        }
      });
    }

    // Render Derelict Space Stations in Viewport
    // Render Quantum Wormholes in the Viewport. These were drawn NOWHERE in the
    // space view - the only hint a rift existed was the LAND control flipping to
    // ENTER WORMHOLE [W] once inside 4 LY, so players flew straight past them.
    if (GameData.wormholes) {
      const pulse = 0.5 + Math.abs(Math.sin(Date.now() / 320)) * 0.5;
      GameData.wormholes.forEach(wh => {
        const px = centerX + (wh.x - this.shipX) * scale;
        const py = centerY + (wh.y - this.shipY) * scale;
        if (px < -60 || px > viewWidth + 60 || py < -60 || py > viewHeight + 60) return;

        const isNear = (this.nearbyWormhole && this.nearbyWormhole.id === wh.id);
        const r = (11 + pulse * 5) * (isNear ? 1.35 : 1);

        // Swirling accretion rings
        this.ctx.save();
        this.ctx.strokeStyle = "#00e5ff";
        this.ctx.shadowBlur = 14;
        this.ctx.shadowColor = "#00e5ff";
        for (let i = 0; i < 3; i++) {
          this.ctx.globalAlpha = (0.65 - i * 0.18) * (0.6 + pulse * 0.4);
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.arc(px, py, r - i * 3.5, pulse * Math.PI * 2 + i, pulse * Math.PI * 2 + i + Math.PI * 1.45);
          this.ctx.stroke();
        }
        // Event core
        this.ctx.globalAlpha = 1;
        const grad = this.ctx.createRadialGradient(px, py, 0, px, py, r);
        grad.addColorStop(0, "rgba(180, 245, 255, 0.95)");
        grad.addColorStop(0.55, "rgba(0, 229, 255, 0.35)");
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(px, py, r, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        this.ctx.font = "bold 10px Share Tech Mono";
        this.ctx.fillStyle = "#00e5ff";
        this.ctx.fillText(wh.name.toUpperCase(), px + r + 6, py + 3);
        if (isNear) {
          this.ctx.fillStyle = "#ffcc00";
          this.ctx.font = "bold 11px Share Tech Mono";
          this.ctx.fillText("▶ ENTER WORMHOLE [W]", px + r + 6, py + 16);
          this.ctx.font = "9px Share Tech Mono";
          this.ctx.fillStyle = "#88ccaa";
          this.ctx.fillText(`EXIT: ${wh.destName.toUpperCase()}`, px + r + 6, py + 28);
        }
        this.ctx.restore();
      });
    }

    if (GameData.derelicts) {
      GameData.derelicts.forEach(der => {
        const dx = (der.x - this.shipX) * scale;
        const dy = (der.y - this.shipY) * scale;
        const px = centerX + dx;
        const py = centerY + dy;

        if (px > -40 && px < viewWidth + 40 && py > -40 && py < viewHeight + 40) {
          this.ctx.font = "16px Share Tech Mono";
          this.ctx.fillStyle = der.searched ? "#888888" : "#00e5ff";
          this.ctx.shadowBlur = der.searched ? 0 : 10;
          this.ctx.shadowColor = "#00e5ff";
          this.ctx.fillText("🛰️", px - 8, py + 6);
          this.ctx.shadowBlur = 0;

          this.ctx.font = "bold 10px Share Tech Mono";
          this.ctx.fillStyle = der.searched ? "#888888" : "#00e5ff";
          this.ctx.fillText(`${der.name.toUpperCase()} ${der.searched ? '[SALVAGED]' : ''}`, px + 12, py + 3);
        }
      });
    }

    // Render Subspace Distress Beacons in Viewport
    if (GameData.distressSignals) {
      GameData.distressSignals.forEach(sig => {
        if (!sig.active) return;
        const dx = (sig.x - this.shipX) * scale;
        const dy = (sig.y - this.shipY) * scale;
        const px = centerX + dx;
        const py = centerY + dy;

        if (px > -40 && px < viewWidth + 40 && py > -40 && py < viewHeight + 40) {
          const pulse = 8 + Math.abs(Math.sin(Date.now() / 200)) * 6;
          this.ctx.strokeStyle = "#ffaa33";
          this.ctx.lineWidth = 1.5;
          this.ctx.beginPath();
          this.ctx.arc(px, py, pulse, 0, Math.PI * 2);
          this.ctx.stroke();

          this.ctx.font = "14px Share Tech Mono";
          this.ctx.fillStyle = "#ffaa33";
          this.ctx.fillText("📡", px - 7, py + 5);

          this.ctx.font = "bold 10px Share Tech Mono";
          this.ctx.fillStyle = "#ffaa33";
          this.ctx.fillText(`DISTRESS SIGNAL (${sig.x}, ${sig.y})`, px + 12, py + 3);
        }
      });
    }

    // Render Active Asteroids in Viewport
    if (this.activeAsteroids) {
      this.activeAsteroids.forEach(ast => {
        const dx = (ast.x - this.shipX) * scale;
        const dy = (ast.y - this.shipY) * scale;
        const px = centerX + dx;
        const py = centerY + dy;

        if (px > -20 && px < viewWidth + 20 && py > -20 && py < viewHeight + 20) {
          this.ctx.beginPath();
          this.ctx.arc(px, py, ast.size, 0, Math.PI * 2);
          this.ctx.fillStyle = "#776655";
          this.ctx.strokeStyle = "#aa9988";
          this.ctx.lineWidth = 1.5;
          this.ctx.fill();
          this.ctx.stroke();
        }
      });
    }

    // Render Floating Ore Chunks in Viewport
    if (this.floatingOreChunks) {
      this.floatingOreChunks.forEach(chunk => {
        const dx = (chunk.x - this.shipX) * scale;
        const dy = (chunk.y - this.shipY) * scale;
        const px = centerX + dx;
        const py = centerY + dy;

        if (px > -20 && px < viewWidth + 20 && py > -20 && py < viewHeight + 20) {
          const pulse = 4 + Math.abs(Math.sin(Date.now() / 150)) * 2;
          this.ctx.beginPath();
          this.ctx.arc(px, py, pulse, 0, Math.PI * 2);
          this.ctx.fillStyle = "#ffcc00";
          this.ctx.shadowBlur = 8;
          this.ctx.shadowColor = "#ffcc00";
          this.ctx.fill();
          this.ctx.shadowBlur = 0;

          this.ctx.font = "bold 9px Share Tech Mono";
          this.ctx.fillStyle = "#ffcc00";
          this.ctx.fillText(`⛏ ${chunk.type.replace('_ore','').toUpperCase()}`, px + 6, py + 3);
        }
      });
    }

    // Draw Alien Spacecraft flying in space viewport
    this.alienShips.forEach(alien => {
      const dx = (alien.x - this.shipX) * scale;
      const dy = (alien.y - this.shipY) * scale;
      const px = centerX + dx;
      const py = centerY + dy;

      if (px > -40 && px < viewWidth + 40 && py > -40 && py < viewHeight + 40) {
        this.ctx.save();
        this.ctx.translate(px, py);
        this.ctx.rotate(alien.angle + Math.PI / 2);

        // Draw alien vessel triangular hull
        this.ctx.fillStyle = alien.color;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = alien.color;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -9);
        this.ctx.lineTo(6, 7);
        this.ctx.lineTo(0, 3);
        this.ctx.lineTo(-6, 7);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();

        // Pulsing radar aura ring
        const aura = 10 + Math.abs(Math.sin(Date.now() / 300)) * 5;
        this.ctx.strokeStyle = alien.color;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(px, py, aura, 0, Math.PI * 2);
        this.ctx.stroke();

        // Vessel name & coordinate label
        this.ctx.font = "9px Share Tech Mono";
        this.ctx.fillStyle = alien.color;
        this.ctx.fillText(`${alien.name.toUpperCase()} (${alien.x.toFixed(1)}, ${alien.y.toFixed(1)})`, px + 12, py + 3);
      }
    });

    // Render active space projectiles (lasers, homing missiles, plasma bolts)
    if (this.spaceProjectiles) {
      this.spaceProjectiles.forEach(p => {
        const dx = (p.x - this.shipX) * scale;
        const dy = (p.y - this.shipY) * scale;
        const px = centerX + dx;
        const py = centerY + dy;

        if (px > -20 && px < viewWidth + 20 && py > -20 && py < viewHeight + 20) {
          if (p.isPlayer) {
            // Player Phaser Beam / Missile
            this.ctx.fillStyle = p.color || "#00ff66";
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = p.color || "#00ff66";
            this.ctx.beginPath();
            this.ctx.arc(px, py, p.isMissile ? 4 : 2.5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
          } else {
            // Alien Plasma Torpedo (Pulsing Red)
            const plasmaRad = 5 + Math.abs(Math.sin(Date.now() / 150)) * 3;
            this.ctx.fillStyle = "#ff3333";
            this.ctx.shadowBlur = 12;
            this.ctx.shadowColor = "#ff3333";
            this.ctx.beginPath();
            this.ctx.arc(px, py, plasmaRad, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
          }
        }
      });
    }

    // Draw Ship icon at center
    this.drawShip(centerX, centerY);
  },

  drawSystem() {
    const system = window.game.ship.currentSystem;
    if (!system || !system.planets) return;

    let starColor = system.starColor || "#ffcc00";
    if (typeof starColor !== "string" || !starColor.startsWith("#") || starColor.length < 7) {
      starColor = "#ffcc00";
    }
    const starX = this.canvas.width / 2;
    const starY = this.canvas.height / 2;
    const systemRadius = Math.min(starX, starY) * 0.92;
    
    // Draw star glow halo
    const glowRad = 25 + Math.abs(Math.sin(Date.now() / 250)) * 5;
    this.ctx.beginPath();
    this.ctx.arc(starX, starY, glowRad, 0, Math.PI * 2);
    const r = parseInt(starColor.substring(1,3), 16) || 255;
    const g = parseInt(starColor.substring(3,5), 16) || 200;
    const b = parseInt(starColor.substring(5,7), 16) || 0;
    this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.18)`;
    this.ctx.fill();

    // Draw star core
    this.ctx.beginPath();
    this.ctx.arc(starX, starY, 18, 0, Math.PI * 2);
    this.ctx.fillStyle = starColor;
    this.ctx.fill();

    // Draw solar boundary limit circle
    this.ctx.beginPath();
    this.ctx.arc(starX, starY, systemRadius, 0, Math.PI * 2);
    this.ctx.strokeStyle = "rgba(255, 51, 51, 0.2)";
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 5]);
    this.ctx.stroke();
    this.ctx.setLineDash([]); // reset

    // Draw orbiting planets
    this.ensureOrbitAngles(system);
    system.planets.forEach(planet => {
      const radiusPx = planet.radius * this.getOrbitScale(system);
      
      // Draw orbit path line
      this.ctx.beginPath();
      this.ctx.arc(starX, starY, radiusPx, 0, Math.PI * 2);
      this.ctx.strokeStyle = "rgba(0, 255, 102, 0.12)";
      this.ctx.stroke();

      // Orbit position
      const px = starX + Math.cos(planet.orbitAngle) * radiusPx;
      const py = starY + Math.sin(planet.orbitAngle) * radiusPx;

      // Draw planet body
      this.ctx.beginPath();
      this.ctx.arc(px, py, Math.max(5, planet.size / 2), 0, Math.PI * 2);
      this.ctx.fillStyle = planet.color;
      this.ctx.fill();

      // Highlight if ship orbiting this planet
      if (window.game.ship.currentPlanet === planet) {
        this.ctx.beginPath();
        this.ctx.arc(px, py, Math.max(5, planet.size / 2) + 5, 0, Math.PI * 2);
        this.ctx.strokeStyle = "rgba(0, 255, 102, 0.8)";
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
      }

      // Draw planet label
      this.ctx.font = "10px Share Tech Mono";
      this.ctx.fillStyle = "rgba(0, 255, 102, 0.85)";
      this.ctx.fillText(planet.name.toUpperCase(), px + 10, py + 3);
    });

    // Draw player ship in System Coordinates
    this.drawShip(this.shipX, this.shipY);
  },

  drawShip(x, y) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(this.shipAngle);

    // Engine thruster flame glow
    const isBoosting = this.keys["Shift"] || this.keys["ShiftLeft"] || this.keys["ShiftRight"];
    this.ctx.beginPath();
    this.ctx.moveTo(-4, 0);
    this.ctx.lineTo(isBoosting ? -22 : -12, isBoosting ? -6 : -4);
    this.ctx.lineTo(isBoosting ? -28 : -16, 0);
    this.ctx.lineTo(isBoosting ? -22 : -12, isBoosting ? 6 : 4);
    this.ctx.closePath();
    this.ctx.fillStyle = isBoosting ? "#00ccff" : "#ffaa00";
    this.ctx.shadowBlur = isBoosting ? 14 : 6;
    this.ctx.shadowColor = isBoosting ? "#00ccff" : "#ffaa00";
    this.ctx.fill();

    // Draw bright vector ship body
    this.ctx.shadowBlur = 8;
    this.ctx.shadowColor = "#00ff66";
    this.ctx.beginPath();
    this.ctx.moveTo(12, 0);    // Nose
    this.ctx.lineTo(-8, -8);  // Left wing tip
    this.ctx.lineTo(-4, 0);   // Rear center notch
    this.ctx.lineTo(-8, 8);   // Right wing tip
    this.ctx.closePath();

    this.ctx.fillStyle = "#0c2b14";
    this.ctx.fill();
    this.ctx.strokeStyle = "#00ff66";
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Draw shields halo if active
    if (window.game.ship && window.game.ship.shieldsActive) {
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 18, 0, Math.PI * 2);
      this.ctx.strokeStyle = "#00ccff";
      this.ctx.lineWidth = 2;
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = "#00ccff";
      this.ctx.stroke();
    }

    this.ctx.shadowBlur = 0;
    this.ctx.restore();
  },

  toggleShields() {
    if (window.game && window.game.toggleShields) {
      window.game.toggleShields();
    }
  },

  toggleWeapons() {
    if (window.game && window.game.toggleWeapons) {
      window.game.toggleWeapons();
    }
  }
  // NOTE: enterSpacebase() is defined once, above (docking repairs hull & heals crew).
  // Do not re-declare it here — a later duplicate silently shadows the real one.
};

window.Navigation = Navigation;
