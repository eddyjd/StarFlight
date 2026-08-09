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
  fuelDryAnnounced: false,
  lastShownFuel: -1,
  needsResize: true,
  starPhase: 0,
  patrolCooldown: 0,
  nearbyPatrol: null,
  activePatrols: null,

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
    // Populate the region the save is in. Without this the galaxy holds only the
    // three hard-coded vessels the file was authored with.
    try { this.generateTraffic(); } catch (e) { console.warn("generateTraffic failed", e); }
    this.setupListeners();
  },

  // Reading clientWidth/clientHeight forces a synchronous layout. This used to run
  // every single frame from draw(), and because the HUD writes text to the DOM each
  // frame the layout was always dirty - so every frame paid a forced reflow, which
  // shows up as irregular hitching. It now runs only when the viewport can actually
  // have changed (window resize, fullscreen toggle, view switch).
  resizeCanvas() {
    this.needsResize = false;
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
      if (e.key === "p" || e.key === "P") {
        if (this.autopilot) this.cancelAutopilot("cancelled by helm");
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
        } else if (this.nearbyCombatWreck) {
          this.salvageCombatWreck();
        } else if (this.nearbyDerelict) {
          this.boardNearbyDerelict();
        } else if (this.nearbyAlienPort) {
          this.dockAtAlienPort();
        }
      }
      if (e.key === "e" || e.key === "E") {
        if (this.nearbyDistressSignal) {
          this.investigateDistressSignal();
        } else if (window.game && window.game.ship.fuel <= 0 &&
                   !window.game.ship.isInSpacebase && window.game.viewState === "navigation") {
          UI.openRescueModal();
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

    window.addEventListener("resize", () => { this.needsResize = true; });
    document.addEventListener("fullscreenchange", () => { this.needsResize = true; });

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
        this.mapDragMoved = false;
        this.dragStartX = e.clientX - this.mapOffsetX;
        this.dragStartY = e.clientY - this.mapOffsetY;
        this.hideStarMapTooltip();
      });

      window.addEventListener("mousemove", (e) => {
        if (this.isDraggingMap) {
          const nx = e.clientX - this.dragStartX;
          const ny = e.clientY - this.dragStartY;
          if (Math.abs(nx - this.mapOffsetX) > 2 || Math.abs(ny - this.mapOffsetY) > 2) this.mapDragMoved = true;
          this.mapOffsetX = nx;
          this.mapOffsetY = ny;
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

      // Click a point on the chart to set course. Only on the chart of the region
      // the ship is actually in - an archived chart is a record, not a helm.
      starmapCanvas.addEventListener("click", (e) => {
        if (this.mapDragMoved) return;                  // a pan is not a course order
        if (RegionManager.viewedId() !== RegionManager.currentId()) {
          UI.addLog(this.foldPicking
            ? "FOLD NOT SET: A CHARGE CANNOT AIM AT A REGION THE SHIP IS NOT IN."
            : "COURSE NOT SET: THIS IS AN ARCHIVED CHART OF A REGION THE SHIP HAS LEFT.");
          return;
        }
        const gal = this.starMapToGalaxy(e);
        if (!gal) return;

        // An armed fold charge claims the click before the autopilot does
        if (this.foldPicking) {
          const hit = this.findStarMapTargetAt(e);
          const name = hit && hit.title ? hit.title.replace(/^[^A-Z0-9]*/, "") : null;
          this.fireFoldCharge(gal.x, gal.y, name);
          return;
        }
        // Snap to a charted object if the click was near one - a captain clicking
        // a star means that star, not a coordinate 3 LY off it.
        const snap = this.findStarMapTargetAt(e);
        const label = snap && snap.title ? snap.title.replace(/^[^A-Z0-9]*/, "") : null;
        if (this.engageAutopilot(gal.x, gal.y, label)) this.closeStarMapModal();
      });
    }

    // Click the hyperspace viewport to set course for that point
    const gameCanvas = document.getElementById("gameCanvas");
    if (gameCanvas) {
      gameCanvas.addEventListener("click", (e) => {
        const game = window.game;
        if (!game || game.viewState !== "navigation" || game.spaceState !== "hyper") return;
        const gal = this.canvasToGalaxy(e.clientX, e.clientY);
        if (gal) this.engageAutopilot(gal.x, gal.y, null);
      });
    }
  },

  /** Invert the star map projection for a click event. */
  starMapToGalaxy(e) {
    const canvas = document.getElementById("starmapCanvas");
    if (!canvas || !this.mapProjection) return null;
    const p = this.mapProjection;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);
    // Exact inverse of toCanvasX / toCanvasY in drawStarMapCanvas()
    const baseX = (px - p.centerX) / p.zoom + p.centerX - p.offsetX;
    const baseY = (py - p.centerY) / p.zoom + p.centerY - p.offsetY;
    return {
      x: ((baseX - p.originX) / p.mapW) * 500,
      y: ((baseY - p.originY) / p.mapH) * 500
    };
  },


  // ---- In-system sites ---------------------------------------------------
  // System mode rendered planets and nothing else, so every star looked the same
  // once you were inside it: a sun, some worlds, no reason to fly anywhere except
  // straight at the nearest planet.
  //
  // Sites are generated deterministically from the system name, the same trick
  // planet surfaces use - so a given system always holds the same things, in
  // every save, without authoring 29 systems by hand and getting nothing for free
  // in the regions. Roughly a third of systems carry anything at all.

  SITE_TYPES: {
    station: { icon: "⬟", color: "#00e5ff", label: "ORBITAL STATION", action: "BOARD STATION [B]" },
    wreck:   { icon: "🛸", color: "#ff9955", label: "DRIFTING WRECK", action: "SALVAGE WRECK [B]" },
    debris:  { icon: "∷", color: "#ccbb88", label: "DEBRIS FIELD",    action: "SWEEP DEBRIS [B]" }
  },

  /** Mulberry32 off a string, so a system's contents never move between saves. */
  siteRandom(seedString) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seedString.length; i++) {
      h ^= seedString.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return WormholeNet.prng(h);
  },

  /**
   * What orbits this star besides planets. Cached per system object so the
   * generator runs once, not every frame.
   */
  getSystemSites(system) {
    if (!system) return [];
    if (system.__sites) return system.__sites;

    const rand = this.siteRandom("sites:" + system.name);
    const sites = [];

    // Not every system. A system with nothing in it is a real answer - it makes
    // the ones that do carry something worth the flight.
    if (rand() < 0.34) {
      const count = rand() < 0.25 ? 2 : 1;
      const kinds = ["station", "wreck", "debris", "station", "wreck", "debris"];
      for (let i = 0; i < count; i++) {
        const kind = kinds[Math.floor(rand() * kinds.length)];
        sites.push({
          id: "site_" + system.name.replace(/\s+/g, "_").toLowerCase() + "_" + i,
          kind: kind,
          name: this.siteName(kind, system, rand),
          orbit: 0.42 + rand() * 0.5,     // fraction of the system radius
          angle: rand() * Math.PI * 2,
          drift: (rand() - 0.5) * 0.05,   // slow relative motion
          seed: Math.floor(rand() * 1e9)
        });
      }
    }

    system.__sites = sites;
    return sites;
  },

  siteName(kind, system, rand) {
    const stem = system.name.split(/\s+/)[0];
    if (kind === "station") {
      return [stem + " Waystation", stem + " Relay Post", "Abandoned " + stem + " Platform"][Math.floor(rand() * 3)];
    }
    if (kind === "wreck") {
      return [stem + " Hulk", "Wreck of the " + stem + " Runner", "Broken Hull, " + stem + " Orbit"][Math.floor(rand() * 3)];
    }
    return [stem + " Debris Belt", "Scattered Field, " + stem, stem + " Shatter Ring"][Math.floor(rand() * 3)];
  },

  /** Screen position of a site this frame. */
  sitePosition(system, site, starX, starY, systemRadius) {
    const r = systemRadius * site.orbit;
    return { x: starX + Math.cos(site.angle) * r, y: starY + Math.sin(site.angle) * r };
  },

  /** Already stripped? Uses the same salvage ledger as everything else. */
  siteLooted(site) {
    const ship = window.game && window.game.ship;
    return !!(ship && ship.salvagedIds && ship.salvagedIds[site.id]);
  },

  /**
   * Work a site. Stations and wrecks pay in modules and credits; debris is swept
   * for whatever the field happens to hold, which is where the minerals come from.
   */
  workNearbySite() {
    const site = this.nearbySite;
    if (!site || this.siteLooted(site)) return;
    const ship = window.game.ship;
    const rand = this.siteRandom("loot:" + site.id);

    window.game.markSalvaged(site.id);
    site.__looted = true;

    if (site.kind === "debris") {
      // A sweep yields ore, and occasionally something better. Respects the hold:
      // the tractor-scoop bug taught us not to load cargo we have no room for.
      const pool = ["iron", "silicate", "titanium", "gold", "platinum", "iridium", "precursor_alloy"];
      const key = pool[Math.floor(Math.pow(rand(), 2.2) * pool.length)];
      const qty = 1 + Math.floor(rand() * 3);
      const used = Object.keys(ship.cargo || {}).reduce((n, k) => n + (ship.cargo[k] || 0), 0);
      const room = Math.max(0, (ship.cargoCap || 20) - used);
      const took = Math.min(qty, room);

      UI.addLog(`SWEEPING ${site.name.toUpperCase()}...`);
      if (took > 0) {
        ship.cargo[key] = (ship.cargo[key] || 0) + took;
        const c = GameData.commodities[key];
        UI.addLog(`RECOVERED ${took}x ${String((c && c.name) || key).toUpperCase()} FROM THE FIELD.`);
      } else {
        UI.addLog("HOLD FULL. THE FIELD IS LEFT WHERE IT DRIFTS.");
      }
      if (rand() < 0.22 && typeof ClueLog !== "undefined") {
        ClueLog.record({
          id: "clue_" + site.id,
          title: "Salvaged Telemetry",
          text: `RECOVERED FROM ${site.name.toUpperCase()}: a fragment of a flight recorder. ` +
                `Whoever they were, they were logging the same thing you are.`,
          source: "wreck", sourceName: site.name
        });
        UI.addLog("A FLIGHT RECORDER FRAGMENT SURVIVED. LOGGED TO THE CAPTAIN'S LOG.");
      }
      if (typeof AudioController !== "undefined") AudioController.playBeep("success");
      UI.updateShip(ship);
      window.game.saveGame();
      return;
    }

    if (site.kind === "wreck") {
      const keys = Object.keys(GameData.techParts);
      const part = GameData.techParts[keys[Math.floor(rand() * keys.length)]];
      UI.addLog(`BOARDING ${site.name.toUpperCase()}. A MODULE SURVIVED THE BREAK-UP.`);
      UI.openTechPartModal(part);
      return;
    }

    // station
    const credits = 400 + Math.floor(rand() * 1400);
    ship.credits += credits;
    UI.addLog(`${site.name.toUpperCase()} IS DARK AND OPEN. STRIPPED THE LOCKERS FOR ${credits.toLocaleString()} M.U.`);
    if (rand() < 0.45) {
      const keys = Object.keys(GameData.techParts);
      const part = GameData.techParts[keys[Math.floor(rand() * keys.length)]];
      UI.addLog("SOMETHING IN THE ENGINEERING BAY IS STILL INTACT.");
      UI.openTechPartModal(part);
    } else {
      if (typeof AudioController !== "undefined") AudioController.playBeep("success");
    }
    UI.updateShip(ship);
    window.game.saveGame();
  },

  // ---- Nebulae -----------------------------------------------------------
  // Every nebula in the game shipped with a description promising an effect -
  // boosted shield recharge, scanner interference, Endurium concentrations - and
  // none of them did anything at all. They were also invisible from the cockpit:
  // drawn on the star map only, so you could fly through one and never know.

  NEBULA_EFFECTS: {
    shield_boost:  { label: "IONISED FIELD",       hud: "SHIELD RECHARGE x3",        color: "#66ffcc" },
    scanner_blind: { label: "SENSOR INTERFERENCE", hud: "SCAN RANGE -60%",           color: "#ff8866" },
    fuel_rich:     { label: "ENDURIUM RICH",       hud: "SLOW REACTOR REPLENISH",    color: "#ffee88" },
    radiation:     { label: "GAMMA RIFT",          hud: "SHIELD DRAIN - HULL AT RISK", color: "#ff5555" },
    hull_stress:   { label: "COMPRESSION FIELD",   hud: "HULL UNDER LOAD",           color: "#ffaa44" },
    stealth:       { label: "DAMPENING FIELD",     hud: "RUNNING DARK - NO CONTACT", color: "#88aaff" },
    bio_rich:      { label: "BIO-PLASMA MIST",     hud: "SCAN RANGE +40%",           color: "#66ff99" },
    safe:          { label: "CORE AURA",           hud: "NO MEASURABLE EFFECT",      color: "#00ffaa" }
  },

  /** The nebula the ship is currently inside, or null. Set once per frame. */
  updateNebula() {
    this.activeNebula = null;
    const list = RegionManager.content('nebulae');
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      if (Math.hypot(this.shipX - n.x, this.shipY - n.y) < (n.radius || 60)) {
        this.activeNebula = n;
        this.markContact(n.id, 2);
        break;
      }
    }
    return this.activeNebula;
  },

  /** Effect key of the nebula the ship is in, or null in clear space. */
  nebulaEffect() {
    const n = this.activeNebula;
    return (n && n.effect) || null;
  },

  /**
   * Per-frame consequences of sitting inside a cloud. Kept in one place so the
   * HUD readout and the actual mechanics can never disagree.
   */
  applyNebulaEffects(dt) {
    const eff = this.nebulaEffect();
    if (!eff) {
      if (this.nebulaWarned) { UI.addLog("CLEAR OF THE CLOUD. SENSORS AND SYSTEMS NOMINAL."); this.nebulaWarned = null; }
      return;
    }

    const ship = window.game.ship;
    const meta = this.NEBULA_EFFECTS[eff];

    // Announce once on entry rather than every frame
    if (this.nebulaWarned !== this.activeNebula.id) {
      this.nebulaWarned = this.activeNebula.id;
      UI.addLog(`ENTERING ${this.activeNebula.name.toUpperCase()} - ${(meta ? meta.label : eff).toUpperCase()}.`);
      if (this.activeNebula.desc) UI.addLog(this.activeNebula.desc);
      if (meta) UI.addLog(`EFFECT: ${meta.hud}`);
    }

    if (eff === "fuel_rich") {
      // Scooping raw Endurium out of the cloud. Deliberately slow - about a unit
      // every eight seconds - so it relieves a bad situation without replacing
      // the need to buy fuel.
      if (ship.fuel < ship.maxFuel) {
        ship.fuel = Math.min(ship.maxFuel, ship.fuel + dt * 0.125);
      }
    } else if (eff === "radiation") {
      // Shields soak it. With none up, the hull takes it instead.
      if (ship.shieldsActive && (ship.shieldsCharge || 0) > 0) {
        ship.shieldsCharge = Math.max(0, ship.shieldsCharge - dt * 4.0);
      } else {
        ship.hull = Math.max(0, (ship.hull || 0) - dt * 1.2);
        this.nebulaHurtAccum = (this.nebulaHurtAccum || 0) + dt;
        if (this.nebulaHurtAccum > 3) {
          this.nebulaHurtAccum = 0;
          UI.addLog(`GAMMA FLUX BURNING THROUGH UNSHIELDED PLATING - HULL ${Math.round(ship.hull)}.`);
        }
      }
    } else if (eff === "hull_stress") {
      // Pressure, not radiation, so shields do not help. Slower than the rift.
      ship.hull = Math.max(0, (ship.hull || 0) - dt * 0.6);
      this.nebulaHurtAccum = (this.nebulaHurtAccum || 0) + dt;
      if (this.nebulaHurtAccum > 4) {
        this.nebulaHurtAccum = 0;
        UI.addLog(`THE HULL IS GROANING UNDER THE PRESSURE - INTEGRITY ${Math.round(ship.hull)}.`);
      }
    }

    // Same end-of-ship path combat uses, rather than a second one that would
    // leave the captain flying a wreck with zero hull.
    if ((ship.hull || 0) <= 0 && typeof Encounter !== "undefined" && Encounter.triggerGameOver) {
      Encounter.triggerGameOver();
    }
  },

  /** Scanner multiplier from the surrounding cloud. 1.0 in clear space. */
  nebulaScanMult() {
    const eff = this.nebulaEffect();
    if (eff === "scanner_blind") return 0.4;
    if (eff === "bio_rich") return 1.4;
    return 1.0;
  },

  /** Shield recharge multiplier from the surrounding cloud. */
  nebulaShieldMult() {
    const eff = this.nebulaEffect();
    if (eff === "shield_boost") return 3.0;
    if (eff === "radiation") return 0.0;
    return 1.0;
  },

  /** Running dark: a dampening field keeps aliens from finding you. */
  nebulaHidesShip() {
    return this.nebulaEffect() === "stealth";
  },

  /** If some region declares this singularity as its entry point, name it. */
  regionEntryFor(blackHoleId) {
    const regions = (typeof GameData !== "undefined" && GameData.regions) || {};
    const hit = Object.keys(regions).find(k => regions[k].entryFrom === blackHoleId);
    return hit || null;
  },

  /**
   * Where a singularity actually goes, in one place. Three authoring forms exist
   * because the topology grew: `leadsTo` is explicit (preferred), `returnsTo`
   * names the parent and takes the current region's authored return point, and
   * `entryFrom` is declared on the far region instead of on the gate.
   *
   * Returns null for an ordinary displacement well that just throws you across
   * the same quadrant.
   */
  /**
   * Every distress call the ship could answer here: the authored ones placed in
   * the region, plus whatever has come in over the band. Anything that reads
   * signals must go through this, or dynamic calls become invisible to it.
   */
  allDistressSignals() {
    const authored = RegionManager.content('distressSignals') || [];
    const dynamic = (typeof DistressNet !== "undefined") ? DistressNet.activeHere() : [];
    return authored.concat(dynamic);
  },

  // ---- Alien traffic -----------------------------------------------------
  // The galaxy shipped with exactly three alien vessels, hard-coded, all in the
  // core - so a captain could fly for an hour across a 500x500 quadrant and meet
  // nobody, and the deep regions were completely empty of anyone at all.
  //
  // Traffic is now generated per region from a `traffic` profile in the region
  // data, and regenerated on transit.

  RACE_LOOK: {
    spemin: { name: "Spemin", color: "#00ff66", hulls: ["Scout", "Gleaner", "Bladder-Ship", "Drifter"] },
    thrynn: { name: "Thrynn", color: "#ffcc00", hulls: ["Trader", "Ledger-Barge", "Factor", "Caravan"] },
    veloxi: { name: "Veloxi", color: "#ff5533", hulls: ["Cruiser", "Picket", "Lance", "Enforcer"] },
    uhlek:  { name: "Uhlek",  color: "#ff3333", hulls: ["Interceptor", "Hive-Fragment", "Swarm", "Render"] }
  },

  trafficProfile() {
    const id = RegionManager.currentId();
    if (id === "core") return GameData.traffic || { count: 6, races: ["spemin", "veloxi", "uhlek"] };
    const region = RegionManager.get(id) || {};
    return region.traffic || { count: 4, races: ["uhlek"] };
  },

  /**
   * Populate this region with vessels. Called on boot and on every region transit,
   * so the Marrow is full of stranded Spemin and the Lattice of Veloxi pickets
   * without any of it being authored ship by ship.
   */
  generateTraffic() {
    const profile = this.trafficProfile();
    const races = profile.races || ["veloxi"];
    const count = profile.count || 5;
    const ships = [];

    for (let i = 0; i < count; i++) {
      const raceKey = races[Math.floor(Math.random() * races.length)];
      const look = this.RACE_LOOK[raceKey] || this.RACE_LOOK.veloxi;
      const hull = look.hulls[Math.floor(Math.random() * look.hulls.length)];
      const speed = 0.5 + Math.random() * 1.1;
      const heading = Math.random() * Math.PI * 2;

      // Keep them out of Starbase Prime's lap - the Corps does police that much
      let x, y, tries = 0;
      do {
        x = 25 + Math.random() * 450;
        y = 25 + Math.random() * 450;
        tries++;
      } while (RegionManager.isCore() && Math.hypot(x - 250, y - 250) < 45 && tries < 40);

      ships.push({
        raceKey: raceKey,
        name: `${look.name} ${hull}`,
        x: x, y: y,
        vx: Math.cos(heading) * speed,
        vy: Math.sin(heading) * speed,
        angle: heading,
        color: look.color,
        hp: 100,
        stance: null,
        provoked: false
      });
    }

    this.alienShips = ships;
    return ships;
  },

  // ---- Alien disposition -------------------------------------------------
  // GameData.aliens has carried an `aggression` value per race from the start -
  // 0.3 Spemin, 0.6 Veloxi, 1.0 Uhlek - and nothing ever read it. Every vessel of
  // every race fired on sight at exactly the same rate, so the galaxy had one
  // temperament and the numbers were decoration.
  //
  // A vessel now decides once, when it first notices you, and remembers. Firing on
  // anything makes it hostile permanently: that is a choice you do not get back.

  ALIEN_STANCE: {
    hostile:  { label: "HOSTILE",  color: "#ff3333", hail: "WEAPONS HOT" },
    wary:     { label: "WARY",     color: "#ffaa22", hail: "TRACKING YOU" },
    peaceful: { label: "PEACEFUL", color: "#00ff66", hail: "NOT ENGAGING" }
  },

  /**
   * Decide how this vessel feels about the ISS Odyssey, once, and cache it.
   *
   * Aggression is the chance it is simply hostile. Beyond that, a wary vessel
   * turns hostile if the captain approaches with weapons armed - which makes
   * running hot a real decision rather than a free upgrade.
   */
  alienStance(alien) {
    if (!alien) return "peaceful";
    if (alien.provoked) return "hostile";
    if (alien.stance) {
      // A wary vessel keeps re-reading the room: come in armed and it commits.
      if (alien.stance === "wary" && window.game.ship.weaponsArmed) return "hostile";
      return alien.stance;
    }

    const race = (GameData.aliens && GameData.aliens[alien.raceKey]) || {};
    const aggression = (typeof race.aggression === "number") ? race.aggression : 0.5;

    // Seeded off the vessel so a given ship behaves consistently within a session
    const roll = Math.random();
    alien.stance = (roll < aggression) ? "hostile"
                 : (roll < aggression + 0.35) ? "wary"
                 : "peaceful";
    return this.alienStance(alien);
  },

  /** Mark a vessel as having been shot at. There is no going back from this. */
  provokeAlien(alien) {
    if (!alien || alien.provoked) return;
    alien.provoked = true;
    alien.stance = "hostile";
    UI.addLog(`${String(alien.name).toUpperCase()} HAS BEEN FIRED ON AND IS RETURNING FIRE.`);
  },

  /** Reset dispositions - used when traffic is regenerated for a region. */
  clearAlienStances() {
    this.alienShips.forEach(a => { a.stance = null; a.provoked = false; });
  },

  // ---- Fold charges ------------------------------------------------------
  // A Precursor Fold Charge is the one thing in the game that ignores distance.
  // It is priced accordingly, and it is spent only when it actually fires - a
  // captain who opens the chart and thinks better of it keeps the charge.

  executeFold(x, y, label) {
    const ship = window.game.ship;
    const fromX = this.shipX, fromY = this.shipY;

    this.foldPicking = false;
    this.autopilot = null;
    this.shipX = Math.max(5, Math.min(495, x));
    this.shipY = Math.max(5, Math.min(495, y));
    this.shipVx = 0;
    this.shipVy = 0;
    ship.coordinates.x = this.shipX;
    ship.coordinates.y = this.shipY;
    this.driftWarned = null;
    this.gravityGrip = null;

    const jumped = Math.hypot(this.shipX - fromX, this.shipY - fromY);
    UI.addLog("FOLD CHARGE FIRED. THE HULL GOES SOMEWHERE THE HULL IS NOT SUPPOSED TO GO.");
    UI.addLog(`EMERGED AT (${this.shipX.toFixed(0)}, ${this.shipY.toFixed(0)})` +
              (label ? ` - ${String(label).toUpperCase()}` : "") +
              ` AFTER ${jumped.toFixed(0)} LY.`);
    if (!label) UI.addLog("THE CHARGE CHOSE. IT USUALLY DOES NOT CHOOSE WELL.");

    // Arriving somewhere charts where you arrived
    this.revealSectorsWithin(25);
    if (typeof AudioController !== "undefined" && AudioController.playBeep) AudioController.playBeep("powerup");
    window.game.saveGame();
  },

  /** Called when the captain clicks a destination while a charge is armed. */
  fireFoldCharge(x, y, label) {
    if (!this.foldPicking) return false;
    if (!Consumables.consume("fold_charge")) {
      this.foldPicking = false;
      UI.addLog("NO FOLD CHARGE ABOARD.");
      return false;
    }
    this.closeStarMapModal();
    this.executeFold(x, y, label);
    UI.updateShip(window.game.ship);
    return true;
  },

  cancelFoldPicking() {
    if (!this.foldPicking) return;
    this.foldPicking = false;
    UI.addLog("FOLD CHARGE STOOD DOWN. STILL ABOARD, STILL UNSPENT.");
  },

  // ---- Autopilot ---------------------------------------------------------
  // Crossing the quadrant is deliberately slow, which is right for pacing and
  // tedious for the fourth trip to the same coordinates. The autopilot flies the
  // leg; it does not skip it. Fuel and time are spent exactly as if hand-flown.
  //
  // It disengages the moment anything happens that a captain would want to see:
  // manual input, an alien in range, or a gravity well taking hold.

  AUTOPILOT_ARRIVE: 1.5,   // LY from target that counts as arrived
  AUTOPILOT_EASE: 12,      // LY out from target where it starts slowing

  engageAutopilot(x, y, label) {
    const game = window.game;
    if (!game || game.viewState !== "navigation" || game.spaceState !== "hyper") {
      UI.addLog("AUTOPILOT UNAVAILABLE: HYPERSPACE FLIGHT ONLY.");
      return false;
    }
    if (game.ship.fuel <= 0) {
      UI.addLog("AUTOPILOT REFUSED: NO REACTOR POWER. THE HELM HAS NOTHING TO WORK WITH.");
      return false;
    }
    const tx = Math.max(5, Math.min(495, x));
    const ty = Math.max(5, Math.min(495, y));
    if (Math.hypot(tx - this.shipX, ty - this.shipY) < this.AUTOPILOT_ARRIVE) {
      UI.addLog("AUTOPILOT: ALREADY THERE.");
      return false;
    }

    this.autopilot = { x: tx, y: ty, label: label || null };
    UI.addLog(`AUTOPILOT ENGAGED: HELM SET FOR (${tx.toFixed(0)}, ${ty.toFixed(0)})` +
              (label ? ` - ${String(label).toUpperCase()}` : "") + ".");
    UI.addLog("ANY MANUAL INPUT DISENGAGES. PRESS [P] TO CANCEL.");
    if (typeof AudioController !== "undefined" && AudioController.playBeep) AudioController.playBeep("click");
    return true;
  },

  cancelAutopilot(reason) {
    if (!this.autopilot) return;
    this.autopilot = null;
    if (reason) UI.addLog(`AUTOPILOT DISENGAGED: ${String(reason).toUpperCase()}.`);
    if (typeof AudioController !== "undefined" && AudioController.playBeep) AudioController.playBeep("click");
  },

  /**
   * Fly the leg. Returns true when it took the helm this frame, so the manual
   * thrust block knows to stand off.
   */
  updateAutopilot(dt) {
    const ap = this.autopilot;
    if (!ap) return false;
    const game = window.game;
    const ship = game.ship;

    // Hand back for anything worth looking at
    if (game.viewState !== "navigation" || game.spaceState !== "hyper") {
      this.cancelAutopilot("flight state changed");
      return false;
    }
    if (this.keys["w"] || this.keys["W"] || this.keys["KeyW"] ||
        this.keys["a"] || this.keys["A"] || this.keys["KeyA"] ||
        this.keys["d"] || this.keys["D"] || this.keys["KeyD"] ||
        this.keys["ArrowUp"] || this.keys["ArrowLeft"] || this.keys["ArrowRight"]) {
      this.cancelAutopilot("manual helm input");
      return false;
    }
    if (ship.fuel <= 0) {
      this.cancelAutopilot("reactor exhausted");
      return false;
    }
    if (this.nearbyAlien) {
      this.cancelAutopilot(`vessel in range - ${this.nearbyAlien.name}`);
      return false;
    }
    if (this.gravityGrip && this.gravityGrip.inWell) {
      this.cancelAutopilot(`gravity well - ${this.gravityGrip.bh.name}`);
      return false;
    }

    const dx = ap.x - this.shipX, dy = ap.y - this.shipY;
    const dist = Math.hypot(dx, dy);
    if (dist < this.AUTOPILOT_ARRIVE) {
      this.shipVx *= 0.5;
      this.shipVy *= 0.5;
      this.autopilot = null;
      UI.addLog(`AUTOPILOT: ARRIVED AT (${ap.x.toFixed(0)}, ${ap.y.toFixed(0)})` +
                (ap.label ? ` - ${String(ap.label).toUpperCase()}` : "") + ". HELM RETURNED.");
      if (typeof AudioController !== "undefined" && AudioController.playBeep) AudioController.playBeep("success");
      return true;
    }

    // Turn onto the bearing at the same rate a hand on the helm manages
    const want = Math.atan2(dy, dx);
    let diff = want - this.shipAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const navSkill = (ship.crew && ship.crew.navigator) ? ship.crew.navigator.skill : 40;
    const turn = (3.0 + navSkill / 50) * dt;
    this.shipAngle += Math.max(-turn, Math.min(turn, diff));

    // Burn only when roughly pointed the right way, and ease off on approach so
    // it does not sail past the target and have to come back.
    const aligned = Math.abs(diff) < 0.5;
    if (!aligned) return true;

    const engine = GameData.upgrades.engines[(ship.engineLevel || 1) - 1] || GameData.upgrades.engines[0];
    const mass = 1.0 + (UI.calculateCargoMass(ship.cargo) / 100);
    const ease = Math.min(1, dist / this.AUTOPILOT_EASE);
    const grip = this.gravityGrip;
    const authority = grip ? grip.authority : 1;
    const thrust = ((2.5 + (ship.engineLevel * 2.0)) / mass) * 2.5 * ease * authority;

    this.shipVx += Math.cos(this.shipAngle) * thrust * dt;
    this.shipVy += Math.sin(this.shipAngle) * thrust * dt;

    // The leg costs what it would cost hand-flown - the autopilot saves attention,
    // not Endurium.
    const engSkill = (ship.crew && ship.crew.engineer) ? ship.crew.engineer.skill : 40;
    const wellCost = grip ? grip.fuelMult : 1;
    ship.fuel = Math.max(0, ship.fuel - (engine.fuelMult * (1.2 - engSkill / 200)) * wellCost * dt);
    if (Math.ceil(this.lastShownFuel) !== Math.ceil(ship.fuel)) {
      this.lastShownFuel = ship.fuel;
      if (UI.updateShip) UI.updateShip(ship);
    }
    if (typeof AudioController !== "undefined") AudioController.updateEnginePitch(0.8);
    return true;
  },

  /** Turn a click on the hyperspace viewport into galaxy coordinates. */
  canvasToGalaxy(clientX, clientY) {
    if (!this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    // The canvas backing store may not match its CSS size
    const sx = (clientX - rect.left) * (this.canvas.width / rect.width);
    const sy = (clientY - rect.top) * (this.canvas.height / rect.height);
    const scale = 14;   // must match drawHyper()
    return {
      x: this.shipX + (sx - this.canvas.width / 2) / scale,
      y: this.shipY + (sy - this.canvas.height / 2) / scale
    };
  },

  // ---- Gravity wells -----------------------------------------------------
  // A singularity used to be binary: outside gravityRadius nothing happened at
  // all, inside it you were already being hauled in hard. There was no moment of
  // "something is off with our heading" - just a wall.
  //
  // Three zones now:
  //   DRIFT  out to gravityRadius * DRIFT_SPAN. A pull small enough to miss if
  //          you are not watching your heading. This is the warning you get.
  //   WELL   inside gravityRadius. The old hard ramp takes over.
  //   CORE   inside coreRadius. Transit or displacement.
  //
  // Inside the well the engines lose authority the deeper you are, and burn more
  // fuel doing it - so overdrive gets you out if you hit it AS SOON as the drift
  // shows, and cannot if you wait to be sure.

  DRIFT_SPAN: 2.4,        // outer drift reaches this multiple of gravityRadius
  DRIFT_STRENGTH: 0.05,   // fraction of pullForce felt at the drift/well boundary
  MIN_AUTHORITY: 0.18,    // engine effectiveness at the event horizon
  MAX_FUEL_PENALTY: 5.0,  // extra fuel burn multiplier fighting a well

  /**
   * The strongest well acting on the ship right now, and what it does to the
   * engines. Computed once per frame BEFORE thrust is applied, so the throttle
   * and the pull agree with each other.
   */
  computeGravityGrip() {
    let best = null;
    RegionManager.content('blackHoles').forEach(bh => {
      const dist = Math.hypot(this.shipX - bh.x, this.shipY - bh.y);
      const outer = bh.gravityRadius * this.DRIFT_SPAN;
      if (dist >= outer) return;
      if (best && dist / outer >= best.ratio) return;
      best = { bh: bh, dist: dist, outer: outer, ratio: dist / outer };
    });

    if (!best) {
      this.gravityGrip = null;
      if (this.driftWarned) { this.driftWarned = null; }
      return null;
    }

    const bh = best.bh, dist = best.dist;
    const gR = bh.gravityRadius, cR = bh.coreRadius || 3;
    const inWell = dist < gR;

    let pull, authority, fuelMult;
    if (inWell) {
      pull = (1 - (dist / gR)) * bh.pullForce;
      // Authority falls off toward the horizon, so hesitation is what kills you
      const t = Math.max(0, Math.min(1, (dist - cR) / Math.max(0.001, gR - cR)));
      authority = this.MIN_AUTHORITY + (1 - this.MIN_AUTHORITY) * t;
      fuelMult = 1 + (1 - t) * this.MAX_FUEL_PENALTY;
    } else {
      // Drift zone: strongest at the well boundary, fading to nothing outside
      const t = (best.outer - dist) / Math.max(0.001, best.outer - gR);
      pull = bh.pullForce * this.DRIFT_STRENGTH * t;
      authority = 1;
      fuelMult = 1;
    }

    this.gravityGrip = {
      bh: bh, dist: dist, pull: pull, authority: authority,
      fuelMult: fuelMult, inWell: inWell, zone: inWell ? "well" : "drift"
    };
    return this.gravityGrip;
  },

  /** Apply the pull worked out by computeGravityGrip, and handle the horizon. */
  applyGravityGrip(dt) {
    const grip = this.gravityGrip;
    this.nearbyBlackHole = null;
    if (!grip) return false;

    const bh = grip.bh;
    if (grip.inWell) this.nearbyBlackHole = bh;

    const angle = Math.atan2(bh.y - this.shipY, bh.x - this.shipX);
    this.shipVx += Math.cos(angle) * grip.pull * dt;
    this.shipVy += Math.sin(angle) * grip.pull * dt;

    // One line when the drift first becomes noticeable, and one when the well
    // takes hold. Said once each, not every frame.
    const stamp = bh.id + ":" + grip.zone;
    if (this.driftWarned !== stamp) {
      this.driftWarned = stamp;
      if (grip.zone === "drift") {
        UI.addLog(`NAVIGATION NOTE: HEADING IS DRIFTING. SOMETHING WITH MASS IS OUT THERE.`);
      } else {
        UI.addLog(`GRAVITY WARNING: ${bh.name.toUpperCase()} HAS THE SHIP. FULL OVERDRIVE NOW OR NOT AT ALL.`);
        if (typeof AudioController !== "undefined" && AudioController.playBeep) AudioController.playBeep("error");
      }
    }

    if (grip.dist < (bh.coreRadius || 3)) {
      this.crossEventHorizon(bh);
      return true;
    }
    return false;
  },

  /** Past the horizon: either a displacement, or transit out of this region. */
  crossEventHorizon(bh) {
    if (typeof AudioController !== "undefined" && AudioController.playBeep) AudioController.playBeep("powerup");
    UI.addLog(`CRITICAL WARP DISPLACEMENT! PULLED INTO ${bh.name.toUpperCase()} EVENT HORIZON!`);
    UI.addLog(`REEMERGED AT DISPLACED COORDINATES (${bh.destX}, ${bh.destY}).`);
    this.shipX = bh.destX;
    this.shipY = bh.destY;
    this.shipVx = 0;
    this.shipVy = 0;
    this.driftWarned = null;
    this.gravityGrip = null;
    this.markLinkTraversed(bh.id);
    this.markContact(bh.id, 2);

    // A singularity that names a destination region is a gateway, not a
    // displacement - it carries the ship out of this volume entirely.
    const gateway = this.resolveGateway(bh);
    if (gateway) {
      if (gateway.oneWay) UI.addLog("THE FOLD SEALS BEHIND THE SHIP. THERE IS NO MOUTH ON THIS SIDE.");
      RegionManager.travelTo(gateway.region, gateway.x, gateway.y);
    }
  },

  /**
   * Has this ship been through this singularity? Until it has, the chart may say
   * a fold is there but not where it goes - the mystery is the point.
   */
  gateCharted(bh) {
    const ship = window.game && window.game.ship;
    return !!(bh && ship && ship.traversedLinks && ship.traversedLinks[bh.id]);
  },

  resolveGateway(bh) {
    if (!bh) return null;
    const dest = bh.leadsTo || bh.returnsTo || this.regionEntryFor(bh.id);
    if (!dest || typeof RegionManager === "undefined") return null;

    let x, y;
    if (bh.exitAt) {
      x = bh.exitAt.x; y = bh.exitAt.y;
    } else if (bh.returnsTo) {
      const here = RegionManager.current();
      if (here && here.returnTo) { x = here.returnTo.x; y = here.returnTo.y; }
    }
    return { region: dest, x: x, y: y, oneWay: !!bh.oneWay };
  },

  // ---- Starbase Prime Customs Patrols -------------------------------------
  // Cutters sweep the core sectors and hail any vessel that comes close. What
  // they find depends on whether Shielded Cargo Bays (cargo class 3+) are fitted,
  // which is the mechanic that upgrade always advertised but never had.
  getPatrols() {
    if (!this.activePatrols) {
      const src = (GameData.patrols || []);
      // baseSpeed is captured ONCE from the authored velocity. Deriving it from
      // the current velocity each frame made the response burn multiply its own
      // speed by 1.8 every frame - cutters accelerated to 1e306 and then to NaN,
      // which permanently broke patrols in any save where a call was answered.
      this.activePatrols = src.map(p => {
        const copy = Object.assign({}, p);
        copy.baseSpeed = Math.hypot(p.vx || 0, p.vy || 0) || 4;
        return copy;
      });
    }
    return this.activePatrols;
  },

  countContraband(ship) {
    let n = 0;
    const cargo = (ship && ship.cargo) || {};
    for (const key in cargo) {
      const c = GameData.commodities[key];
      if (c && c.isContraband) n += cargo[key] || 0;
    }
    return n;
  },

  hasShieldedHold(ship) {
    return (ship && ship.cargoLevel || 1) >= 3;
  },

  /**
   * Send the nearest available cutter to a distress call. Customs answers calls
   * inside its own jurisdiction and nowhere else - a beacon out past the zone is
   * exactly as alone as the Reach beacons say it is.
   */
  dispatchPatrolTo(sig) {
    if (!sig || (sig.region || "core") !== "core") return null;
    const zone = GameData.patrolZone || { x: 250, y: 250, radius: 130 };
    if (Math.hypot(sig.x - zone.x, sig.y - zone.y) > zone.radius) return null;

    const free = this.getPatrols().filter(p => !p.respondingTo);
    if (!free.length) return null;

    free.sort((a, b) => Math.hypot(a.x - sig.x, a.y - sig.y) - Math.hypot(b.x - sig.x, b.y - sig.y));
    const cutter = free[0];
    cutter.respondingTo = sig.id;
    cutter.targetX = sig.x;
    cutter.targetY = sig.y;
    UI.addLog(`SFC TRAFFIC: ${cutter.name.toUpperCase()} IS ANSWERING THE CALL AT (${sig.x}, ${sig.y}).`);
    return cutter;
  },

  /** Stand a cutter down once the call it was answering is over. */
  recallPatrolFrom(sig) {
    if (!sig) return;
    this.getPatrols().forEach(p => {
      if (p.respondingTo === sig.id) {
        p.respondingTo = null;
        p.targetX = null;
        p.targetY = null;
        UI.addLog(`SFC TRAFFIC: ${p.name.toUpperCase()} IS RETURNING TO STATION.`);
      }
    });
  },

  /**
   * Customs cutters hold station near Starbase Prime. They used to wander the
   * whole 130 LY jurisdiction, which meant being stopped and searched hundreds of
   * light years from anywhere the Corps actually polices - and made the core feel
   * no safer than the rim.
   *
   * A cutter leaves station for exactly one reason: a distress call inside the
   * zone. Then it goes back.
   */
  updatePatrols(dt) {
    const game = window.game;
    const ship = game.ship;
    if (typeof RegionManager !== "undefined" && !RegionManager.isCore()) { this.nearbyPatrol = null; return; }
    const zone = GameData.patrolZone || { x: 250, y: 250, radius: 130 };
    const cfg = GameData.customs || {};
    const station = cfg.stationRadius || 40;

    if (this.patrolCooldown > 0) this.patrolCooldown = Math.max(0, this.patrolCooldown - dt);

    this.nearbyPatrol = null;
    this.getPatrols().forEach(p => {
      const speed = p.baseSpeed || (p.baseSpeed = Math.hypot(p.vx, p.vy) || 4);

      if (p.respondingTo && typeof p.targetX === "number") {
        // Running a call: straight there, faster than a station patrol bothers to move
        const dx = p.targetX - p.x, dy = p.targetY - p.y;
        const d = Math.hypot(dx, dy);
        if (d > 3) {
          const run = speed * 1.8;
          p.vx = (dx / d) * run;
          p.vy = (dy / d) * run;
        } else {
          // On scene. Hold here until the call resolves or lapses.
          p.vx *= 0.3;
          p.vy *= 0.3;
        }
      } else {
        // On station: loiter around the base, turning back at the station edge
        const dFromBase = Math.hypot(p.x - zone.x, p.y - zone.y);
        if (dFromBase > station) {
          const inward = Math.atan2(zone.y - p.y, zone.x - p.x);
          // Curve back rather than snapping round, so the patrol reads as a patrol
          const blend = Math.min(1, (dFromBase - station) / 12);
          p.vx = p.vx * (1 - blend) + Math.cos(inward) * speed * blend;
          p.vy = p.vy * (1 - blend) + Math.sin(inward) * speed * blend;
          const norm = Math.hypot(p.vx, p.vy) || 1;
          p.vx = (p.vx / norm) * speed;
          p.vy = (p.vy / norm) * speed;
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle = Math.atan2(p.vy, p.vx);

      const dist = Math.hypot(this.shipX - p.x, this.shipY - p.y);
      if (dist < (cfg.hailRange || 7.0)) {
        this.nearbyPatrol = p;
        // A cutter running a call has somewhere to be, and the Ghost Baffle means
        // nothing is looking at this hull at all.
        const busy = !!p.respondingTo;
        const ghosted = this.isGhosted();
        if (!busy && !ghosted && this.patrolCooldown <= 0 &&
            game.viewState === "navigation" && game.spaceState === "hyper") {
          this.patrolCooldown = cfg.cooldownSeconds || 45;
          UI.openPatrolModal(p);
        }
      }
    });
  },

  /** True while a Precursor Ghost Baffle is running. */
  isGhosted() {
    const ship = window.game && window.game.ship;
    if (!ship || this.ghostUntil == null) return false;
    if ((ship.playClock || 0) >= this.ghostUntil) { this.ghostUntil = null; return false; }
    return true;
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
      ship.mapLayers = { systems: true, anomalies: true, salvage: true, aliens: true, patrols: true, ports: true, nebulae: true, unknown: true };
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
      ["aliens", "aliens"], ["patrols", "patrols"], ["ports", "ports"], ["nebulae", "nebulae"], ["unknown", "unknown"]
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
    {
      RegionManager.content('wormholes').forEach(wh => {
        if (ship.traversedLinks[wh.id]) {
          links.push({ x: wh.x, y: wh.y, tx: wh.targetX, ty: wh.targetY, color: "#00e5ff", label: "RIFT EXIT" });
        }
      });
    }
    if (RegionManager.content('blackHoles').length) {
      RegionManager.content('blackHoles').forEach(bh => {
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

  // The HUD is rewritten every frame in flight; caching the nodes avoids three
  // document.getElementById lookups per frame and only touches the DOM when the
  // displayed text actually changes.
  setHudText(key, id, value) {
    if (!this.hudNodes) this.hudNodes = {};
    if (!this.hudNodes[key]) this.hudNodes[key] = document.getElementById(id);
    const el = this.hudNodes[key];
    if (el && el.textContent !== value) el.textContent = value;
  },

  // Label text is drawn every frame for every visible object. Building it with
  // .toUpperCase() each time allocated dozens of throwaway strings per frame,
  // which is needless GC pressure in the render loop. Compute once, reuse.
  labelFor(obj) {
    if (!obj) return "";
    if (obj.__label === undefined) obj.__label = String(obj.name || "").toUpperCase();
    return obj.__label;
  },

  /**
   * Chart the fog-of-war sectors a sweep actually covers. Scanning used to name
   * objects without revealing any map, so the star map stayed dark in places the
   * sensors had plainly just swept.
   */
  revealSectorsWithin(radius) {
    const ship = window.game.ship;
    if (!ship.exploredSectors) ship.exploredSectors = {};
    let fresh = 0;
    const step = 25;
    const minX = Math.max(0, Math.floor((this.shipX - radius) / step) * step);
    const maxX = Math.min(500, Math.ceil((this.shipX + radius) / step) * step);
    const minY = Math.max(0, Math.floor((this.shipY - radius) / step) * step);
    const maxY = Math.min(500, Math.ceil((this.shipY + radius) / step) * step);
    for (let x = minX; x <= maxX; x += step) {
      for (let y = minY; y <= maxY; y += step) {
        // sector centre inside the sweep
        if (Math.hypot((x + step / 2) - this.shipX, (y + step / 2) - this.shipY) > radius) continue;
        const key = `${x}_${y}`;
        if (!ship.exploredSectors[key]) { ship.exploredSectors[key] = true; fresh++; }
      }
    }
    return fresh;
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
    // A cloud that says it blinds sensors now actually blinds them.
    const neb = this.nebulaScanMult();
    return {
      short: 25 * scannerMult * navBonus * neb,
      long: 70 * scannerMult * navBonus * neb,
      navSkill: nav,
      scannerLevel: lvl,
      nebulaMult: neb
    };
  },

  // Every scannable deep space object, flattened with a stable id.
  getDeepSpaceContacts() {
    const D = GameData, out = [];
    const add = (arr, label) => {
      if (!arr) return;
      arr.forEach(o => out.push({ id: o.id, x: o.x, y: o.y, name: o.name, label: label, obj: o }));
    };
    const R = (typeof RegionManager !== "undefined") ? RegionManager : null;
    const pick = (kind, fallback) => R ? R.content(kind) : (fallback || []);
    add(pick("derelicts", D.derelicts), "DERELICT STATION");
    add(pick("spaceWrecks", D.spaceWrecks), "ALIEN WRECK");
    add(this.allDistressSignals(), "DISTRESS BEACON");
    // A short-range identify is what tells you whether a throat comes back. That
    // is the payoff for spending the scan instead of just flying at it.
    pick("wormholes", D.wormholes).forEach(o => out.push({
      id: o.id, x: o.x, y: o.y, name: o.name, obj: o,
      label: o.oneWay ? "ONE-WAY THROAT" : "QUANTUM WORMHOLE"
    }));
    add(pick("blackHoles", D.blackHoles), "GRAVITATIONAL SINGULARITY");
    add(pick("nebulae", D.nebulae), "NEBULA FIELD");
    add(pick("alienPorts", D.alienPorts), "ALIEN STARPORT");
    return out;
  },

  // Identification tier for a deep space contact:
  //   0 = never picked up      -> not drawn on the star map at all
  //   1 = long range contact   -> dim grey unlabelled blip
  //   2 = short range identify -> full icon, name and readout
  getContactTier(id, x, y) {
    const ship = window.game && window.game.ship;
    if (!ship) return 0;
    // When the map is reviewing another region, judge by that region's log
    const mapOpen = (() => {
      const m = document.getElementById("starmap-modal");
      return m && !m.classList.contains("hidden");
    })();
    if (mapOpen && typeof RegionManager !== "undefined" && RegionManager.viewedId() !== RegionManager.currentId()) {
      const rec = RegionManager.viewedRecord();
      return (rec.contactLog && rec.contactLog[id]) || 0;
    }
    // Identification comes ONLY from the contact log - a short scan, or flying
    // within interaction range. It deliberately no longer keys off charted
    // sectors: now that a long sweep charts the fog of war it swept, treating
    // "sector charted" as "contact identified" would auto-identify everything in
    // long range and collapse the two-tier scan back into one.
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
    this.longScanCooldown = 2.5;
    this.sonarActive = true;
    this.sonarRadius = 0;
    AudioController.playScan();

    UI.addLog(`LONG RANGE SWEEP EMITTED. RANGE ${r.long.toFixed(1)} LY (NAV SKILL ${r.navSkill} / SCANNER CLASS ${r.scannerLevel}).`);

    const chartedLong = this.revealSectorsWithin(r.long);
    if (chartedLong > 0) UI.addLog(`NAV-COMPUTER: ${chartedLong} NEW SECTOR(S) CHARTED BY THE SWEEP.`);

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
    RegionManager.content('starSystems').forEach(sys => {
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

    // Every readout names the chart it belongs to. A coordinate pair is ambiguous
    // across four regions - (205, 375) is a Corps beacon in the Reach and empty
    // sky in the Corps Quadrant - and the star map can be showing an archived
    // chart of somewhere the ship is not. Done here rather than in each of the
    // dozen `details` strings, so a new contact type gets it for free.
    const viewed = RegionManager.get(RegionManager.viewedId());
    const away = RegionManager.viewedId() !== RegionManager.currentId();
    const chartLine = `
Chart: ${String((viewed && viewed.name) || "CORPS QUADRANT").toUpperCase()}` +
                      (away ? " [ARCHIVED - VESSEL ELSEWHERE]" : "");

    tip.innerHTML = `<strong>${target.title || "UNKNOWN CONTACT"}</strong>` +
                    `<span class="subtext">${((target.details || "") + chartLine).replace(/</g, "&lt;")}</span>`;
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

    // A one-way throat is a commitment. If the captain has not scanned it there is
    // no way to know that in advance, which is exactly what makes the scan worth
    // spending - but once it IS known, do not let a misclick strand anyone.
    if (wh.oneWay && WormholeNet.isCharted(wh) &&
        !confirm(`${wh.name.toUpperCase()} IS A ONE-WAY THROAT.\n\n` +
                 `It ejects near (${wh.targetX}, ${wh.targetY}) and there is no return throat on the far side. ` +
                 `You will have to fly home.\n\nEnter anyway?`)) {
      UI.addLog(`HELD POSITION. ${wh.name.toUpperCase()} LEFT UNENTERED.`);
      return;
    }

    if (typeof AudioController !== "undefined" && AudioController.playBeep) AudioController.playBeep("powerup");
    UI.addLog(`QUANTUM RIFT DETECTED! ENTERING ${wh.name.toUpperCase()}...`);
    UI.addLog(`SPACE-TIME WARP COMPLETED. ARRIVED AT ${wh.destName.toUpperCase()} (${wh.targetX}, ${wh.targetY}).`);
    if (wh.oneWay) UI.addLog("THE THROAT COLLAPSES BEHIND YOU. THERE IS NOTHING HERE TO GO BACK THROUGH.");
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

  /**
   * Drop a salvageable hull where a ship died. These are transient - they live in
   * Navigation rather than GameData, and are not persisted, because a battlefield
   * should be worth returning to only while it is still warm.
   */
  spawnCombatWreck(alien) {
    if (!this.combatWrecks) this.combatWrecks = [];
    const id = "cw_" + alien.raceKey + "_" + Math.round(alien.x) + "_" + Math.round(alien.y);
    if (this.combatWrecks.some(w => w.id === id)) return;

    // Loot scales with what the ship was: tougher hulls carry better material.
    const tiers = { spemin: "iron", thrynn: "titanium", veloxi: "platinum", uhlek: "iridium" };
    const ore = tiers[alien.raceKey] || "titanium";
    this.combatWrecks.push({
      id: id,
      name: alien.name + " Hull",
      raceKey: alien.raceKey,
      x: alien.x, y: alien.y,
      searched: false,
      credits: 150 + Math.floor(Math.random() * 250),
      ore: ore,
      oreCount: 1 + Math.floor(Math.random() * 3)
    });
    UI.addLog("SENSORS: THE SHATTERED HULL IS DRIFTING AND INTACT ENOUGH TO BOARD [B].");
  },

  salvageCombatWreck() {
    const wreck = this.nearbyCombatWreck;
    if (!wreck || wreck.searched) return;
    const ship = window.game.ship;
    wreck.searched = true;

    ship.credits += wreck.credits;
    const comm = GameData.commodities[wreck.ore];
    const mass = (comm ? comm.mass : 2) * wreck.oreCount;
    const room = (ship.cargoCap || 20) - UI.calculateCargoMass(ship.cargo);
    let took = 0;
    if (room >= mass) {
      ship.cargo[wreck.ore] = (ship.cargo[wreck.ore] || 0) + wreck.oreCount;
      took = wreck.oreCount;
    }

    if (typeof AudioController !== "undefined" && AudioController.playBeep) AudioController.playBeep("powerup");
    UI.addLog(`HULL STRIPPED: +${wreck.credits} M.U. SALVAGE VALUE.`);
    UI.addLog(took > 0
      ? `RECOVERED ${took} x ${(comm ? comm.name : wreck.ore).toUpperCase()} FROM THE WRECKAGE.`
      : `HOLD FULL - THE ${(comm ? comm.name : wreck.ore).toUpperCase()} WAS LEFT IN THE DEBRIS.`);

    // The hull breaks up once stripped
    this.combatWrecks = this.combatWrecks.filter(w => w.id !== wreck.id);
    this.nearbyCombatWreck = null;
    UI.updateShip(ship);
    window.game.saveGame();
  },

  dockAtAlienPort() {
    if (!this.nearbyAlienPort) return;
    const port = this.nearbyAlienPort;
    if (typeof AudioController !== "undefined" && AudioController.playBeep) AudioController.playBeep("success");
    UI.addLog(`DOCKING CLEARANCE GRANTED: ${port.name.toUpperCase()}.`);
    if (port.greeting) UI.addLog(`"${port.greeting}"`);
    if (typeof QuestEngine !== "undefined") {
      QuestEngine.notify("dock", { station: port.name, raceKey: port.raceKey });
    }
    UI.openPortModal(port);
  },

  salvageSpaceWreck() {
    if (!this.nearbySpaceWreck || this.nearbySpaceWreck.searched) return;
    const sw = this.nearbySpaceWreck;
    sw.searched = true;
    if (window.game && window.game.markSalvaged) window.game.markSalvaged(sw.id);
    if (sw.fragment && typeof PuzzleEngine !== "undefined") {
      PuzzleEngine.grantFragment(sw.fragment.setId, sw.fragment.id, sw.fragment.name);
    }
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

        // Respect the hold, like every other acquisition route. The scoop used to
        // ignore capacity entirely and load ore into a full ship.
        const comm = GameData.commodities[chunk.type];
        const mass = comm ? (comm.mass || 1) : 1;
        if (UI.calculateCargoMass(ship.cargo) + mass > (ship.cargoCap || 20)) {
          if (!this.scoopFullWarned) {
            this.scoopFullWarned = true;
            if (typeof AudioController !== "undefined" && AudioController.playBeep) AudioController.playBeep("error");
            UI.addLog(`TRACTOR SCOOP OFFLINE: HOLD FULL. THE ${typeName} DRIFTS PAST.`);
          }
          return chunk.lifetime > 0;
        }
        this.scoopFullWarned = false;
        ship.cargo[chunk.type] = (ship.cargo[chunk.type] || 0) + 1;

        if (typeof AudioController !== "undefined" && AudioController.playBeep) AudioController.playBeep("powerup");
        UI.addLog(`TRACTOR SCOOP: RECOVERED 1 UNIT OF ${typeName} (${(comm ? comm.tier : "common").toUpperCase()}) INTO CARGO!`);
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
      // `depth` drives parallax. Small values are far-off stars that barely move;
      // larger ones are near field and sweep past. Without this the field was
      // screen-locked wallpaper and the ship read as motionless in open space.
      const depth = Math.pow(Math.random(), 2) * 0.85 + 0.05;
      this.bgStars.push({
        u: Math.random(),
        v: Math.random(),
        depth: depth,
        size: (Math.random() * 1.4 + 0.4) * (0.6 + depth),
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
      this.sonarRadius += 900 * dt;   // sweep ring, not a loading bar
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
    // Cruise speed is deliberately unhurried: crossing the quadrant should cost
    // real time so exploration and mining cannot be rushed. Engine class keeps the
    // same 2.8x span from Class 1 to Class 5, it just starts far lower.
    const baseThrust = (2.5 + (ship.engineLevel * 2.0)) / mass;
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

    // What has hold of the ship this frame, worked out BEFORE the throttle so the
    // engines and the pull are reading the same numbers.
    const grip = this.computeGravityGrip();
    const authority = grip ? grip.authority : 1;

    // The autopilot flies the leg itself when engaged, and stands down the moment
    // the captain touches anything.
    const autoFlying = this.updateAutopilot(dt);

    let isThrusting = false;
    if (!autoFlying && (this.keys["ArrowUp"] || this.keys["KeyW"] || this.keys["w"] || this.keys["W"])) {
      this.shipVx += Math.cos(this.shipAngle) * thrust * authority * dt;
      this.shipVy += Math.sin(this.shipAngle) * thrust * authority * dt;
      isThrusting = true;
    }
    // Read by drawShip(). The autopilot burns too, and should look like it.
    this.isThrusting = isThrusting || (autoFlying && !!this.autopilot);

    // Apply drift friction, scaled to elapsed time.
    // This used to be a flat per-FRAME multiply while thrust was per-SECOND, so any
    // wobble in frame duration changed the ship's velocity: a long frame applied a
    // full frame of drag but a longer burn, producing a visible lurch, and the
    // terminal velocity scaled with frame time (roughly double the speed at 30 FPS,
    // less than half at 144 Hz). Math.pow keeps 60 FPS behaviour identical.
    const drag = Math.pow(friction, dt * 60);
    this.shipVx *= drag;
    this.shipVy *= drag;

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
    const secKey = `${secX}_${secY}`;
    ship.exploredSectors[secKey] = true;

    // Position-based quest objectives are evaluated on sector change only - doing
    // this every frame would run the whole objective table 60 times a second.
    if (this.lastSectorKey !== secKey) {
      this.lastSectorKey = secKey;
      if (typeof QuestEngine !== "undefined") {
        QuestEngine.notify("position", { x: this.shipX, y: this.shipY });
      }
    }

    // 0. Which cloud, if any, the ship is currently inside. Runs before the
    //    hazards below so scan range and shield behaviour are already correct.
    this.updateNebula();
    this.applyNebulaEffects(dt);

    // 1. Singularity gravity - drift zone, well, and the horizon. See
    //    computeGravityGrip(): the grip was already worked out above so the
    //    throttle could be scaled by it.
    if (this.applyGravityGrip(dt)) return;

    // 2. Derelict Station Proximity
    this.nearbyDerelict = null;
    if (RegionManager.content('derelicts').length) {
      RegionManager.content('derelicts').forEach(der => {
        const dist = Math.hypot(this.shipX - der.x, this.shipY - der.y);
        if (dist < 4.0) {
          this.nearbyDerelict = der;
        }
      });
    }

    // 3. Subspace Distress Signal Proximity
    this.nearbyDistressSignal = null;
    if (this.isLayerOn("salvage")) {
      this.allDistressSignals().forEach(sig => {
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

    // 4b. Customs patrols sweeping the core sectors
    this.updatePatrols(dt);

    // Check Proximity to Quantum Wormholes
    this.nearbyWormhole = null;
    {
      RegionManager.content('wormholes').forEach(wh => {
        const dist = Math.hypot(this.shipX - wh.x, this.shipY - wh.y);
        if (dist < 4.0) {
          this.nearbyWormhole = wh;
        }
      });
    }

    // 4b2. Drifting hulls from ships destroyed in combat
    this.nearbyCombatWreck = null;
    if (this.combatWrecks && this.combatWrecks.length) {
      this.combatWrecks.forEach(w => {
        if (!w.searched && Math.hypot(this.shipX - w.x, this.shipY - w.y) < 5.0) this.nearbyCombatWreck = w;
      });
    }

    // 4c. Alien Starport Proximity - neutral ground, always approachable
    this.nearbyAlienPort = null;
    {
      RegionManager.content('alienPorts').forEach(port => {
        if (Math.hypot(this.shipX - port.x, this.shipY - port.y) < 5.0) {
          this.nearbyAlienPort = port;
          this.markContact(port.id, 2);
        }
      });
    }

    // 5. Drifting Alien Space Wrecks Proximity
    this.nearbySpaceWreck = null;
    if (RegionManager.content('spaceWrecks').length) {
      RegionManager.content('spaceWrecks').forEach(sw => {
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
    RegionManager.content('starSystems').forEach(sys => {
      const dist = Math.hypot(this.shipX - sys.x, this.shipY - sys.y);
      if (dist < 18.0) {
        if (!ship.discoveredSystems[sys.name]) {
          ship.discoveredSystems[sys.name] = true;
          AudioController.playBeep('success');
          UI.addLog(`NAV DISCOVERY: STAR SYSTEM ${sys.name.toUpperCase()} (COORD: X ${sys.x}, Y ${sys.y}) LOGGED TO MAP.`);
        }
      }
    });

    // Reserve power only. Running dry used to log a reactor failure and then let
    // the ship fly exactly as before, which made fuel meaningless.
    if (ship.fuel <= 0) {
      this.shipVx *= Math.pow(0.90, dt * 60);
      this.shipVy *= Math.pow(0.90, dt * 60);
      const speed = Math.hypot(this.shipVx, this.shipVy);
      const IMPULSE_CAP = 0.45;
      if (speed > IMPULSE_CAP) {
        const k = IMPULSE_CAP / speed;
        this.shipVx *= k;
        this.shipVy *= k;
      }
      if (!this.fuelDryAnnounced) {
        this.fuelDryAnnounced = true;
        if (typeof AudioController !== "undefined" && AudioController.stopEngine) AudioController.stopEngine();
        UI.addLog("REACTOR OFFLINE: ENDURIUM EXHAUSTED. MANOEUVRING ON RESERVE POWER ONLY.");
        UI.addLog("DISTRESS PROTOCOL AVAILABLE - PRESS [E] OR USE THE DISTRESS CONTROL TO CALL FOR AID.");
        if (typeof UI !== "undefined" && UI.updateShip) UI.updateShip(ship);
      }
    } else if (this.fuelDryAnnounced) {
      this.fuelDryAnnounced = false;
      UI.addLog("REACTOR RESTART: ENDURIUM FLOW RESTORED.");
    }

    // Fuel Consumption based on thrust and engine efficiency
    if (isThrusting && ship.fuel > 0) {
      const engSkill = ship.crew.engineer ? ship.crew.engineer.skill : 40;
      // Fighting a gravity well is expensive, and gets worse the deeper you are.
      const wellCost = this.gravityGrip ? this.gravityGrip.fuelMult : 1;
      const fuelCost = (engine.fuelMult * (1.2 - engSkill / 200)) * wellCost * dt;
      ship.fuel = Math.max(0, ship.fuel - fuelCost);
      AudioController.updateEnginePitch(0.8);

      // Refresh the gauge when the displayed integer moves. Without this the
      // readout only changed when some unrelated event happened to redraw it, so
      // fuel appeared frozen for long stretches of flight.
      if (Math.ceil(this.lastShownFuel) !== Math.ceil(ship.fuel)) {
        this.lastShownFuel = ship.fuel;
        if (typeof UI !== "undefined" && UI.updateShip) UI.updateShip(ship);
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
            // Shooting at something that was not shooting at you is a decision you
            // do not get back - it is hostile from here on, whatever it was before.
            this.provokeAlien(alien);
            alien.hp = (alien.hp || 100) - p.damage;
            if (alien.hp <= 0) {
              UI.addLog(`TACTICAL VICTORY: ${alien.name.toUpperCase()} DESTROYED IN SPACE!`);
              ship.credits += 300;
              UI.updateShip(ship);

              // A kill leaves a hull worth picking over. Previously the wreck
              // simply vanished, so winning a fight produced nothing but a bounty.
              this.spawnCombatWreck(alien);
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

      // Bounce at galaxy borders. These were 15..185 - left over from the old
      // 200x200 quadrant - which penned every alien vessel into the top-left
      // corner of the 500x500 galaxy for the whole game.
      if (alien.x < 15 || alien.x > 485) alien.vx *= -1;
      if (alien.y < 15 || alien.y > 485) alien.vy *= -1;
      alien.angle = Math.atan2(alien.vy, alien.vx);

      const dist = Math.hypot(this.shipX - alien.x, this.shipY - alien.y);
      // A dampening field is worth flying into: inside one, nothing can find you.
      // This is what the Aquila Dark Veil has always claimed to do.
      const hidden = this.nebulaHidesShip() || this.isGhosted();
      if (dist < 6.5 && !hidden) {
        this.nearbyAlien = alien;
        // Say what it is doing, once per approach, so "it did not shoot" reads as
        // a decision rather than a bug.
        if (alien.__announced !== alien.stance) {
          alien.__announced = alien.stance;
          const meta = this.ALIEN_STANCE[this.alienStance(alien)];
          UI.addLog(`CONTACT: ${String(alien.name).toUpperCase()} - ${meta.label}, ${meta.hail}.`);
        }
      } else if (dist > 12) {
        alien.__announced = null;
      }

      // Alien Tactical Firing - only from something that means it. A peaceful or
      // merely wary vessel holds fire, which is what the aggression values in
      // GameData.aliens have always implied and never did.
      const stance = this.alienStance(alien);
      if (dist < 18.0 && !hidden && stance === "hostile") {
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

    RegionManager.content('starSystems').forEach(sys => {
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
      : this.nearbyCombatWreck    ? "STRIP SHATTERED HULL [B]"
      : this.nearbyDerelict       ? "BOARD DERELICT [B]"
      : this.nearbyAlienPort      ? "DOCK AT ALIEN PORT [B]"
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
    this.setHudText("x", "hud-coord-x", this.shipX.toFixed(1));
    this.setHudText("y", "hud-coord-y", this.shipY.toFixed(1));
    this.setHudText("v", "hud-velocity", (Math.hypot(this.shipVx, this.shipVy) * 0.1).toFixed(2));
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
    // In-system space is small, so it is slowed less than hyperspace
    const baseThrust = 15.0 + (ship.engineLevel * 15.0);
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
    this.isThrusting = isThrusting;

    // Time-scaled drag, same reasoning as updateHyper()
    const drag = Math.pow(friction, dt * 60);
    this.shipVx *= drag;
    this.shipVy *= drag;

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

    // Drift the in-system sites and see if we are alongside one
    this.nearbySite = null;
    this.getSystemSites(system).forEach(site => {
      site.angle += site.drift * dt;
      const pos = this.sitePosition(system, site, starX, starY, systemRadius);
      if (!this.siteLooted(site) && Math.hypot(this.shipX - pos.x, this.shipY - pos.y) < 20) {
        this.nearbySite = site;
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
    this.setHudText("x", "hud-coord-x", ship.coordinates.x.toFixed(1));
    this.setHudText("y", "hud-coord-y", ship.coordinates.y.toFixed(1));
    this.setHudText("v", "hud-velocity", (Math.hypot(this.shipVx, this.shipVy) * 0.05).toFixed(2));
    
    // Enable buttons on HUD based on orbital proximity
    UI.updateControlPanel(true, ship.currentPlanet, ship.shieldsActive, ship.weaponsArmed);

    // A site alongside claims the LAND control, exactly as deep space objects do
    // in hyperspace - otherwise there is nothing on screen to say you can act.
    if (this.nearbySite && !ship.currentPlanet) {
      const meta = this.SITE_TYPES[this.nearbySite.kind];
      UI.elements.btnLand.disabled = false;
      UI.elements.btnLand.textContent = meta.action;
      if (this.keys["b"] || this.keys["B"]) {
        this.keys["b"] = false; this.keys["B"] = false;
        this.workNearbySite();
      }
    }
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

    if (typeof QuestEngine !== "undefined") {
      QuestEngine.notify("dock", { station: "Starbase Prime" });
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

  /** Region selector - only regions actually visited are offered. */
  refreshMapRegionButtons() {
    const bar = document.getElementById("starmap-regions");
    if (!bar) return;
    const visited = RegionManager.visited();
    if (visited.length < 2) { bar.innerHTML = ""; bar.classList.add("hidden"); return; }
    bar.classList.remove("hidden");
    const viewed = RegionManager.viewedId();
    bar.innerHTML = '<span style="font-size:10px; color:#ffcc00; font-weight:bold; margin-right:2px;">CHARTS:</span>' +
      visited.map(id => {
        const r = RegionManager.get(id);
        const here = (id === RegionManager.currentId()) ? " ◉" : "";
        return `<button class="glow-btn btn-sm ${id === viewed ? "green-glow" : ""}" ` +
               `style="${id === viewed ? "" : "opacity:0.55;"}" ` +
               `onclick="Navigation.viewRegionMap('${id}')">${r.name.toUpperCase()}${here}</button>`;
      }).join("");
  },

  viewRegionMap(id) {
    RegionManager.setViewed(id);
    this.resetStarMapPanZoom();
    this.refreshMapRegionButtons();
    this.drawStarMapCanvas();
    if (typeof AudioController !== "undefined" && AudioController.playBeep) AudioController.playBeep("click");
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
    RegionManager.setViewed(RegionManager.currentId());   // always open on where you are
    this.refreshMapRegionButtons();
    this.refreshMapLayerButtons();
    this.drawStarMapCanvas();
  },

  closeStarMapModal() {
    this.cancelFoldPicking();
    AudioController.playBeep('click');
    const modal = document.getElementById("starmap-modal");
    if (modal) modal.classList.add("hidden");
    this.hideStarMapTooltip();
    // Clear the archived-chart override. Left set, it leaks out of the map and
    // makes gameplay contact lookups consult a region the ship is not in.
    if (typeof RegionManager !== "undefined") RegionManager.mapView = null;
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
    // The map may be reviewing a region the ship has left, so read that
    // region's own exploration record rather than the live working copy.
    const view = RegionManager.viewedRecord();
    const viewingElsewhere = RegionManager.viewedId() !== RegionManager.currentId();
    
    

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

    // Keep the projection parameters so a click can be inverted back to galaxy
    // coordinates. Storing the numbers rather than duplicating the arithmetic
    // means the forward and inverse transforms cannot drift apart.
    this.mapProjection = {
      originX: originX, originY: originY, mapW: mapW, mapH: mapH,
      centerX: centerX, centerY: centerY,
      offsetX: this.mapOffsetX, offsetY: this.mapOffsetY, zoom: this.mapZoom
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
    if (this.isLayerOn("nebulae")) {
      RegionManager.viewedContent('nebulae').forEach(neb => {
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
          known: true, // reached only at tier 2 - see getContactTier
          x: nx, y: ny, radius: nr,
          title: `☁ NEBULA: ${neb.name.toUpperCase()}`,
          details: `Location: (${neb.x}, ${neb.y})\nType: Deep Space Cloud Field\nProperties: ${neb.desc}`
        });
      });
    }

    // Draw Quantum Wormholes Portals on Star Map
    if (this.isLayerOn("anomalies")) {
      RegionManager.viewedContent('wormholes').forEach(wh => {
        const whPx = toCanvasX(wh.x);
        const whPy = toCanvasY(wh.y);
        const tier = this.getContactTier(wh.id, wh.x, wh.y);
        if (tier === 0) return;
        if (tier === 1) { this.drawUnknownContact(ctx, whPx, whPy, zScale, wh.x, wh.y); return; }
        const pulseRad = (7 + Math.abs(Math.sin(Date.now() / 250)) * 4) * zScale;

        // A one-way throat is drawn amber, not cyan. The colour is the warning -
        // the network is rolled per game, so the chart is the only place to learn it.
        const hue = wh.oneWay ? "#ffaa22" : "#00e5ff";
        ctx.strokeStyle = hue;
        ctx.lineWidth = Math.max(1.5, 2 * zScale);
        ctx.shadowBlur = 10 * zScale;
        ctx.shadowColor = hue;
        ctx.beginPath();
        if (wh.oneWay) {
          // Broken ring: a throat that does not close back on itself
          for (let a = 0; a < 4; a++) {
            ctx.arc(whPx, whPy, pulseRad, a * Math.PI / 2, a * Math.PI / 2 + Math.PI / 3);
            ctx.stroke();
            ctx.beginPath();
          }
        } else {
          ctx.arc(whPx, whPy, pulseRad, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;

        ctx.font = `${fontSize + 4}px Share Tech Mono`;
        ctx.fillStyle = hue;
        ctx.fillText("🌀", whPx - (fontSize / 2), whPy + (fontSize / 3));

        this.mapTargets.push({
          type: "wormhole",
          known: true, // reached only at tier 2 - see getContactTier
          x: whPx, y: whPy, radius: 14 * zScale,
          title: `🌀 ${wh.oneWay ? "COLLAPSING THROAT" : "QUANTUM WORMHOLE"}: ${wh.name.toUpperCase()}`,
          details: `Coordinates: (${wh.x}, ${wh.y})\nTarget Jump Destination: ${wh.destName}\n` +
                   (wh.oneWay
                     ? "Status: ONE-WAY FOLD - no paired throat at the far end. Transit is irreversible."
                     : "Status: Stable paired fold. A matching throat returns you here.")
        });
      });
    }

    // Draw Supermassive Black Holes on Star Map
    if (this.isLayerOn("anomalies")) {
      RegionManager.viewedContent('blackHoles').forEach(bh => {
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

        // Once identified, a gateway well should read as a route on the chart, not
        // just a hazard - that is the difference between a wall and a door.
        // What the chart may say about a singularity depends on whether this ship
        // has been through it. Naming the destination on sight gave away the whole
        // topology from the first scan.
        const gate = this.resolveGateway(bh);
        const known = gate ? this.gateCharted(bh) : false;
        const gTarget = (gate && known) ? RegionManager.get(gate.region) : null;
        const routeLine = !gate ? ""
          : known
            ? `\nRoute: ${gate.oneWay ? "ONE-WAY GATE" : "GATEWAY"} → ${String((gTarget && gTarget.name) || gate.region).toUpperCase()}` +
              (gate.oneWay ? "\nWARNING: nothing on the far side leads back this way." : "")
            : "\nRoute: FOLD STRUCTURE PRESENT - DESTINATION UNCHARTED. Telemetry ends at the horizon.";

        this.mapTargets.push({
          type: "blackhole",
          known: true, // reached only at tier 2 - see getContactTier
          x: bhPx, y: bhPy, radius: gravRad,
          title: `🕳 ${!gate ? "BLACK HOLE" : (known ? (gate.oneWay ? "ONE-WAY GATE" : "REGION GATEWAY") : "UNCHARTED FOLD")}: ${bh.name.toUpperCase()}`,
          details: `Location: (${bh.x}, ${bh.y})\nHazard: Extreme Gravitational Core${routeLine}\nProperties: ${bh.desc}`
        });
      });
    }

    // Draw Derelict Space Stations on Star Map
    if (this.isLayerOn("salvage")) {
      RegionManager.viewedContent('derelicts').forEach(der => {
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
          known: true, // reached only at tier 2 - see getContactTier
          x: derPx, y: derPy, radius: 12 * zScale,
          title: `🛰️ PRECURSOR DERELICT: ${der.name.toUpperCase()}`,
          details: `Location: (${der.x}, ${der.y})\nStatus: ${der.searched ? 'Salvaged' : 'Unsearched Artifact Vault'}\nDetails: ${der.desc}`
        });
      });
    }

    // Draw Drifting Space Alien Wrecks on Star Map
    if (this.isLayerOn("salvage")) {
      RegionManager.viewedContent('spaceWrecks').forEach(sw => {
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
          known: true, // reached only at tier 2 - see getContactTier
          x: swPx, y: swPy, radius: 12 * zScale,
          title: `🛸 ALIEN WRECK: ${sw.name.toUpperCase()}`,
          details: `Location: (${sw.x}, ${sw.y})\nStatus: ${sw.searched ? 'Salvaged' : 'Unsearched Tech Component Wreck'}`
        });
      });
    }

    // Draw Subspace Distress Beacons on Star Map
    {
      (RegionManager.viewedId() === RegionManager.currentId()
        ? this.allDistressSignals()
        : RegionManager.viewedContent('distressSignals')).forEach(sig => {
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
          known: true, // reached only at tier 2 - see getContactTier
          x: sigPx, y: sigPy, radius: 12 * zScale,
          title: `📡 DISTRESS BEACON: ${sig.name.toUpperCase()}`,
          details: `Location: (${sig.x}, ${sig.y})\nBroadcast: ${sig.desc}`
        });
      });
    }

    // Check if any star system in a sector is discovered
    const systemInSectorDiscovered = (sx, sy) => {
      return RegionManager.viewedContent('starSystems').some(sys => {
        return sys.x >= sx && sys.x < sx + 25 && sys.y >= sy && sys.y < sy + 25 && (view.discoveredSystems || {})[sys.name];
      });
    };

    // Draw Fog of War over unexplored 25x25 LY sectors
    for (let sx = 0; sx < 500; sx += 25) {
      for (let sy = 0; sy < 500; sy += 25) {
        const secKey = `${sx}_${sy}`;
        const isExplored = (view.exploredSectors || {})[secKey] || systemInSectorDiscovered(sx, sy) || (Math.hypot(sx - 250, sy - 250) < 40);
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
    if (this.isLayerOn("systems")) RegionManager.viewedContent('starSystems').forEach(sys => {
      const secX = Math.floor(sys.x / 25) * 25;
      const secY = Math.floor(sys.y / 25) * 25;
      const isDiscovered = ship.discoveredSystems && (view.discoveredSystems || {})[sys.name];
      const isExplored = isDiscovered || (view.exploredSectors || {})[`${secX}_${secY}`] || (Math.hypot(sys.x - 250, sys.y - 250) < 40);

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
    // Encounters are logged with a region, so they belong to that region's chart
    // only. Without this, every alien met in the core appeared on every chart.
    // Records written before contacts were tagged are treated as core.
    if (ship.encounterHistory && this.isLayerOn("aliens")) {
      const encFontSize = Math.min(22, Math.max(11, Math.round(13 * zScale)));
      const viewedRegionId = RegionManager.viewedId();
      ship.encounterHistory.forEach(enc => {
        if ((enc.region || "core") !== viewedRegionId) return;
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
    // Alien starports - fixed installations, so shown once detected like any site
    if (this.isLayerOn("ports")) {
      RegionManager.viewedContent('alienPorts').forEach(port => {
        const tier = this.getContactTier(port.id, port.x, port.y);
        if (tier === 0) return;
        const px = toCanvasX(port.x), py = toCanvasY(port.y);
        if (tier === 1) { this.drawUnknownContact(ctx, px, py, zScale, port.x, port.y); return; }
        ctx.strokeStyle = port.color || "#ffcc00";
        ctx.lineWidth = Math.max(1, 1.5 * zScale);
        ctx.shadowBlur = 8; ctx.shadowColor = port.color || "#ffcc00";
        ctx.beginPath(); ctx.arc(px, py, Math.max(4, 5 * zScale), 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(px, py, Math.max(8, 9 * zScale), Math.max(3, 3 * zScale), 0, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
        this.mapTargets.push({
          type: "port",
          known: true,
          x: px, y: py, radius: 12 * zScale,
          title: `⌂ ALIEN STARPORT: ${this.labelFor(port)}`,
          details: `Position: (${port.x}, ${port.y})
Affiliation: ${String(port.raceKey || "").toUpperCase()}
Facility: Archive open to visiting captains. Dock with [B].`
        });
      });
    }

    // Customs patrols, plotted like alien contacts and limited to sensor reach
    if (this.isLayerOn("patrols") && RegionManager.isCore()) {
      const reach = this.getScanRanges().short * 1.15;
      const me = this.getShipGalaxyCoords();
      this.getPatrols().forEach(p => {
        if (Math.hypot(me.x - p.x, me.y - p.y) > reach) return;
        const px = toCanvasX(p.x), py = toCanvasY(p.y);
        ctx.fillStyle = p.color || "#00ccff";
        ctx.shadowBlur = 8; ctx.shadowColor = p.color || "#00ccff";
        ctx.font = `${Math.min(20, Math.max(10, Math.round(12 * zScale)))}px Share Tech Mono`;
        ctx.fillText("⚑", px - 4, py + 4);
        ctx.shadowBlur = 0;
        this.mapTargets.push({
          type: "patrol",
          known: true,
          x: px, y: py, radius: 11 * zScale,
          title: `⚑ CUSTOMS PATROL: ${p.name.toUpperCase()}`,
          details: `Position: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})
Authority: Starbase Prime Customs
Action: Hails and scans passing vessels for contraband.`
        });
      });
    }

    // Live alien vessels are radar contacts, not omniscient tracking: only plot the
    // ones currently inside sensor reach. The radius matches the alien detection
    // range triggerSonar() uses, so the map shows exactly what the scanner can see.
    const alienReach = this.getScanRanges().short * 1.15;
    const selfPos = this.getShipGalaxyCoords();
    // Live traffic is only ever in the region the ship is in - this gated on
    // isCore() (the CURRENT region), so viewing another chart drew core vessels on it.
    // Live traffic exists in every region now, not just the core. Still gated to
    // the chart of the region the ship is in - nobody follows you through a fold.
    if (this.isLayerOn("aliens") && !viewingElsewhere) this.alienShips.forEach(alien => {
      if (alien.x < 0) return;
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
        title: `🛸 ${this.ALIEN_STANCE[this.alienStance(alien)].label} VESSEL: ${alien.name.toUpperCase()}`,
        details: `Coordinates: (${alien.x.toFixed(1)}, ${alien.y.toFixed(1)})\nSpecies: ${alien.raceKey.toUpperCase()}\n` +
                 `Disposition: ${this.ALIEN_STANCE[this.alienStance(alien)].label} - ${this.ALIEN_STANCE[this.alienStance(alien)].hail}` +
                 (alien.provoked ? "\nThis vessel has been fired on by this ship." : "")
      });
    });

    // Draw Vessel Position Flashing Marker ("YOU ARE HERE")
    // Only on the chart of the region the ship is actually IN. This guard used to
    // sit on the tooltip target alone, so an archived chart still drew the pulse
    // and the label - the ship appeared to be in a region it had left.
    const galCoords = this.getShipGalaxyCoords();
    const shipPx = toCanvasX(galCoords.x);
    const shipPy = toCanvasY(galCoords.y);

    if (!viewingElsewhere) {
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
    }

    if (!viewingElsewhere) this.mapTargets.push({
      type: "ship",
      known: true,
      x: shipPx, y: shipPy, radius: 16 * zScale,
      title: "🚀 ISS ODYSSEY (FLAGSHIP)",
      details: `Current Coords: (${galCoords.x.toFixed(1)}, ${galCoords.y.toFixed(1)})\nNavigation State: ${window.game.spaceState.toUpperCase()}`
    });

    // Count total discovered systems & encounters
    const discoveredCount = Object.keys(view.discoveredSystems || {}).length;
    const encounterCount = (ship.encounterHistory || []).length;

    // Update bottom info text
    const infoText = document.getElementById("starmap-info-text");
    if (infoText) {
      const stateStr = (window.game.spaceState === "system" && ship.currentSystem) ? `ORBITING ${ship.currentSystem.name.toUpperCase()}` : "HYPERSPACE";
      infoText.textContent = `[${String(RegionManager.get(RegionManager.viewedId()).name).toUpperCase()}${viewingElsewhere ? " - ARCHIVED CHART" : ""}] ${viewingElsewhere ? "VESSEL NOT IN THIS REGION" : `VESSEL POSITION: X ${galCoords.x.toFixed(1)}, Y ${galCoords.y.toFixed(1)} (${stateStr})`} | SYSTEMS LOGGED: ${discoveredCount} / ${RegionManager.viewedContent('starSystems').length} | SECTORS: ${Object.keys(view.exploredSectors || {}).length} / 100`;
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

      RegionManager.content('starSystems').forEach(sys => {
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

      const charted = this.revealSectorsWithin(r.short);
      if (charted > 0) UI.addLog(`NAV-COMPUTER: ${charted} NEW SECTOR(S) CHARTED FROM SENSOR RETURNS.`);

      // Resolve deep space contacts inside short range into full identifications.
      // Every contact in range is reported, not only the newly-found ones - a scan
      // that lists nothing on a re-sweep reads as a scan that failed.
      let identified = 0, known = 0;
      this.getDeepSpaceContacts().forEach(c => {
        const dist = Math.hypot(this.shipX - c.x, this.shipY - c.y);
        if (dist > r.short) return;
        const wasNew = this.markContact(c.id, 2);
        const bearing = Math.round(((Math.atan2(c.y - this.shipY, c.x - this.shipX) * 180 / Math.PI) + 360) % 360);
        if (wasNew) {
          identified++;
          UI.addLog(`CONTACT IDENTIFIED - ${c.label}: ${c.name.toUpperCase()} AT (${c.x}, ${c.y}) - ${dist.toFixed(1)} LY BEARING ${bearing}°`);
        } else {
          known++;
          UI.addLog(`CONTACT (LOGGED) - ${c.label}: ${c.name.toUpperCase()} - ${dist.toFixed(1)} LY BEARING ${bearing}°`);
        }
      });
      if (identified > 0) AudioController.playBeep('success');
      if (identified === 0 && known === 0) UI.addLog("NO DEEP SPACE CONTACTS WITHIN SHORT RANGE.");

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
      // A scan that lists only planets in a system holding a wreck is a scan that lied.
      const sites = this.getSystemSites(sys);
      if (sites.length) {
        sites.forEach(site => {
          const meta = this.SITE_TYPES[site.kind];
          UI.addLog(`${meta.label}: ${site.name.toUpperCase()}` + (this.siteLooted(site) ? " [ALREADY STRIPPED]" : " - UNWORKED"));
        });
      } else {
        UI.addLog("NO ARTIFICIAL BODIES IN THIS SYSTEM. PLANETS ONLY.");
      }
    }
  },

  draw() {
    if (!this.ctx || !this.canvas) return;
    if (this.needsResize) this.resizeCanvas();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const game = window.game;

    const w = this.canvas.width;
    const h = this.canvas.height;

    if (!this.bgStars || this.bgStars.length === 0) {
      this.generateBackground();
    }

    // Twinkle at a fixed rate per second rather than per frame
    const nowMs = Date.now();
    const stepDt = this.lastDrawMs ? Math.min(0.1, (nowMs - this.lastDrawMs) / 1000) : 1 / 60;
    this.lastDrawMs = nowMs;
    this.starStep = 3.0 * stepDt;


    // The starfield scrolls against the ship's own position, each star at its own
    // depth. This is the only cue that the ship is moving at all when there is
    // nothing else in the viewport - previously the field was pinned to the canvas
    // and open space felt completely static.
    //
    // In hyperspace shipX/shipY are galaxy LY, so they convert at the same 14 px
    // per LY the rest of drawHyper uses. In system mode they are already pixels.
    const inHyper = (game.spaceState === "hyper");
    const paraScale = inHyper ? 14 : 1;
    const paraX = this.shipX * paraScale;
    const paraY = this.shipY * paraScale;

    // Speed smear: at cruise the near field stretches slightly along the heading.
    const speed = Math.hypot(this.shipVx, this.shipVy) * (inHyper ? 1 : 0.1);
    const smear = Math.min(6, speed * 0.35);
    const heading = (speed > 0.01) ? Math.atan2(this.shipVy, this.shipVx) : 0;
    const smearX = Math.cos(heading) * smear;
    const smearY = Math.sin(heading) * smear;

    const wrap = (v, span) => ((v % span) + span) % span;

    this.bgStars.forEach(s => {
      s.twinkle += this.starStep;
      const alpha = 0.3 + Math.abs(Math.sin(s.twinkle)) * 0.7;
      const d = (s.depth !== undefined) ? s.depth : 0.5;   // saves from before parallax
      const sx = wrap((s.u * w) - paraX * d, w);
      const sy = wrap((s.v * h) - paraY * d, h);

      this.ctx.fillStyle = `rgba(0, 255, 102, ${alpha})`;
      if (smear > 0.8) {
        // Draw the trail as a short line rather than a dot, scaled by depth so the
        // near field streaks and the far field stays still.
        this.ctx.strokeStyle = `rgba(0, 255, 102, ${alpha * 0.8})`;
        this.ctx.lineWidth = s.size;
        this.ctx.beginPath();
        this.ctx.moveTo(sx, sy);
        this.ctx.lineTo(sx - smearX * d, sy - smearY * d);
        this.ctx.stroke();
      } else {
        this.ctx.fillRect(sx, sy, s.size, s.size);
      }
    });

    // Faint screen-locked haze. This is scenery only - the REAL nebulae from
    // GameData are drawn world-locked in drawHyper() so the ship flies into them.
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
    RegionManager.content('starSystems').forEach(sys => {
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

    // Render the real nebulae, world-locked, so they can actually be flown into.
    // Previously these existed only on the star map, and the cockpit showed an
    // unrelated screen-locked haze that never moved.
    RegionManager.content('nebulae').forEach(neb => {
      const px = centerX + (neb.x - this.shipX) * scale;
      const py = centerY + (neb.y - this.shipY) * scale;
      const pr = (neb.radius || 60) * scale;
      if (px + pr < -40 || px - pr > viewWidth + 40 || py + pr < -40 || py - pr > viewHeight + 40) return;

      const meta = this.NEBULA_EFFECTS[neb.effect] || this.NEBULA_EFFECTS.safe;
      const grad = this.ctx.createRadialGradient(px, py, pr * 0.1, px, py, pr);
      grad.addColorStop(0, neb.color);
      grad.addColorStop(0.65, neb.color.replace(/[\d.]+\)$/, "0.10)"));
      grad.addColorStop(1, "rgba(0,0,0,0)");
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(px, py, pr, 0, Math.PI * 2);
      this.ctx.fill();

      // Boundary, so the edge of the cloud is a place you can see yourself cross
      this.ctx.save();
      this.ctx.setLineDash([6, 8]);
      this.ctx.strokeStyle = meta.color;
      this.ctx.globalAlpha = 0.35;
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.arc(px, py, pr, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();

      this.ctx.font = "bold 10px Share Tech Mono";
      this.ctx.fillStyle = meta.color;
      this.ctx.globalAlpha = 0.75;
      this.ctx.fillText(neb.name.toUpperCase(), px - 30, py - pr + 14);
      this.ctx.globalAlpha = 1;
    });

    // Course line and readout while the autopilot has the helm, so it is obvious
    // the ship is flying itself and obvious where to.
    if (this.autopilot) {
      const tx = centerX + (this.autopilot.x - this.shipX) * scale;
      const ty = centerY + (this.autopilot.y - this.shipY) * scale;
      this.ctx.save();
      this.ctx.setLineDash([5, 7]);
      this.ctx.strokeStyle = "rgba(0, 204, 255, 0.55)";
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.moveTo(centerX, centerY);
      this.ctx.lineTo(tx, ty);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
      this.ctx.strokeStyle = "#00ccff";
      this.ctx.beginPath();
      this.ctx.arc(tx, ty, 9, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(tx - 13, ty); this.ctx.lineTo(tx + 13, ty);
      this.ctx.moveTo(tx, ty - 13); this.ctx.lineTo(tx, ty + 13);
      this.ctx.stroke();
      this.ctx.restore();

      const rem = Math.hypot(this.autopilot.x - this.shipX, this.autopilot.y - this.shipY);
      this.ctx.font = "bold 12px Share Tech Mono";
      this.ctx.fillStyle = "#00ccff";
      this.ctx.fillText(
        `⌖ AUTOPILOT → (${this.autopilot.x.toFixed(0)}, ${this.autopilot.y.toFixed(0)})  ${rem.toFixed(1)} LY  [P] CANCEL`,
        14, 22);
    }

    // Standing inside one is worth saying plainly, over the cloud itself.
    if (this.activeNebula) {
      const meta = this.NEBULA_EFFECTS[this.activeNebula.effect] || this.NEBULA_EFFECTS.safe;
      this.ctx.font = "bold 12px Share Tech Mono";
      this.ctx.fillStyle = meta.color;
      this.ctx.fillText(`◈ IN ${this.activeNebula.name.toUpperCase()} - ${meta.hud}`, 14, viewHeight - 16);
    }

    // Render Supermassive Black Holes in Viewport
    if (RegionManager.content('blackHoles').length) {
      RegionManager.content('blackHoles').forEach(bh => {
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

          // A gateway singularity is not a hazard to be avoided, it is a door. Say
          // where it goes, and say plainly when the door only opens one way - the
          // ship is already being pulled in by the time this is readable.
          const gate = this.resolveGateway(bh);
          if (gate) {
            const known = this.gateCharted(bh);
            const target = RegionManager.get(gate.region);
            const caught = this.nearbyBlackHole && this.nearbyBlackHole.id === bh.id;
            this.ctx.font = "9px Share Tech Mono";
            this.ctx.fillStyle = (gate.oneWay && known) ? "#ff6644" : "#88ccaa";
            this.ctx.fillText(
              known
                ? `${gate.oneWay ? "ONE-WAY GATE" : "GATEWAY"} → ${String((target && target.name) || gate.region).toUpperCase()}`
                : "FOLD STRUCTURE DETECTED - DESTINATION UNKNOWN",
              px + coreRadPx + 6, py + 15);
            if (caught && known && gate.oneWay) {
              this.ctx.font = "bold 11px Share Tech Mono";
              this.ctx.fillStyle = "#ff3322";
              this.ctx.fillText("NO RETURN FOLD ON THE FAR SIDE - BREAK AWAY NOW", px + coreRadPx + 6, py + 28);
            }
          }
        }
      });
    }

    // Render Space Alien Wrecks in Viewport
    if (RegionManager.content('spaceWrecks').length) {
      RegionManager.content('spaceWrecks').forEach(sw => {
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
          this.ctx.fillText(`${this.labelFor(sw)} ${sw.searched ? '[SALVAGED]' : ''}`, px + 12, py + 3);
        }
      });
    }

    // Render Derelict Space Stations in Viewport
    // Drifting combat wrecks
    if (this.combatWrecks && this.combatWrecks.length) {
      this.combatWrecks.forEach(w => {
        const px = centerX + (w.x - this.shipX) * scale;
        const py = centerY + (w.y - this.shipY) * scale;
        if (px < -40 || px > viewWidth + 40 || py < -40 || py > viewHeight + 40) return;
        this.ctx.font = "15px Share Tech Mono";
        this.ctx.fillStyle = "#ff9955";
        this.ctx.shadowBlur = 8; this.ctx.shadowColor = "#ff9955";
        this.ctx.fillText("☢", px - 7, py + 5);
        this.ctx.shadowBlur = 0;
        this.ctx.font = "bold 10px Share Tech Mono";
        this.ctx.fillText(w.name.toUpperCase(), px + 12, py + 3);
        if (this.nearbyCombatWreck && this.nearbyCombatWreck.id === w.id) {
          this.ctx.fillStyle = "#ffcc00";
          this.ctx.fillText("▶ STRIP HULL [B]", px + 12, py + 15);
        }
      });
    }

    // Render Alien Starports in the Viewport. Core-only installations: previously
    // only the interaction was region-gated, so they still DREW in the Reach and
    // could be flown to for no reason.
    {
      RegionManager.content('alienPorts').forEach(port => {
        const px = centerX + (port.x - this.shipX) * scale;
        const py = centerY + (port.y - this.shipY) * scale;
        if (px < -50 || px > viewWidth + 50 || py < -50 || py > viewHeight + 50) return;

        const near = (this.nearbyAlienPort && this.nearbyAlienPort.id === port.id);
        this.ctx.save();
        this.ctx.strokeStyle = port.color || "#ffcc00";
        this.ctx.fillStyle = "rgba(10, 20, 14, 0.85)";
        this.ctx.lineWidth = 2;
        this.ctx.shadowBlur = near ? 16 : 9;
        this.ctx.shadowColor = port.color || "#ffcc00";
        // ringed station silhouette
        this.ctx.beginPath();
        this.ctx.arc(px, py, 8, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.ellipse(px, py, 15, 5, 0, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
        this.ctx.restore();

        this.ctx.font = "bold 10px Share Tech Mono";
        this.ctx.fillStyle = port.color || "#ffcc00";
        this.ctx.fillText(this.labelFor(port), px + 20, py + 3);
        if (near) {
          this.ctx.fillStyle = "#ffcc00";
          this.ctx.font = "bold 11px Share Tech Mono";
          this.ctx.fillText("▶ DOCK AT ALIEN PORT [B]", px + 20, py + 16);
        }
      });
    }

    // Customs jurisdiction does not extend beyond the fold
    if (GameData.patrols && RegionManager.isCore()) {
      this.getPatrols().forEach(p => {
        const px = centerX + (p.x - this.shipX) * scale;
        const py = centerY + (p.y - this.shipY) * scale;
        if (px < -40 || px > viewWidth + 40 || py < -40 || py > viewHeight + 40) return;

        this.ctx.save();
        this.ctx.translate(px, py);
        this.ctx.rotate(p.angle);
        this.ctx.fillStyle = "#0a2a33";
        this.ctx.strokeStyle = p.color || "#00ccff";
        this.ctx.lineWidth = 1.6;
        this.ctx.shadowBlur = 9;
        this.ctx.shadowColor = p.color || "#00ccff";
        this.ctx.beginPath();
        this.ctx.moveTo(11, 0);
        this.ctx.lineTo(-7, 6);
        this.ctx.lineTo(-4, 0);
        this.ctx.lineTo(-7, -6);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();

        this.ctx.font = "bold 10px Share Tech Mono";
        this.ctx.fillStyle = p.color || "#00ccff";
        this.ctx.fillText(`⚑ ${this.labelFor(p)}`, px + 14, py + 3);
        if (this.nearbyPatrol && this.nearbyPatrol.id === p.id) {
          this.ctx.fillStyle = "#ffcc00";
          this.ctx.font = "9px Share Tech Mono";
          this.ctx.fillText("CUSTOMS INSPECTION ZONE", px + 14, py + 15);
        }
      });
    }

    // Render Quantum Wormholes in the Viewport. These were drawn NOWHERE in the
    // space view - the only hint a rift existed was the LAND control flipping to
    // ENTER WORMHOLE [W] once inside 4 LY, so players flew straight past them.
    {
      const pulse = 0.5 + Math.abs(Math.sin(Date.now() / 320)) * 0.5;
      RegionManager.content('wormholes').forEach(wh => {
        const px = centerX + (wh.x - this.shipX) * scale;
        const py = centerY + (wh.y - this.shipY) * scale;
        if (px < -60 || px > viewWidth + 60 || py < -60 || py > viewHeight + 60) return;

        const isNear = (this.nearbyWormhole && this.nearbyWormhole.id === wh.id);
        const r = (11 + pulse * 5) * (isNear ? 1.35 : 1);
        // Amber for a throat known to be one-way. Unscanned throats stay cyan -
        // the ship cannot tell them apart until the sensors have looked.
        const known = (typeof WormholeNet !== "undefined") && WormholeNet.isCharted(wh);
        const hue = (wh.oneWay && known) ? "#ffaa22" : "#00e5ff";

        // Swirling accretion rings
        this.ctx.save();
        this.ctx.strokeStyle = hue;
        this.ctx.shadowBlur = 14;
        this.ctx.shadowColor = hue;
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
        grad.addColorStop(0, (wh.oneWay && known) ? "rgba(255, 226, 170, 0.95)" : "rgba(180, 245, 255, 0.95)");
        grad.addColorStop(0.55, (wh.oneWay && known) ? "rgba(255, 170, 34, 0.35)" : "rgba(0, 229, 255, 0.35)");
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(px, py, r, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        this.ctx.font = "bold 10px Share Tech Mono";
        this.ctx.fillStyle = hue;
        this.ctx.fillText(this.labelFor(wh), px + r + 6, py + 3);
        if (isNear) {
          this.ctx.fillStyle = "#ffcc00";
          this.ctx.font = "bold 11px Share Tech Mono";
          this.ctx.fillText("▶ ENTER WORMHOLE [W]", px + r + 6, py + 16);
          this.ctx.font = "9px Share Tech Mono";
          if (!known) {
            this.ctx.fillStyle = "#889999";
            this.ctx.fillText("EXIT VECTOR UNRESOLVED - SCAN TO CHART", px + r + 6, py + 28);
          } else {
            this.ctx.fillStyle = wh.oneWay ? "#ffaa22" : "#88ccaa";
            this.ctx.fillText(`EXIT: ${wh.destName.toUpperCase()}`, px + r + 6, py + 28);
            if (wh.oneWay) this.ctx.fillText("WARNING: NO RETURN THROAT", px + r + 6, py + 40);
          }
        }
        this.ctx.restore();
      });
    }

    if (RegionManager.content('derelicts').length) {
      RegionManager.content('derelicts').forEach(der => {
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
          this.ctx.fillText(`${this.labelFor(der)} ${der.searched ? '[SALVAGED]' : ''}`, px + 12, py + 3);
        }
      });
    }

    // Render Subspace Distress Beacons in Viewport
    {
      this.allDistressSignals().forEach(sig => {
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

    // Draw whatever else is in orbit here - stations, hulks, debris belts. Drawn
    // under the planets so a world always wins the foreground.
    this.getSystemSites(system).forEach(site => {
      const meta = this.SITE_TYPES[site.kind];
      const pos = this.sitePosition(system, site, starX, starY, systemRadius);
      const looted = this.siteLooted(site);
      const near = (this.nearbySite && this.nearbySite.id === site.id);

      this.ctx.save();
      this.ctx.globalAlpha = looted ? 0.35 : 1;

      if (site.kind === "debris") {
        // A scatter rather than an object, seeded so it does not boil frame to frame
        const rnd = this.siteRandom("draw:" + site.id);
        this.ctx.fillStyle = meta.color;
        for (let i = 0; i < 14; i++) {
          const a = rnd() * Math.PI * 2, d = 4 + rnd() * 22;
          this.ctx.fillRect(pos.x + Math.cos(a) * d, pos.y + Math.sin(a) * d, 2, 2);
        }
      } else {
        this.ctx.font = "16px Share Tech Mono";
        this.ctx.fillStyle = meta.color;
        this.ctx.shadowBlur = looted ? 0 : 10;
        this.ctx.shadowColor = meta.color;
        this.ctx.fillText(meta.icon, pos.x - 8, pos.y + 6);
        this.ctx.shadowBlur = 0;
      }

      this.ctx.font = "bold 10px Share Tech Mono";
      this.ctx.fillStyle = looted ? "#777777" : meta.color;
      this.ctx.fillText(`${site.name.toUpperCase()}${looted ? " [STRIPPED]" : ""}`, pos.x + 14, pos.y + 3);
      if (near && !looted) {
        this.ctx.fillStyle = "#ffcc00";
        this.ctx.font = "bold 11px Share Tech Mono";
        this.ctx.fillText("▶ " + meta.action, pos.x + 14, pos.y + 16);
      }
      this.ctx.restore();
    });

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

    // Engine thruster flame. This used to draw unconditionally - only its SIZE
    // responded to the boost key - so a ship coasting on momentum, or sitting
    // completely still, still showed a full burn.
    const isBoosting = this.keys["Shift"] || this.keys["ShiftLeft"] || this.keys["ShiftRight"];
    if (this.isThrusting) {
      const flicker = 0.85 + Math.abs(Math.sin(Date.now() / 40)) * 0.3;
      const len = (isBoosting ? 28 : 16) * flicker;
      const wide = (isBoosting ? 6 : 4) * flicker;
      this.ctx.beginPath();
      this.ctx.moveTo(-4, 0);
      this.ctx.lineTo(-(len * 0.78), -wide);
      this.ctx.lineTo(-len, 0);
      this.ctx.lineTo(-(len * 0.78), wide);
      this.ctx.closePath();
      this.ctx.fillStyle = isBoosting ? "#00ccff" : "#ffaa00";
      this.ctx.shadowBlur = isBoosting ? 14 : 6;
      this.ctx.shadowColor = isBoosting ? "#00ccff" : "#ffaa00";
      this.ctx.fill();
    }

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
