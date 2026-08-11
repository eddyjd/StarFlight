/**
 * Main Game Controller for StarFlight: Odyssey
 * Integrates all sub-modules, manages global game state, handles keyboard listeners,
 * schedules the requestAnimationFrame loop, and saves progress.
 */

const GameManager = {
  viewState: "intro", // intro, spaceport, navigation, landing, encounter, barter
  spaceState: "hyper", // hyper, system
  lastTime: 0,

  // Player state object
  ship: {
    coordinates: { x: 250.0, y: 250.0 },
    credits: 1500,
    fuel: 100,
    maxFuel: 100,

    shieldsActive: false,
    shieldsCharge: 100,
    maxShields: 100,

    hull: 100,
    maxHull: 100,

    weaponsArmed: false,
    missilesAmmo: 0,
    maxMissiles: 0,

    // Module Levels (1-based index matching upgrades list)
    engineLevel: 1,
    shieldLevel: 1,
    armorLevel: 1,
    blasterLevel: 1,
    missileLevel: 0,
    scannerLevel: 1,
    cargoLevel: 1,
    cargoCap: 20,

    tvUpgrades: {
      engine: 1,
      armor: 1,
      blaster: 0,
      cargo: 1
    },

    // Cargo slots
    cargo: {},
    artifactsCollected: [], // unique names of precursor artifacts

    // Crew slots
    crew: {
      captain: null,
      science: null,
      navigator: null,
      engineer: null,
      comm: null,
      doctor: null
    },

    discoveredSystems: { "Starbase Prime": true },
    exploredSectors: { "250_250": true },
    encounterHistory: [],

    // Persistent world state for one-shot deep space sites (derelicts, alien
    // wrecks, distress beacons) keyed by their GameData id, e.g. { der_1: true }.
    // Lives on ship so it is written to the save file - the `searched` / `active`
    // flags on GameData itself are in-memory only and reset on every page load.
    salvagedIds: {},

    // Deep space sensor log: id -> 1 (long range contact) | 2 (identified)
    contactLog: {},

    // Every hint the captain has learned, from any source. See js/clues.js.
    clues: [],
    victory: false,

    // Quest progress: questId -> { stage, done, objectives }. See js/quest.js.
    quests: {},
    puzzlesSolved: {},
    volumesRead: [],
    relics: {},

    // Per-planet dossier: scan readings and everything recovered on the surface
    planetSurveys: {},

    // Wormholes / black holes the ship has actually been through. Once traversed,
    // the star map draws a line to where it comes out.
    traversedLinks: {},

    // Which volume of space the ship is in, and the per-region exploration record.
    // See js/region.js - the five knowledge fields above are the working copy for
    // whichever region is active.
    region: "core",
    regions: {},
    visitedRegions: { core: true },

    // Rare Precursor tech modules bolted onto the hull, by GameData.techParts id.
    // Their stat boosts are already folded into the numbers above; this is the
    // record of WHICH ones, so Ship Diagnostics can list them.
    installedTechParts: [],

    // Star map layer visibility, persisted so it survives a reload
    mapLayers: {
      systems: true,
      anomalies: true,
      salvage: true,
      aliens: true,
      patrols: true,
      ports: true,
      nebulae: true,
      unknown: true
    },

    launchConfig: {
      autoShields: true,
      autoWeapons: true
    },

    // The wormhole network is rolled per save rather than authored, so the throats
    // are somewhere new every game. Stored whole, not as a seed - see js/wormholes.js.
    wormholeSeed: null,
    wormholeNet: null,

    // Structural modules recovered in the field, waiting for the gravity drydock
    pendingModules: [],

    // Where a Precursor gate must put the rover back. Null unless mid-transit.
    portalReturn: null,

    // One-use equipment, as { itemId: count }. Not cargo - see js/consumables.js.
    consumables: {},

    // One-time dialogue lines already spoken, so they do not repeat
    dialogueSeen: {},

    // Distress calls that have come in over the band and not yet lapsed
    dynamicSignals: [],
    nextSignalAt: null,
    signalSerial: 0,

    // Seconds of actual play. Used for anything that should age with play time
    // rather than wall clock, so a save stays portable across sessions.
    playClock: 0,

    isInSpacebase: true,
    currentSystem: null,
    currentPlanet: null
  },

  init() {
    const errors = [];

    try { this.loadGame(); } catch (e) { errors.push("loadGame: " + e.message); console.error("loadGame error:", e); }
    try { UI.init(); } catch (e) { errors.push("UI.init: " + e.message); console.error("UI.init error:", e); }
    try { AudioController.init(); } catch (e) { errors.push("AudioController.init: " + e.message); console.error("AudioController.init error:", e); }
    try { Spaceport.init(); } catch (e) { errors.push("Spaceport.init: " + e.message); console.error("Spaceport.init error:", e); }
    try { Navigation.init(); } catch (e) { errors.push("Navigation.init: " + e.message); console.error("Navigation.init error:", e); }
    try { PlanetExploration.init(); } catch (e) { errors.push("PlanetExploration.init: " + e.message); console.error("PlanetExploration.init error:", e); }
    try { Encounter.init(); } catch (e) { errors.push("Encounter.init: " + e.message); console.error("Encounter.init error:", e); }

    try { RegionManager.migrate(this.ship); } catch (e) { errors.push("RegionManager.migrate: " + e.message); console.error("RegionManager.migrate error:", e); }
    try { QuestEngine.init(); } catch (e) { errors.push("QuestEngine.init: " + e.message); console.error("QuestEngine.init error:", e); }
    try { this.setupGlobalListeners(); } catch (e) { errors.push("setupGlobalListeners: " + e.message); console.error("setupGlobalListeners error:", e); }

    if (errors.length > 0) {
      document.title = "INIT ERRORS: " + errors.join(" | ");
      console.error("=== STARFLIGHT INIT ERRORS ===", errors);
    }

    // Start main game ticking loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.tick(t));
  },

  /**
   * The endgame. The lore in GameData.hqLogs has always described this - integrate
   * the three Precursor conduits with the warp reactor and stabilise the local
   * stars - but no code ever ran it, so returning with all three did nothing.
   * Invoked declaratively by the quest's onComplete.fn.
   */
  triggerAegisVictory() {
    const ship = this.ship;
    ship.victory = true;
    ship.victoryAt = (ship.victoryAt || (ship.clues || []).length);

    const lines = [
      "STARBASE PRIME: ALL THREE PRECURSOR CONDUITS RECEIVED.",
      "DEPOT ENGINEERS INTEGRATING CRYSTAL MATRIX WITH THE WARP REACTOR...",
      "AEGIS MATRIX ONLINE. DAMPENING WAVE PROPAGATING ACROSS THE QUADRANT.",
      "STELLAR COLLAPSE ARRESTED. G-CLASS CORES RETURNING TO NOMINAL OUTPUT.",
      "COMMAND: THE INHABITED WORLDS WILL SURVIVE, CAPTAIN. THE CORPS OWES YOU EVERYTHING.",
      "=== PRECURSOR AEGIS COMPLETE - THE QUADRANT IS SAVED ==="
    ];
    lines.forEach((line, i) => setTimeout(() => { try { UI.addLog(line); } catch (e) {} }, i * 900));

    try {
      if (typeof AudioController !== "undefined" && AudioController.playVictory) AudioController.playVictory();
    } catch (e) {}

    setTimeout(() => { try { UI.openVictoryModal(); } catch (e) {} }, lines.length * 900);
    try { this.saveGame(); } catch (e) {}
  },

  // Record a one-shot deep space site as consumed, and persist it immediately.
  markSalvaged(id) {
    if (!id) return;
    if (!this.ship.salvagedIds) this.ship.salvagedIds = {};
    this.ship.salvagedIds[id] = true;
    // The salvage_site objective reads salvagedIds, but nothing told the engine the
    // set had changed - so a "salvage X" objective sat unresolved until some other
    // event happened to fire an evaluation.
    if (typeof QuestEngine !== "undefined") QuestEngine.notify("salvage", { siteId: id });
    this.saveGame();
  },

  // Rehydrate the in-memory GameData flags from the save. Must run after any load,
  // import or reset, otherwise looted sites come back to life on every reload.
  applySalvageState() {
    if (typeof GameData === "undefined") return;
    const salvaged = (this.ship && this.ship.salvagedIds) || {};

    if (GameData.derelicts) {
      GameData.derelicts.forEach(der => { der.searched = !!salvaged[der.id]; });
    }
    if (GameData.spaceWrecks) {
      GameData.spaceWrecks.forEach(sw => { sw.searched = !!salvaged[sw.id]; });
    }
    if (GameData.distressSignals) {
      GameData.distressSignals.forEach(sig => { sig.active = !salvaged[sig.id]; });
    }
  },

  // Standalone launch method callable from inline onclick
  dispatchLaunch() {
    try {
      if (typeof AudioController !== 'undefined' && AudioController.playBeep) {
        AudioController.playBeep('success');
      }
    } catch (e) {}

    if (!this.ship.crew) this.ship.crew = {};
    if (!this.ship.crew.captain) {
      this.ship.crew.captain = { id: "starter_cap", name: "Capt. Vance", race: "Human", role: "Captain", skill: 70, hp: 100, maxHp: 100 };
    }
    if (!this.ship.crew.navigator) {
      this.ship.crew.navigator = { id: "starter_nav", name: "Nav. Kren", race: "Human", role: "Navigator", skill: 65, hp: 100, maxHp: 100 };
    }

    this.ship.isInSpacebase = false;
    if (!this.ship.coordinates || isNaN(this.ship.coordinates.x)) {
      this.ship.coordinates = { x: 250.0, y: 250.0 };
    }

    this.viewState = "navigation";
    this.spaceState = "hyper";

    if (typeof Navigation !== 'undefined') {
      Navigation.shipX = this.ship.coordinates.x;
      Navigation.shipY = this.ship.coordinates.y;
      Navigation.shipVx = 0;
      Navigation.shipVy = 0;
      Navigation.shipAngle = -Math.PI / 2;
    }

    if (typeof UI !== 'undefined') {
      UI.switchView("navigation");
      try { UI.updateControlPanel(true, null, this.ship.shieldsActive, this.ship.weaponsArmed); } catch (e) {}
      try { UI.updateCrew(this.ship); } catch (e) {}
      try { UI.updateShip(this.ship); } catch (e) {}
      try { UI.addLog("DISPATCH JUMP INITIALIZED. ISS ODYSSEY LAUNCHED FROM STARBASE PRIME."); } catch (e) {}
    }

    try {
      if (typeof AudioController !== 'undefined' && AudioController.startEngine) {
        AudioController.startEngine();
      }
    } catch (e) {}

    try { this.saveGame(); } catch (e) {}
  },

  // Standalone starport entry callable from inline onclick
  enterStarport() {
    try {
      if (typeof AudioController !== 'undefined' && AudioController.playBeep) {
        AudioController.playBeep('click');
      }
    } catch (e) {}

    this.ship.isInSpacebase = true;
    this.viewState = "spaceport";

    if (typeof UI !== 'undefined') {
      UI.switchView("spaceport");
      try { UI.updateCrew(this.ship); } catch (e) {}
      try { UI.updateShip(this.ship); } catch (e) {}
    }
    if (typeof Spaceport !== 'undefined') {
      try { Spaceport.renderAll(); } catch (e) {}
    }
  },

  setupGlobalListeners() {
    const fileInput = document.getElementById("importFileInput");

    // Intro start game button (Direct Launch into Space Navigation)
    const startBtn = document.getElementById("startGameBtn");
    if (startBtn) {
      startBtn.addEventListener("click", () => {
        try {
          if (typeof AudioController !== 'undefined' && AudioController.playBeep) {
            AudioController.playBeep('success');
          }

          // Auto assign starter captain & navigator if unassigned so launch is never blocked
          if (!this.ship.crew) this.ship.crew = {};
          if (!this.ship.crew.captain) {
            this.ship.crew.captain = { id: "starter_cap", name: "Capt. Vance", race: "Human", role: "Captain", skill: 70, hp: 100, maxHp: 100 };
          }
          if (!this.ship.crew.navigator) {
            this.ship.crew.navigator = { id: "starter_nav", name: "Nav. Kren", race: "Human", role: "Navigator", skill: 65, hp: 100, maxHp: 100 };
          }

          // Launch ship directly into space navigation on dispatch jump
          this.ship.isInSpacebase = false;
          if (!this.ship.coordinates || isNaN(this.ship.coordinates.x)) {
            this.ship.coordinates = { x: 250.0, y: 250.0 };
          }

          this.viewState = "navigation";
          this.spaceState = "hyper";

          if (typeof Navigation !== 'undefined') {
            Navigation.shipX = this.ship.coordinates.x;
            Navigation.shipY = this.ship.coordinates.y;
            Navigation.shipVx = 0;
            Navigation.shipVy = 0;
            Navigation.shipAngle = -Math.PI / 2;
          }

          UI.switchView("navigation");
          UI.updateControlPanel(true, null, this.ship.shieldsActive, this.ship.weaponsArmed);
          UI.updateCrew(this.ship);
          UI.updateShip(this.ship);

          if (typeof AudioController !== 'undefined' && AudioController.startEngine) {
            AudioController.startEngine();
          }

          UI.addLog("DISPATCH JUMP INITIALIZED. ISS ODYSSEY LAUNCHED FROM STARBASE PRIME.");
          this.saveGame();
        } catch (err) {
          console.error("Error in dispatch jump:", err);
          this.viewState = "navigation";
          UI.switchView("navigation");
        }
      });
    }

    // Intro enter spaceport facility button
    const enterBaseBtn = document.getElementById("enterSpaceportBtn");
    if (enterBaseBtn) {
      enterBaseBtn.addEventListener("click", () => {
        if (typeof AudioController !== 'undefined' && AudioController.playBeep) {
          AudioController.playBeep('click');
        }
        this.ship.isInSpacebase = true;
        this.viewState = "spaceport";
        UI.switchView("spaceport");
        Spaceport.renderAll();
        UI.updateCrew(this.ship);
        UI.updateShip(this.ship);
      });
    }

    // Intro export / import / reset buttons
    const exportBtn = document.getElementById("exportSaveBtn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => this.exportSaveFile());
    }

    const importBtn = document.getElementById("importSaveBtn");
    if (importBtn) {
      importBtn.addEventListener("click", () => {
        if (fileInput) fileInput.click();
      });
    }

    if (fileInput) {
      fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          this.importSaveFile(e.target.files[0]);
          e.target.value = ""; // reset file input
        }
      });
    }

    // Intro reset game button
    document.getElementById("resetGameBtn").addEventListener("click", () => {
      this.resetGame();
    });

    // NOTE: The bottom control bar buttons (ctrl-scan, ctrl-land, ctrl-shields, ctrl-weapons,
    // ctrl-starmap) are bound ONCE, in UI.setupListeners(). Do not bind them here as well —
    // a second listener makes every click fire twice, which reads as a toggle flipping
    // off and straight back on. Keyboard shortcuts below still route through this object.

    // Keyboard Shortcuts
    window.addEventListener("keydown", (e) => {
      // Ignore key shortcuts if any modal is visible (except Escape key)
      const cargoModal = document.getElementById("cargo-modal");
      const transferModal = document.getElementById("transfer-modal");
      const tvModal = document.getElementById("tv-cargo-modal");
      const starmapModal = document.getElementById("starmap-modal");
      const patrolModal = document.getElementById("patrol-modal");
      const archiveModal = document.getElementById("archive-modal");
      const puzzleModal = document.getElementById("puzzle-modal");
      const rescueModal = document.getElementById("rescue-modal");
      const portModal = document.getElementById("port-modal");
      const lockerModal = document.getElementById("locker-modal");

      const isModalOpen = (cargoModal && !cargoModal.classList.contains("hidden")) ||
                          (transferModal && !transferModal.classList.contains("hidden")) ||
                          (tvModal && !tvModal.classList.contains("hidden")) ||
                          (starmapModal && !starmapModal.classList.contains("hidden")) ||
                          (patrolModal && !patrolModal.classList.contains("hidden")) ||
                          (archiveModal && !archiveModal.classList.contains("hidden")) ||
                          (puzzleModal && !puzzleModal.classList.contains("hidden")) ||
                          (rescueModal && !rescueModal.classList.contains("hidden")) ||
                          (portModal && !portModal.classList.contains("hidden")) ||
                          (lockerModal && !lockerModal.classList.contains("hidden"));

      if (e.key === "Escape") {
        // Every `.modal` is a full-screen overlay at z-index 100 that takes
        // clicks, so ANY modal left open makes the entire control bar
        // unreachable - every button on it reads as broken. Five modals had no
        // keyboard exit at all, and two of them (the legend and the landing-site
        // picker) had a button literally captioned "[ESC]" that did nothing.
        //
        // Excluded on purpose:
        //   patrol   - must resolve before it can be dismissed (handled below)
        //   techpart - Esc would silently bin a salvaged module; INSTALL/STORE
        //              are the two ways out and both keep it
        //   derelict / distress / transfer - each is a choice with its own
        //              resolution buttons, and Esc would quietly forfeit it
        const escapable = [
          "cargo-modal", "tv-cargo-modal", "starmap-modal", "archive-modal",
          "puzzle-modal", "rescue-modal", "port-modal", "locker-modal",
          "captains-log-modal", "help-modal", "legend-modal",
          "landing-site-modal", "victory-modal"
        ];
        escapable.forEach(id => {
          const m = document.getElementById(id);
          if (m) m.classList.add("hidden");
        });
        if (portModal) UI.currentPort = null;
        if (typeof Navigation !== "undefined" && Navigation.cancelFoldPicking) Navigation.cancelFoldPicking();

        // Only dismissable once the inspection has actually resolved
        if (patrolModal && !document.getElementById("patrol-close-btn").classList.contains("hidden")) {
          UI.closePatrolModal();
        }
        return;
      }

      if (this.viewState === "barter" || isModalOpen) {
        return;
      }

      if (this.viewState === "navigation") {
        if (e.key === "s" || e.key === "S") {
          // SHIFT+S is the long range sweep, handled in Navigation
          if (!e.shiftKey) this.triggerScan();
        }
        else if (e.key === "l" || e.key === "L") this.triggerLanding();
        else if (e.key === "k" || e.key === "K") this.toggleShields();
        // NOTE: [F] fires the phaser blasters (Navigation.firePlayerBlaster) and must NOT
        // also toggle the armed/safe state - arming is done from the WEAPONS control
        // button or automatically at launch via ship.launchConfig.autoWeapons.
        else if (e.key === "m" || e.key === "M") Navigation.openStarMapModal();
        else if (e.key === "i" || e.key === "I") UI.openCargoModal();
        else if (e.key === "o" || e.key === "O") UI.openLockerModal();
      }
      else if (this.viewState === "landing" && PlanetExploration.active) {
        if (e.key === "i" || e.key === "I") PlanetExploration.openRoverCargoModal();
        else if (e.key === "u" || e.key === "U") PlanetExploration.unloadAtLander();
        else PlanetExploration.handleInput(e.key);
      }
    });
  },

  // State action shortcuts
  triggerScan() {
    if (this.viewState !== "navigation") return;
    if (this.ship.currentPlanet) {
      PlanetExploration.scanPlanet();
    } else {
      Navigation.triggerSonar();
    }
  },

  triggerLanding() {
    if (this.viewState !== "navigation") return;

    if (this.spaceState === "hyper") {
      if (Navigation.nearbySpaceWreck) {
        Navigation.salvageSpaceWreck();
      } else if (Navigation.nearbyCombatWreck) {
        Navigation.salvageCombatWreck();
      } else if (Navigation.nearbyDerelict) {
        Navigation.boardNearbyDerelict();
      } else if (Navigation.nearbyAlienPort) {
        // Must mirror the priority order in updateHyper's deepActionLabel, or the
        // button performs something other than what it says.
        Navigation.dockAtAlienPort();
      } else if (Navigation.nearbyDistressSignal) {
        Navigation.investigateDistressSignal();
      } else if (Navigation.nearbyWormhole) {
        Navigation.enterNearbyWormhole();
      } else if (Math.hypot(Navigation.shipX - 250.0, Navigation.shipY - 250.0) < 4.0) {
        Navigation.enterSpacebase();
      } else {
        AudioController.playBeep('error');
        UI.addLog("DOCKING UNAVAILABLE: APPROACH STARBASE PRIME AT (250, 250), AN ALIEN WRECK, DERELICT, WORMHOLE OR BEACON.");
      }
    } else if (this.spaceState === "system") {
      // In Solar System: landing on current planet, or working an orbital site.
      // A world always wins - the site prompt only claims the control when the
      // ship is not already inside a planet's gravity.
      if (this.ship.currentPlanet) {
        PlanetExploration.startLanding();
      } else if (Navigation.nearbySite) {
        Navigation.workNearbySite();
      } else {
        AudioController.playBeep('error');
        UI.addLog("LANDING UNAVAILABLE: APPROACH A PLANET ORBIT, STATION, WRECK OR DEBRIS FIELD FIRST.");
      }
    }
  },

  toggleShields() {
    if (this.viewState === "spaceport") {
      AudioController.playBeep('error');
      UI.addLog("STARBASE SAFETY PROTOCOL: Shields locked offline while docked at Station Facility.");
      return;
    }

    if (this.ship.shieldLevel === 0) {
      AudioController.playBeep('error');
      UI.addLog("Shields failed: Equip a shield module at spaceport depot first.");
      return;
    }

    if (this.ship.shieldsCharge <= 0) {
      AudioController.playBeep('error');
      UI.addLog("SHIELDS FAILED: CAPACITORS AT 0%. THEY RECHARGE SLOWLY WHILE LOWERED, OR INSTANTLY WHEN YOU DOCK AT STARBASE PRIME.");
      return;
    }

    this.ship.shieldsActive = !this.ship.shieldsActive;
    AudioController.playBeep('success');
    UI.addLog(`Shield barrier systems: ${this.ship.shieldsActive ? "ONLINE" : "OFFLINE"}`);

    UI.updateShip(this.ship);
    UI.updateControlPanel(true, this.ship.currentPlanet, this.ship.shieldsActive, this.ship.weaponsArmed);
    this.saveGame();
  },

  toggleWeapons() {
    if (this.viewState === "spaceport") {
      AudioController.playBeep('error');
      UI.addLog("STARBASE SAFETY PROTOCOL: Tactical weapons locked offline while docked at Station Facility.");
      return;
    }

    const hasWeapons = this.ship.blasterLevel > 0 || this.ship.missileLevel > 0;
    if (!hasWeapons) {
      AudioController.playBeep('error');
      UI.addLog("Weapons failed: Equip blaster or missile launcher first.");
      return;
    }

    this.ship.weaponsArmed = !this.ship.weaponsArmed;
    AudioController.playBeep('success');
    UI.addLog(`Tactical weapons status: ${this.ship.weaponsArmed ? "ARMED" : "SAFE"}`);

    UI.updateShip(this.ship);
    UI.updateControlPanel(true, this.ship.currentPlanet, this.ship.shieldsActive, this.ship.weaponsArmed);
    this.saveGame();
  },

  /**
   * Is a blocking dialog on screen? Every `.modal` is a full-screen overlay, so
   * if one is open the captain cannot see or reach the ship anyway.
   *
   * Deliberately excludes the star map: it is a chart the captain reads WHILE
   * flying, and freezing the galaxy behind it would make the vessel marker lie.
   */
  isDialogOpen() {
    const open = document.querySelectorAll(".modal:not(.hidden)");
    for (let i = 0; i < open.length; i++) {
      if (open[i].id !== "starmap-modal") return true;
    }
    return false;
  },

  // Main Loop ticking - hardened against frame crashes
  tick(timestamp) {
    // Schedule next frame tick FIRST so exceptions never kill the animation loop
    requestAnimationFrame((t) => this.tick(t));

    if (!this.lastTime) this.lastTime = timestamp;
    const rawDt = (timestamp - this.lastTime) / 1000;
    const dt = Math.min(0.05, Math.max(0.001, (isNaN(rawDt) ? 0.016 : rawDt)));
    this.lastTime = timestamp;

    try {
      // A modal is a conversation, and the ship should not be flying itself
      // during one. The world used to keep running behind every dialog: reading a
      // distress beacon parked in the drift of a gateway singularity drifted the
      // hull in and transited it to another region while the captain was reading.
      // Measured at 4 LY of unattended movement in 12 seconds.
      //
      // Rendering continues so the viewport does not freeze into a dead image -
      // only time stops.
      const paused = this.isDialogOpen();

      if (this.viewState === "navigation") {
        if (!paused) {
          Navigation.update(dt);
          this.checkAlienSpawnProbability(dt);
        }
        Navigation.draw();
        if (!paused) this.updateCrewHealing(dt);
      }
      else if (this.viewState === "landing") {
        PlanetExploration.draw();
        if (!paused) this.updateCrewHealing(dt);
      }
      else if (this.viewState === "encounter") {
        // The encounter view IS the dialog - it runs on its own terms.
        Encounter.update(dt);
        this.updateCrewHealing(dt);
      }

      if (paused) return;

      // Applies in flight, on a surface and mid-encounter alike
      this.updateShieldRegen(dt);

      // Seconds of actual play. Anything that should age with play rather than
      // wall clock reads this, so a save stays portable across sessions.
      this.ship.playClock = (this.ship.playClock || 0) + dt;
      if (typeof DistressNet !== "undefined") DistressNet.update(dt);
    } catch (err) {
      console.error("Game loop tick error caught safely:", err);
    }
  },

  // Deflector capacitors trickle-charge whenever the shields are lowered.
  // Without this, roughly one minute of raised shields drained them to 0 with no
  // way back at all: docking did not recharge them, and the only restore path was
  // relaunching from the Starport with AUTO-RAISE SHIELDS enabled.
  updateShieldRegen(dt) {
    const ship = this.ship;
    if (!ship || ship.isInSpacebase) return;
    if (!ship.shieldLevel || ship.shieldLevel <= 0) return;
    if (ship.shieldsActive) return; // raised shields drain, they do not charge

    const max = ship.maxShields || 100;
    if (!(ship.shieldsCharge < max)) return;

    // Rate is a fraction of capacity, so bigger shield classes do not take
    // proportionally longer, and an Engineer on the crew speeds it up.
    // Same 40 "no specialist aboard" baseline the drain side uses, so an unmanned
    // engineering station behaves consistently in both directions.
    const engSkill = (ship.crew && ship.crew.engineer) ? ship.crew.engineer.skill : 40;
    // An ionised cloud is a capacitor you can park in; a gamma rift is the
    // opposite. The Tarantula Nebula has promised this since it was written.
    const nebMult = (typeof Navigation !== "undefined" && Navigation.nebulaShieldMult)
      ? Navigation.nebulaShieldMult() : 1.0;
    const rate = max * (0.008 + engSkill / 12000) * nebMult;
    if (rate <= 0) return;

    const before = ship.shieldsCharge || 0;
    ship.shieldsCharge = Math.min(max, before + rate * dt);

    if (before <= 0 && ship.shieldsCharge > 0) {
      UI.addLog("DEFLECTOR CAPACITORS RECHARGING FROM RESERVE POWER...");
    }
    if (before < max && ship.shieldsCharge >= max) {
      UI.addLog("DEFLECTOR SHIELD MATRIX RESTORED TO FULL CHARGE.");
      if (typeof AudioController !== 'undefined' && AudioController.playBeep) {
        AudioController.playBeep('success');
      }
    }
    // Only touch the DOM when the displayed integer actually moves
    if (Math.floor(before) !== Math.floor(ship.shieldsCharge)) UI.updateShip(ship);
  },

  // Passive crew health regeneration over time (Doctor boost)
  updateCrewHealing(dt) {
    if (!this.ship || !this.ship.crew) return;

    const doctor = this.ship.crew.doctor;
    // Healing rate: Base 0.5 HP/sec, plus Doctor skill bonus (up to +4.0 HP/sec)
    const healRate = 0.5 + (doctor ? (doctor.skill / 25) : 0);

    let needsUIUpdate = false;
    const roles = ['captain', 'science', 'navigator', 'engineer', 'comm', 'doctor'];
    
    roles.forEach(role => {
      const member = this.ship.crew[role];
      if (member) {
        const maxHp = member.maxHp || member.hp || 100;
        if (member.hp < maxHp) {
          member.hp = Math.min(maxHp, member.hp + healRate * dt);
          needsUIUpdate = true;
        }
      }
    });

    if (needsUIUpdate) {
      UI.updateCrew(this.ship);
    }
  },

  // Proximity alien intercept logic (NO random auto-spawns)
  checkAlienSpawnProbability(dt) {
    if (this.ship.isInSpacebase) return;

    // Tick encounter immunity cooldown timer
    if (this.encounterCooldown && this.encounterCooldown > 0) {
      this.encounterCooldown -= dt;
      return;
    }

    // Only hostile Uhlek vessels intercept automatically when physically right next to player ship (< 3.5 LY)
    if (Navigation.alienShips) {
      const shipX = this.ship.coordinates.x || 250.0;
      const shipY = this.ship.coordinates.y || 250.0;

      Navigation.alienShips.forEach(alien => {
        if (alien.raceKey === "uhlek") {
          const dist = Math.hypot(shipX - alien.x, shipY - alien.y);
          if (dist < 3.5) {
            this.encounterCooldown = 25.0;
            Encounter.trigger("uhlek");
          }
        }
      });
    }
  },

  // Save game state
  saveGame() {
    try {
      // Flush the live exploration fields into the region they describe, or a
      // reload would attribute them to whichever region loads first.
      try {
        if (typeof RegionManager !== "undefined") {
          RegionManager.migrate(this.ship);
          RegionManager.stash(this.ship, this.ship.region || "core");
        }
      } catch (e) {}

      const shipToSave = Object.assign({}, this.ship);
      if (this.spaceState === "hyper" || this.ship.isInSpacebase) {
        shipToSave.currentPlanet = null;
      }
      localStorage.setItem("starflight_odyssey_save", JSON.stringify(shipToSave));
    } catch (e) {
      console.warn("Failed to auto save progress", e);
    }
  },

  // Export Save Game to downloadable .json file
  exportSaveFile() {
    try {
      const shipToSave = Object.assign({}, this.ship);
      if (this.spaceState === "hyper" || this.ship.isInSpacebase) {
        shipToSave.currentPlanet = null;
      }

      const saveData = {
        title: "StarFlight: Odyssey Save File",
        version: "1.0",
        timestamp: new Date().toISOString(),
        ship: shipToSave
      };

      const jsonStr = JSON.stringify(saveData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `starflight_save_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (typeof AudioController !== 'undefined' && AudioController.playBeep) {
        AudioController.playBeep('success');
      }
      UI.addLog("GAME PROGRESS EXPORTED TO JSON FILE.");
    } catch (e) {
      console.error("Failed to export save file", e);
      alert("Error exporting save file: " + e.message);
    }
  },

  // Import Save Game from user-selected .json file
  importSaveFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const shipData = parsed.ship || parsed;

        if (!shipData || typeof shipData.credits === 'undefined') {
          throw new Error("Invalid StarFlight save file format.");
        }

        // Reset runtime states
        this.resetGameData();
        this.ship = Object.assign({}, this.ship, shipData);
        if (!this.ship.salvagedIds) this.ship.salvagedIds = {};
        if (!this.ship.quests) this.ship.quests = {};
        if (!Array.isArray(this.ship.clues)) this.ship.clues = [];
        try { RegionManager.migrate(this.ship); } catch (e) {}
        this.applySalvageState();
        try { QuestEngine.init(); } catch (e) { console.warn("QuestEngine re-init failed", e); }

        if (this.ship.isInSpacebase || this.spaceState === "hyper") {
          this.ship.currentPlanet = null;
        }

        // Sync navigation ship positions
        if (typeof Navigation !== 'undefined') {
          Navigation.resetPhysics(this.ship.coordinates.x || 250.0, this.ship.coordinates.y || 250.0);
        }
        this.spaceState = "hyper";

        if (typeof PlanetExploration !== 'undefined') {
          PlanetExploration.active = false;
          PlanetExploration.planet = null;
          PlanetExploration.cargo = [];
        }

        if (typeof Encounter !== 'undefined') {
          Encounter.active = false;
          Encounter.inCombat = false;
          Encounter.fleeing = false;
        }

        UI.addLog("SAVE FILE IMPORTED SUCCESSFULLY! PROGRESS RESTORED.");
        UI.updateCrew(this.ship);
        UI.updateShip(this.ship);
        UI.updateControlPanel(true, null, false, false);

        if (this.ship.isInSpacebase) {
          this.viewState = "spaceport";
          UI.switchView("spaceport");
          Spaceport.renderAll();
        } else {
          this.viewState = "navigation";
          UI.switchView("navigation");
        }

        this.saveGame();
        if (typeof AudioController !== 'undefined' && AudioController.playBeep) {
          AudioController.playBeep('success');
        }
      } catch (err) {
        console.error("Failed to import save file", err);
        alert("Could not load save file. " + err.message);
      }
    };
    reader.readAsText(file);
  },

  // Load game state
  loadGame() {
    try {
      const data = localStorage.getItem("starflight_odyssey_save");
      if (data) {
        const parsed = JSON.parse(data);
        // Merge attributes carefully
        this.ship = Object.assign({}, this.ship, parsed);
        this.viewState = "intro";

        if (this.ship.isInSpacebase || this.spaceState === "hyper") {
          this.ship.currentPlanet = null;
        }

        // Migration check for v1.8.0 500x500 Galaxy Map
        if (!this.ship.coordinates || (this.ship.coordinates.x === 100 && this.ship.coordinates.y === 100)) {
          this.ship.coordinates = { x: 250.0, y: 250.0 };
        }
        if (this.ship.exploredSectors && this.ship.exploredSectors["100_100"]) {
          this.ship.exploredSectors["250_250"] = true;
        }

        // Ensure default starting shield and blaster modules if old save
        if (!this.ship.shieldLevel || this.ship.shieldLevel < 1) {
          this.ship.shieldLevel = 1;
          this.ship.maxShields = 100;
          this.ship.shieldsCharge = 100;
        }
        if (!this.ship.blasterLevel || this.ship.blasterLevel < 1) {
          this.ship.blasterLevel = 1;
        }

        // Migration: saves from before v1.9.10 have no salvage ledger
        if (!this.ship.salvagedIds) this.ship.salvagedIds = {};
        if (!this.ship.contactLog) this.ship.contactLog = {};
        if (!Array.isArray(this.ship.clues)) this.ship.clues = [];
        if (!this.ship.quests) this.ship.quests = {};
        if (!this.ship.puzzlesSolved) this.ship.puzzlesSolved = {};
        if (!Array.isArray(this.ship.volumesRead)) this.ship.volumesRead = [];
        if (!this.ship.relics) this.ship.relics = {};
        if (!this.ship.planetSurveys) this.ship.planetSurveys = {};
        if (!this.ship.visitedRegions) this.ship.visitedRegions = { core: true };
        if (!this.ship.traversedLinks) this.ship.traversedLinks = {};
        if (!Array.isArray(this.ship.installedTechParts)) this.ship.installedTechParts = [];
        if (!Array.isArray(this.ship.pendingModules)) this.ship.pendingModules = [];
        if (!this.ship.consumables) this.ship.consumables = {};

        // Scrub null entries out of the name lists.
        //
        // Before v1.11.1, excavating one of the 20 ruin worlds that carry no
        // artifact ran this:
        //     ship.artifactsCollected.push(artifactName);      // null pushed
        //     UI.addLog(`... ${artifactName.toUpperCase()}`);  // then threw
        // The push landed, the throw was swallowed by the frame handler, and the
        // null was saved. From then on EVERY attempt to open the cargo manifest
        // threw on `art.toUpperCase()` - so the CARGO LOG control was dead for
        // the rest of that save's life, with nothing on screen to say why.
        //
        // v1.11.1 stopped new nulls being created but never cleaned up the ones
        // already sitting in people's saves. This does.
        ["artifactsCollected", "installedTechParts", "pendingModules", "volumesRead"].forEach(f => {
          if (!Array.isArray(this.ship[f])) { this.ship[f] = []; return; }
          const before = this.ship[f].length;
          this.ship[f] = this.ship[f].filter(v => typeof v === "string" && v.length > 0);
          if (this.ship[f].length !== before) {
            console.warn(`Save repair: removed ${before - this.ship[f].length} empty entr(y/ies) from ship.${f}`);
          }
        });
        if (Array.isArray(this.ship.clues)) {
          this.ship.clues = this.ship.clues.filter(c => c && c.id && c.text);
        }
        if (!Array.isArray(this.ship.dynamicSignals)) this.ship.dynamicSignals = [];
        if (!this.ship.dialogueSeen) this.ship.dialogueSeen = {};
        if (typeof this.ship.playClock !== "number") this.ship.playClock = 0;
        if (!this.ship.mapLayers) {
          this.ship.mapLayers = { systems: true, anomalies: true, salvage: true, aliens: true, patrols: true, ports: true, nebulae: true, unknown: true };
        }

        // Sync navigation ship positions
        Navigation.shipX = this.ship.coordinates.x || 250.0;
        Navigation.shipY = this.ship.coordinates.y || 250.0;
        Navigation.shipVx = 0;
        Navigation.shipVy = 0;
      }
    } catch (e) {
      console.warn("Failed to load progress", e);
    }

    // The wormhole network is rolled per save. An older save has none stored, so
    // this is also the migration: it rolls once and keeps it from then on.
    try {
      if (typeof WormholeNet !== "undefined") WormholeNet.ensure(this.ship);
    } catch (e) { console.warn("WormholeNet.ensure failed", e); }

    // Always run, even with no save present, so a fresh galaxy starts un-looted
    try { this.applySalvageState(); } catch (e) { console.warn("applySalvageState failed", e); }
  },

  resetGame() {
    if (confirm("Are you sure you want to delete all save data and restart the game?")) {
      if (typeof AudioController !== 'undefined' && AudioController.playBeep) {
        AudioController.playBeep('error');
      }
      this.resetGameData();

      // Reset in-memory state
      this.ship = {
        coordinates: { x: 250.0, y: 250.0 },
        credits: 1500,
        fuel: 100,
        maxFuel: 100,
        shieldsActive: false,
        shieldsCharge: 100,
        maxShields: 100,
        hull: 100,
        maxHull: 100,
        weaponsArmed: false,
        missilesAmmo: 0,
        maxMissiles: 0,
        engineLevel: 1,
        shieldLevel: 1,
        armorLevel: 1,
        blasterLevel: 1,
        missileLevel: 0,
        scannerLevel: 1,
        cargoLevel: 1,
        cargoCap: 20,
        tvUpgrades: { engine: 1, armor: 1, blaster: 0, cargo: 1 },
        cargo: {},
        artifactsCollected: [],
        crew: { captain: null, science: null, navigator: null, engineer: null, comm: null, doctor: null },
        discoveredSystems: { "Starbase Prime": true },
        exploredSectors: { "250_250": true },
        encounterHistory: [],
        exploredPlanets: {},
        salvagedIds: {},
        contactLog: {},
        clues: [],
        victory: false,
        quests: {},
        puzzlesSolved: {},
        volumesRead: [],
        relics: {},
        planetSurveys: {},
        traversedLinks: {},
        region: "core",
        regions: {},
        visitedRegions: { core: true },
        installedTechParts: [],
        mapLayers: { systems: true, anomalies: true, salvage: true, aliens: true, patrols: true, ports: true, nebulae: true, unknown: true },
        launchConfig: { autoShields: true, autoWeapons: true },
        wormholeSeed: null,
        wormholeNet: null,
        pendingModules: [],
        portalReturn: null,
        consumables: {},
        playClock: 0,
        dialogueSeen: {},
        dynamicSignals: [],
        nextSignalAt: null,
        signalSerial: 0,
        isInSpacebase: true,
        currentSystem: null,
        currentPlanet: null
      };

      // A new galaxy gets a new set of throats. This is the point of rolling them
      // per save - a captain who has played before should not already know the map.
      try { WormholeNet.reroll(this.ship); } catch (e) { console.warn("WormholeNet.reroll failed", e); }

      // Refill every derelict, wreck and distress beacon for the new game
      this.applySalvageState();

      try { RegionManager.migrate(this.ship); } catch (e) {}

      // Restart the story. Without this a NEW GAME leaves every quest unstarted,
      // because resetGame() rebuilds ship.quests as an empty object.
      try { QuestEngine.init(); } catch (e) { console.warn("QuestEngine restart failed", e); }

      // Reset navigation and system physics
      this.spaceState = "hyper";
      if (typeof Navigation !== 'undefined') {
        Navigation.resetPhysics(250.0, 250.0);
      }

      // Reset planet explorer
      if (typeof PlanetExploration !== 'undefined') {
        PlanetExploration.active = false;
        PlanetExploration.planet = null;
        PlanetExploration.cargo = [];
      }

      // Reset encounters
      if (typeof Encounter !== 'undefined') {
        Encounter.active = false;
        Encounter.inCombat = false;
        Encounter.fleeing = false;
      }

      UI.addLog("Save wiped. New dispatch sequence authorized.");
      UI.updateCrew(this.ship);
      UI.updateShip(this.ship);
      UI.updateControlPanel(true, null, false, false);

      this.viewState = "spaceport";
      UI.switchView("spaceport");
      Spaceport.renderAll();

      this.saveGame();
    }
  },

  resetGameData() {
    try {
      localStorage.removeItem("starflight_odyssey_save");
    } catch (e) { }
  }
};

window.game = GameManager;

// Quest rewards reference bespoke payoffs by name (onComplete.fn), so the engine
// stays free of story-specific code.
window.triggerAegisVictory = function () { GameManager.triggerAegisVictory(); };
window.onload = () => {
  GameManager.init();
};
