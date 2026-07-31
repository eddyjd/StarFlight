/**
 * Spaceport Controller for StarFlight: Odyssey
 * Handles Starbase Operations: Depot upgrades, crew hiring/training, lore databases, and launch validation.
 */

const Spaceport = {
  activeTab: "depot",

  init() {
    this.setupListeners();
    this.renderAll();
  },

  setupListeners() {
    // Tab switching buttons in Spaceport
    const tabs = document.querySelectorAll("#view-spaceport .spaceport-nav-menu .menu-item");
    tabs.forEach(tab => {
      tab.addEventListener("click", (e) => {
        const action = e.target.getAttribute("data-action");
        AudioController.playBeep('click');
        
        if (action === "launch") {
          this.launchShip();
          return;
        }

        if (action === "reset") {
          window.game.resetGame();
          return;
        }

        if (action === "export-save") {
          window.game.exportSaveFile();
          return;
        }

        if (action === "import-save") {
          const fileInput = document.getElementById("importFileInput");
          if (fileInput) fileInput.click();
          return;
        }

        // Deactivate all tabs
        tabs.forEach(t => t.classList.remove("active"));
        e.target.classList.add("active");

        // Show subview panels
        document.getElementById("spaceport-depot").classList.remove("active");
        document.getElementById("spaceport-personnel").classList.remove("active");
        const marketPanel = document.getElementById("spaceport-market");
        if (marketPanel) marketPanel.classList.remove("active");
        document.getElementById("spaceport-hq").classList.remove("active");

        this.activeTab = action;
        const targetPanel = document.getElementById(`spaceport-${action}`);
        if (targetPanel) targetPanel.classList.add("active");
        this.renderTab(action);
      });
    });
  },

  resetTabs() {
    const tabs = document.querySelectorAll("#view-spaceport .spaceport-nav-menu .menu-item");
    tabs.forEach(t => {
      const act = t.getAttribute("data-action");
      if (act === "depot") {
        t.classList.add("active");
      } else if (act !== "launch" && act !== "reset") {
        t.classList.remove("active");
      }
    });

    document.getElementById("spaceport-depot").classList.add("active");
    document.getElementById("spaceport-personnel").classList.remove("active");
    const marketPanel = document.getElementById("spaceport-market");
    if (marketPanel) marketPanel.classList.remove("active");
    document.getElementById("spaceport-hq").classList.remove("active");
    this.activeTab = "depot";
  },

  renderAll() {
    this.resetTabs();
    this.renderTab("depot");
    this.renderTab("personnel");
    this.renderTab("market");
    this.renderTab("hq");
  },

  renderTab(tab) {
    if (tab === "depot") {
      this.renderDepot();
    } else if (tab === "personnel") {
      this.renderPersonnel();
    } else if (tab === "market") {
      this.renderMarket();
    } else if (tab === "hq") {
      this.renderHqLogs();
    }
  },

  renderMarket() {
    const container = document.getElementById("spaceport-market");
    if (!container) return;

    const ship = window.game.ship;
    const commodities = GameData.commodities;

    let totalWorth = 0;
    let itemsCount = 0;
    let rowsHtml = "";

    Object.keys(ship.cargo).forEach(itemKey => {
      const qty = ship.cargo[itemKey];
      if (qty > 0) {
        const itemData = commodities[itemKey] || { name: itemKey, sellVal: 50, mass: 1 };
        const unitVal = itemData.sellVal;
        const subtotal = unitVal * qty;
        totalWorth += subtotal;
        itemsCount += qty;

        rowsHtml += `
          <div class="depot-item" style="display:flex; justify-content:space-between; align-items:center;">
            <div class="depot-info">
              <span class="depot-name">${itemData.name.toUpperCase()} (x${qty})</span>
              <span class="depot-desc">Unit Value: ${unitVal} M.U. | Mass: ${itemData.mass} T each</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="depot-cost" style="color:var(--primary-color); font-weight:bold;">${subtotal.toLocaleString()} M.U.</span>
              <button class="glow-btn sell-one-btn" data-item="${itemKey}">SELL 1</button>
              <button class="glow-btn green-glow sell-all-item-btn" data-item="${itemKey}">SELL ALL (${qty})</button>
            </div>
          </div>
        `;
      }
    });

    let html = `
      <h3>COMMODITY EXCHANGE & CARGO MARKET</h3>
      <div style="border-bottom:1px dashed rgba(0,255,102,0.3); padding-bottom:10px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <span style="color:var(--secondary-color); font-size:11px;">CARGO MANIFEST TOTAL: <strong>${itemsCount} ITEMS</strong></span>
          <span style="margin-left:15px; color:var(--primary-color); font-size:11px;">TOTAL VALUE: <strong>${totalWorth.toLocaleString()} M.U.</strong></span>
        </div>
        <button id="btn-sell-everything" class="glow-btn green-glow" ${itemsCount === 0 ? "disabled" : ""}>SELL ALL CARGO (${totalWorth.toLocaleString()} M.U.)</button>
      </div>
      <div class="depot-list">
    `;

    if (itemsCount === 0) {
      html += `<div style="text-align:center; padding:30px; color:rgba(0,255,102,0.4);">YOUR CARGO HOLD IS EMPTY. LAND ON PLANETS TO MINE MINERALS & BIO SAMPLES OR TRADE WITH ALIEN SPECIES TO EARN CREDITS.</div>`;
    } else {
      html += rowsHtml;
    }

    html += `</div>`;
    container.innerHTML = html;

    // Connect sell action listeners
    const sellEverythingBtn = document.getElementById("btn-sell-everything");
    if (sellEverythingBtn) {
      sellEverythingBtn.addEventListener("click", () => this.sellAllCargo());
    }

    container.querySelectorAll(".sell-one-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const itemKey = e.target.getAttribute("data-item");
        this.sellCargoItem(itemKey, 1);
      });
    });

    container.querySelectorAll(".sell-all-item-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const itemKey = e.target.getAttribute("data-item");
        const qty = ship.cargo[itemKey] || 0;
        this.sellCargoItem(itemKey, qty);
      });
    });
  },

  sellCargoItem(itemKey, count) {
    const ship = window.game.ship;
    const currentQty = ship.cargo[itemKey] || 0;
    if (currentQty <= 0) return;

    const toSell = Math.min(currentQty, count);
    const itemData = GameData.commodities[itemKey] || { name: itemKey, sellVal: 50 };
    const earned = itemData.sellVal * toSell;

    ship.cargo[itemKey] -= toSell;
    if (ship.cargo[itemKey] <= 0) {
      delete ship.cargo[itemKey];
    }

    ship.credits += earned;
    AudioController.playBeep('success');
    UI.addLog(`COMMODITY EXCHANGED: Sold ${toSell}x ${itemData.name.toUpperCase()} for +${earned.toLocaleString()} M.U.`);

    UI.updateShip(ship);
    this.renderMarket();
    window.game.saveGame();
  },

  sellAllCargo() {
    const ship = window.game.ship;
    const commodities = GameData.commodities;

    let totalEarned = 0;
    let totalItems = 0;

    Object.keys(ship.cargo).forEach(itemKey => {
      const qty = ship.cargo[itemKey];
      if (qty > 0) {
        const itemData = commodities[itemKey] || { name: itemKey, sellVal: 50 };
        totalEarned += itemData.sellVal * qty;
        totalItems += qty;
      }
    });

    if (totalItems === 0) return;

    ship.cargo = {};
    ship.credits += totalEarned;
    AudioController.playBeep('success');
    UI.addLog(`COMMODITY MARKET: Liquidated full cargo manifest (${totalItems} items) for +${totalEarned.toLocaleString()} M.U.!`);

    UI.updateShip(ship);
    this.renderMarket();
    window.game.saveGame();
  },

  // Render Depot: Fuel, Ammo, upgrades
  renderDepot() {
    const container = document.getElementById("spaceport-depot");
    const ship = window.game.ship;
    
    let html = `
      <h3>SHIP REPAIR AND UPGRADE DEPOT</h3>
      <div class="depot-actions-bar" style="display:flex; gap:10px; margin-bottom:15px; border-bottom:1px dashed rgba(0,255,102,0.3); padding-bottom:10px;">
        <button id="btn-depot-fuel" class="glow-btn">BUY FUEL (15 M.U. / UNIT)</button>
        <button id="btn-depot-ammo" class="glow-btn">BUY MISSILE AMMO (50 M.U. / UNIT)</button>
      </div>
      <div class="depot-list">
    `;

    // Engine upgrading
    html += this.createUpgradeRow("engines", "ENGINES", ship.engineLevel, GameData.upgrades.engines);
    // Shield upgrading
    html += this.createUpgradeRow("shields", "SHIELD MATRICES", ship.shieldLevel, GameData.upgrades.shields);
    // Armor upgrading
    html += this.createUpgradeRow("armor", "HULL PLATING", ship.armorLevel, GameData.upgrades.armor);
    // Blaster upgrading
    html += this.createUpgradeRow("blasters", "BLASTERS (LASER)", ship.blasterLevel, GameData.upgrades.blasters);
    // Missile launcher upgrading
    html += this.createUpgradeRow("missiles", "MISSILE LAUNCHERS", ship.missileLevel, GameData.upgrades.missiles);
    // Scanner upgrading
    html += this.createUpgradeRow("scanners", "SENSOR SCAN SYSTEMS", ship.scannerLevel, GameData.upgrades.scanners);
    // Cargo upgrading
    html += this.createUpgradeRow("cargos", "CARGO BAY EXPANSIONS", ship.cargoLevel, GameData.upgrades.cargos);

    // Rover upgrades
    html += `
      <h4 style="margin: 10px 0 5px 0; color:var(--secondary-color); font-size:11px;">TERRAIN EXPLORATION ROVER (TV) CONFIGURATION</h4>
    `;
    html += this.createTvUpgradeRow("engine", "ROVER MOTOR", ship.tvUpgrades.engine, GameData.upgrades.tvUpgrades.engine);
    html += this.createTvUpgradeRow("armor", "ROVER PLATING", ship.tvUpgrades.armor, GameData.upgrades.tvUpgrades.armor);
    html += this.createTvUpgradeRow("blaster", "ROVER LAZER TURRET", ship.tvUpgrades.blaster, GameData.upgrades.tvUpgrades.blaster);
    html += this.createTvUpgradeRow("cargo", "ROVER CARGO CONTAINER", ship.tvUpgrades.cargo, GameData.upgrades.tvUpgrades.cargo);

    if (!ship.launchConfig) ship.launchConfig = { autoShields: true, autoWeapons: true };

    // Launch preparedness configuration
    html += `
      <h4 style="margin: 15px 0 5px 0; color:var(--secondary-color); font-size:11px;">LAUNCH DEPLOYMENT PROTOCOL CONFIGURATION</h4>
      <div style="display:flex; gap:10px; margin-bottom:15px; border-bottom:1px dashed rgba(0,255,102,0.3); padding-bottom:10px;">
        <button id="btn-toggle-auto-shields" class="glow-btn ${ship.launchConfig.autoShields ? 'green-glow' : ''}">
          AUTO-RAISE SHIELDS ON LAUNCH: ${ship.launchConfig.autoShields ? 'ON' : 'OFF'}
        </button>
        <button id="btn-toggle-auto-weapons" class="glow-btn ${ship.launchConfig.autoWeapons ? 'red-glow' : ''}">
          AUTO-ARM WEAPONS ON LAUNCH: ${ship.launchConfig.autoWeapons ? 'ON' : 'OFF'}
        </button>
      </div>
    `;

    html += `</div>`;
    container.innerHTML = html;

    // Depot event handlers
    document.getElementById("btn-depot-fuel").addEventListener("click", () => this.buyFuel());
    document.getElementById("btn-depot-ammo").addEventListener("click", () => this.buyAmmo());

    document.getElementById("btn-toggle-auto-shields").addEventListener("click", () => {
      ship.launchConfig.autoShields = !ship.launchConfig.autoShields;
      AudioController.playBeep('click');
      UI.addLog(`LAUNCH PROTOCOL UPDATED: Auto-Raise Shields set to ${ship.launchConfig.autoShields ? 'ON' : 'OFF'}.`);
      this.renderDepot();
      window.game.saveGame();
    });

    document.getElementById("btn-toggle-auto-weapons").addEventListener("click", () => {
      ship.launchConfig.autoWeapons = !ship.launchConfig.autoWeapons;
      AudioController.playBeep('click');
      UI.addLog(`LAUNCH PROTOCOL UPDATED: Auto-Arm Weapons set to ${ship.launchConfig.autoWeapons ? 'ON' : 'OFF'}.`);
      this.renderDepot();
      window.game.saveGame();
    });

    // Connect upgrading click listeners
    const upgradeBtns = container.querySelectorAll(".buy-upgrade-btn");
    upgradeBtns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        const category = e.target.getAttribute("data-cat");
        const isTv = e.target.getAttribute("data-tv") === "true";
        this.purchaseUpgrade(category, isTv);
      });
    });
  },

  createUpgradeRow(category, title, currentLevel, list) {
    const nextIdx = currentLevel; // List index starts at 0, level matches next index if 1-based or offset
    let currentName = "None";
    let isMaxed = false;
    let nextUpgrade = null;

    // Search for current item details
    const currItem = list.find(u => u.level === currentLevel);
    if (currItem) currentName = currItem.name;

    // Find next upgrade
    nextUpgrade = list.find(u => u.level === currentLevel + 1);
    if (!nextUpgrade) {
      isMaxed = true;
    }

    if (isMaxed) {
      return `
        <div class="depot-item maxed">
          <div class="depot-info">
            <span class="depot-name">${title}: ${currentName}</span>
            <span class="depot-desc">Level Maxed out. Optimal capacity reached.</span>
          </div>
          <button class="glow-btn green-glow" disabled>MAX LEVEL</button>
        </div>
      `;
    } else {
      return `
        <div class="depot-item">
          <div class="depot-info">
            <span class="depot-name">${title}: ${currentName} &rarr; ${nextUpgrade.name}</span>
            <span class="depot-desc">${nextUpgrade.desc}</span>
            <span class="depot-cost">Cost: ${nextUpgrade.cost} M.U.</span>
          </div>
          <button class="glow-btn buy-upgrade-btn" data-cat="${category}" data-tv="false">BUY UPGRADE</button>
        </div>
      `;
    }
  },

  createTvUpgradeRow(category, title, currentLevel, list) {
    const nextUpgrade = list.find(u => u.level === currentLevel + 1);
    const currItem = list.find(u => u.level === currentLevel) || { name: "None" };
    const isMaxed = !nextUpgrade;

    if (isMaxed) {
      return `
        <div class="depot-item maxed">
          <div class="depot-info">
            <span class="depot-name">${title}: ${currItem.name}</span>
            <span class="depot-desc">Level Maxed. Rover component at max density.</span>
          </div>
          <button class="glow-btn green-glow" disabled>MAX LEVEL</button>
        </div>
      `;
    } else {
      return `
        <div class="depot-item">
          <div class="depot-info">
            <span class="depot-name">${title}: ${currItem.name} &rarr; ${nextUpgrade.name}</span>
            <span class="depot-desc">${nextUpgrade.desc}</span>
            <span class="depot-cost">Cost: ${nextUpgrade.cost} M.U.</span>
          </div>
          <button class="glow-btn buy-upgrade-btn" data-cat="${category}" data-tv="true">BUY UPGRADE</button>
        </div>
      `;
    }
  },

  // Perform purchase upgrading logic
  purchaseUpgrade(category, isTv) {
    const game = window.game;
    const ship = game.ship;

    if (isTv) {
      const tvList = GameData.upgrades.tvUpgrades[category];
      const curLvl = ship.tvUpgrades[category];
      const nextUpgrade = tvList.find(u => u.level === curLvl + 1);
      
      if (!nextUpgrade) return;
      if (ship.credits < nextUpgrade.cost) {
        AudioController.playBeep('error');
        UI.addLog("Purchase denied: Insufficient Megacredits (M.U.).");
        return;
      }

      ship.credits -= nextUpgrade.cost;
      ship.tvUpgrades[category] = nextUpgrade.level;
      
      // Update cargo cap of TV if cargo upgrades
      if (category === "cargo") {
        ship.tvCargoCap = nextUpgrade.cap;
      }

      AudioController.playBeep('success');
      UI.addLog(`TV component upgraded: ${category.toUpperCase()} to ${nextUpgrade.name}.`);
    } else {
      const upgradeList = GameData.upgrades[category];
      let curLvl = 0;
      
      if (category === "engines") curLvl = ship.engineLevel;
      else if (category === "shields") curLvl = ship.shieldLevel;
      else if (category === "armor") curLvl = ship.armorLevel;
      else if (category === "blasters") curLvl = ship.blasterLevel;
      else if (category === "missiles") curLvl = ship.missileLevel;
      else if (category === "scanners") curLvl = ship.scannerLevel;
      else if (category === "cargos") curLvl = ship.cargoLevel;

      const nextUpgrade = upgradeList.find(u => u.level === curLvl + 1);
      if (!nextUpgrade) return;
      if (ship.credits < nextUpgrade.cost) {
        AudioController.playBeep('error');
        UI.addLog("Purchase denied: Insufficient Megacredits (M.U.).");
        return;
      }

      ship.credits -= nextUpgrade.cost;
      
      if (category === "engines") ship.engineLevel = nextUpgrade.level;
      else if (category === "shields") {
        ship.shieldLevel = nextUpgrade.level;
        ship.maxShields = nextUpgrade.maxEnergy;
        ship.shieldsCharge = nextUpgrade.maxEnergy;
      } else if (category === "armor") {
        ship.armorLevel = nextUpgrade.level;
        ship.maxHull = 100 + nextUpgrade.extraHull;
        ship.hull = ship.maxHull; // repair hull on upgrade
      } else if (category === "blasters") ship.blasterLevel = nextUpgrade.level;
      else if (category === "missiles") {
        ship.missileLevel = nextUpgrade.level;
        ship.maxMissiles = nextUpgrade.maxAmmo;
        ship.missilesAmmo = nextUpgrade.maxAmmo;
      } else if (category === "scanners") ship.scannerLevel = nextUpgrade.level;
      else if (category === "cargos") {
        ship.cargoLevel = nextUpgrade.level;
        ship.cargoCap = nextUpgrade.cap;
      }

      AudioController.playBeep('success');
      UI.addLog(`Vessel upgraded: ${category.toUpperCase()} to ${nextUpgrade.name}.`);
    }

    // Refresh UI
    game.saveGame();
    UI.updateShip(ship);
    this.renderDepot();
  },

  buyFuel() {
    const game = window.game;
    const ship = game.ship;
    const fuelNeeded = ship.maxFuel - ship.fuel;
    if (fuelNeeded <= 0) {
      AudioController.playBeep('error');
      UI.addLog("Fuel status already at maximum tank limits.");
      return;
    }

    const cost = Math.ceil(fuelNeeded * 15);
    if (ship.credits < cost) {
      // Buy partial fuel
      const possibleFuel = Math.floor(ship.credits / 15);
      if (possibleFuel <= 0) {
        AudioController.playBeep('error');
        UI.addLog("Refuel denied: Insufficient credits.");
        return;
      }
      ship.credits -= possibleFuel * 15;
      ship.fuel += possibleFuel;
      AudioController.playBeep('success');
      UI.addLog(`Refueled partial reactor: +${possibleFuel} units Endurium.`);
    } else {
      ship.credits -= cost;
      ship.fuel = ship.maxFuel;
      AudioController.playBeep('success');
      UI.addLog(`Refueled reactor: Full tank (+${Math.floor(fuelNeeded)} units Endurium).`);
    }
    
    game.saveGame();
    UI.updateShip(ship);
    this.renderDepot();
  },

  buyAmmo() {
    const game = window.game;
    const ship = game.ship;
    if (ship.missileLevel === 0) {
      AudioController.playBeep('error');
      UI.addLog("Ammo load denied: Install a missile launcher module first.");
      return;
    }

    const ammoNeeded = ship.maxMissiles - ship.missilesAmmo;
    if (ammoNeeded <= 0) {
      AudioController.playBeep('error');
      UI.addLog("Missile compartments full.");
      return;
    }

    const cost = ammoNeeded * 50;
    if (ship.credits < cost) {
      const possibleAmmo = Math.floor(ship.credits / 50);
      if (possibleAmmo <= 0) {
        AudioController.playBeep('error');
        UI.addLog("Ammo loading denied: Insufficient credits.");
        return;
      }
      ship.credits -= possibleAmmo * 50;
      ship.missilesAmmo += possibleAmmo;
      AudioController.playBeep('success');
      UI.addLog(`Missiles loaded: +${possibleAmmo} ordinance.`);
    } else {
      ship.credits -= cost;
      ship.missilesAmmo = ship.maxMissiles;
      AudioController.playBeep('success');
      UI.addLog(`Missiles loaded: Full inventory load (+${ammoNeeded} ordinance).`);
    }
    
    game.saveGame();
    UI.updateShip(ship);
    this.renderDepot();
  },

  // Personnel panel rendering: Crew hire and training
  renderPersonnel() {
    const container = document.getElementById("spaceport-personnel");
    const ship = window.game.ship;
    const candidates = GameData.crewCandidates;

    let html = `
      <h3>PERSONNEL OFFICE: ASSIGN & TRAIN TEAM</h3>
      <div class="crew-hiring-grid">
    `;

    // Show currently assigned crew and training buttons
    html += `<h4>ACTIVE OFFICERS</h4><div style="display:flex; flex-direction:column; gap:6px;">`;
    const roles = ['captain', 'science', 'navigator', 'engineer', 'comm', 'doctor'];
    let activeCount = 0;
    
    roles.forEach(role => {
      const member = ship.crew[role];
      if (member) {
        activeCount++;
        html += `
          <div class="hire-item" style="border-color:var(--secondary-color)">
            <div class="hire-info">
              <span class="hire-name">${role.toUpperCase()}: ${member.name} (${member.race})</span>
              <span class="hire-desc">Skill Level: ${member.skill}% | Status: Healthy</span>
            </div>
            <button class="glow-btn train-crew-btn" data-role="${role}" ${member.skill >= 100 ? "disabled" : ""}>
              ${member.skill >= 100 ? "MAX TRAINED" : "TRAIN SKILL (250 M.U. for +5%)"}
            </button>
          </div>
        `;
      }
    });

    if (activeCount === 0) {
      html += `<div style="color:rgba(0,255,102,0.4); font-size:11px; padding:10px;">NO CREW MEMBERS CURRENTLY ASSIGNED. DISPATCH AT ONCE.</div>`;
    }
    html += `</div><h4 style="margin-top:15px;">RECRUIT CANDIDATES</h4>`;

    // Show available candidates
    let availableCount = 0;
    candidates.forEach(cand => {
      // Check if hired in any role
      const isHired = Object.values(ship.crew).some(m => m && m.name === cand.name);
      if (!isHired) {
        availableCount++;
        html += `
          <div class="hire-item">
            <div class="hire-info">
              <span class="hire-name">${cand.name} (${cand.race} ${cand.role})</span>
              <span class="hire-desc">${cand.desc}</span>
              <span class="hire-cost">Recruitment Bounty: ${cand.cost} M.U. | Skill: ${cand.skill}%</span>
            </div>
            <button class="glow-btn hire-crew-btn" data-id="${cand.id}">HIRE FOR ${cand.role.toUpperCase()}</button>
          </div>
        `;
      }
    });

    if (availableCount === 0) {
      html += `<div style="color:rgba(0,255,102,0.4); font-size:11px; padding:10px;">ALL AVAIALBLE CANDIDATES RECRUITED.</div>`;
    }

    html += `</div>`;
    container.innerHTML = html;

    // Connect hire buttons
    container.querySelectorAll(".hire-crew-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const candId = e.target.getAttribute("data-id");
        this.hireCrew(candId);
      });
    });

    // Connect train buttons
    container.querySelectorAll(".train-crew-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const role = e.target.getAttribute("data-role");
        this.trainCrew(role);
      });
    });
  },

  hireCrew(candId) {
    const game = window.game;
    const cand = GameData.crewCandidates.find(c => c.id === candId);
    if (!cand) return;

    const roleKey = cand.role.toLowerCase();
    
    // Check if role is occupied
    if (game.ship.crew[roleKey]) {
      AudioController.playBeep('error');
      UI.addLog(`Recruitment failed: A Crew member is already assigned to the ${cand.role} console.`);
      return;
    }

    if (game.ship.credits < cand.cost) {
      AudioController.playBeep('error');
      UI.addLog("Recruitment failed: Insufficient Credits.");
      return;
    }

    game.ship.credits -= cand.cost;
    game.ship.crew[roleKey] = {
      name: cand.name,
      race: cand.race,
      skill: cand.skill,
      hp: cand.hp,
      maxHp: cand.maxHp || cand.hp || 100
    };

    AudioController.playBeep('success');
    UI.addLog(`Recruited: ${cand.name} hired as ship's ${cand.role}.`);
    
    game.saveGame();
    UI.updateCrew(game.ship);
    UI.updateShip(game.ship);
    this.renderPersonnel();
  },

  trainCrew(role) {
    const game = window.game;
    const ship = game.ship;
    const member = ship.crew[role];
    if (!member) return;

    if (ship.credits < 250) {
      AudioController.playBeep('error');
      UI.addLog("Training failed: Insufficient Credits (Requires 250 M.U.).");
      return;
    }

    ship.credits -= 250;
    member.skill = Math.min(100, member.skill + 5);

    AudioController.playBeep('success');
    UI.addLog(`Training completed: ${member.name} skill level rose to ${member.skill}%.`);

    game.saveGame();
    UI.updateCrew(ship);
    UI.updateShip(ship);
    this.renderPersonnel();
  },

  // Starport HQ Logs rendering
  renderHqLogs() {
    const container = document.getElementById("hq-logs-content");
    const ship = window.game.ship;
    let logsHtml = "";

    // Show logs based on artifacts collected to simulate progression
    const artifactsCount = ship.artifactsCollected.length;
    
    GameData.hqLogs.forEach((log, index) => {
      // Log 1 always visible, subsequent logs unlock as artifacts count increases
      if (index === 0 || index <= artifactsCount) {
        logsHtml += `
          <div class="hq-log-entry">
            <div class="hq-log-title">${log.title}</div>
            <div class="hq-log-text" style="color: rgba(0, 255, 102, 0.85);">${log.text}</div>
          </div>
        `;
      } else {
        logsHtml += `
          <div class="hq-log-entry" style="opacity:0.3;">
            <div class="hq-log-title">DECRYPTION LOCKED</div>
            <div class="hq-log-text">Collect more Precursor Artifacts to unlock deep subspace transmissions.</div>
          </div>
        `;
      }
    });

    container.innerHTML = logsHtml;
  },

  launchVessel() {
    return this.launchShip();
  },

  // Ship launch check
  launchShip() {
    const game = window.game;
    const ship = game.ship;
    if (!ship.crew) ship.crew = {};
    const crew = ship.crew;

    // Auto-assign starter Captain & Navigator if missing so launch is never blocked
    if (!crew.captain) {
      crew.captain = { id: "starter_cap", name: "Capt. Vance", race: "Human", role: "Captain", skill: 70, hp: 100, maxHp: 100 };
      UI.addLog("STARPORT DISPATCH: Capt. Vance assigned to Command Deck.");
    }
    if (!crew.navigator) {
      crew.navigator = { id: "starter_nav", name: "Nav. Kren", race: "Human", role: "Navigator", skill: 65, hp: 100, maxHp: 100 };
      UI.addLog("STARPORT DISPATCH: Nav. Kren assigned to Helm Control.");
    }

    try {
      if (typeof AudioController !== 'undefined' && AudioController.playBeep) {
        AudioController.playBeep('success');
      }
    } catch (e) {}
    UI.addLog("LAUNCH CLEARED. DISENGAGING STARPORT CLAMPS.");

    // Apply shield state according to Launch Configuration & installed modules
    if (ship.launchConfig.autoShields && ship.shieldLevel > 0) {
      ship.shieldsActive = true;
      ship.shieldsCharge = ship.maxShields;
      UI.addLog(`SHIELDS ONLINE: Deflector Matrix activated (${ship.shieldsCharge}/${ship.maxShields} MW).`);
    } else {
      ship.shieldsActive = false;
      UI.addLog("SHIELDS STANDBY: Deflectors offline.");
    }

    // Apply weapon state according to Launch Configuration & installed modules
    if (ship.launchConfig.autoWeapons && (ship.blasterLevel > 0 || ship.missileLevel > 0)) {
      ship.weaponsArmed = true;
      UI.addLog("WEAPONS ARMED: Laser cannons and Missile launchers hot.");
    } else {
      ship.weaponsArmed = false;
      UI.addLog("WEAPONS STANDBY: Cannon banks disarmed.");
    }

    // Launch coordinates: Hyperspace at Starbase Prime (250, 250)
    ship.isInSpacebase = false;
    ship.coordinates.x = 250.0;
    ship.coordinates.y = 250.0;
    ship.currentSystem = null;
    ship.currentPlanet = null;

    game.viewState = "navigation"; // Set navigation state
    game.spaceState = "hyper"; // Launch directly into Hyperspace navigation

    // Reset navigation physics facing upward
    if (typeof Navigation !== 'undefined') {
      Navigation.shipX = 250.0;
      Navigation.shipY = 250.0;
      Navigation.shipVx = 0;
      Navigation.shipVy = 0;
      Navigation.shipAngle = -Math.PI / 2;
    }
    
    UI.switchView("navigation");
    UI.updateControlPanel(true, null, game.ship.shieldsActive, game.ship.weaponsArmed);
    
    // Start engine hum
    try {
      if (typeof AudioController !== 'undefined' && AudioController.startEngine) {
        AudioController.startEngine();
      }
    } catch (e) {}
    
    game.saveGame();
  }
};

window.Spaceport = Spaceport;
