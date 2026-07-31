/**
 * Space Encounter Controller for StarFlight: Odyssey
 * Manages alien communications, haggling/barter trade engines,
 * real-time tactical combat, and looting.
 */

const Encounter = {
  active: false,
  raceKey: "",
  alien: null,
  posture: "friendly",
  dialogNode: null,
  
  // Barter state
  playerOfferItems: {},
  alienOfferItems: {},
  haggleVal: 0,
  haggleTolerances: 3, // attempts before they get angry
  
  // Combat state
  inCombat: false,
  alienHp: 100,
  alienShields: 50,
  combatTimer: 0,
  fleeTimer: 0,
  fleeing: false,

  init() {
    this.setupListeners();
  },

  setupListeners() {
    // Combat Action buttons
    document.getElementById("btn-fire-blaster").addEventListener("click", () => this.fireBlaster());
    document.getElementById("btn-fire-missile").addEventListener("click", () => this.fireMissile());
    document.getElementById("btn-comms-retreat").addEventListener("click", () => this.openComms());
    document.getElementById("btn-flee").addEventListener("click", () => this.engageFlee());

    // Barter controls
    document.getElementById("btn-haggle-raise").addEventListener("click", () => this.adjustHaggleOffer(0.10));
    document.getElementById("btn-haggle-lower").addEventListener("click", () => this.adjustHaggleOffer(-0.10));
    document.getElementById("btn-haggle-submit").addEventListener("click", () => this.submitHaggleOffer());
    document.getElementById("btn-haggle-cancel").addEventListener("click", () => this.cancelTrade());
  },

  // Trigger an encounter with a specific race
  trigger(raceKey) {
    const game = window.game;
    const ship = game.ship;
    const raceData = GameData.aliens[raceKey];
    if (!raceData) return;

    this.active = true;
    this.inCombat = false;
    this.fleeing = false;
    this.fleeTimer = 0;
    this.raceKey = raceKey;
    
    // Copy alien attributes
    this.alien = JSON.parse(JSON.stringify(raceData));
    this.alienHp = this.alien.health;
    this.alienShields = this.alien.shields;

    // Record encounter history for Starmap indicators
    if (!ship.encounterHistory) ship.encounterHistory = [];
    const shipX = ship.coordinates.x || 100.0;
    const shipY = ship.coordinates.y || 100.0;
    const isRecentDup = ship.encounterHistory.some(h => Math.hypot(h.x - shipX, h.y - shipY) < 3.0 && h.raceKey === raceKey);
    if (!isRecentDup) {
      ship.encounterHistory.push({
        x: shipX,
        y: shipY,
        raceKey: raceKey,
        raceName: this.alien.name || raceKey.toUpperCase(),
        timestamp: Date.now()
      });
    }

    AudioController.playAlarm();
    setTimeout(() => AudioController.stopAlarm(), 1200);

    UI.addLog(`ALERT: ENCOUNTER WITH HOSTILE/UNKNOWN VESSEL: ${this.alien.name.toUpperCase()}`);
    game.viewState = "encounter";
    UI.switchView("encounter");

    // Default attitude is Friendly, unless they are Uhlek who are always hostile
    if (raceKey === "uhlek") {
      this.enterCombat();
    } else {
      this.setPosture("friendly");
    }

    UI.updateControlPanel(true, null, ship.shieldsActive, ship.weaponsArmed);
  },

  setPosture(posture) {
    this.posture = posture;
    
    // Draw procedural retro alien face
    this.drawAlienPortrait();

    // Read dialog greeting
    const greeting = this.alien.dialogue[posture].greeting;
    document.getElementById("alien-name").textContent = this.alien.name.toUpperCase();
    document.getElementById("dialogue-box").innerHTML = greeting;

    // Load dialog choices
    this.loadDialogueChoices();
  },

  drawAlienPortrait() {
    const canvas = document.getElementById("alienCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background green grid lines for scanner effect
    ctx.strokeStyle = "rgba(0, 255, 102, 0.15)";
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 10) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    ctx.save();
    // Procedural alien commander face
    if (this.raceKey === "spemin") {
      // Spemin: green blob creature
      ctx.fillStyle = "#00ff66";
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#00ff66";
      
      // Blob body
      ctx.beginPath();
      ctx.ellipse(60, 75, 40, 25, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eye stalks
      ctx.strokeStyle = "#00ff66";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(40, 60);
      ctx.lineTo(35, 35);
      ctx.moveTo(80, 60);
      ctx.lineTo(85, 35);
      ctx.stroke();

      // Eye bulbs
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(35, 35, 8, 0, Math.PI * 2);
      ctx.arc(85, 35, 8, 0, Math.PI * 2);
      ctx.fill();

      // Pupils (cross-eyed look)
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(37, 35, 3, 0, Math.PI * 2);
      ctx.arc(83, 35, 3, 0, Math.PI * 2);
      ctx.fill();

      // Smile
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(60, 80, 10, 0.1, Math.PI - 0.1, false);
      ctx.stroke();
    } 
    else if (this.raceKey === "veloxi") {
      // Veloxi: red compound eye insectoid
      ctx.fillStyle = "#ff5533";
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#ff5533";

      // Head structure
      ctx.beginPath();
      ctx.moveTo(60, 25);
      ctx.lineTo(85, 55);
      ctx.lineTo(80, 85);
      ctx.lineTo(60, 100);
      ctx.lineTo(40, 85);
      ctx.lineTo(35, 55);
      ctx.closePath();
      ctx.fill();

      // Antennae
      ctx.strokeStyle = "#ff5533";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(45, 35);
      ctx.quadraticCurveTo(30, 15, 20, 20);
      ctx.moveTo(75, 35);
      ctx.quadraticCurveTo(90, 15, 100, 20);
      ctx.stroke();

      // Compound eyes
      ctx.fillStyle = "#ffcc00";
      ctx.shadowColor = "#ffcc00";
      ctx.beginPath();
      ctx.ellipse(45, 55, 10, 18, Math.PI / 6, 0, Math.PI * 2);
      ctx.ellipse(75, 55, 10, 18, -Math.PI / 6, 0, Math.PI * 2);
      ctx.fill();

      // Mandibles
      ctx.strokeStyle = "#1b1a1a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(52, 90);
      ctx.quadraticCurveTo(45, 100, 60, 100);
      ctx.moveTo(68, 90);
      ctx.quadraticCurveTo(75, 100, 60, 100);
      ctx.stroke();
    } 
    else if (this.raceKey === "uhlek") {
      // Uhlek: Glowing cybornetic visor
      ctx.fillStyle = "#111b15";
      ctx.strokeStyle = "#00ccff";
      ctx.lineWidth = 3;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#00ccff";

      // Outer visor frame
      ctx.beginPath();
      ctx.rect(20, 40, 80, 40);
      ctx.fill();
      ctx.stroke();

      // Tech details
      ctx.strokeStyle = "rgba(0, 204, 255, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(20, 60); ctx.lineTo(10, 60); ctx.lineTo(10, 20);
      ctx.moveTo(100, 60); ctx.lineTo(110, 60); ctx.lineTo(110, 20);
      ctx.stroke();

      // Glowing scanner line
      const scanX = 30 + Math.abs(Math.sin(Date.now() / 400)) * 50;
      ctx.fillStyle = "#ff3333";
      ctx.shadowColor = "#ff3333";
      ctx.beginPath();
      ctx.rect(scanX, 55, 10, 10);
      ctx.fill();
    }

    // Vertical Divider Line between Commander Portrait and Ship Graphic
    ctx.strokeStyle = "rgba(0, 255, 102, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(135, 0);
    ctx.lineTo(135, 120);
    ctx.stroke();

    // RIGHT SIDE (140-280px): ALIEN SPACECRAFT GRAPHIC
    const shipCenterX = 210;
    const shipCenterY = 60;

    if (this.raceKey === "spemin") {
      // Spemin Organic Slime Saucer Ship
      ctx.fillStyle = "#00cc66";
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#00ff66";
      
      // Main Saucer Body
      ctx.beginPath();
      ctx.ellipse(shipCenterX, shipCenterY, 45, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      // Glowing Cockpit Dome
      ctx.fillStyle = "rgba(136, 204, 255, 0.85)";
      ctx.beginPath();
      ctx.ellipse(shipCenterX, shipCenterY - 8, 20, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      // Thruster Slime Plumes
      ctx.fillStyle = "rgba(0, 255, 102, 0.5)";
      ctx.beginPath();
      ctx.arc(shipCenterX - 35, shipCenterY + 12, 6, 0, Math.PI * 2);
      ctx.arc(shipCenterX, shipCenterY + 15, 8, 0, Math.PI * 2);
      ctx.arc(shipCenterX + 35, shipCenterY + 12, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "9px Share Tech Mono";
      ctx.fillStyle = "#00ff66";
      ctx.fillText("[SPEMIN BIO-SAUCER]", 155, 114);
    } 
    else if (this.raceKey === "veloxi") {
      // Veloxi Ruby Battlecruiser Ship
      ctx.fillStyle = "#ff3333";
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#ff3333";

      // Swept Delta Wing Hull
      ctx.beginPath();
      ctx.moveTo(shipCenterX, shipCenterY - 30);
      ctx.lineTo(shipCenterX + 42, shipCenterY + 25);
      ctx.lineTo(shipCenterX + 18, shipCenterY + 15);
      ctx.lineTo(shipCenterX, shipCenterY + 22);
      ctx.lineTo(shipCenterX - 18, shipCenterY + 15);
      ctx.lineTo(shipCenterX - 42, shipCenterY + 25);
      ctx.closePath();
      ctx.fill();

      // Wingtip Cannons
      ctx.strokeStyle = "#ffcc00";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(shipCenterX - 40, shipCenterY + 25);
      ctx.lineTo(shipCenterX - 40, shipCenterY - 10);
      ctx.moveTo(shipCenterX + 40, shipCenterY + 25);
      ctx.lineTo(shipCenterX + 40, shipCenterY - 10);
      ctx.stroke();

      ctx.font = "9px Share Tech Mono";
      ctx.fillStyle = "#ff5533";
      ctx.fillText("[VELOXI CRUISER]", 162, 114);
    } 
    else if (this.raceKey === "uhlek") {
      // Uhlek Obsidian Dreadnought Ship
      ctx.fillStyle = "#1a2620";
      ctx.strokeStyle = "#ff3333";
      ctx.lineWidth = 2;
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#ff3333";

      // Hexagonal Spiky Body
      ctx.beginPath();
      ctx.moveTo(shipCenterX, shipCenterY - 32);
      ctx.lineTo(shipCenterX + 35, shipCenterY - 10);
      ctx.lineTo(shipCenterX + 38, shipCenterY + 20);
      ctx.lineTo(shipCenterX, shipCenterY + 30);
      ctx.lineTo(shipCenterX - 38, shipCenterY + 20);
      ctx.lineTo(shipCenterX - 35, shipCenterY - 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Red Core Array
      ctx.fillStyle = "#ff3333";
      ctx.beginPath();
      ctx.arc(shipCenterX, shipCenterY, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "9px Share Tech Mono";
      ctx.fillStyle = "#ff3333";
      ctx.fillText("[UHLEK DREADNOUGHT]", 152, 114);
    } 
    else {
      // Generic Alien Corvette
      ctx.fillStyle = "#00ccff";
      ctx.beginPath();
      ctx.arc(shipCenterX, shipCenterY, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "9px Share Tech Mono";
      ctx.fillStyle = "#00ccff";
      ctx.fillText("[UNKNOWN VESSEL]", 162, 114);
    }

    ctx.restore();
  },

  loadDialogueChoices() {
    const optionsGrid = document.getElementById("dialogue-options");
    optionsGrid.innerHTML = "";
    
    // Display choices based on posture
    const choices = this.alien.dialogue[this.posture].choices;
    choices.forEach((choice, index) => {
      const btn = document.createElement("button");
      btn.className = "action-btn";
      btn.textContent = choice.text;
      btn.addEventListener("click", () => {
        AudioController.playBeep('click');
        this.selectChoice(choice);
      });
      optionsGrid.appendChild(btn);
    });

    // Add posture change options
    if (this.posture !== "friendly") {
      this.addPostureBtn(optionsGrid, "Adopt Friendly Posture", "friendly");
    }
    if (this.posture !== "hostile") {
      this.addPostureBtn(optionsGrid, "Adopt Hostile Posture", "hostile");
    }
    if (this.posture !== "obsequious") {
      this.addPostureBtn(optionsGrid, "Adopt Obsequious Posture", "obsequious");
    }
  },

  addPostureBtn(container, text, posture) {
    const btn = document.createElement("button");
    btn.className = "action-btn yellow-glow";
    btn.textContent = text;
    btn.addEventListener("click", () => {
      AudioController.playBeep('click');
      this.setPosture(posture);
    });
    container.appendChild(btn);
  },

  selectChoice(choice) {
    const dialogueBox = document.getElementById("dialogue-box");
    dialogueBox.innerHTML = choice.response || "Dialogue sequence terminated.";

    // Action handling
    if (choice.action === "exit") {
      setTimeout(() => this.endEncounter(), 1500);
    } 
    else if (choice.action === "combat") {
      this.enterCombat();
    } 
    else if (choice.action === "trade") {
      setTimeout(() => this.startTrade(), 1200);
    } 
    else if (choice.action === "surrender") {
      // Give away all cargo
      window.game.ship.cargo = {};
      UI.addLog("CARGO SURRENDERED. ALIEN SHIP COLLECTED SHIPMENTS.");
      UI.updateShip(window.game.ship);
      setTimeout(() => this.endEncounter(), 1500);
    }
    else if (choice.action === "bribe" || choice.action === "fine") {
      const fee = choice.action === "bribe" ? 100 : 300;
      if (window.game.ship.credits >= fee) {
        window.game.ship.credits -= fee;
        UI.addLog(`PAID FEE: -${fee} M.U. DEDUCTED.`);
        UI.updateShip(window.game.ship);
        setTimeout(() => this.endEncounter(), 1500);
      } else {
        dialogueBox.innerHTML = "INSUFFICIENT FUNDS IN YOUR BANK ACCOUNTS. WE DEMAND COMBAT!";
        setTimeout(() => this.enterCombat(), 1800);
      }
    }
  },

  // Transition to Combat dashboard
  enterCombat() {
    this.inCombat = true;
    this.combatTimer = 0;
    this.fleeing = false;
    
    // Hide standard dialog options
    document.getElementById("dialogue-options").classList.add("hidden");
    
    // Show combat actions
    const combatActions = document.getElementById("combat-actions");
    combatActions.classList.remove("hidden");
    
    // Update ammo counts
    document.getElementById("ammo-count").textContent = window.game.ship.missilesAmmo;
    document.getElementById("dialogue-box").innerHTML = "=== ALERT: WEAPONS HOT. DEFLECTOR SHIELDS ARMED. ===";
    
    UI.addLog(`ENGAGING COMBAT PROTOCOLS WITH ${this.alien.name.toUpperCase()}`);
    AudioController.startAlarm();
  },

  // Real-time ticking update loop during encounter
  update(dt) {
    if (!this.active) return;

    // Animate alien commander portrait & spacecraft canvas continuously at 60 FPS
    this.drawAlienPortrait();

    if (!this.inCombat) return;

    this.combatTimer += dt;
    
    // Alien fires weapons every 2 seconds
    if (this.combatTimer >= 2.0) {
      this.combatTimer = 0;
      this.alienAttack();
    }

    // Escape thruster timer
    if (this.fleeing) {
      this.fleeTimer += dt;
      const pct = Math.min(100, (this.fleeTimer / 3.0) * 100);
      document.getElementById("dialogue-box").innerHTML = `ENGAGING HYPER JUMP ESCAPE VECTOR... ${Math.round(pct)}%`;
      
      if (this.fleeTimer >= 3.0) {
        this.fleeSuccess();
      }
    }
  },

  alienAttack() {
    const ship = window.game.ship;
    
    // Determine damage based on alien blaster stats
    const rawDmg = this.alien.blaster * (0.8 + Math.random() * 0.4);
    AudioController.playLaser();

    if (ship.shieldsActive && ship.shieldsCharge > 0) {
      const absorbs = Math.min(ship.shieldsCharge, rawDmg);
      ship.shieldsCharge = Math.max(0, ship.shieldsCharge - absorbs);
      UI.addLog(`SHIELDS IMPEDIMENT: Deflectors absorbed ${Math.round(absorbs)} damage.`);
      
      const bleedDmg = rawDmg - absorbs;
      if (bleedDmg > 0) {
        this.applyHullDamage(bleedDmg);
      }
    } else {
      this.applyHullDamage(rawDmg);
    }

    UI.updateShip(ship);
  },

  applyHullDamage(amount) {
    const ship = window.game.ship;
    // Armor level mitigates direct hull damage (Class 1 = 100%, Class 5 = 60% damage)
    const armorMod = 1.1 - (ship.armorLevel * 0.1);
    const finalDmg = Math.ceil(amount * armorMod);
    
    ship.hull = Math.max(0, ship.hull - finalDmg);
    UI.addLog(`HULL ALERT: Vessel received ${finalDmg} structural damage!`);
    
    if (ship.hull <= 0) {
      this.triggerGameOver();
    }
  },

  fireBlaster() {
    const ship = window.game.ship;
    if (ship.blasterLevel === 0) {
      AudioController.playBeep('error');
      UI.addLog("Blaster failed: Install a laser cannon module at depot first.");
      return;
    }

    // Deduct reactor fuel (fuel energy is used to power weapons)
    const fuelCost = 0.5;
    if (ship.fuel < fuelCost) {
      AudioController.playBeep('error');
      UI.addLog("Weapons failed: Insufficient reactor energy (Endurium).");
      return;
    }

    ship.fuel -= fuelCost;
    AudioController.playLaser();

    const blasterData = GameData.upgrades.blasters[ship.blasterLevel];
    // Scale damage by Science skill
    const sciSkill = ship.crew.science ? ship.crew.science.skill : 40;
    let dmg = blasterData.damage * (0.8 + (sciSkill / 200));

    // Deal damage to alien shields first
    if (this.alienShields > 0) {
      const absorbs = Math.min(this.alienShields, dmg);
      this.alienShields -= absorbs;
      dmg -= absorbs;
      UI.addLog(`WEAPONS IMPACT: Hit alien shields for ${Math.round(absorbs)} points.`);
    }

    if (dmg > 0) {
      this.alienHp = Math.max(0, this.alienHp - dmg);
      UI.addLog(`HULL HIT: Dealt ${Math.round(dmg)} hull damage to alien ship!`);
    }

    this.checkCombatVictory();
    UI.updateShip(ship);
  },

  fireMissile() {
    const ship = window.game.ship;
    if (ship.missileLevel === 0) {
      AudioController.playBeep('error');
      UI.addLog("Missile failed: No launchers equipped.");
      return;
    }

    if (ship.missilesAmmo <= 0) {
      AudioController.playBeep('error');
      UI.addLog("Weapons failed: Missile pods empty.");
      return;
    }

    ship.missilesAmmo--;
    document.getElementById("ammo-count").textContent = ship.missilesAmmo;
    AudioController.playMissile();

    // Missiles bypass shields entirely and strike the hull!
    const missileData = GameData.upgrades.missiles[ship.missileLevel];
    const sciSkill = ship.crew.science ? ship.crew.science.skill : 40;
    const dmg = missileData.damage * (0.9 + (sciSkill / 200));

    this.alienHp = Math.max(0, this.alienHp - dmg);
    UI.addLog(`CRITICAL HIT: Missile ignored shields and dealt ${Math.round(dmg)} damage directly to hull!`);

    this.checkCombatVictory();
    UI.updateShip(ship);
  },

  checkCombatVictory() {
    if (this.alienHp <= 0) {
      AudioController.stopAlarm();
      AudioController.playExplosion();
      AudioController.playVictory();
      
      UI.addLog(`VICTORY: Enemy vessel destroyed.`);
      
      // Salvage cargo loot
      const ship = window.game.ship;
      let salvaged = 0;
      this.alien.cargo.forEach(c => {
        const space = ship.cargoCap - UI.calculateCargoMass(ship.cargo);
        const item = GameData.commodities[c.type];
        if (space >= item.mass * c.count) {
          ship.cargo[c.type] = (ship.cargo[c.type] || 0) + c.count;
          salvaged += c.count;
        }
      });

      if (salvaged > 0) {
        UI.addLog(`SALVAGE MATRIX: Recovered +${salvaged} commodities from ship debris.`);
      } else {
        UI.addLog("SALVAGE MATRIX: Cargo holds full. Unable to salvage debris.");
      }

      this.endEncounter();
    }
  },

  openComms() {
    AudioController.playBeep('click');
    AudioController.stopAlarm();
    this.inCombat = false;
    this.fleeing = false;

    // Transition back to Dialog menu
    document.getElementById("combat-actions").classList.add("hidden");
    document.getElementById("dialogue-options").classList.remove("hidden");
    
    this.setPosture("friendly");
  },

  engageFlee() {
    if (this.fleeing) return;
    AudioController.playBeep('click');
    this.fleeing = true;
    this.fleeTimer = 0;
  },

  fleeSuccess() {
    AudioController.stopAlarm();
    AudioController.playBeep('success');
    UI.addLog("ESCAPE VECTOR LOCKED. WARP MATRIX ENGAGED.");
    this.endEncounter();
  },

  triggerGameOver() {
    AudioController.stopAlarm();
    AudioController.playDefeat();
    alert("CRITICAL DAMAGE: Ship Hull Destroyed. GAME OVER.");
    
    // Clear save and reload page
    window.game.resetGameData();
    window.location.reload();
  },

  endEncounter() {
    this.active = false;
    this.inCombat = false;
    AudioController.stopAlarm();
    
    window.game.encounterCooldown = 25.0; // 25 seconds of clear flight immunity
    window.game.viewState = "navigation";
    UI.switchView("navigation");
    
    // Re-engage engine hum
    AudioController.startEngine();
    window.game.saveGame();
  },

  // Trade screen operations
  startTrade() {
    window.game.viewState = "barter";
    UI.switchView("barter");

    this.playerOfferItems = {};
    this.alienOfferItems = {};
    this.haggleVal = 0;
    this.haggleTolerances = 3;

    this.renderBarterScreen();
  },

  renderBarterScreen() {
    const ship = window.game.ship;
    const playerContainer = document.getElementById("player-cargo-list");
    const alienContainer = document.getElementById("alien-cargo-list");

    playerContainer.innerHTML = "";
    alienContainer.innerHTML = "";

    // Load player's tradeable inventory
    let hasPlayerInv = false;
    for (let key in ship.cargo) {
      const count = ship.cargo[key];
      if (count > 0) {
        hasPlayerInv = true;
        const item = GameData.commodities[key];
        const row = document.createElement("div");
        row.className = `barter-item ${this.playerOfferItems[key] ? 'selected' : ''}`;
        row.innerHTML = `<span>${item.name} (${count})</span> <span>Value: ${item.sellVal} M.U.</span>`;
        row.addEventListener("click", () => this.togglePlayerTradeItem(key));
        playerContainer.appendChild(row);
      }
    }
    if (!hasPlayerInv) {
      playerContainer.innerHTML = `<div style="text-align:center; padding-top:50px; opacity:0.4;">CARGO HOLD EMPTY</div>`;
    }

    // Load alien's tradeable inventory
    let hasAlienInv = false;
    this.alien.cargo.forEach((c, idx) => {
      if (c.count > 0) {
        hasAlienInv = true;
        const item = GameData.commodities[c.type];
        const row = document.createElement("div");
        const key = `alien_${idx}`;
        row.className = `barter-item ${this.alienOfferItems[key] ? 'selected' : ''}`;
        row.innerHTML = `<span>${item.name} (${c.count})</span> <span>Value: ${item.buyVal} M.U.</span>`;
        row.addEventListener("click", () => this.toggleAlienTradeItem(key, c.type));
        alienContainer.appendChild(row);
      }
    });
    if (!hasAlienInv) {
      alienContainer.innerHTML = `<div style="text-align:center; padding-top:50px; opacity:0.4;">NO CARGO REMAINING</div>`;
    }

    this.recalculateOfferSum();
  },

  togglePlayerTradeItem(key) {
    AudioController.playBeep('click');
    if (this.playerOfferItems[key]) {
      delete this.playerOfferItems[key];
    } else {
      this.playerOfferItems[key] = 1;
    }
    this.renderBarterScreen();
  },

  toggleAlienTradeItem(key, type) {
    AudioController.playBeep('click');
    if (this.alienOfferItems[key]) {
      delete this.alienOfferItems[key];
    } else {
      this.alienOfferItems[key] = { type: type, count: 1 };
    }
    this.renderBarterScreen();
  },

  recalculateOfferSum() {
    let playerSum = 0;
    let alienSum = 0;

    for (let key in this.playerOfferItems) {
      const item = GameData.commodities[key];
      playerSum += item.sellVal;
    }

    for (let key in this.alienOfferItems) {
      const data = this.alienOfferItems[key];
      const item = GameData.commodities[data.type];
      alienSum += item.buyVal;
    }

    // Initial haggle offset is the difference
    this.haggleVal = playerSum - alienSum;
    
    // Update labels
    const offerLabel = document.getElementById("offer-value");
    offerLabel.textContent = this.haggleVal;
    if (this.haggleVal < 0) {
      offerLabel.className = "red";
    } else {
      offerLabel.className = "green";
    }
  },

  adjustHaggleOffer(percent) {
    AudioController.playBeep('click');
    // Adjust the net credits offer
    this.haggleVal += Math.round(this.haggleVal * percent) || (percent > 0 ? 10 : -10);
    
    const offerLabel = document.getElementById("offer-value");
    offerLabel.textContent = this.haggleVal;
    if (this.haggleVal < 0) {
      offerLabel.className = "red";
    } else {
      offerLabel.className = "green";
    }
  },

  submitHaggleOffer() {
    const ship = window.game.ship;
    const commSkill = ship.crew.comm ? ship.crew.comm.skill : 40;
    
    // Haggling evaluation formula
    // Spemin: very cowardly, accepts low deals. Veloxi: strict.
    const strictness = this.raceKey === "spemin" ? 0.75 : this.raceKey === "veloxi" ? 1.05 : 1.2;
    const charismaFactor = 1.0 + (commSkill / 200); // +0% to +50% advantage
    
    let playerSum = 0;
    let alienSum = 0;

    for (let key in this.playerOfferItems) {
      playerSum += GameData.commodities[key].sellVal;
    }

    for (let key in this.alienOfferItems) {
      alienSum += GameData.commodities[this.alienOfferItems[key].type].buyVal;
    }

    const tradeBalance = playerSum + this.haggleVal; // Total value offered by player
    const expectedValue = alienSum * strictness;

    // Accept deal criteria
    if (tradeBalance * charismaFactor >= expectedValue) {
      // Accept deal!
      AudioController.playVictory();
      UI.addLog("COMMERCE TRANSACTION ACCEPTED.");
      
      // Perform trades
      // 1. Remove player items
      for (let key in this.playerOfferItems) {
        ship.cargo[key]--;
      }

      // 2. Add alien items
      for (let key in this.alienOfferItems) {
        const itemType = this.alienOfferItems[key].type;
        ship.cargo[itemType] = (ship.cargo[itemType] || 0) + 1;
        
        // Remove from alien inventory
        const alienIdx = parseInt(key.split("_")[1]);
        this.alien.cargo[alienIdx].count--;
      }

      // 3. Adjust cash balance
      ship.credits += this.haggleVal;

      UI.updateShip(ship);
      this.cancelTrade(); // exits back to dialog
    } else {
      AudioController.playBeep('error');
      this.haggleTolerances--;
      
      const reactionNode = document.getElementById("haggle-reaction");
      if (this.haggleTolerances > 0) {
        reactionNode.textContent = `"Your terms are unacceptable. Re-calculate transaction values."`;
        reactionNode.className = "red";
      } else {
        // Trigger battle!
        reactionNode.textContent = `"Haggling time is over. We take your cargo by force!"`;
        setTimeout(() => this.enterCombat(), 1500);
      }
    }
  },

  cancelTrade() {
    AudioController.playBeep('click');
    // Exit back to encounter dialog view
    window.game.viewState = "encounter";
    UI.switchView("encounter");
    this.setPosture("friendly");
  }
};

window.Encounter = Encounter;
