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
      btnDistress: document.getElementById("ctrl-distress"),

      // Cargo Modal
      cargoModal: document.getElementById("cargo-modal"),
      cargoManifestDetails: document.getElementById("cargo-manifest-details"),
      closeCargoBtn: document.querySelector(".close-modal-btn")
    };

    this.setupListeners();
    this.setupModalBackdrops();
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
    this.elements.btnCargo.addEventListener("click", () => this.dispatchCargo());

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

    if (this.elements.btnDistress) {
      this.elements.btnDistress.addEventListener("click", () => this.openRescueModal());
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
      // An unrecognised key still occupies the hold. Skipping it made anything
      // the commodity table did not know about weightless, which quietly
      // defeated the cargo cap.
      const item = GameData.commodities[key] || { mass: 1.0 };
      mass += (cargo[key] || 0) * (item.mass || 1.0);
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
    // Defensive: a single unusable entry must not take the whole manifest down
    // with it. This is what made CARGO LOG look like a dead button.
    (shipState.artifactsCollected || []).filter(a => typeof a === "string" && a).forEach(art => {
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
    // Carry count on the locker control, so equipment aboard is visible without
    // opening anything - and so the control is worth pressing in the first place.
    const lockerBtn = document.getElementById("ctrl-locker");
    if (lockerBtn && typeof Consumables !== "undefined") {
      const held = Consumables.inventory().reduce((n, r) => n + r.count, 0);
      lockerBtn.textContent = held > 0 ? `SHIP'S LOCKER (${held}) [O]` : "SHIP'S LOCKER [O]";
      lockerBtn.classList.toggle("green-glow", held > 0);
    }

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

    // updateHyper leaves btnLand reading "DOCK AT BASE [L]" from the approach, and
    // nothing reset it once docking succeeded - so the control still invited you to
    // dock at a base you were already standing on.
    if (isDocked && this.elements.btnLand) {
      this.elements.btnLand.disabled = true;
      this.elements.btnLand.textContent = "DOCKED AT STARBASE";
    }

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

    // Distress control surfaces only when the ship is actually stranded
    if (this.elements.btnDistress) {
      const stranded = (game.ship.fuel <= 0) && !game.ship.isInSpacebase && game.viewState === "navigation";
      this.elements.btnDistress.classList.toggle("hidden", !stranded);
      this.elements.btnDistress.disabled = !stranded;
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

  /**
   * Put a salvaged haul where it belongs and report what actually happened.
   *
   * `endurium` is the one loot type that means reactor mass; it goes straight to
   * the tank. Everything else is ore and belongs in the hold, subject to the
   * cargo cap - a hold that cannot take it says so rather than quietly eating it.
   *
   * Returns { log, detail, name, taken, refused } so callers never have to guess
   * at the wording, which is how "SALVAGED 6 ENDURIUM" ended up printed over a
   * crate of precursor alloy.
   */
  deliverSalvage(type, amount) {
    const ship = window.game.ship;
    const qty = Math.max(0, Math.floor(amount || 0));
    if (!qty) return { log: "NOTHING OF VALUE RECOVERED", detail: "Nothing recoverable in the hold.", name: "", taken: 0, refused: 0 };

    // Reactor mass, not cargo
    if (type === "endurium" || type === "fuel") {
      const before = ship.fuel;
      ship.fuel = Math.min(ship.maxFuel, ship.fuel + qty);
      const taken = Math.round((ship.fuel - before) * 10) / 10;
      const spare = qty - taken;
      return {
        log: `SALVAGED ${taken} ENDURIUM INTO THE TANK`,
        detail: `+${taken} Endurium fuel units pumped into the tanks.` +
                (spare > 0 ? ` <span style="color:#ffcc00;">Tank full - ${Math.round(spare)} units left behind.</span>` : ""),
        name: "Endurium", taken: taken, refused: 0
      };
    }

    const c = GameData.commodities[type] || { name: type, mass: 1 };
    const used = this.calculateCargoMass(ship.cargo);
    const perUnit = c.mass || 1;
    const room = Math.max(0, Math.floor(((ship.cargoCap || 20) - used) / perUnit));
    const taken = Math.min(qty, room);

    if (taken > 0) {
      if (!ship.cargo) ship.cargo = {};
      ship.cargo[type] = (ship.cargo[type] || 0) + taken;
    }

    return {
      log: taken > 0
        ? `SALVAGED ${taken}x ${String(c.name).toUpperCase()} INTO THE HOLD`
        : `RECOVERED NOTHING - THE HOLD IS FULL`,
      detail: taken > 0
        ? `+${taken} ${c.name} stowed in the cargo hold.`
        : `<span style="color:#ffcc00;">Hold full - the ${c.name} stays where it is.</span>`,
      name: c.name, taken: taken, refused: qty - taken
    };
  },

  scavengeCurrentDerelict() {
    if (!this.currentDerelict || this.currentDerelict.searched) return;
    const der = this.currentDerelict;
    const ship = window.game.ship;

    der.searched = true;
    if (window.game && window.game.markSalvaged) window.game.markSalvaged(der.id);
    const loot = der.loot;

    // Deliver the haul.
    //
    // Only `endurium` is reactor mass and goes to the tank. Every other loot type
    // is ORE, and it was never delivered anywhere at all - `ship.cargo` was not
    // touched by this function. Nine of the eleven derelicts in the game carry
    // precursor alloy, platinum, iridium or alien art, so their entire haul was
    // silently discarded: up to 12 units of precursor alloy, about 3,000 M.U., per
    // site. And the log line was hardcoded to say ENDURIUM whatever the manifest
    // actually held, so it announced fuel that never arrived.
    const haul = this.deliverSalvage(loot.type, loot.amount);
    ship.credits += loot.credits;

    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('powerup');
    this.addLog(`DERELICT SCAVENGED! ${haul.log} & ${loot.credits.toLocaleString()} M.U. CREDITS!`);
    if (haul.refused > 0) {
      this.addLog(`HOLD FULL: ${haul.refused} UNITS OF ${haul.name.toUpperCase()} LEFT IN THE WRECK.`);
    }

    // Derelict tech was flavour text: loot.tech printed a name and did nothing.
    // Every station now yields the real Precursor module its manifest describes,
    // so salvage - not the Depot - is where hold capacity and scanner range grow.
    const part = (loot.techPartKey && GameData.techParts) ? GameData.techParts[loot.techPartKey] : null;

    const lootDetails = document.getElementById("derelict-loot-details");
    lootDetails.innerHTML = `<span style="color: #00ff66;">✓ SALVAGE COMPLETE!</span><br>` +
      `+${loot.credits.toLocaleString()} Credits added to ship vault.<br>` +
      `${haul.detail}<br>` +
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

  /**
   * Stranded without fuel. Who answers a distress call depends on where you are:
   * inside Customs jurisdiction the Corps will tow you, near an alien port they
   * will trade, and in the deep dark you are on your own with whatever is in the
   * hold. Every option costs something - being rescued should sting.
   */
  openRescueModal() {
    const modal = document.getElementById("rescue-modal");
    if (!modal) return;
    const ship = window.game.ship;
    const N = Navigation;

    const inCore = (typeof RegionManager === "undefined") || RegionManager.isCore();
    const zone = GameData.patrolZone || { x: 250, y: 250, radius: 130 };
    const distToBase = Math.hypot(N.shipX - zone.x, N.shipY - zone.y);
    const inJurisdiction = inCore && distToBase <= zone.radius;
    const nearestPort = inCore && GameData.alienPorts
      ? GameData.alienPorts.map(p => ({ p: p, d: Math.hypot(N.shipX - p.x, N.shipY - p.y) }))
                           .sort((a, b) => a.d - b.d)[0]
      : null;

    document.getElementById("rescue-position").textContent =
      `ADRIFT AT (${N.shipX.toFixed(1)}, ${N.shipY.toFixed(1)}) - ${String(RegionManager.current().name).toUpperCase()}`;

    const cargoMass = this.calculateCargoMass(ship.cargo);
    document.getElementById("rescue-status").innerHTML =
      `Endurium: <strong style="color:#ff5555;">${Math.floor(ship.fuel)} / ${ship.maxFuel}</strong><br>` +
      `Credits: <strong>${(ship.credits || 0).toLocaleString()} M.U.</strong><br>` +
      `Cargo aboard: <strong>${cargoMass.toFixed(1)} T</strong><br>` +
      `Distance to Starbase Prime: <strong>${inCore ? distToBase.toFixed(0) + " LY" : "unreachable from this region"}</strong>`;

    const opts = document.getElementById("rescue-options");
    opts.innerHTML = "";
    const addOpt = (label, note, cls, fn, enabled) => {
      const wrap = document.createElement("div");
      wrap.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap:10px;";
      const b = document.createElement("button");
      b.className = "glow-btn " + cls;
      b.textContent = label;
      b.disabled = !enabled;
      b.onclick = fn;
      const n = document.createElement("span");
      n.style.cssText = "font-size:11px; color:#88ccaa; flex:1;";
      n.textContent = note;
      wrap.appendChild(b); wrap.appendChild(n);
      opts.appendChild(wrap);
    };

    // 1. Corps tow - only inside the jurisdiction that fields the cutters
    addOpt("REQUEST SFC TOW", inJurisdiction
        ? "Starbase Prime dispatches a cutter. Full tank, towed home, and a 2,000 M.U. recovery bill."
        : "No Customs cutter is within range of this position.",
      "green-glow", () => this.resolveRescue("sfc"), inJurisdiction && ship.credits >= 0);

    // 2. Alien trade - they want paying, and they know you have no choice
    addOpt("HAIL PASSING TRADER", nearestPort
        ? `A ${nearestPort.p.raceKey.toUpperCase()} tender answers. 40 Endurium at triple the going rate: 1,800 M.U.`
        : "Nothing answers on the trade bands out here.",
      "yellow-glow", () => this.resolveRescue("trade"), !!nearestPort && ship.credits >= 1800);

    // 3. Barter the hold - always available if you have anything to give
    addOpt("BARTER THE CARGO HOLD", cargoMass > 0
        ? `Trade the entire hold (${cargoMass.toFixed(1)} T) for 50 Endurium. No credits change hands.`
        : "The hold is empty. There is nothing to trade.",
      "", () => this.resolveRescue("barter"), cargoMass > 0);

    // 4. Last resort - always works, always hurts
    addOpt("BURN THE CARGO FOR REACTION MASS", "Scuttle everything aboard for 20 Endurium. Nothing is recovered.",
      "red-glow", () => this.resolveRescue("scuttle"), true);

    document.getElementById("rescue-result").classList.add("hidden");
    modal.classList.remove("hidden");
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('error');
    this.addLog("DISTRESS BEACON BROADCASTING ON THE OPEN BAND...");
  },

  resolveRescue(choice) {
    const ship = window.game.ship;
    const N = Navigation;
    let html = "";

    if (choice === "sfc") {
      const fee = 2000;
      const paid = Math.min(ship.credits, fee);
      ship.credits -= paid;
      ship.fuel = ship.maxFuel;
      const debt = fee - paid;
      html = `<span style="color:#00ff66;">SFC cutter matches velocity and takes you under tow.</span><br>` +
             `Tanks refilled to ${ship.maxFuel}. Recovery fee ${paid.toLocaleString()} M.U. deducted.` +
             (debt > 0 ? `<br><span style="color:#ffcc00;">${debt.toLocaleString()} M.U. logged as debt against your commission.</span>` : "");
      N.resetPhysics(250, 250);
      ship.coordinates.x = 250; ship.coordinates.y = 250;
      this.addLog(`SFC TOW COMPLETE: RETURNED TO STARBASE PRIME. FEE ${paid} M.U.`);
      setTimeout(() => { try { Navigation.enterSpacebase(); } catch (e) {} }, 1200);

    } else if (choice === "trade") {
      ship.credits -= 1800;
      ship.fuel = Math.min(ship.maxFuel, ship.fuel + 40);
      html = `<span style="color:#ffcc00;">The tender transfers 40 Endurium and departs without ceremony.</span><br>` +
             `1,800 M.U. paid. They knew exactly what your position was worth.`;
      this.addLog("TRADER RESUPPLY: +40 ENDURIUM FOR 1,800 M.U.");

    } else if (choice === "barter") {
      const mass = this.calculateCargoMass(ship.cargo);
      ship.cargo = {};
      ship.fuel = Math.min(ship.maxFuel, ship.fuel + 50);
      html = `<span style="color:#ffcc00;">The hold is emptied into their bay and 50 Endurium comes back the other way.</span><br>` +
             `${mass.toFixed(1)} T of cargo gone. It was worth more than the fuel, and both of you knew it.`;
      this.addLog(`CARGO BARTERED: ${mass.toFixed(1)} T TRADED FOR 50 ENDURIUM.`);

    } else if (choice === "scuttle") {
      ship.cargo = {};
      ship.fuel = Math.min(ship.maxFuel, ship.fuel + 20);
      html = `<span style="color:#ff5555;">You feed the hold into the reaction chamber.</span><br>` +
             `20 Endurium recovered. Enough to limp somewhere. Nothing else survives the burn.`;
      this.addLog("EMERGENCY SCUTTLE: CARGO CONVERTED TO 20 ENDURIUM.");
    }

    Navigation.fuelDryAnnounced = false;
    document.getElementById("rescue-options").innerHTML = "";
    document.getElementById("rescue-result-body").innerHTML = html;
    document.getElementById("rescue-result").classList.remove("hidden");
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('success');
    this.updateShip(ship);
    window.game.saveGame();
  },

  closeRescueModal() {
    const modal = document.getElementById("rescue-modal");
    if (modal) modal.classList.add("hidden");
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
      `Star systems charted: <strong>${systems} / ${RegionManager.content('starSystems').length}</strong><br>` +
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

  // ---- Alien starports ----------------------------------------------------
  // Docking used to do nothing but open the archive, which made a starport a
  // library with a docking clamp. A port is now somewhere you can actually
  // resupply - and out past the singularities it is the ONLY place you can.

  /** What this port charges per unit of Endurium. Starbase Prime charges 15. */
  portFuelPrice(port) {
    return (port && port.fuelPrice) || 25;
  },

  /** What this port pays for a commodity, which is never what the Corps pays. */
  portPriceFor(port, key) {
    // Always an object. This returned the bare number 0 for an unknown key, and
    // every caller reads `.name` and `.price` off it - so one unrecognised item
    // in the hold threw on `q.name.toUpperCase()` and took the entire port modal
    // down with it. Docking logged its greeting and then simply did nothing.
    const c = GameData.commodities[key] || { name: key, sellVal: 10 };
    const wanted = Array.isArray(port.wants) && port.wants.indexOf(key) >= 0;
    const mult = wanted ? (port.wantMult || 1.5) : (port.baseMult || 0.7);
    return {
      price: Math.max(1, Math.round((c.sellVal || 50) * mult)),
      wanted: wanted,
      name: c.name || String(key)
    };
  },

  openPortModal(port) {
    this.currentPort = port;
    const modal = document.getElementById("port-modal");
    if (!modal || !port) return;

    const region = (typeof RegionManager !== "undefined") ? RegionManager.current() : null;
    document.getElementById("port-title").textContent = `⌂ ${port.name.toUpperCase()}`;
    document.getElementById("port-region").textContent =
      `${String((region && region.name) || "").toUpperCase()} - (${port.x}, ${port.y})`;
    document.getElementById("port-greeting").textContent = port.greeting ? `"${port.greeting}"` : "";
    document.getElementById("port-trade-line").textContent = port.tradeLine || "";

    this.renderPortFuel();
    this.renderPortMarket();

    modal.classList.remove("hidden");
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('success');
  },

  renderPortFuel() {
    const port = this.currentPort;
    const ship = window.game.ship;
    if (!port) return;

    const unit = this.portFuelPrice(port);
    const room = Math.max(0, Math.floor(ship.maxFuel - ship.fuel));
    const info = document.getElementById("port-fuel-info");
    const box = document.getElementById("port-fuel-options");

    info.innerHTML =
      `TANK: <strong>${Math.floor(ship.fuel)} / ${ship.maxFuel}</strong> ENDURIUM &nbsp;|&nbsp; ` +
      `PRICE HERE: <strong style="color:#ffcc00;">${unit} M.U./UNIT</strong> ` +
      `<span style="color:#889999;">(Starbase Prime: 15)</span><br>` +
      `CREDITS: <strong>${(ship.credits || 0).toLocaleString()} M.U.</strong>`;

    if (room <= 0) {
      box.innerHTML = `<span style="color:#88ccaa;">Tank already full. Nothing to sell you.</span>`;
      return;
    }

    // Offer a partial top-up as well as a full tank: a captain who cannot afford
    // to fill up should still be able to buy enough to reach somewhere cheaper.
    const affordable = Math.floor((ship.credits || 0) / unit);
    const opts = [];
    [10, 25, room].forEach(n => {
      const qty = Math.min(n, room);
      if (qty <= 0 || opts.some(o => o.qty === qty)) return;
      opts.push({ qty: qty, cost: qty * unit, label: (qty === room ? "FILL TANK" : `+${qty} UNITS`) });
    });

    box.innerHTML = opts.map(o => {
      const can = (ship.credits || 0) >= o.cost;
      return `<button class="glow-btn ${can ? 'yellow-glow' : ''}" ${can ? '' : 'disabled'} ` +
             `onclick="try{UI.buyPortFuel(${o.qty})}catch(e){alert(e.message)}">` +
             `${o.label} - ${o.cost.toLocaleString()} M.U.</button>`;
    }).join("") + (affordable <= 0
      ? `<div style="color:#ff5555; width:100%;">You cannot afford a single unit here.</div>` : "");
  },

  buyPortFuel(qty) {
    const port = this.currentPort;
    const ship = window.game.ship;
    if (!port) return;

    const unit = this.portFuelPrice(port);
    const room = Math.max(0, Math.floor(ship.maxFuel - ship.fuel));
    const want = Math.min(qty, room);
    if (want <= 0) return;

    const cost = want * unit;
    if ((ship.credits || 0) < cost) {
      this.addLog("TRANSACTION REFUSED: INSUFFICIENT CREDITS FOR THAT QUANTITY.");
      if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('error');
      return;
    }

    ship.credits -= cost;
    ship.fuel = Math.min(ship.maxFuel, ship.fuel + want);
    this.addLog(`FUEL PURCHASED: ${want} ENDURIUM FROM ${port.name.toUpperCase()} FOR ${cost.toLocaleString()} M.U.`);
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('success');
    if (typeof QuestEngine !== "undefined") QuestEngine.notify("trade", { portId: port.id, bought: "fuel", qty: want });

    this.updateShip(ship);
    this.renderPortFuel();
    window.game.saveGame();
  },

  renderPortMarket() {
    const port = this.currentPort;
    const ship = window.game.ship;
    const box = document.getElementById("port-market");
    if (!port || !box) return;

    const keys = Object.keys(ship.cargo || {}).filter(k => (ship.cargo[k] || 0) > 0);
    if (!keys.length) {
      box.innerHTML = `<span style="color:#88ccaa;">Hold empty. Nothing to put on the ledger.</span>`;
      return;
    }

    const rows = keys.map(k => {
      const q = this.portPriceFor(port, k);
      const qty = ship.cargo[k];
      return `<div style="display:flex; align-items:center; gap:8px; padding:3px 0; border-bottom:1px solid rgba(0,255,102,0.12);">
        <span style="flex:1; color:${q.wanted ? '#ffcc00' : '#aaccbb'};">
          ${q.name.toUpperCase()} x${qty}${q.wanted ? ' <span style="color:#ffcc00;">[SOUGHT]</span>' : ''}
        </span>
        <span style="width:110px; text-align:right;">${q.price} M.U. ea</span>
        <button class="glow-btn" style="padding:2px 8px; font-size:11px;"
          onclick="try{UI.sellToPort('${k}')}catch(e){alert(e.message)}">SELL ALL (${(q.price * qty).toLocaleString()})</button>
      </div>`;
    }).join("");

    box.innerHTML = rows +
      `<div style="margin-top:8px; color:#889999; font-size:11px;">
         Sought goods pay above Corps rate. Everything else is bought at a discount - an alien port is not a fair market.
       </div>`;
  },

  sellToPort(key) {
    const port = this.currentPort;
    const ship = window.game.ship;
    if (!port) return;

    const qty = ship.cargo[key] || 0;
    if (qty <= 0) return;

    const q = this.portPriceFor(port, key);
    const earned = q.price * qty;
    delete ship.cargo[key];
    ship.credits += earned;

    this.addLog(`LEDGER CLOSED: SOLD ${qty}x ${q.name.toUpperCase()} TO ${port.name.toUpperCase()} FOR ${earned.toLocaleString()} M.U.` +
                (q.wanted ? " THEY WANTED IT." : ""));
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('success');
    if (typeof QuestEngine !== "undefined") QuestEngine.notify("trade", { portId: port.id, sold: key, qty: qty });

    this.updateShip(ship);
    this.renderPortMarket();
    this.renderPortFuel();
    window.game.saveGame();
  },

  openPortArchive() {
    const port = this.currentPort;
    if (!port || typeof ArchiveReader === "undefined") return;
    ArchiveReader.open(port.archive);
  },

  closePortModal() {
    const modal = document.getElementById("port-modal");
    if (modal) modal.classList.add("hidden");
    this.currentPort = null;
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
  },

  /**
   * Open whichever manifest belongs to where the captain is standing.
   *
   * Reachable from BOTH an addEventListener binding and an inline onclick in
   * index.html. That duplication is deliberate and is the house pattern from
   * v1.9.8 (see PROJECT_DOCUMENTATION 6.5): a listener that fails to attach for
   * any reason leaves the control dead with nothing on screen to explain it, and
   * the inline attribute always fires. Both paths are safe to run together -
   * opening an already-open manifest just re-renders it.
   */
  dispatchCargo() {
    const game = window.game;
    const onSurface = game && game.viewState === "landing" &&
                      typeof PlanetExploration !== 'undefined' && PlanetExploration.active;
    if (onSurface) {
      PlanetExploration.openRoverCargoModal();
    } else {
      this.openCargoModal();
    }
  },

  // ---- Modal backdrop dismissal ------------------------------------------
  // A `.modal` covers the whole screen and takes clicks, so one left open makes
  // every control button unclickable. Clicking the dark surround now closes the
  // ones that are safe to abandon - the same set Esc handles - which is what a
  // player instinctively tries first.
  ESCAPABLE_MODALS: [
    "cargo-modal", "tv-cargo-modal", "starmap-modal", "archive-modal",
    "puzzle-modal", "rescue-modal", "port-modal", "locker-modal",
    "captains-log-modal", "help-modal", "legend-modal",
    "landing-site-modal", "victory-modal", "packs-modal"
  ],

  setupModalBackdrops() {
    this.ESCAPABLE_MODALS.forEach(id => {
      const modal = document.getElementById(id);
      if (!modal || modal.dataset.backdropWired) return;
      modal.dataset.backdropWired = "1";
      modal.addEventListener("click", (e) => {
        // Only the backdrop itself - never a click that landed on the panel
        if (e.target !== modal) return;
        modal.classList.add("hidden");
        if (id === "port-modal") this.currentPort = null;
        if (id === "starmap-modal" && typeof Navigation !== "undefined" && Navigation.cancelFoldPicking) {
          Navigation.cancelFoldPicking();
        }
        if (typeof AudioController !== "undefined" && AudioController.playBeep) AudioController.playBeep("click");
      });
    });
  },

  // ---- Content packs -----------------------------------------------------
  // Two ways in, same gate. Packs you author go in js/content/packs/ and get
  // listed in manifest.js; packs you are handed get pasted here. Either way
  // ContentValidator runs over the merged result before anything is kept.
  //
  // Pasted packs are stored and registered as DATA. Nothing typed into that box
  // is ever executed - that is the difference between installing content and
  // running someone else's code.

  PACK_STORE: "starflight_content_packs",

  storedPacks() {
    try {
      const raw = localStorage.getItem(this.PACK_STORE);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn("Stored content packs unreadable", e);
      return [];
    }
  },

  writeStoredPacks(list) {
    try {
      localStorage.setItem(this.PACK_STORE, JSON.stringify(list));
      return true;
    } catch (e) {
      this.addLog("PACK NOT SAVED: LOCAL STORAGE REFUSED IT.");
      console.error("Could not persist content packs", e);
      return false;
    }
  },

  openPacksModal() {
    const modal = document.getElementById("packs-modal");
    if (!modal) return;
    this.renderPacks();
    const box = document.getElementById("pack-result");
    if (box) box.textContent = "";
    const file = document.getElementById("pack-file");
    if (file && !file.dataset.wired) {
      file.dataset.wired = "1";
      file.addEventListener("change", (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const rd = new FileReader();
        rd.onload = () => {
          document.getElementById("pack-json").value = String(rd.result || "");
          this.validatePastedPack();
        };
        rd.readAsText(f);
      });
    }
    modal.classList.remove("hidden");
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
  },

  closePacksModal() {
    const modal = document.getElementById("packs-modal");
    if (modal) modal.classList.add("hidden");
  },

  renderPacks() {
    const CP = window.ContentPacks;
    const inst = document.getElementById("packs-installed");
    const failCard = document.getElementById("packs-failed-card");
    const fail = document.getElementById("packs-failed");
    const count = document.getElementById("packs-count");
    if (!CP || !inst) return;

    count.textContent = `${CP.installed.length} INSTALLED / ${CP.failures.length} REJECTED`;

    if (!CP.installed.length) {
      inst.innerHTML = `<span style="color:#88ccaa;">No packs loaded. The game is running on its authored content only.</span>`;
    } else {
      const stored = this.storedPacks().map(p2 => p2.id);
      inst.innerHTML = CP.installed.map(p2 => {
        const total = Object.keys(p2.counts || {}).reduce((n, k) => n + p2.counts[k], 0);
        const what = Object.keys(p2.counts || {}).map(k => `${p2.counts[k]} ${k}`).join(", ");
        const removable = stored.indexOf(p2.id) >= 0;
        return `<div style="display:flex; align-items:center; gap:10px; padding:5px 0; border-bottom:1px solid rgba(0,255,102,0.12);">
          <div style="flex:1;">
            <div style="color:#00ccff;">${p2.name} <span style="color:#889999;">(${p2.id} v${p2.version})</span></div>
            <div style="font-size:11px; color:#aaccbb;">${total} record(s): ${what || "none"} &nbsp;|&nbsp; ${p2.source}</div>
          </div>
          ${removable
            ? `<button class="glow-btn" style="padding:2px 8px; font-size:11px;"
                 onclick="try{UI.removePack('${p2.id}')}catch(e){alert(e.message)}">REMOVE</button>`
            : `<span style="font-size:10px; color:#889999;">edit manifest.js to remove</span>`}
        </div>`;
      }).join("");
    }

    if (CP.failures.length) {
      failCard.classList.remove("hidden");
      fail.innerHTML = CP.failures.map(f => `
        <div style="padding:5px 0; border-bottom:1px solid rgba(255,85,85,0.2);">
          <div style="color:#ff8866;">${f.name || f.id}</div>
          <div style="font-size:11px; color:#ffaa99;">${f.errors.slice(0, 4).map(e => "• " + String(e).replace(/</g, "&lt;")).join("<br>")}
          ${f.errors.length > 4 ? `<br>• ...and ${f.errors.length - 4} more` : ""}</div>
        </div>`).join("");
    } else {
      failCard.classList.add("hidden");
    }
  },

  /** Parse the box. Returns { pack } or { error }. */
  readPastedPack() {
    const raw = (document.getElementById("pack-json") || {}).value || "";
    if (!raw.trim()) return { error: "Nothing to read - paste a pack or choose a file." };
    let pack;
    try {
      pack = JSON.parse(raw);
    } catch (e) {
      return { error: "That is not valid JSON.\n" + e.message };
    }
    if (!pack || typeof pack !== "object" || Array.isArray(pack)) return { error: "A pack must be a JSON object." };
    if (!pack.id) return { error: "A pack must declare an \"id\"." };
    if (!pack.add && !pack.extend) return { error: "A pack must contain \"add\" and/or \"extend\"." };
    return { pack: pack };
  },

  /** Dry run: say exactly what would happen, change nothing. */
  validatePastedPack() {
    const box = document.getElementById("pack-result");
    const read = this.readPastedPack();
    if (read.error) { box.innerHTML = `<span style="color:#ff5555;">${read.error.replace(/</g, "&lt;")}</span>`; return null; }

    const CP = window.ContentPacks;
    if (CP.isInstalled(read.pack.id)) {
      box.innerHTML = `<span style="color:#ffcc00;">"${read.pack.id}" is already installed.</span>`;
      return null;
    }

    const trial = CP.snapshot();
    const applied = CP.applyTo(trial, read.pack);
    const verdict = ContentValidator.validate(trial);
    const problems = applied.problems.concat(verdict.errors);

    if (problems.length) {
      box.innerHTML = `<span style="color:#ff5555;">REFUSED - ${problems.length} problem(s):</span><br>` +
        problems.slice(0, 8).map(e => "• " + String(e).replace(/</g, "&lt;")).join("<br>") +
        (problems.length > 8 ? `<br>• ...and ${problems.length - 8} more` : "");
      return null;
    }

    const total = Object.keys(applied.counts).reduce((n, k) => n + applied.counts[k], 0);
    const what = Object.keys(applied.counts).map(k => `${applied.counts[k]} ${k}`).join(", ");
    box.innerHTML = `<span style="color:#00ff66;">VALID - passes all ${verdict.ruleCount} content rules.</span><br>` +
      `Would add ${total} record(s): ${what}` +
      (verdict.warnings.length ? `<br><span style="color:#ffcc00;">${verdict.warnings.length} warning(s): ` +
        verdict.warnings.slice(0, 3).map(w => String(w).replace(/</g, "&lt;")).join("; ") + `</span>` : "");
    return read.pack;
  },

  installPastedPack() {
    const pack = this.validatePastedPack();
    if (!pack) return false;

    const list = this.storedPacks();
    list.push(pack);
    if (!this.writeStoredPacks(list)) return false;

    const box = document.getElementById("pack-result");
    box.innerHTML = `<span style="color:#00ff66;">INSTALLED. Reload to bring "${pack.name || pack.id}" into the galaxy.</span>`;
    this.addLog(`CONTENT PACK INSTALLED: ${String(pack.name || pack.id).toUpperCase()}. RELOAD TO APPLY.`);
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('powerup');
    this.renderPacks();
    return true;
  },

  removePack(id) {
    const list = this.storedPacks().filter(p2 => p2.id !== id);
    if (!this.writeStoredPacks(list)) return false;
    this.addLog(`CONTENT PACK REMOVED: ${String(id).toUpperCase()}. RELOAD TO APPLY.`);
    const box = document.getElementById("pack-result");
    if (box) box.innerHTML = `<span style="color:#ffcc00;">Removed "${id}". Reload to apply.</span>`;
    this.renderPacks();
    return true;
  },

  // ---- Region labelling --------------------------------------------------
  // A coordinate pair means nothing on its own now that there are four separate
  // volumes of space. (205, 375) is a Corps beacon in the Shattered Reach and
  // empty sky in the Corps Quadrant. Anything that quotes coordinates has to say
  // which chart they are on.

  regionName(regionId) {
    const r = (typeof RegionManager !== "undefined") ? RegionManager.get(regionId || "core") : null;
    return (r && r.name) || String(regionId || "core").toUpperCase();
  },

  /** "(205, 375) - THE SHATTERED REACH", with the region marked if it is not here. */
  coordLabel(x, y, regionId) {
    const rid = regionId || "core";
    const here = (typeof RegionManager !== "undefined") ? RegionManager.currentId() : "core";
    const name = this.regionName(rid).toUpperCase();
    return `(${x}, ${y}) - ${name}${rid === here ? "" : " [NOT THIS REGION]"}`;
  },

  /**
   * Every system logged anywhere, not just in the region the ship happens to be
   * standing in. discoveredSystems is region-scoped, so the Captain's Log used to
   * silently drop every system charted in the other three quadrants.
   */
  allDiscoveredSystems() {
    const ship = window.game && window.game.ship;
    if (!ship || typeof RegionManager === "undefined") return [];
    const here = RegionManager.currentId();
    const out = [];

    Object.keys(RegionManager.all()).forEach(rid => {
      // Live working copy for the active region, stashed record for the others
      const record = (rid === here) ? ship : ((ship.regions && ship.regions[rid]) || {});
      const names = Object.keys(record.discoveredSystems || {});
      if (!names.length) return;

      const systems = (rid === "core")
        ? (GameData.starSystems || [])
        : ((RegionManager.get(rid) || {}).starSystems || []);

      names.forEach(n => {
        const sys = systems.find(sy => sy.name === n);
        if (sys) out.push({ regionId: rid, regionName: this.regionName(rid), sys: sys, here: rid === here });
      });
    });

    return out;
  },

  // ---- Ship's locker -----------------------------------------------------
  // One-use equipment lives here rather than in the cargo hold, because it is not
  // cargo: it does not take hold space, cannot be sold to an alien port by
  // accident, and Customs has no opinion about it.

  // What pressing USE will actually do, said in the locker rather than left for
  // the captain to find out by spending the item.
  LOCKER_HOWTO: {
    fold: "USE asks whether to aim. OK opens the chart - click a charted system in THIS region and the " +
          "fold fires there. Cancel fires it blind. It cannot cross a singularity into another region. " +
          "The charge is only spent when it fires.",
    survey: "USE launches the drone immediately and charts everything within 160 LY.",
    refuel: "USE breaks the seal and pumps 40 Endurium into the tank.",
    repair: "USE patches 60 points of hull, in the field.",
    shields: "USE dumps the capacitor bank straight into the deflectors.",
    cloak: "USE runs the baffle for two minutes. Nothing acquires, hails or scans you."
  },

  openLockerModal() {
    const modal = document.getElementById("locker-modal");
    if (!modal) return;
    this.renderLocker();
    modal.classList.remove("hidden");
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
  },

  closeLockerModal() {
    const modal = document.getElementById("locker-modal");
    if (modal) modal.classList.add("hidden");
  },

  renderLocker() {
    const box = document.getElementById("locker-body");
    if (!box || typeof Consumables === "undefined") return;
    const inv = Consumables.inventory();

    if (!inv.length) {
      box.innerHTML = `<span style="color:#88ccaa;">The locker is empty. One-use equipment is sold at the ` +
                      `Starbase Prime chandlery, and found more often than it is bought.</span>`;
      return;
    }

    box.innerHTML = inv.map(row => {
      const blocked = Consumables.blockedReason(row.item);
      return `<div style="display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid rgba(0,255,102,0.12);">
        <span style="font-size:20px;">${row.item.icon}</span>
        <div style="flex:1;">
          <div style="color:#00ccff;">${row.item.name.toUpperCase()} <span style="color:#88ccaa;">x${row.count}</span></div>
          <div style="font-size:11px; color:#aaccbb;">${row.item.desc}</div>
          ${!blocked && this.LOCKER_HOWTO[row.item.effect]
            ? `<div style="font-size:11px; color:#ffcc00;">${this.LOCKER_HOWTO[row.item.effect]}</div>` : ""}
          ${blocked ? `<div style="font-size:11px; color:#ff8866;">${blocked}</div>` : ""}
        </div>
        <button class="glow-btn ${blocked ? "" : "green-glow"}" ${blocked ? "disabled" : ""}
          onclick="try{UI.useFromLocker('${row.item.id}')}catch(e){alert('LOCKER FAILED: '+e.message)}">USE</button>
      </div>`;
    }).join("");
  },

  useFromLocker(id) {
    if (typeof Consumables === "undefined") return;
    const before = Consumables.count(id);
    const used = Consumables.use(id);
    // A fold charge opens the chart and is spent later, so close the locker to get
    // out of the way whether or not it reported success.
    if (used || Consumables.count(id) !== before || Navigation.foldPicking) this.closeLockerModal();
    else this.renderLocker();
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
    } else if (signal.event === "corps_beacon") {
      html += `
        <button class="glow-btn green-glow" onclick="UI.handleDistressOption('read_beacon')">DECODE THE FINAL TRANSMISSION (RECOVERS: SURVEY CHART & SHIP'S LOG)</button>
        <button class="glow-btn" onclick="UI.handleDistressOption('ignore')">LEAVE IT TRANSMITTING</button>
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
      this.mergeProbeTelemetry(sig);
      if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('powerup');
    } else if (choiceKey === "rescue_pod") {
      ship.credits += 800;
      if (sig) { sig.active = false; if (window.game && window.game.markSalvaged) window.game.markSalvaged(sig.id); }
      this.addLog("CRYO-POD RECOVERED: Rescued stranded specialist navigator. Received 800 M.U. Starbase bounty!");
      if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('powerup');
    } else if (choiceKey === "read_beacon") {
      // A derelict Corps beacon is a record, not a bounty. What it is worth is the
      // survey it died carrying - out here that chart is the only one there is.
      const bounty = (sig && sig.bounty) || 300;
      ship.credits += bounty;
      if (sig) { sig.active = false; if (window.game && window.game.markSalvaged) window.game.markSalvaged(sig.id); }
      this.addLog(`BEACON DECODED: Recovered the survey's final transmission. ${bounty} M.U. records bounty pending at Starbase Prime.`);
      this.mergeProbeTelemetry(sig);
      if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('powerup');
    }

    // Any beacon may carry a clue, whatever its event type. Authored as data on
    // the signal so a new beacon is a content record, never an edit here.
    if (choiceKey !== "ignore" && sig && sig.grantsClue && typeof ClueLog !== "undefined") {
      const c = sig.grantsClue;
      if (ClueLog.record(Object.assign({ source: "beacon", sourceName: sig.name }, c))) {
        this.addLog(`INTELLIGENCE LOGGED: ${String(c.title || c.id).toUpperCase()} - SEE CAPTAIN'S LOG.`);
      }
    }
    if (choiceKey !== "ignore" && sig && typeof QuestEngine !== "undefined") {
      QuestEngine.notify("beacon", { signalId: sig.id, event2: sig.event });
    }
    // A call that came in over the band stops being tracked once it is answered,
    // and any cutter sent to it stands down.
    if (choiceKey !== "ignore" && sig && sig.dynamic && typeof DistressNet !== "undefined") {
      DistressNet.resolve(sig.id);
    }

    this.closeDistressModal();
  },

  /**
   * Fold a salvaged probe's survey data into the captain's chart. The button has
   * always promised "MAP DISCOVERIES" and the handler never granted any - this is
   * the reveal that was advertised but never wired.
   */
  mergeProbeTelemetry(sig) {
    const radius = (sig && sig.chartRadius) || 90;
    const charted = (typeof Navigation !== "undefined" && Navigation.revealSectorsWithin)
      ? Navigation.revealSectorsWithin(radius) : 0;
    this.addLog(charted > 0
      ? `TELEMETRY MERGED: ${charted} NEW SECTORS CHARTED FROM THE PROBE'S SURVEY RUN.`
      : "TELEMETRY MERGED: THE PROBE'S SURVEY COVERS SPACE ALREADY CHARTED.");
    if (window.game && window.game.saveGame) window.game.saveGame();
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

    // Say up front when fitting this would be wasted, rather than after the module
    // has been consumed. A capped module is worth real credits sold instead.
    const redundant = this.techPartRedundantReason(techPart);
    const value = document.getElementById("techpart-value");
    if (redundant && value) {
      const repeat = redundant.indexOf("REPEAT:") === 0;
      value.innerHTML = `<span style="color:${repeat ? "#ffcc00" : "#ff5555"};">` +
        `${repeat ? "ALREADY ABOARD" : "NO BENEFIT"}</span> - SALVAGE VALUE: ${techPart.value || 2500} M.U.`;
    }

    // The offer itself changes for structural work, so the button must not keep
    // promising an immediate fit it is not going to perform.
    const docked = !!(window.game && window.game.ship && window.game.ship.isInSpacebase);
    const btn = document.getElementById("btnInstallTechPart");
    const proto = document.getElementById("techpart-protocol");
    if (redundant) {
      const repeat = redundant.indexOf("REPEAT:") === 0;
      const body = repeat ? redundant.slice(7) : redundant;
      if (btn) btn.textContent = repeat ? "⚡ INSTALL ANYWAY" : "⚠ INSTALL ANYWAY (NO EFFECT)";
      if (proto) proto.textContent = body +
        ` Stored in the hold it sells for ${(techPart.value || 2500).toLocaleString()} M.U. at Starbase Prime.`;
    } else if (techPart.requiresDrydock && !docked) {
      if (btn) btn.textContent = "\u{1F527} STOW FOR DRYDOCK FITTING";
      if (proto) proto.textContent =
        "This is structural work. It cannot be fitted between stars - the mount has to be cut, " +
        "or the plate bonded, or the hold cut open, and none of that is done under way. Stow it and the " +
        "Starbase Prime engineering bay will fit it when you dock. You can also sell it instead.";
    } else {
      if (btn) btn.textContent = "⚡ INSTALL IMMEDIATELY ON SHIP";
      if (proto) proto.textContent =
        "You can install this rare tech module directly onto ISS Odyssey right now for a permanent " +
        "performance boost, or store it in your cargo hold to sell for credits at Starbase Prime.";
    }

    modal.classList.remove("hidden");
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
  },

  closeTechPartModal() {
    const modal = document.getElementById("techpart-modal");
    if (modal) modal.classList.add("hidden");
  },

  /**
   * Apply a module's permanent effect. Split out of installCurrentTechPart so the
   * drydock can run exactly the same fitting later, rather than a second copy of
   * it that would drift out of sync.
   */
  /**
   * Would fitting this module actually change anything? A Sensor Amplifier on a
   * Class 4 scanner, or a second Warp Conduit on a Class 5 engine, installs
   * cleanly and does nothing - the capped branches already said so in the log,
   * but only AFTER the module was consumed. This lets the modal say it first.
   *
   * Returns null when the fitting is worthwhile, or a reason string when it is not.
   */
  techPartRedundantReason(part) {
    const ship = window.game.ship;
    if (!part) return null;
    const already = Array.isArray(ship.installedTechParts) && ship.installedTechParts.indexOf(part.id) >= 0;

    if (part.effect === "engine_boost" && (ship.engineLevel || 1) >= 5) {
      return "The engine is already Class 5. Fitting this would gain nothing.";
    }
    if (part.effect === "weapon_boost" && (ship.blasterLevel || 1) >= 5) {
      return "Blasters are already Class 5. Fitting this would gain nothing.";
    }
    if (part.effect === "scanner_boost" && (ship.scannerLevel || 1) >= 4) {
      return "The scanner array is already at maximum class. Fitting this would gain nothing.";
    }
    // Shield, hull and cargo modules stack without a cap, so a second one is
    // still worth fitting - say it is a repeat, but do not call it a waste.
    if (already) {
      return "REPEAT:One of these is already fitted. Another will stack, but check you would not rather sell it.";
    }
    return null;
  },

  applyTechPartEffect(part) {
    const ship = window.game.ship;
    if (!part) return;

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
  },

  /**
   * Some modules cannot be fitted between stars. Splicing an amplifier into the
   * sensor loom is field work; re-cutting an engine mount, bonding hull plate or
   * cutting the hold open to fold it is not. Those are stowed and fitted at
   * Starbase Prime, which gives the flight home a reason beyond selling ore.
   */
  installCurrentTechPart() {
    if (!this.currentTechPart) return;
    const part = this.currentTechPart;
    const ship = window.game.ship;

    // Only block on a genuine dead end - a stacking repeat is a real choice and
    // does not need a second prompt after the modal already flagged it.
    const redundant = this.techPartRedundantReason(part);
    if (redundant && redundant.indexOf("REPEAT:") !== 0) {
      if (!confirm(`${part.name.toUpperCase()}\n\n${redundant}\n\n` +
                   `Sold at Starbase Prime it is worth ${(part.value || 2500).toLocaleString()} M.U.\n\n` +
                   `Install it anyway?`)) {
        this.addLog(`${part.name.toUpperCase()} LEFT UNFITTED - THE SYSTEM IT UPGRADES IS ALREADY AT MAXIMUM.`);
        return;
      }
    }

    if (part.requiresDrydock && !ship.isInSpacebase) {
      if (!Array.isArray(ship.pendingModules)) ship.pendingModules = [];
      ship.pendingModules.push(part.id || part.name);
      this.addLog(`${part.name.toUpperCase()} SECURED IN THE HOLD. THIS IS DRYDOCK WORK - IT CANNOT BE FITTED UNDER WAY.`);
      this.addLog("REPORT TO STARBASE PRIME ENGINEERING BAY TO HAVE IT INSTALLED.");
      if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
      this.updateShip(ship);
      window.game.saveGame();
      this.closeTechPartModal();
      return;
    }

    this.applyTechPartEffect(part);
    this.closeTechPartModal();
  },

  storeCurrentTechPartInCargo() {
    if (!this.currentTechPart) return;
    const part = this.currentTechPart;
    const ship = window.game.ship;

    if (!ship.cargo) ship.cargo = {};
    const itemKey = part.id;
    ship.cargo[itemKey] = (ship.cargo[itemKey] || 0) + 1;

    // Modules are registered as commodities at boot (see the bottom of data.js),
    // so this is only a safety net for a part added at runtime. Note the field is
    // sellVal, not `price` - the old version wrote `price`, which nothing reads,
    // so a stored module had no sale value anywhere in the game.
    if (!GameData.commodities[itemKey]) {
      GameData.commodities[itemKey] = {
        name: part.name,
        sellVal: Math.round((part.value || 2500) * 0.4),
        buyVal: part.value || 2500,
        mass: 1.0,
        isSalvagedModule: true
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

  planetSurvey(name) {
    const ship = window.game.ship;
    return (ship.planetSurveys && ship.planetSurveys[name]) ||
           { scanned: false, landed: false, landings: 0, minerals: [], bio: [], ruins: 0, ruinsEmpty: 0, artifacts: [], wrecks: 0, profile: null };
  },

  toggleLogSystem(sysName) {
    if (!this.expandedSystems) this.expandedSystems = {};
    this.expandedSystems[sysName] = !this.expandedSystems[sysName];
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('click');
    this.renderCaptainsLog('systems');
  },

  /**
   * Three tiers of knowledge per world, so the log reflects how far you actually
   * took the investigation rather than dumping the data file.
   */
  renderSystemPlanets(planets) {
    if (!planets.length) return '';
    let out = '<div style="margin-top:10px; border-top:1px solid rgba(0,255,102,0.25); padding-top:8px;">';

    planets.forEach(p => {
      const sv = this.planetSurvey(p.name);
      const nameCol = sv.landed ? '#00ff66' : (sv.scanned ? '#00e5ff' : '#888888');
      const state = sv.landed ? `DESCENT x${sv.landings}` : (sv.scanned ? 'SCANNED' : 'UNSURVEYED');

      out += `<div style="margin-bottom:10px;">
        <strong style="color:${nameCol};">🪐 ${p.name.toUpperCase()}</strong>
        <span style="font-size:10px; color:#88ccaa;"> — ${state}</span><br>`;

      if (!sv.scanned && !sv.landed) {
        out += `<span style="font-size:11px; color:#666;">Orbital elements only. Enter orbit and SCAN to survey.</span>`;
      } else {
        out += `<span style="font-size:11px; color:#aaccbb;">
          ${sv.profile || 'Unclassified'} &nbsp;|&nbsp; ${p.atmosphere || 'Unknown'} atmosphere &nbsp;|&nbsp;
          ${p.gravity}g &nbsp;|&nbsp; ${p.temp}&deg;C<br>
          Mineral richness ${Math.round((p.minerals || 0) * 100)}% &nbsp;|&nbsp; Biosphere ${Math.round((p.bio || 0) * 100)}%
          ${p.hasRuins ? ' &nbsp;|&nbsp; <span style="color:#ffcc00;">PRECURSOR RUIN SIGNATURES</span>' : ''}
        </span>`;

        if (sv.landed) {
          const named = keys => keys.map(k => (GameData.commodities[k] || { name: k }).name).join(', ');
          out += `<div style="font-size:11px; margin-top:4px; color:#88ccaa;">`;
          out += sv.minerals.length
            ? `⛏️ Minerals recovered: <span style="color:#ffcc00;">${named(sv.minerals)}</span><br>`
            : `⛏️ No minerals recovered yet.<br>`;
          out += sv.bio.length
            ? `🧬 Biologicals recovered: <span style="color:#66ffaa;">${named(sv.bio)}</span><br>`
            : `🧬 No biologicals recovered yet.<br>`;
          if (sv.artifacts.length) out += `🏛️ Artifacts: <span style="color:#00e5ff;">${sv.artifacts.join(', ')}</span><br>`;
          if (sv.ruinsEmpty) out += `🏛️ Interment chambers found empty: ${sv.ruinsEmpty}<br>`;
          if (sv.wrecks) out += `🛸 Wrecks salvaged: ${sv.wrecks}<br>`;
          out += `</div>`;
        } else {
          out += `<div style="font-size:11px; margin-top:4px; color:#666;">No descent logged — land to catalogue surface resources.</div>`;
        }
      }
      out += '</div>';
    });

    return out + '</div>';
  },

  renderCaptainsLog(tabName) {
    const ship = window.game ? window.game.ship : null;
    if (!ship) return;

    if (tabName === 'systems') {
      const panel = document.getElementById('log-panel-systems');
      if (!panel) return;
      const logged = this.allDiscoveredSystems();
      if (logged.length === 0) {
        panel.innerHTML = `<div class="log-card"><div class="log-card-body">No star systems logged in chart computer yet.</div></div>`;
        return;
      }
      // Group by region. The log used to read only the ACTIVE region's record, so
      // everything charted in the other quadrants vanished from it the moment the
      // ship went through a fold.
      const byRegion = {};
      logged.forEach(row => { (byRegion[row.regionId] = byRegion[row.regionId] || []).push(row); });
      // Systems expand to show their worlds, and each world shows progressively
      // more the further you took the investigation: orbit data, then scan
      // readings, then what the rover actually brought back.
      let html = '';
      Object.keys(byRegion).forEach(rid => {
        const rows = byRegion[rid];
        const isHere = rows[0].here;
        html += `<div style="color:${isHere ? '#00ff66' : '#88ccaa'}; font-weight:bold; margin:12px 0 6px; ` +
                `border-bottom:1px dashed rgba(0,255,102,0.25); padding-bottom:4px;">` +
                `🗺 ${rows[0].regionName.toUpperCase()}` +
                `${isHere ? ' <span style="color:#ffcc00;">- VESSEL HERE</span>' : ''}` +
                ` <span style="color:#889999; font-weight:normal;">(${rows.length} logged)</span></div>`;

      rows.forEach(row => {
        const sys = row.sys;
        const sysName = sys.name;
        const open = this.expandedSystems && this.expandedSystems[sysName];
        const planets = sys.planets || [];
        const surveyed = planets.filter(p => this.planetSurvey(p.name).scanned || this.planetSurvey(p.name).landed).length;

        html += `
          <div class="log-card">
            <div class="log-card-header" style="cursor:pointer;" onclick="UI.toggleLogSystem('${sysName.replace(/'/g, "\\'")}')">
              <span>${open ? '▼' : '▶'} ⭐ ${sys.name.toUpperCase()} SYSTEM</span>
              <span style="color:#ffcc00;">${this.coordLabel(sys.x, sys.y, row.regionId)} &nbsp; ${surveyed}/${planets.length} SURVEYED</span>
            </div>
            <div class="log-card-body">
              Primary Star: Class ${sys.starClass || 'M'} &nbsp;|&nbsp; ${planets.length} orbiting bodies<br>
              <span style="font-size:11px; color:#88ccaa;">${sys.descr || ''}</span>
              ${open ? this.renderSystemPlanets(planets) : `<br><span style="font-size:11px; color:#ffcc00;">Click to expand planetary records.</span>`}
            </div>
          </div>`;
      });
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
              <span style="color:#88ccaa; font-size:10px;">${c.sourceName || src.label} &nbsp;|&nbsp; ${this.regionName(c.region).toUpperCase()}</span>
            </div>
            <div class="log-card-body">
              ${c.text}
              ${c.coords ? `<br><span style="color:#ffcc00; font-weight:bold;">REFERENCED COORDINATES: ${this.coordLabel(c.coords.x, c.coords.y, c.region)}</span>` : ''}
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
