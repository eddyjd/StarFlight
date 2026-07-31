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

    launchConfig: {
      autoShields: true,
      autoWeapons: true
    },

    isInSpacebase: true,
    currentSystem: null,
    currentPlanet: null
  },

  init() {
    this.loadGame();
    UI.init();
    AudioController.init();
    Spaceport.init();
    Navigation.init();
    PlanetExploration.init();
    Encounter.init();

    this.setupGlobalListeners();

    // Start main game ticking loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.tick(t));
  },

  setupGlobalListeners() {
    const fileInput = document.getElementById("importFileInput");

    // Intro start game button
    document.getElementById("startGameBtn").addEventListener("click", () => {
      AudioController.playBeep('success');
      if (this.ship.isInSpacebase) {
        this.viewState = "spaceport";
        UI.switchView("spaceport");
        Spaceport.renderAll();
      } else {
        this.viewState = "navigation";
        UI.switchView("navigation");
        AudioController.startEngine();
      }
      UI.updateCrew(this.ship);
      UI.updateShip(this.ship);
    });

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

    // Dashboard navigation control buttons clicks
    document.getElementById("ctrl-scan").addEventListener("click", () => this.triggerScan());
    document.getElementById("ctrl-land").addEventListener("click", () => this.triggerLanding());
    document.getElementById("ctrl-shields").addEventListener("click", () => this.toggleShields());
    document.getElementById("ctrl-weapons").addEventListener("click", () => this.toggleWeapons());
    document.getElementById("ctrl-starmap").addEventListener("click", () => Navigation.openStarMapModal());

    // Keyboard Shortcuts
    window.addEventListener("keydown", (e) => {
      // Ignore key shortcuts if any modal is visible (except Escape key)
      const cargoModal = document.getElementById("cargo-modal");
      const transferModal = document.getElementById("transfer-modal");
      const tvModal = document.getElementById("tv-cargo-modal");
      const starmapModal = document.getElementById("starmap-modal");

      const isModalOpen = (cargoModal && !cargoModal.classList.contains("hidden")) ||
                          (transferModal && !transferModal.classList.contains("hidden")) ||
                          (tvModal && !tvModal.classList.contains("hidden")) ||
                          (starmapModal && !starmapModal.classList.contains("hidden"));

      if (e.key === "Escape") {
        if (cargoModal) cargoModal.classList.add("hidden");
        if (tvModal) tvModal.classList.add("hidden");
        if (starmapModal) starmapModal.classList.add("hidden");
        return;
      }

      if (this.viewState === "barter" || isModalOpen) {
        return;
      }

      if (this.viewState === "navigation") {
        if (e.key === "s" || e.key === "S") this.triggerScan();
        else if (e.key === "l" || e.key === "L") this.triggerLanding();
        else if (e.key === "k" || e.key === "K") this.toggleShields();
        else if (e.key === "f" || e.key === "F") this.toggleWeapons();
        else if (e.key === "m" || e.key === "M") Navigation.openStarMapModal();
        else if (e.key === "i" || e.key === "I") UI.openCargoModal();
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
      } else if (Navigation.nearbyDerelict) {
        Navigation.boardNearbyDerelict();
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
      // In Solar System: landing on current planet
      if (this.ship.currentPlanet) {
        PlanetExploration.startLanding();
      } else {
        AudioController.playBeep('error');
        UI.addLog("LANDING UNAVAILABLE: APPROACH A PLANET ORBIT FIRST.");
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
      UI.addLog("Shields failed: Charge is at 0%. Let shields charge at base.");
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

  // Main Loop ticking - hardened against frame crashes
  tick(timestamp) {
    // Schedule next frame tick FIRST so exceptions never kill the animation loop
    requestAnimationFrame((t) => this.tick(t));

    if (!this.lastTime) this.lastTime = timestamp;
    const rawDt = (timestamp - this.lastTime) / 1000;
    const dt = Math.min(0.05, Math.max(0.001, (isNaN(rawDt) ? 0.016 : rawDt)));
    this.lastTime = timestamp;

    try {
      if (this.viewState === "navigation") {
        Navigation.update(dt);
        Navigation.draw();
        this.checkAlienSpawnProbability(dt);
        this.updateCrewHealing(dt);
      } 
      else if (this.viewState === "landing") {
        PlanetExploration.draw();
        this.updateCrewHealing(dt);
      } 
      else if (this.viewState === "encounter") {
        Encounter.update(dt);
        this.updateCrewHealing(dt);
      }
    } catch (err) {
      console.error("Game loop tick error caught safely:", err);
    }
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

        // Sync navigation ship positions
        Navigation.shipX = this.ship.coordinates.x || 250.0;
        Navigation.shipY = this.ship.coordinates.y || 250.0;
        Navigation.shipVx = 0;
        Navigation.shipVy = 0;
      }
    } catch (e) {
      console.warn("Failed to load progress", e);
    }
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
        isInSpacebase: true,
        currentSystem: null,
        currentPlanet: null
      };

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
window.onload = () => {
  GameManager.init();
};
