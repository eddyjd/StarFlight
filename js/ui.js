/**
 * UI Renderer and view manager for StarFlight: Odyssey
 * Updates terminal logs, sidebars (crew and ship stats), modals, and controls.
 */

const UI = {
  // Elements references
  elements: {},
  logsMax: 30,

  init() {
    this.elements = {
      soundToggle: document.getElementById("soundToggle"),
      fullscreenToggle: document.getElementById("fullscreenToggle"),
      viewIntro: document.getElementById("view-intro"),
      viewSpaceport: document.getElementById("view-spaceport"),
      viewNavigation: document.getElementById("view-navigation"),
      viewEncounter: document.getElementById("view-encounter"),
      viewBarter: document.getElementById("view-barter"),
      logTerminal: document.getElementById("log-terminal"),
      
      // Crew nodes
      crew: {
        captain: document.getElementById("crew-captain"),
        science: document.getElementById("crew-science"),
        navigator: document.getElementById("crew-navigator"),
        engineer: document.getElementById("crew-engineer"),
        comm: document.getElementById("crew-comm"),
        doctor: document.getElementById("crew-doctor")
      },

      // Ship status nodes
      shipCredits: document.getElementById("ship-credits"),
      shipFuel: document.getElementById("ship-fuel"),
      shipShields: document.getElementById("ship-shields"),
      shipHull: document.getElementById("ship-hull"),
      shipMissiles: document.getElementById("ship-missiles"),
      shipCargoMass: document.getElementById("ship-cargo-mass"),
      equippedList: document.getElementById("equipped-list"),

      // Control Action Buttons
      btnScan: document.getElementById("ctrl-scan"),
      btnLand: document.getElementById("ctrl-land"),
      btnComms: document.getElementById("ctrl-comms"),
      btnShields: document.getElementById("ctrl-shields"),
      btnWeapons: document.getElementById("ctrl-weapons"),
      btnCargo: document.getElementById("ctrl-cargo"),
      btnStarmap: document.getElementById("ctrl-starmap"),
      btnLongScan: document.getElementById("ctrl-longscan"),

      // Cargo Modal
      cargoModal: document.getElementById("cargo-modal"),
      cargoManifestDetails: document.getElementById("cargo-manifest-details"),
      closeCargoBtn: document.querySelector(".close-modal-btn")
    };

    this.setupListeners();
  },

  setupListeners() {
    // Sound toggle listener
    this.elements.soundToggle.addEventListener("click", () => {
      const enabled = AudioController.toggleSound();
      this.elements.soundToggle.textContent = `SOUND: ${enabled ? "ON" : "OFF"}`;
      this.elements.soundToggle.classList.toggle("green-glow", enabled);
      AudioController.playBeep('click');
    });

    // Fullscreen toggle listener
    if (this.elements.fullscreenToggle) {
      this.elements.fullscreenToggle.addEventListener("click", () => {
        this.toggleFullscreen();
      });
    }

    // Window resize & fullscreenchange dynamic scaling listeners
    window.addEventListener("resize", () => {
      this.updateScreenScale();
    });

    document.addEventListener("fullscreenchange", () => {
      const isFS = !!document.fullscreenElement;
      if (this.elements.fullscreenToggle) {
        this.elements.fullscreenToggle.textContent = `FULLSCREEN: ${isFS ? "ON" : "OFF"}`;
        this.elements.fullscreenToggle.classList.toggle("green-glow", isFS);
      }
      this.updateScreenScale();
    });

    // Auto blur all buttons on click so focus doesn't trap keyboard holding
    document.addEventListener("click", (e) => {
      if (e.target && e.target.tagName === "BUTTON") {
        e.target.blur();
      }
    });

    // Initial scale calculation
    this.updateScreenScale();

    // Close cargo modal
    this.elements.closeCargoBtn.addEventListener("click", () => {
      this.closeCargoModal();
    });

    // Must mirror the [I] key exactly (see GameManager.setupGlobalListeners): on a
    // planet surface [I] opens the Rover cargo bed, everywhere else it opens the
    // ship hold. The button used to always open the ship hold, so on the surface it
    // showed an empty manifest and read as broken.
    this.elements.btnCargo.addEventListener("click", () => {
      const game = window.game;
      const onSurface = game && game.viewState === "landing" &&
                        typeof PlanetExploration !== 'undefined' && PlanetExploration.active;
      if (onSurface) {
        PlanetExploration.openRoverCargoModal();
      } else {
        this.openCargoModal();
      }
    });

    // Starmap button listener
    if (this.elements.btnStarmap) {
      this.elements.btnStarmap.addEventListener("click", () => {
        if (typeof Navigation !== 'undefined' && Navigation.openStarMapModal) {
          Navigation.openStarMapModal();
        }
      });
    }

    // Control buttons click handlers
    if (this.elements.btnShields) {
      this.elements.btnShields.addEventListener("click", () => {
        if (window.game && window.game.toggleShields) {
          window.game.toggleShields();
        }
      });
    }

    if (this.elements.btnWeapons) {
      this.elements.btnWeapons.addEventListener("click", () => {
        if (window.game && window.game.toggleWeapons) {
          window.game.toggleWeapons();
        }
      });
    }

    if (this.elements.btnScan) {
      this.elements.btnScan.addEventListener("click", () => {
        const game = window.game;
        if (game.viewState === "landing" && typeof PlanetExploration !== 'undefined') {
          if (PlanetExploration.grid && PlanetExploration.grid[PlanetExploration.roverY] && PlanetExploration.grid[PlanetExploration.roverY][PlanetExploration.roverX].type === "lander") {
            PlanetExploration.returnToShip();
          } else {
            PlanetExploration.analyzeCurrentDeposit();
          }
        } else if (game.spaceState === "system") {
          if (game.ship.currentPlanet && typeof PlanetExploration !== 'undefined') {
            PlanetExploration.scanPlanet();
          } else if (typeof Navigation !== 'undefined') {
            Navigation.triggerSonar();
          }
        } else if (game.spaceState === "hyper") {
          if (typeof Navigation !== 'undefined') {
            if (Navigation.nearStarbase || Navigation.nearSystem) {
              Navigation.enterSystem(Navigation.nearSystem || { name: "Starbase Prime", x: 250, y: 250 });
            } else {
              Navigation.triggerSonar();
            }
          }
        }
      });
    }

    if (this.elements.btnLongScan) {
      this.elements.btnLongScan.addEventListener("click", () => {
        if (typeof Navigation !== 'undefined' && Navigation.triggerLongRangeScan) {
          Navigation.triggerLongRangeScan();
        }
      });
    }

    if (this.elements.btnLand) {
      this.elements.btnLand.addEventListener("click", () => {
        const game = window.game;
        if (game && game.triggerLanding) {
          game.triggerLanding();
        }
      });
    }

    // Handle generic button focus sounds
    document.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("mouseenter", () => AudioController.playBeep('hover'));
    });
  },

  // Scroll text into terminal log
  addLog(text) {
    const logNode = document.createElement("div");
    logNode.innerHTML = `&gt; ${text.toUpperCase()}`;
    this.elements.logTerminal.appendChild(logNode);

    // Keep log buffer within limits
    while (this.elements.logTerminal.childElementCount > this.logsMax) {
      this.elements.logTerminal.removeChild(this.elements.logTerminal.firstChild);
    }

    // Scroll to bottom
    this.elements.logTerminal.scrollTop = this.elements.logTerminal.scrollHeight;
  },

  // View manager
  switchView(viewName) {
    // Hide all main display views
    const views = [
      this.elements.viewIntro,
      this.elements.viewSpaceport,
      this.elements.viewNavigation,
      this.elements.viewEncounter,
      this.elements.viewBarter
    ];
    views.forEach(v => v.classList.remove("active"));

    // Deactivate sound components if leaving spatial navigation
    if (viewName !== 'navigation') {
      AudioController.stopEngine();
    }

    // Show selected view
    switch(viewName) {
      case 'intro':
        this.elements.viewIntro.classList.add("active");
        break;
      case 'spaceport':
        this.elements.viewSpaceport.classList.add("active");
        break;
      case 'navigation':
        this.elements.viewNavigation.classList.add("active");
        break;
      case 'encounter':
        this.elements.viewEncounter.classList.add("active");
        break;
      case 'barter':
        this.elements.viewBarter.classList.add("active");
        break;
    }
  },

  // Update Left Sidebar: Crew Status
  updateCrew(shipOrCrewState) {
    const crewState = (shipOrCrewState && shipOrCrewState.crew) ? shipOrCrewState.crew : (shipOrCrewState || {});
    const roles = ['captain', 'science', 'navigator', 'engineer', 'comm', 'doctor'];
    roles.forEach(role => {
      const member = crewState[role];
      const el = this.elements.crew[role];
      if (!el) return;

      if (!member) {
        el.querySelector(".crew-name").textContent = `${role.substring(0,3).toUpperCase()}: -- UNASSIGNED --`;
        el.querySelector(".crew-stats").innerHTML = `HP: -- <span class="bar"><span class="val" style="width:0%"></span></span> SKILL: 0%`;
        el.classList.remove("hired", "injured");
      } else {
        // Sanitize maxHp and hp (default maxHp to member.hp or 100)
        const maxHp = Math.round(member.maxHp || member.hp || 100);
        member.maxHp = maxHp;

        // Sanitize only - never write a rounded value back. GameManager.
        // updateCrewHealing() accrues fractions of a HP per frame (0.008 - 0.048)
        // and then calls this method, so rounding member.hp here destroyed that
        // progress every single frame and silently disabled passive crew healing
        // and the Doctor's in-flight recovery entirely.
        if (member.hp === undefined || isNaN(member.hp)) member.hp = maxHp;
        const currentHp = Math.round(member.hp);

        const hpPercent = Math.min(100, Math.max(0, Math.round((currentHp / maxHp) * 100)));

        el.classList.add("hired");
        // Guard the optional fields: a crew member missing `race` used to throw here,
        // which aborts whatever called updateCrew (docking, for instance) midway.
        const memberName = member.name || "UNKNOWN";
        const memberRace = (member.race || "---").substring(0, 3);
        el.querySelector(".crew-name").textContent = `${role.substring(0,3).toUpperCase()}: ${memberName} (${memberRace})`;
        
        if (hpPercent <= 35) {
          el.classList.add("injured");
        } else {
          el.classList.remove("injured");
        }

        el.querySelector(".crew-stats").innerHTML = `
          HP: <span class="${hpPercent <= 35 ? 'red' : 'green'}">${currentHp}/${maxHp}</span> 
          <span class="bar"><span class="val" style="width:${hpPercent}%"></span></span> 
          SKILL: <span class="cyan">${member.skill}%</span>
        `;
      }
    });
  },

  // Update Right Sidebar: Ship Status & Modules
  updateShip(shipState) {
    this.elements.shipCredits.textContent = `${Number(shipState.credits).toLocaleString()} M.U.`;
    this.elements.shipFuel.textContent = `${Math.floor(shipState.fuel)} / ${shipState.maxFuel}`;
    
    // Shield status display
    if (shipState.shieldLevel === 0) {
      this.elements.shipShields.textContent = "N/A";
      this.elements.shipShields.className = "value red";
    } else {
      if (shipState.shieldsActive) {
        this.elements.shipShields.textContent = `${Math.floor(shipState.shieldsCharge)} / ${shipState.maxShields}`;
        this.elements.shipShields.className = "value green";
      } else {
        this.elements.shipShields.textContent = "OFFLINE";
        this.elements.shipShields.className = "value yellow";
      }
    }

    // Hull status
    const hullPct = Math.round((shipState.hull / shipState.maxHull) * 100);
    this.elements.shipHull.textContent = `${hullPct}%`;
    if (hullPct < 30) {
      this.elements.shipHull.className = "value red";
    } else if (hullPct < 75) {
      this.elements.shipHull.className = "value yellow";
    } else {
      this.elements.shipHull.className = "value green";
    }

    // Missile counts
    if (shipState.missileLevel === 0) {
      this.elements.shipMissiles.textContent = "N/A";
      this.elements.shipMissiles.className = "value red";
    } else {
      this.elements.shipMissiles.textContent = `${shipState.missilesAmmo} / ${shipState.maxMissiles}`;
      this.elements.shipMissiles.className = "value yellow";
    }

    // Cargo counts
    const mass = this.calculateCargoMass(shipState.cargo);
    const capacity = shipState.cargoCap;
    this.elements.shipCargoMass.textContent = `${mass.toFixed(1)} / ${capacity} T`;
    if (mass >= capacity) {
      this.elements.shipCargoMass.className = "value red";
    } else {
      this.elements.shipCargoMass.className = "value cyan";
    }

    // Equipped Modules details
    let equippedHtml = "";
    equippedHtml += `<li>Engines: Class ${shipState.engineLevel}</li>`;
    equippedHtml += `<li>Shields: ${shipState.shieldLevel > 0 ? "Class " + shipState.shieldLevel : "None"}</li>`;
    equippedHtml += `<li>Armor: Class ${shipState.armorLevel}</li>`;
    equippedHtml += `<li>Blaster: ${shipState.blasterLevel > 0 ? "Class " + shipState.blasterLevel : "None"}</li>`;
    if (shipState.missileLevel > 0) {
      equippedHtml += `<li>Missiles: Class ${shipState.missileLevel}</li>`;
    }
    equippedHtml += `<li>Cargo: ${GameData.upgrades.cargos[shipState.cargoLevel - 1].name}</li>`;
    equippedHtml += `<li>Scanner: ${GameData.upgrades.scanners[shipState.scannerLevel - 1].name}</li>`;
    
    // TV updates
    equippedHtml += `<li>Rover Engine: Lvl ${shipState.tvUpgrades.engine}</li>`;
    equippedHtml += `<li>Rover Armor: Lvl ${shipState.tvUpgrades.armor}</li>`;
    equippedHtml += `<li>Rover Blaster: Lvl ${shipState.tvUpgrades.blaster}</li>`;
    equippedHtml += `<li>Rover Cargo: Lvl ${shipState.tvUpgrades.cargo}</li>`;

    // Salvaged Precursor modules recovered from wrecks, vaults and derelicts
    const fitted = Array.isArray(shipState.installedTechParts) ? shipState.installedTechParts : [];
    if (fitted.length > 0) {
      equippedHtml += `<li style="color:#ffcc00; font-weight:bold; margin-top:6px;">SALVAGED PRECURSOR TECH</li>`;
      const counts = {};
      fitted.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
      Object.keys(counts).forEach(id => {
        const part = (GameData.techParts && GameData.techParts[id]) || null;
        const icon = part ? part.icon : "⚙";
        const name = part ? part.name : id;
        const qty = counts[id] > 1 ? ` x${counts[id]}` : "";
        equippedHtml += `<li style="color:#00e5ff;">${icon} ${name}${qty}</li>`;
      });
    }

    this.elements.equippedList.innerHTML = equippedHtml;
  },

  calculateCargoMass(cargo) {
    let mass = 0;
    for (let key in cargo) {
      const item = GameData.commodities[key];
      if (item) {
        mass += (cargo[key] || 0) * (item.mass || 1.0);
      }
    }
    return Math.max(0, mass);
  },

  // Jettison cargo directly into deep space
  jettisonCargoItem(key, quantity = 1) {
    const ship = window.game.ship;
    if (!ship.cargo[key]) return;

    const item = GameData.commodities[key] || { name: key, mass: 1 };
    
    if (quantity === 'all' || ship.cargo[key] <= quantity) {
      const removed = ship.cargo[key];
      delete ship.cargo[key];
      UI.addLog(`JETTISONED ALL ${removed} UNITS OF ${item.name.toUpperCase()} INTO DEEP SPACE.`);
    } else {
      ship.cargo[key] -= quantity;
      UI.addLog(`JETTISONED 1 UNIT OF ${item.name.toUpperCase()} INTO DEEP SPACE.`);
    }

    if (typeof AudioController !== 'undefined' && AudioController.playBeep) {
      AudioController.playBeep('error');
    }
    UI.updateShip(ship);
    window.game.saveGame();
    this.openCargoModal(); // Refresh modal content
  },

  // Cargo manifest inventory modal popup
  openCargoModal() {
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) {
      AudioController.playBeep('click');
    }
    const shipState = window.game.ship;
    let html = "";
    let empty = true;
    let totalVal = 0;
    let totalMass = 0;

    for (let key in shipState.cargo) {
      const count = shipState.cargo[key];
      if (count > 0) {
        const item = GameData.commodities[key] || { name: key, mass: 1, sellVal: 10 };
        totalVal += (item.sellVal * count);
        totalMass += (item.mass * count);
      }
    }

    html += `
      <div style="display: flex; justify-content: space-between; align-items: center; background-color: rgba(0, 255, 102, 0.08); padding: 8px 12px; border: 1px solid rgba(0, 255, 102, 0.3); border-radius: 4px; margin-bottom: 10px;">
        <span style="color: #00ff66; font-weight: bold;">HOLD CAPACITY: ${totalMass.toFixed(1)} / ${shipState.cargoCap} TONS</span>
        <span style="color: #ffcc00; font-weight: bold; font-size: 12px;">EST. TOTAL HOLD VALUE: $${totalVal.toLocaleString()} M.U.</span>
      </div>
    `;

    for (let key in shipState.cargo) {
      const count = shipState.cargo[key];
      if (count > 0) {
        empty = false;
        const item = GameData.commodities[key] || { name: key, mass: 1, sellVal: 10 };
        const stackVal = item.sellVal * count;
        const stackMass = item.mass * count;

        html += `
          <div class="cargo-row" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px dashed rgba(0,255,102,0.25); margin-bottom: 4px; background-color: rgba(0, 255, 102, 0.03);">
            <div style="flex-grow: 1;">
              <strong style="color: #00ff66; font-size: 13px;">${item.name.toUpperCase()}</strong> <span style="color: #88ccaa;">(${count} units)</span><br>
              <span style="font-size: 11px; color: #ffcc00; font-weight: bold;">VALUE: $${item.sellVal} / unit &nbsp;➔&nbsp; TOTAL: $${stackVal.toLocaleString()} M.U.</span><br>
              <span style="font-size: 10px; color: #88ccaa;">Mass: ${stackMass.toFixed(1)} T (${item.mass} T/unit)</span>
            </div>
            <div class="cargo-row-actions" style="display: flex; gap: 6px;">
              <button class="glow-btn red-glow btn-sm" onclick="UI.jettisonCargoItem('${key}', 1)">JETTISON 1</button>
              <button class="glow-btn red-glow btn-sm" onclick="UI.jettisonCargoItem('${key}', 'all')">JETTISON ALL</button>
            </div>
          </div>
        `;
      }
    }

    // Precursor artifacts checking
    shipState.artifactsCollected.forEach(art => {
      empty = false;
      html += `
        <div class="cargo-row" style="padding: 8px; border-bottom: 1px dashed rgba(0,204,255,0.3); background-color: rgba(0, 204, 255, 0.04);">
          <span class="cyan" style="font-weight: bold;">★ ${art.toUpperCase()} (PRECURSOR ARTIFACT)</span><br>
          <span class="cyan" style="font-size: 10px;">Mass: 0 T | Value: PRICELESS (DECRYPTED IN HQ DATABASE)</span>
        </div>
      `;
    });

    if (empty) {
      html = `<div style="text-align:center; padding-top:40px; color:rgba(0, 255, 102, 0.4)">NO CARGO COMMODITIES DETECTED ON BOARD.</div>`;
    }

    this.elements.cargoManifestDetails.innerHTML = html;
    this.elements.cargoModal.classList.remove("hidden");
  },

  closeCargoModal() {
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) {
      AudioController.playBeep('click');
    }
    this.elements.cargoModal.classList.add("hidden");
  },

  // Update navigation button active/disabled states based on game environment
  updateControlPanel(isInSpace, currentPlanet, shieldsActive, weaponsArmed) {
    const game = window.game;

    // The cargo control follows the view: Rover bed on a surface, ship hold in space
    if (this.elements.btnCargo) {
      const onSurface = game.viewState === "landing" &&
                        typeof PlanetExploration !== 'undefined' && PlanetExploration.active;
      this.elements.btnCargo.textContent = onSurface ? "TV CARGO BED [I]" : "CARGO LOG [I]";
    }

    // Check if on planet surface
    if (game.viewState === "landing" && typeof PlanetExploration !== 'undefined') {
      const atLander = (PlanetExploration.grid && PlanetExploration.grid[PlanetExploration.roverY] && PlanetExploration.grid[PlanetExploration.roverY][PlanetExploration.roverX].type === "lander");
      if (atLander) {
        this.elements.btnLand.disabled = false;
        this.elements.btnLand.textContent = "UNLOAD AT LANDER [U]";
        this.elements.btnScan.disabled = false;
        this.elements.btnScan.textContent = "RETURN TO SHIP [L]";
      } else {
        this.elements.btnLand.disabled = false;
        this.elements.btnLand.textContent = "MINE / HARVEST [ENTER]";
        this.elements.btnScan.disabled = false;
        this.elements.btnScan.textContent = "ANALYZE DEPOSIT [V]";
      }
    }
    // Solar System mode
    else if (game.spaceState === "system") {
      if (currentPlanet) {
        this.elements.btnLand.disabled = false;
        this.elements.btnLand.textContent = "LAND VEHICLE [L]";
        this.elements.btnScan.disabled = false;
        this.elements.btnScan.textContent = `SCAN ${currentPlanet.name.toUpperCase()} [S]`;
      } else {
        this.elements.btnLand.disabled = true;
        this.elements.btnLand.textContent = "LAND VEHICLE [L]";
        this.elements.btnScan.disabled = false;
        this.elements.btnScan.textContent = "SYSTEM SENSORS [S]";
      }
    }

    // Comms button
    this.elements.btnComms.disabled = true;
    
    // Check if docked in Spaceport
    const isDocked = (game.viewState === "spaceport");

    // Shields toggling
    const hasShields = game.ship.shieldLevel > 0;
    this.elements.btnShields.disabled = !hasShields || isDocked;
    if (isDocked) {
      this.elements.btnShields.textContent = "SHIELDS LOCKED [K]";
      this.elements.btnShields.classList.remove("green-glow");
    } else if (hasShields) {
      this.elements.btnShields.textContent = shieldsActive ? "SHIELDS DOWN [K]" : "SHIELDS UP [K]";
      this.elements.btnShields.classList.toggle("green-glow", shieldsActive);
    } else {
      this.elements.btnShields.textContent = "NO SHIELDS [K]";
    }

    // Weapons ready
    const hasWeapons = game.ship.blasterLevel > 0 || game.ship.missileLevel > 0;
    this.elements.btnWeapons.disabled = !hasWeapons || isDocked;
    // NOTE: no [F] hint - [F] fires the blasters. Arming is button / launch-config only.
    if (isDocked) {
      this.elements.btnWeapons.textContent = "WEAPONS LOCKED";
      this.elements.btnWeapons.classList.remove("red-glow");
    } else if (hasWeapons) {
      this.elements.btnWeapons.textContent = weaponsArmed ? "WEAPONS SAFE" : "ARM WEAPONS";
      this.elements.btnWeapons.classList.toggle("red-glow", weaponsArmed);
    } else {
      this.elements.btnWeapons.textContent = "NO WEAPONS";
    }

    // Long range sweep: hyperspace only, and shows its own recharge timer
    if (this.elements.btnLongScan && typeof Navigation !== 'undefined') {
      const inHyper = (game.viewState === "navigation" && game.spaceState === "hyper");
      const cd = Navigation.longScanCooldown || 0;
      this.elements.btnLongScan.disabled = !inHyper || cd > 0;
      if (cd > 0) {
        this.elements.btnLongScan.textContent = `SENSORS RECHARGING ${cd.toFixed(1)}s`;
      } else if (Navigation.getScanRanges) {
        this.elements.btnLongScan.textContent = `LONG RANGE SWEEP ${Navigation.getScanRanges().long.toFixed(0)} LY [SHIFT+S]`;
      }
    }

    // Starmap toggles
    this.elements.btnStarmap.disabled = false;
  },

  toggleFullscreen() {
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) {
      AudioController.playBeep('click');
    }
    if (!document.fullscreenElement) {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  },

  updateScreenScale() {
    const crt = document.querySelector('.crt-screen');
    if (!crt) return;
    crt.style.transform = 'none';

    // Match canvas width/height to parent container dimensions dynamically
    const canvas = document.getElementById("gameCanvas");
    if (canvas && canvas.parentElement) {
      const w = canvas.parentElement.clientWidth;
      const h = canvas.parentElement.clientHeight - 24;
      if (w > 100 && h > 100 && (canvas.width !== w || canvas.height !== h)) {
        canvas.width = w;
        canvas.height = h;
      }
    }
  },

  fontSizeMode: 'normal',

  getFontScale() {
    if (this.fontSizeMode === 'large') return 1.18;
    if (this.fontSizeMode === 'xlarge') return 1.38;
    return 1.0;
  },

  openLegendModal() {
    const modal = document.getElementById("legend-modal");
    if (modal) {
      modal.classList.remove("hidden");
      if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
    }
  },

  closeLegendModal() {
    const modal = document.getElementById("legend-modal");
    if (modal) {
      modal.classList.add("hidden");
      if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
    }
  },

  openDerelictModal(derelict) {
    this.currentDerelict = derelict;
    const modal = document.getElementById("derelict-modal");
    if (!modal || !derelict) return;

    document.getElementById("derelict-title").textContent = `🛰️ ${derelict.name.toUpperCase()}`;
    document.getElementById("derelict-coords").textContent = `COORDINATES: (${derelict.x}, ${derelict.y})`;
    document.getElementById("derelict-desc").textContent = derelict.desc;

    const lootDetails = document.getElementById("derelict-loot-details");
    const btnScavenge = document.getElementById("btnScavengeDerelict");

    // Reset the action: scavengeCurrentDerelict() repoints this button at the
    // recovered module, so without this the next station inherits the last one's
    // handler and re-opens a module you already took.
    btnScavenge.onclick = () => this.scavengeCurrentDerelict();

    if (derelict.searched) {
      lootDetails.innerHTML = `<span style="color: #ff5555;">[SALVAGED] Hull has already been completely stripped of useful energy and components.</span>`;
      btnScavenge.disabled = true;
      btnScavenge.textContent = "ALREADY SALVAGED";
    } else {
      const part = (derelict.loot && derelict.loot.techPartKey && GameData.techParts)
        ? GameData.techParts[derelict.loot.techPartKey] : null;
      lootDetails.innerHTML = `Sensors detect residual Endurium fuel cells, credits` +
        (part ? `, and an <span style="color:#ffcc00;">intact Precursor module</span>` : ` and Precursor tech fragments`) +
        ` inside the hold.`;
      btnScavenge.disabled = false;
      btnScavenge.textContent = "SCAVENGE DERELICT HULL";
    }

    modal.classList.remove("hidden");
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
  },

  closeDerelictModal() {
    const modal = document.getElementById("derelict-modal");
    if (modal) modal.classList.add("hidden");
  },

  scavengeCurrentDerelict() {
    if (!this.currentDerelict || this.currentDerelict.searched) return;
    const der = this.currentDerelict;
    const ship = window.game.ship;

    der.searched = true;
    if (window.game && window.game.markSalvaged) window.game.markSalvaged(der.id);
    const loot = der.loot;

    // Award Endurium fuel & credits
    if (loot.type === "endurium") {
      ship.fuel = Math.min(ship.maxFuel, ship.fuel + loot.amount);
    }
    ship.credits += loot.credits;

    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('powerup');
    this.addLog(`DERELICT SCAVENGED! SALVAGED ${loot.amount} ENDURIUM & ${loot.credits} M.U. CREDITS!`);

    // Derelict tech was flavour text: loot.tech printed a name and did nothing.
    // Every station now yields the real Precursor module its manifest describes,
    // so salvage - not the Depot - is where hold capacity and scanner range grow.
    const part = (loot.techPartKey && GameData.techParts) ? GameData.techParts[loot.techPartKey] : null;

    const lootDetails = document.getElementById("derelict-loot-details");
    lootDetails.innerHTML = `<span style="color: #00ff66;">✓ SALVAGE COMPLETE!</span><br>` +
      `+${loot.credits} Credits added to ship vault.<br>` +
      `+${loot.amount} Endurium fuel units refilled into tanks.<br>` +
      (part
        ? `<span style="color:#ffcc00; font-weight:bold;">${part.icon} INTACT MODULE RECOVERED: ${part.name.toUpperCase()}</span>`
        : `<em>Tech Artifact Logged: ${loot.tech}</em>`);

    const btnScavenge = document.getElementById("btnScavengeDerelict");
    if (part) {
      this.addLog(`SALVAGE: RECOVERED AN INTACT ${part.name.toUpperCase()} FROM THE HULL.`);
      btnScavenge.disabled = false;
      btnScavenge.textContent = `${part.icon} INSPECT RECOVERED MODULE`;
      btnScavenge.onclick = () => {
        this.closeDerelictModal();
        this.openTechPartModal(part);
      };
    } else {
      btnScavenge.disabled = true;
      btnScavenge.textContent = "ALREADY SALVAGED";
    }
  },

  openDistressModal(signal) {
    this.currentDistress = signal;
    const modal = document.getElementById("distress-modal");
    if (!modal || !signal) return;

    document.getElementById("distress-title").textContent = `📡 ${signal.name.toUpperCase()}`;
    document.getElementById("distress-coords").textContent = `COORDINATES: (${signal.x}, ${signal.y})`;
    document.getElementById("distress-desc").textContent = signal.desc;

    const optBox = document.getElementById("distress-options");
    let html = "";

    if (signal.event === "trade_rescue") {
      html += `
        <button class="glow-btn yellow-glow" onclick="UI.handleDistressOption('rescue_trade')">TRANSFER 10 ENDURIUM (REWARD: 1,000 M.U.)</button>
        <button class="glow-btn" onclick="UI.handleDistressOption('ignore')">DECLINE ASSISTANCE</button>
      `;
    } else if (signal.event === "probe_salvage") {
      html += `
        <button class="glow-btn green-glow" onclick="UI.handleDistressOption('salvage_probe')">DOWNLOAD TELEMETRY LOGS (REWARD: +500 M.U. & MAP DISCOVERIES)</button>
        <button class="glow-btn" onclick="UI.handleDistressOption('ignore')">IGNORE PROBE SIGNAL</button>
      `;
    } else if (signal.event === "rescue_pod") {
      html += `
        <button class="glow-btn blue-glow" onclick="UI.handleDistressOption('rescue_pod')">RETRIEVE CRYO-POD NAVIGATOR (REWARD: RECOVERED CREW DATA & 800 M.U.)</button>
        <button class="glow-btn" onclick="UI.handleDistressOption('ignore')">LEAVE BEACON ACTIVE</button>
      `;
    }

    optBox.innerHTML = html;
    modal.classList.remove("hidden");
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
  },

  closeDistressModal() {
    const modal = document.getElementById("distress-modal");
    if (modal) modal.classList.add("hidden");
  },

  handleDistressOption(choiceKey) {
    const sig = this.currentDistress;
    const ship = window.game.ship;

    if (choiceKey === "rescue_trade") {
      if (ship.fuel >= 10) {
        ship.fuel -= 10;
        ship.credits += 1000;
        if (sig) { sig.active = false; if (window.game && window.game.markSalvaged) window.game.markSalvaged(sig.id); }
        this.addLog("BEACON RESOLVED: Transferred 10 Endurium units to civilian trader. Received 1,000 M.U. reward!");
        if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('powerup');
      } else {
        this.addLog("INSUFFICIENT FUEL: You need at least 10 units of fuel to assist!");
        if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('error');
      }
    } else if (choiceKey === "salvage_probe") {
      ship.credits += 500;
      if (sig) { sig.active = false; if (window.game && window.game.markSalvaged) window.game.markSalvaged(sig.id); }
      this.addLog("PROBE SALVAGED: Downloaded ancient telemetry logs. Received 500 M.U. data bounty!");
      if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('powerup');
    } else if (choiceKey === "rescue_pod") {
      ship.credits += 800;
      if (sig) { sig.active = false; if (window.game && window.game.markSalvaged) window.game.markSalvaged(sig.id); }
      this.addLog("CRYO-POD RECOVERED: Rescued stranded specialist navigator. Received 800 M.U. Starbase bounty!");
      if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('powerup');
    }

    this.closeDistressModal();
  },

  openTechPartModal(techPart) {
    this.currentTechPart = techPart;
    const modal = document.getElementById("techpart-modal");
    if (!modal || !techPart) return;

    // Use the module's own icon - this was hardcoded to the warp conduit's bolt,
    // so a cargo compressor or sensor array announced itself with the wrong glyph.
    document.getElementById("techpart-title").textContent = `${techPart.icon || "⚡"} ${techPart.name.toUpperCase()}`;
    document.getElementById("techpart-value").textContent = `SALVAGE VALUE: ${techPart.value || 2500} M.U.`;
    document.getElementById("techpart-desc").textContent = techPart.desc;

    modal.classList.remove("hidden");
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
  },

  closeTechPartModal() {
    const modal = document.getElementById("techpart-modal");
    if (modal) modal.classList.add("hidden");
  },

  installCurrentTechPart() {
    if (!this.currentTechPart) return;
    const part = this.currentTechPart;
    const ship = window.game.ship;

    if (part.effect === "engine_boost") {
      ship.engineLevel = Math.min(5, (ship.engineLevel || 1) + 1);
      this.addLog(`SHIP UPGRADED: ${part.name.toUpperCase()} INSTALLED! Engine Level increased to Class ${ship.engineLevel}!`);
    } else if (part.effect === "shield_boost") {
      ship.maxShields = (ship.maxShields || 100) + 30;
      ship.shieldsCharge = ship.maxShields;
      this.addLog(`SHIP UPGRADED: ${part.name.toUpperCase()} INSTALLED! Max Shield capacity increased to ${ship.maxShields}!`);
    } else if (part.effect === "hull_boost") {
      ship.maxHull = (ship.maxHull || 100) + 25;
      ship.hull = ship.maxHull;
      this.addLog(`SHIP UPGRADED: ${part.name.toUpperCase()} INSTALLED! Max Hull integrity increased to ${ship.maxHull}!`);
    } else if (part.effect === "weapon_boost") {
      ship.blasterLevel = Math.min(5, (ship.blasterLevel || 1) + 1);
      ship.weaponsArmed = true;
      this.addLog(`SHIP UPGRADED: ${part.name.toUpperCase()} INSTALLED! Blaster Weapon Firepower increased to Class ${ship.blasterLevel}!`);
    } else if (part.effect === "cargo_boost") {
      ship.cargoCap = (ship.cargoCap || 20) + 15;
      this.addLog(`SHIP UPGRADED: ${part.name.toUpperCase()} INSTALLED! Cargo Hold capacity expanded to ${ship.cargoCap} T!`);
    } else if (part.effect === "scanner_boost") {
      const before = ship.scannerLevel || 1;
      ship.scannerLevel = Math.min(4, before + 1);
      if (ship.scannerLevel > before) {
        const r = (typeof Navigation !== 'undefined' && Navigation.getScanRanges) ? Navigation.getScanRanges() : null;
        this.addLog(`SHIP UPGRADED: ${part.name.toUpperCase()} INSTALLED! Scanner advanced to Class ${ship.scannerLevel}` +
          (r ? ` - sweeps now ${r.short.toFixed(0)} LY short / ${r.long.toFixed(0)} LY long!` : "!"));
      } else {
        this.addLog(`${part.name.toUpperCase()} INSTALLED, but the Scanner array is already at maximum class.`);
      }
    }

    // Log which module was fitted so Ship Diagnostics can list it
    if (!Array.isArray(ship.installedTechParts)) ship.installedTechParts = [];
    ship.installedTechParts.push(part.id || part.name);

    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('powerup');
    this.updateShip(ship);
    window.game.saveGame();
    this.closeTechPartModal();
  },

  storeCurrentTechPartInCargo() {
    if (!this.currentTechPart) return;
    const part = this.currentTechPart;
    const ship = window.game.ship;

    if (!ship.cargo) ship.cargo = {};
    const itemKey = part.id;
    ship.cargo[itemKey] = (ship.cargo[itemKey] || 0) + 1;

    // Register commodity info if not present
    if (!GameData.commodities[itemKey]) {
      GameData.commodities[itemKey] = {
        name: part.name,
        price: part.value || 2500,
        mass: 1.0,
        type: "exotic"
      };
    }

    this.addLog(`RECOVERED: Stored 1 unit of ${part.name.toUpperCase()} in ship cargo hold.`);
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('powerup');
    this.updateShip(ship);
    window.game.saveGame();
    this.closeTechPartModal();
  },

  cycleFontSize() {
    if (this.fontSizeMode === 'normal') {
      this.fontSizeMode = 'large';
      document.body.classList.remove('font-xlarge');
      document.body.classList.add('font-large');
    } else if (this.fontSizeMode === 'large') {
      this.fontSizeMode = 'xlarge';
      document.body.classList.remove('font-large');
      document.body.classList.add('font-xlarge');
    } else {
      this.fontSizeMode = 'normal';
      document.body.classList.remove('font-large', 'font-xlarge');
    }

    const btn = document.getElementById('fontToggle');
    if (btn) btn.textContent = `FONT: ${this.fontSizeMode.toUpperCase()}`;
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
    this.addLog(`ACCESSIBILITY: UI FONT SCALE SET TO ${this.fontSizeMode.toUpperCase()}.`);
  },

  toggleDisplayMode() {
    document.body.classList.toggle('crisp-mode');
    const isCrisp = document.body.classList.contains('crisp-mode');
    const btn = document.getElementById('displayToggle');
    if (btn) btn.textContent = isCrisp ? 'DISPLAY: CRISP' : 'DISPLAY: RETRO';
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
    this.addLog(`DISPLAY SETTING: ${isCrisp ? 'CRISP HIGH-CONTRAST MODE' : 'RETRO CRT SIMULATION MODE'}`);
  },

  openHelpModal() {
    const modal = document.getElementById('help-modal');
    if (modal) {
      modal.classList.remove('hidden');
      if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
    }
  },

  closeHelpModal() {
    const modal = document.getElementById('help-modal');
    if (modal) {
      modal.classList.add('hidden');
      if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
    }
  },

  switchHelpTab(tabName) {
    const helpModal = document.getElementById('help-modal');
    if (!helpModal) return;

    helpModal.querySelectorAll('.log-tab-btn').forEach(btn => btn.classList.remove('active'));
    helpModal.querySelectorAll('.log-content-panel').forEach(panel => panel.classList.remove('active'));

    const tabBtns = helpModal.querySelectorAll('.log-tab-btn');
    if (tabName === 'flight' && tabBtns[0]) tabBtns[0].classList.add('active');
    else if (tabName === 'surface' && tabBtns[1]) tabBtns[1].classList.add('active');
    else if (tabName === 'combat' && tabBtns[2]) tabBtns[2].classList.add('active');
    else if (tabName === 'commerce' && tabBtns[3]) tabBtns[3].classList.add('active');
    else if (tabName === 'mission' && tabBtns[4]) tabBtns[4].classList.add('active');

    const panel = document.getElementById(`help-panel-${tabName}`);
    if (panel) panel.classList.add('active');
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
  },

  openCaptainsLogModal() {
    const modal = document.getElementById('captains-log-modal');
    if (modal) {
      modal.classList.remove('hidden');
      this.renderCaptainsLog('systems');
      if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
    }
  },

  closeCaptainsLogModal() {
    const modal = document.getElementById('captains-log-modal');
    if (modal) {
      modal.classList.add('hidden');
      if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
    }
  },

  switchLogTab(tabName) {
    document.querySelectorAll('.log-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.log-content-panel').forEach(panel => panel.classList.remove('active'));

    const tabBtns = document.querySelectorAll('.log-tab-btn');
    if (tabName === 'systems' && tabBtns[0]) tabBtns[0].classList.add('active');
    else if (tabName === 'planets' && tabBtns[1]) tabBtns[1].classList.add('active');
    else if (tabName === 'artifacts' && tabBtns[2]) tabBtns[2].classList.add('active');
    else if (tabName === 'aliens' && tabBtns[3]) tabBtns[3].classList.add('active');

    const panel = document.getElementById(`log-panel-${tabName}`);
    if (panel) panel.classList.add('active');

    this.renderCaptainsLog(tabName);
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
  },

  renderCaptainsLog(tabName) {
    const ship = window.game ? window.game.ship : null;
    if (!ship) return;

    if (tabName === 'systems') {
      const panel = document.getElementById('log-panel-systems');
      if (!panel) return;
      const discovered = Object.keys(ship.discoveredSystems || {});
      if (discovered.length === 0) {
        panel.innerHTML = `<div class="log-card"><div class="log-card-body">No star systems logged in chart computer yet.</div></div>`;
        return;
      }
      let html = '';
      discovered.forEach(sysName => {
        const sys = GameData.starSystems.find(s => s.name === sysName);
        if (sys) {
          html += `
            <div class="log-card">
              <div class="log-card-header">
                <span>⭐ ${sys.name.toUpperCase()} SYSTEM</span>
                <span style="color:#ffcc00;">LOCATION: (${sys.x}, ${sys.y})</span>
              </div>
              <div class="log-card-body">
                Primary Star Class: ${sys.starClass || 'M-Type Yellow'}<br>
                Planetary Bodies: ${sys.planets ? sys.planets.length : 0} Orbiting Planets<br>
                Status: Logged to ISS Odyssey Navigation Computer
              </div>
            </div>
          `;
        }
      });
      panel.innerHTML = html;
    }
    else if (tabName === 'planets') {
      const panel = document.getElementById('log-panel-planets');
      if (!panel) return;
      const exploredPlanets = ship.exploredPlanetsData || {};
      const planetKeys = Object.keys(exploredPlanets);
      if (planetKeys.length === 0) {
        panel.innerHTML = `<div class="log-card"><div class="log-card-body">No planet surface surveys logged yet. Descend onto planetary surfaces to record survey telemetry.</div></div>`;
        return;
      }
      let html = '';
      planetKeys.forEach(pName => {
        const data = exploredPlanets[pName];
        html += `
          <div class="log-card">
            <div class="log-card-header">
              <span>🪐 PLANET SURVEY: ${pName.toUpperCase()}</span>
              <span style="color:#00ff66;">LANDINGS: ${data.landings || 1}</span>
            </div>
            <div class="log-card-body">
              Atmosphere: ${data.atmosphere || 'Nitrogen-Oxygen'} | Gravity: ${data.gravity || '1.0 G'} | Temp: ${data.temperature || 'Mild 18°C'}<br>
              Mineral Deposits Sampled: ${data.mineralsHarvested || 0} | Bio Specimens: ${data.bioHarvested || 0}<br>
              Survey Status: ${data.surveyed ? 'Full Surface Chart Complete' : 'Partial Surface Reconnaissance'}
            </div>
          </div>
        `;
      });
      panel.innerHTML = html;
    }
    else if (tabName === 'artifacts') {
      const panel = document.getElementById('log-panel-artifacts');
      if (!panel) return;
      const artifacts = ship.precursorArtifacts || [];
      if (artifacts.length === 0) {
        panel.innerHTML = `<div class="log-card"><div class="log-card-body">No Precursor Artifacts or Ancient Relics recovered yet. Search planet ruins (🏛️) across Sector 250, 250.</div></div>`;
        return;
      }
      let html = '';
      artifacts.forEach(art => {
        html += `
          <div class="log-card">
            <div class="log-card-header">
              <span>🏛️ ${art.name.toUpperCase()}</span>
              <span style="color:#00ccff;">SECTOR (${art.x || '???'}, ${art.y || '???'})</span>
            </div>
            <div class="log-card-body">
              ${art.description || 'Ancient Precursor relic containing encrypted stellar frequency telemetry.'}
            </div>
          </div>
        `;
      });
      panel.innerHTML = html;
    }
    else if (tabName === 'aliens') {
      const panel = document.getElementById('log-panel-aliens');
      if (!panel) return;
      const history = ship.encounterHistory || [];
      if (history.length === 0) {
        panel.innerHTML = `<div class="log-card"><div class="log-card-body">No alien species contacts recorded in subspace logs.</div></div>`;
        return;
      }
      let html = '';
      history.forEach(enc => {
        html += `
          <div class="log-card">
            <div class="log-card-header">
              <span>👽 ${enc.raceName.toUpperCase()} SUBSPACE CONTACT</span>
              <span style="color:#ffcc00;">COORDS: (${enc.x.toFixed(1)}, ${enc.y.toFixed(1)})</span>
            </div>
            <div class="log-card-body">
              Encounter Classification: ${enc.type || 'Subspace Communication'}<br>
              Disposition Outcome: ${enc.disposition || 'Neutral Contact'}<br>
              Subspace Frequency: 142.80 MHz
            </div>
          </div>
        `;
      });
      panel.innerHTML = html;
    }
  }
};

window.UI = UI;
