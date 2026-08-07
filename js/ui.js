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
    // Panels change size when views swap, so let the canvases re-measure once
    if (typeof Navigation !== 'undefined') Navigation.needsResize = true;

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

    // A site may also hold a relic fragment and/or a sealed mechanism. Both are
    // authored on the host record, so no site needs bespoke code.
    if (der.fragment && typeof PuzzleEngine !== "undefined") {
      PuzzleEngine.grantFragment(der.fragment.setId, der.fragment.id, der.fragment.name);
      lootDetails.innerHTML += `<br><span style="color:#00e5ff;">⚙ COMPONENT RECOVERED: ${der.fragment.name.toUpperCase()}</span>`;
    }

    const btnScavenge = document.getElementById("btnScavengeDerelict");

    if (der.puzzleId && typeof PuzzleEngine !== "undefined" && !PuzzleEngine.isSolved(der.puzzleId)) {
      this.addLog("SENSORS: A SEALED PRECURSOR MECHANISM REMAINS ACTIVE ABOARD THIS HULL.");
      if (part) {
        lootDetails.innerHTML += `<br><span style="color:#ffcc00;">A sealed mechanism guards the module cache.</span>`;
      }
      // Held so the module is released when the mechanism yields, rather than lost
      this.pendingTechPart = part || null;
      btnScavenge.disabled = false;
      btnScavenge.textContent = "⛭ EXAMINE SEALED MECHANISM";
      btnScavenge.onclick = () => {
        this.closeDerelictModal();
        PuzzleEngine.open(der.puzzleId, der.name);
      };
      return;
    }
    this.pendingTechPart = null;

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

  // ---- Customs inspection ---------------------------------------------------
  // This is the mechanic behind Shielded Cargo Bays (cargo class 3+), which had
  // advertised contraband protection since launch with nothing implementing it.
  openPatrolModal(patrol) {
    const modal = document.getElementById("patrol-modal");
    if (!modal || !patrol) return;
    this.currentPatrol = patrol;

    const ship = window.game.ship;
    const contraband = Navigation.countContraband(ship);
    const shielded = Navigation.hasShieldedHold(ship);

    document.getElementById("patrol-title").textContent = `⚑ ${patrol.name.toUpperCase()} - CUSTOMS HAIL`;
    document.getElementById("patrol-coords").textContent = `INTERCEPT AT (${patrol.x.toFixed(1)}, ${patrol.y.toFixed(1)})`;
    document.getElementById("patrol-hail").textContent =
      `"ISS Odyssey, this is ${patrol.name} of Starbase Prime Customs. You are transiting a controlled sector. ` +
      `Cut your engines and stand by for a cargo scan."`;

    document.getElementById("patrol-hold").innerHTML =
      `Cargo Bay: <strong>${GameData.upgrades.cargos[(ship.cargoLevel || 1) - 1].name}</strong>` +
      (shielded ? ` <span style="color:#00ff66;">(ABLATIVE SHIELDING ACTIVE)</span>` : ` <span style="color:#888;">(UNSHIELDED)</span>`) +
      `<br>Restricted goods aboard: ` +
      (contraband > 0
        ? `<span style="color:#ff5555; font-weight:bold;">${contraband} UNIT(S) OF SPEMIN SPICE</span>`
        : `<span style="color:#00ff66;">NONE DETECTED IN MANIFEST</span>`);

    const opts = document.getElementById("patrol-options");
    opts.innerHTML = "";
    const addBtn = (label, cls, fn) => {
      const b = document.createElement("button");
      b.className = "glow-btn btn-large " + cls;
      b.textContent = label;
      b.onclick = fn;
      opts.appendChild(b);
    };
    addBtn("SUBMIT TO INSPECTION", "green-glow", () => this.resolvePatrolScan("submit"));
    if (contraband > 0) addBtn(`JETTISON ${contraband} CONTRABAND`, "yellow-glow", () => this.resolvePatrolScan("jettison"));
    addBtn("RUN FOR IT", "red-glow", () => this.resolvePatrolScan("evade"));

    document.getElementById("patrol-result").classList.add("hidden");
    document.getElementById("patrol-close-btn").classList.add("hidden");
    modal.classList.remove("hidden");
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('error');
    this.addLog(`CUSTOMS HAIL: ${patrol.name.toUpperCase()} IS ORDERING A CARGO SCAN.`);
  },

  resolvePatrolScan(choice) {
    const ship = window.game.ship;
    const cfg = GameData.customs || {};
    const contraband = Navigation.countContraband(ship);
    const shielded = Navigation.hasShieldedHold(ship);
    let html = "", beep = "success";

    if (choice === "jettison") {
      for (const key in ship.cargo) {
        const c = GameData.commodities[key];
        if (c && c.isContraband) delete ship.cargo[key];
      }
      html = `<span style="color:#ffcc00;">You purge the restricted cargo into vacuum moments before the scan beam sweeps the hull.</span><br>` +
             `Lost ${contraband} unit(s) of Spemin Spice. The cutter finds nothing and waves you through.`;
      this.addLog(`CONTRABAND JETTISONED: ${contraband} UNIT(S) DUMPED BEFORE THE SCAN.`);
      beep = "click";

    } else if (choice === "evade") {
      const engineBonus = ((ship.engineLevel || 1) - 1) * 0.13;
      const chance = Math.min(0.92, (cfg.evadeBaseChance || 0.35) + engineBonus);
      const roll = Math.random();
      if (roll < chance) {
        html = `<span style="color:#00ff66;">You slam the throttle open and break the intercept cone before their lock resolves.</span><br>` +
               `The cutter falls astern. Nothing aboard was scanned.`;
        this.addLog("EVASION SUCCESSFUL: CUSTOMS INTERCEPT BROKEN.");
      } else {
        const dmg = 18;
        ship.hull = Math.max(1, ship.hull - dmg);
        const fine = Math.min(ship.credits, 750);
        ship.credits -= fine;
        html = `<span style="color:#ff5555;">The cutter runs you down and puts a disabling shot across the hull.</span><br>` +
               `Hull -${dmg}. Fined ${fine.toLocaleString()} M.U. for refusing a lawful inspection.`;
        this.addLog(`EVASION FAILED: HULL -${dmg}, FINED ${fine} M.U.`);
        beep = "error";
      }

    } else { // submit
      if (contraband === 0) {
        html = `<span style="color:#00ff66;">Scan complete. Manifest clean.</span><br>"Apologies for the delay, Odyssey. Safe travels."`;
        this.addLog("CUSTOMS SCAN CLEAN: NO RESTRICTED CARGO FOUND.");
      } else if (shielded) {
        html = `<span style="color:#00ff66;">The scan beam washes over ablative shielding and returns nothing but background noise.</span><br>` +
               `Your ${contraband} unit(s) of Spemin Spice remain undetected in the shielded bays.<br>` +
               `<em>"Sensors read empty. Move along, Odyssey."</em>`;
        this.addLog(`SHIELDED BAYS DEFEATED THE CUSTOMS SCAN. ${contraband} UNIT(S) STILL ABOARD.`);
      } else {
        const fine = Math.min(ship.credits, contraband * (cfg.finePerUnit || 500));
        for (const key in ship.cargo) {
          const c = GameData.commodities[key];
          if (c && c.isContraband) delete ship.cargo[key];
        }
        ship.credits -= fine;
        html = `<span style="color:#ff5555;">SCAN POSITIVE. Restricted compounds detected in an unshielded hold.</span><br>` +
               `${contraband} unit(s) of Spemin Spice seized.<br>Fined ${fine.toLocaleString()} M.U.<br>` +
               `<em>"Fit shielded bays or stay out of our sectors, Odyssey."</em>`;
        this.addLog(`CONTRABAND SEIZED: ${contraband} UNIT(S) CONFISCATED, FINED ${fine} M.U.`);
        beep = "error";
      }
    }

    document.getElementById("patrol-options").innerHTML = "";
    document.getElementById("patrol-result-body").innerHTML = html;
    document.getElementById("patrol-result").classList.remove("hidden");
    document.getElementById("patrol-close-btn").classList.remove("hidden");
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep(beep);

    this.updateShip(ship);
    window.game.saveGame();
  },

  closePatrolModal() {
    const modal = document.getElementById("patrol-modal");
    if (modal) modal.classList.add("hidden");
    this.currentPatrol = null;
  },

  // Puzzle shell. The type's own render() supplies the controls, so this method
  // never grows a branch per puzzle kind.
  openPuzzleModal(puzzle, hostName, impl) {
    const modal = document.getElementById("puzzle-modal");
    if (!modal) return;

    this.puzzleSequence = [];
    document.getElementById("puzzle-title").textContent = puzzle.title || "PRECURSOR MECHANISM";
    document.getElementById("puzzle-host").textContent = hostName || "";

    const body = document.getElementById("puzzle-body");
    const result = document.getElementById("puzzle-result");
    const submit = document.getElementById("puzzle-submit");
    result.textContent = "";
    result.className = "";

    if (PuzzleEngine.isSolved(puzzle.id)) {
      body.innerHTML = `<div class="log-card"><div class="log-card-body" style="color:#00ff66;">
        This mechanism has already been solved. Its records are in your Captain's Log.</div></div>`;
      submit.classList.add("hidden");
    } else if (!PuzzleEngine.hasPrerequisite(puzzle)) {
      body.innerHTML = `<div class="log-card"><div class="log-card-body" style="color:#ffcc00;">
        🔒 ${PuzzleEngine.prerequisiteHint(puzzle)}</div></div>`;
      submit.classList.add("hidden");
    } else {
      body.innerHTML = impl.render(puzzle);
      submit.classList.remove("hidden");

      // Live preview for types that offer one (the cipher dial)
      const input = document.getElementById("puzzle-input");
      if (input && typeof impl.onInput === "function") {
        const preview = document.getElementById("puzzle-preview");
        const update = () => { if (preview) preview.textContent = impl.onInput(puzzle, input.value); };
        input.addEventListener("input", update);
        update();
      }
    }

    modal.classList.remove("hidden");
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
  },

  puzzleGlyphPressed(glyph) {
    if (!Array.isArray(this.puzzleSequence)) this.puzzleSequence = [];
    this.puzzleSequence.push(glyph);
    const box = document.getElementById("puzzle-sequence");
    const input = document.getElementById("puzzle-input");
    if (box) box.textContent = this.puzzleSequence.join(" ");
    if (input) input.value = this.puzzleSequence.join("");
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
  },

  puzzleClearSequence() {
    this.puzzleSequence = [];
    const box = document.getElementById("puzzle-sequence");
    const input = document.getElementById("puzzle-input");
    if (box) box.textContent = "";
    if (input) input.value = "";
  },

  submitPuzzle() {
    const input = document.getElementById("puzzle-input");
    const result = document.getElementById("puzzle-result");
    const value = input ? input.value : "";
    const ok = PuzzleEngine.attempt(value);

    if (ok) {
      result.textContent = "✔ MECHANISM ACCEPTS. SEQUENCE COMPLETE.";
      result.style.color = "#00ff66";
      document.getElementById("puzzle-submit").classList.add("hidden");

      // Release anything the mechanism was sealing
      if (this.pendingTechPart) {
        const released = this.pendingTechPart;
        this.pendingTechPart = null;
        this.addLog(`THE MECHANISM DISENGAGES. MODULE CACHE OPEN: ${released.name.toUpperCase()}.`);
        setTimeout(() => { this.closePuzzleModal(); this.openTechPartModal(released); }, 1400);
      }
      const cur = PuzzleEngine.current;
      if (cur) {
        const body = document.getElementById("puzzle-body");
        if (cur.puzzle.type === "cipher") {
          body.innerHTML = `<div class="log-card"><div class="log-card-body" style="color:#00e5ff; font-size:15px; letter-spacing:1px;">
            ${cur.puzzle.plaintext}</div></div>`;
        }
      }
    } else {
      result.textContent = "✖ REJECTED. The mechanism resets.";
      result.style.color = "#ff5555";
      this.puzzleClearSequence();
      if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('error');
    }
  },

  closePuzzleModal() {
    const modal = document.getElementById("puzzle-modal");
    if (modal) modal.classList.add("hidden");
    PuzzleEngine.current = null;
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
  },

  // Archive shelf. Locked volumes stay visible but state plainly why - a shelf you
  // can see the shape of is an invitation to come back, an empty one is not.
  openArchiveModal(locationId) {
    const modal = document.getElementById("archive-modal");
    if (!modal || typeof ArchiveReader === "undefined") return;
    const loc = ArchiveReader.locations()[locationId];
    if (!loc) return;

    this.currentArchive = locationId;
    const prog = ArchiveReader.progress(locationId);

    document.getElementById("archive-title").textContent = `${loc.icon} ${loc.name.toUpperCase()}`;
    document.getElementById("archive-progress").textContent =
      `${prog.read} READ / ${prog.unlocked} AVAILABLE / ${prog.total} CATALOGUED`;
    document.getElementById("archive-blurb").textContent = loc.blurb;

    this.renderArchiveShelf(locationId);
    document.getElementById("archive-reader").classList.add("hidden");
    modal.classList.remove("hidden");
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
  },

  renderArchiveShelf(locationId) {
    const shelf = document.getElementById("archive-shelf");
    if (!shelf) return;
    const vols = ArchiveReader.at(locationId);

    if (!vols.length) {
      shelf.innerHTML = `<div class="log-card"><div class="log-card-body">This archive is empty.</div></div>`;
      return;
    }

    let html = "";
    vols.forEach(v => {
      const unlocked = ArchiveReader.isUnlocked(v);
      const read = ArchiveReader.hasRead(v.id);
      if (!unlocked) {
        html += `
          <div class="log-card" style="opacity:0.45;">
            <div class="log-card-header"><span>🔒 ${v.title}</span></div>
            <div class="log-card-body" style="font-size:11px;">${ArchiveReader.lockHint(v)}</div>
          </div>`;
      } else {
        html += `
          <div class="log-card">
            <div class="log-card-header">
              <span>${read ? "📖" : "📕"} ${v.title}</span>
              <span style="font-size:10px; color:#88ccaa;">${v.author || ""}</span>
            </div>
            <div class="log-card-body" style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
              <span style="font-size:11px; color:${read ? "#88ccaa" : "#ffcc00"};">
                ${read ? "Studied" : "Not yet studied"}${v.grantsClue ? " &nbsp;|&nbsp; contains actionable intelligence" : ""}
              </span>
              <button class="glow-btn btn-sm ${read ? "" : "green-glow"}" onclick="UI.readArchiveVolume('${v.id}')">READ</button>
            </div>
          </div>`;
      }
    });
    shelf.innerHTML = html;
  },

  readArchiveVolume(volumeId) {
    const vol = ArchiveReader.volumes().find(v => v.id === volumeId);
    if (!vol) return;
    ArchiveReader.readVolume(volumeId);

    document.getElementById("archive-reader-title").textContent = vol.title;
    document.getElementById("archive-reader-author").textContent = vol.author || "";
    document.getElementById("archive-reader-body").textContent = vol.text;
    document.getElementById("archive-reader").classList.remove("hidden");
    this.renderArchiveShelf(this.currentArchive);
  },

  closeArchiveModal() {
    const modal = document.getElementById("archive-modal");
    if (modal) modal.classList.add("hidden");
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
  },

  openVictoryModal() {
    const modal = document.getElementById("victory-modal");
    if (!modal) return;
    const ship = window.game.ship;

    const sectors = Object.keys(ship.exploredSectors || {}).length;
    const systems = Object.keys(ship.discoveredSystems || {}).length;
    const planets = Object.keys(ship.exploredPlanets || {}).length;
    const salvaged = Object.keys(ship.salvagedIds || {}).length;
    const modules = (ship.installedTechParts || []).length;
    const clues = (ship.clues || []).length;

    document.getElementById("victory-stats-body").innerHTML =
      `Star systems charted: <strong>${systems} / ${(GameData.starSystems || []).length}</strong><br>` +
      `Sectors surveyed: <strong>${sectors}</strong><br>` +
      `Worlds walked: <strong>${planets}</strong><br>` +
      `Sites salvaged: <strong>${salvaged}</strong><br>` +
      `Precursor modules installed: <strong>${modules}</strong><br>` +
      `Intelligence recovered: <strong>${clues} clues</strong><br>` +
      `Credits in the vault: <strong>${(ship.credits || 0).toLocaleString()} M.U.</strong>`;

    modal.classList.remove("hidden");
  },

  closeVictoryModal() {
    const modal = document.getElementById("victory-modal");
    if (modal) modal.classList.add("hidden");
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
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

  // Scoped to the Captain's Log modal and matched by name rather than index. The
  // old version queried `.log-tab-btn` across the whole document - which also
  // matches the Help modal's tabs - and mapped tabs to positions 0..3, so adding
  // a tab meant editing an if-chain and risked deactivating the wrong modal.
  switchLogTab(tabName) {
    const modal = document.getElementById('captains-log-modal');
    if (!modal) return;

    modal.querySelectorAll('.log-tab-btn').forEach(btn => {
      const target = (btn.getAttribute('onclick') || '').match(/switchLogTab\('([^']+)'\)/);
      btn.classList.toggle('active', !!target && target[1] === tabName);
    });
    modal.querySelectorAll('.log-content-panel').forEach(panel => panel.classList.remove('active'));

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
        // Guarded like the star map reader: a malformed record must not blank the tab
        const race = String(enc.raceName || enc.raceKey || 'UNKNOWN').toUpperCase();
        html += `
          <div class="log-card">
            <div class="log-card-header">
              <span>👽 ${race} SUBSPACE CONTACT</span>
              <span style="color:#ffcc00;">COORDS: (${Number(enc.x || 0).toFixed(1)}, ${Number(enc.y || 0).toFixed(1)})</span>
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

    else if (tabName === 'clues') {
      const panel = document.getElementById('log-panel-clues');
      if (!panel) return;
      const clues = (typeof ClueLog !== 'undefined') ? ClueLog.list() : [];

      if (clues.length === 0) {
        panel.innerHTML = `<div class="log-card"><div class="log-card-body">` +
          `No intelligence gathered yet. Clues are recorded automatically from Starbase dispatches, ` +
          `Precursor ruins, alien transmissions, archives and salvaged data cores.` +
          `</div></div>`;
        return;
      }

      // Group by quest so an active investigation reads as one thread, with
      // unattached lore collected at the end.
      const groups = {};
      const loose = [];
      clues.forEach(c => {
        if (c.questId) (groups[c.questId] = groups[c.questId] || []).push(c);
        else loose.push(c);
      });

      const questTitle = (qid) => {
        const q = (typeof GameData !== 'undefined' && GameData.quests)
          ? GameData.quests.find(q => q.id === qid) : null;
        return q ? q.title : qid;
      };

      const renderClue = (c) => {
        const src = ClueLog.SOURCES[c.source] || ClueLog.SOURCES.survey;
        return `
          <div class="log-card">
            <div class="log-card-header">
              <span>${src.icon} ${c.title || src.label}</span>
              <span style="color:#88ccaa; font-size:10px;">${c.sourceName || src.label}</span>
            </div>
            <div class="log-card-body">
              ${c.text}
              ${c.coords ? `<br><span style="color:#ffcc00; font-weight:bold;">REFERENCED COORDINATES: (${c.coords.x}, ${c.coords.y})</span>` : ''}
            </div>
          </div>`;
      };

      let html = '';
      Object.keys(groups).forEach(qid => {
        html += `<div style="color:#00ccff; font-weight:bold; margin:10px 0 6px;">🎯 ${questTitle(qid).toUpperCase()}</div>`;
        groups[qid].forEach(c => { html += renderClue(c); });
      });
      if (loose.length) {
        html += `<div style="color:#88ccaa; font-weight:bold; margin:10px 0 6px;">📎 UNFILED INTELLIGENCE</div>`;
        loose.forEach(c => { html += renderClue(c); });
      }
      panel.innerHTML = html;
    }
  }
};

window.UI = UI;
