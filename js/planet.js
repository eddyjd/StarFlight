/**
 * Planet Exploration Controller for StarFlight: Odyssey
 * Implements orbital scanner reporting and 2D grid-based planetary landing.
 * Rover handles mining, hazard traversal, energy decay, and lander return.
 */

const PlanetExploration = {
  canvas: null,
  ctx: null,
  
  active: false,
  planet: null,
  gridWidth: 50,
  gridHeight: 35,
  viewportW: 20,
  viewportH: 14,
  cellW: 42,
  cellH: 36,

  // Target landing coordinates
  targetLandingX: 25,
  targetLandingY: 17,

  // TV / Rover State
  roverX: 25,
  roverY: 17,
  energy: 100,
  maxEnergy: 100,
  hull: 100,
  cargo: [], // items collected on this trip
  grid: [],
  monsters: [],
  stormTicks: 0,

  init() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
  },

  getPlanetState(planetName) {
    const ship = window.game.ship;
    if (!ship.exploredPlanets) ship.exploredPlanets = {};
    const name = planetName || (this.planet ? this.planet.name : "Unknown");
    if (!ship.exploredPlanets[name]) {
      ship.exploredPlanets[name] = {
        minedTiles: {},
        droppedItems: {},
        exploredTiles: {},
        analyzedTiles: {},
        landingSites: []
      };
    }
    if (!ship.exploredPlanets[name].exploredTiles) ship.exploredPlanets[name].exploredTiles = {};
    if (!ship.exploredPlanets[name].analyzedTiles) ship.exploredPlanets[name].analyzedTiles = {};
    return ship.exploredPlanets[name];
  },

  // Perform scanner inspection using ship equipment
  scanPlanet() {
    const game = window.game;
    const ship = game.ship;
    const planet = ship.currentPlanet;
    if (!planet) return;

    AudioController.playScan();
    UI.addLog(`INITIATING SENSOR SCAN ON: ${planet.name.toUpperCase()}`);

    // Scan depth is limited by scanner upgrade level
    setTimeout(() => {
      UI.addLog(`- GRAVITY: ${planet.gravity.toFixed(2)} G`);
      UI.addLog(`- TEMPERATURE: ${planet.temp} C`);
      UI.addLog(`- ATMOSPHERE: ${planet.atmosphere.toUpperCase()}`);
    }, 150);

    if (ship.scannerLevel >= 2) {
      setTimeout(() => {
        UI.addLog(`- MINERAL INDEX: ${planet.minerals > 0.6 ? "EXTREME" : planet.minerals > 0.3 ? "RICH" : "LOW"}`);
      }, 300);
    } else {
      setTimeout(() => {
        UI.addLog("- MINERALS: [UPGRADE SCANNER TO CLASS 2 FOR RES-DENSITY]");
      }, 300);
    }

    if (ship.scannerLevel >= 3) {
      setTimeout(() => {
        UI.addLog(`- BIOLOGICAL INDEX: ${planet.bio > 0.6 ? "DENSE LIFE" : planet.bio > 0.2 ? "SPARSE VEGETATION" : "BARREN"}`);
      }, 450);
    } else {
      setTimeout(() => {
        UI.addLog("- BIOLOGY: [UPGRADE SCANNER TO CLASS 3 FOR BIO-RESONANCE]");
      }, 450);
    }

    if (ship.scannerLevel >= 4) {
      setTimeout(() => {
        if (planet.hasRuins) {
          UI.addLog(`- [WARNING]: ANOMALOUS PRECURSOR EMISSIONS DETECTED AT SURFACE SECTOR!`);
        } else {
          UI.addLog(`- ANOMALY SCAN: ZERO ANOMALIES DETECTED.`);
        }
      }, 600);
    } else {
      setTimeout(() => {
        UI.addLog("- ANOMALY MATRIX: [UPGRADE SCANNER TO CLASS 4 FOR RESONANCE DEPTH]");
      }, 600);
    }
  },

  // Launch Lander: Opens Landing Site Picker Modal
  startLanding() {
    const game = window.game;
    const ship = game.ship;
    const planet = ship.currentPlanet;
    if (!planet) return;

    if (ship.fuel < 10) {
      AudioController.playBeep('error');
      UI.addLog("LANDING DECLINED: MINIMUM 10 ENDURIUM FUEL REQUIRED FOR ATMOSPHERIC DESCENT.");
      return;
    }

    this.planet = planet;
    this.targetLandingX = 25;
    this.targetLandingY = 17;
    this.openLandingSiteModal();
  },

  openLandingSiteModal() {
    AudioController.playBeep('click');
    const modal = document.getElementById("landing-site-modal");
    if (!modal) return;

    const title = document.getElementById("landing-site-title");
    if (title) title.textContent = `PLANETARY LANDING SITE SELECTION: ${this.planet.name.toUpperCase()}`;

    modal.classList.remove("hidden");
    this.drawLandingSiteCanvas();

    const canvas = document.getElementById("landingSiteCanvas");
    if (canvas && !canvas.dataset.listener) {
      canvas.dataset.listener = "true";
      canvas.addEventListener("click", (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const cellW = rect.width / 50;
        const cellH = rect.height / 35;
        this.targetLandingX = Math.max(0, Math.min(49, Math.floor(mx / cellW)));
        this.targetLandingY = Math.max(0, Math.min(34, Math.floor(my / cellH)));

        this.drawLandingSiteCanvas();
      });
    }
  },

  closeLandingSiteModal() {
    AudioController.playBeep('click');
    const modal = document.getElementById("landing-site-modal");
    if (modal) modal.classList.add("hidden");
  },

  confirmLandingSite() {
    const game = window.game;
    const ship = game.ship;
    const planet = this.planet;
    if (!planet) return;

    if (ship.fuel < 10) {
      AudioController.playBeep('error');
      UI.addLog("LANDING DECLINED: Insufficient fuel.");
      this.closeLandingSiteModal();
      return;
    }

    // Spend fuel
    ship.fuel -= 10;
    AudioController.playBeep('success');
    UI.addLog(`LAUNCHING LANDER MODULE TO DESCENT SITE (${this.targetLandingX}, ${this.targetLandingY}) ON ${planet.name.toUpperCase()}`);
    UI.addLog("DESCENT COMPLETED. DEPLOYING TERRAIN VEHICLE (TV).");

    const pState = this.getPlanetState(planet.name);
    pState.landingSites.push({ x: this.targetLandingX, y: this.targetLandingY });

    if (!ship.exploredPlanetsData) ship.exploredPlanetsData = {};
    if (!ship.exploredPlanetsData[planet.name]) {
      ship.exploredPlanetsData[planet.name] = {
        name: planet.name,
        atmosphere: planet.atmosphere || "Nitrogen-Oxygen",
        gravity: planet.gravity ? `${planet.gravity} G` : "1.0 G",
        temperature: planet.temperature ? `${planet.temperature}°C` : "Mild 18°C",
        landings: 1,
        mineralsHarvested: 0,
        bioHarvested: 0,
        surveyed: true
      };
    } else {
      ship.exploredPlanetsData[planet.name].landings = (ship.exploredPlanetsData[planet.name].landings || 1) + 1;
    }

    this.active = true;
    game.viewState = "landing";
    UI.switchView("navigation");

    this.roverX = this.targetLandingX;
    this.roverY = this.targetLandingY;
    this.energy = 100;
    this.hull = 100;
    this.cargo = [];

    this.generatePlanetaryGrid();
    this.closeLandingSiteModal();

    UI.addLog("TV SYSTEMS ONLINE. ARROW KEYS TO MOVE, PRESS [A] TO ANALYZE DEPOSIT, [L] AT LANDER TO RETURN.");
    UI.updateShip(ship);
    UI.updateControlPanel(true, planet, ship.shieldsActive, ship.weaponsArmed);
    game.saveGame();
  },

  drawLandingSiteCanvas() {
    const canvas = document.getElementById("landingSiteCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cellW = canvas.width / 50;
    const cellH = canvas.height / 35;
    const rand = this.getSeededRandom(this.planet.name);
    const pState = this.getPlanetState(this.planet.name);

    // Planet type theme colors
    const pName = (this.planet.name || "").toLowerCase();
    const pAtmo = (this.planet.atmosphere || "").toLowerCase();
    let bgSoil = "#0c1810"; // Default dark green-black
    let mtnColor = "#4a5b4e";

    if (pAtmo.includes("volcanic") || pName.includes("pyro") || pName.includes("fire")) {
      bgSoil = "#1a0b0b"; mtnColor = "#5e2828";
    } else if (pAtmo.includes("ice") || pAtmo.includes("frozen") || pName.includes("frost")) {
      bgSoil = "#091720"; mtnColor = "#3d6878";
    } else if (pAtmo.includes("thin") || pAtmo.includes("desert") || pName.includes("sand")) {
      bgSoil = "#1a140b"; mtnColor = "#5e4b2d";
    }

    ctx.fillStyle = bgSoil;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render Grid Lines & Surface Terrain Map
    for (let y = 0; y < 35; y++) {
      for (let x = 0; x < 50; x++) {
        const px = x * cellW;
        const py = y * cellH;

        const val = rand();

        // Mountain terrain tiles ▲
        if (val < 0.18) {
          ctx.fillStyle = mtnColor;
          ctx.beginPath();
          const cx = px + cellW / 2;
          const cy = py + cellH / 2;
          ctx.moveTo(cx, cy - (cellH * 0.35));
          ctx.lineTo(cx - (cellW * 0.35), cy + (cellH * 0.35));
          ctx.lineTo(cx + (cellW * 0.35), cy + (cellH * 0.35));
          ctx.closePath();
          ctx.fill();
        } 
        // Mineral deposit hotspots *
        else if (val < 0.18 + (this.planet.minerals * 0.07)) {
          if (!pState.minedTiles[`${x}_${y}`]) {
            ctx.fillStyle = "rgba(255, 204, 0, 0.65)";
            ctx.font = "10px Share Tech Mono";
            ctx.fillText("*", px + 3, py + cellH - 3);
          }
        } 
        // Biological specimen hotspots &
        else if (val < 0.22 + (this.planet.minerals * 0.07) + (this.planet.bio * 0.06)) {
          if (!pState.minedTiles[`${x}_${y}`]) {
            ctx.fillStyle = "rgba(136, 136, 255, 0.65)";
            ctx.font = "10px Share Tech Mono";
            ctx.fillText("&", px + 3, py + cellH - 3);
          }
        }

        // Fine Grid Lines
        ctx.strokeStyle = "rgba(0, 255, 102, 0.05)";
        ctx.strokeRect(px, py, cellW, cellH);
      }
    }

    // Render Explored / Traveled Area Highlights on Surface Map
    if (pState.exploredTiles) {
      for (let posKey in pState.exploredTiles) {
        const [ex, ey] = posKey.split("_").map(Number);
        const px = ex * cellW;
        const py = ey * cellH;
        ctx.fillStyle = "rgba(0, 255, 102, 0.28)";
        ctx.fillRect(px, py, cellW, cellH);
        ctx.strokeStyle = "rgba(0, 255, 102, 0.35)";
        ctx.strokeRect(px, py, cellW, cellH);
      }
    }

    // Render Past Landing Sites with Gold Glowing '[H]' Markers
    if (pState.landingSites) {
      pState.landingSites.forEach((site) => {
        const px = site.x * cellW + cellW / 2;
        const py = site.y * cellH + cellH / 2;

        ctx.fillStyle = "#ffcc00";
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#ffcc00";
        ctx.font = "bold 11px Share Tech Mono";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("[H]", px, py);
        ctx.shadowBlur = 0;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      });
    }

    // Render Target Landing Site Reticle
    const targetPx = this.targetLandingX * cellW;
    const targetPy = this.targetLandingY * cellH;

    ctx.strokeStyle = "#00ff66";
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#00ff66";
    ctx.strokeRect(targetPx - 2, targetPy - 2, cellW + 4, cellH + 4);
    ctx.shadowBlur = 0;

    const info = document.getElementById("selected-site-info");
    if (info) {
      info.textContent = `SELECTED DESCENT SITE: (X ${this.targetLandingX}, Y ${this.targetLandingY}) - TOP-DOWN SURFACE MAP READY`;
    }
  },

  // Seeded Random Generator based on planet name
  getSeededRandom(seedString) {
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
      hash = seedString.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return function() {
      hash = (hash * 1664525 + 1013904223) % 4294967296;
      return Math.abs(hash) / 4294967296;
    };
  },

  generatePlanetaryGrid() {
    const rand = this.getSeededRandom(this.planet.name);
    const pState = this.getPlanetState(this.planet.name);

    this.gridWidth = 50;
    this.gridHeight = 35;
    this.grid = [];
    this.monsters = [];

    // Create empty cells
    for (let y = 0; y < this.gridHeight; y++) {
      this.grid[y] = [];
      for (let x = 0; x < this.gridWidth; x++) {
        this.grid[y][x] = { type: "empty" };
      }
    }

    // Place ruins at (15, 8) if hasRuins
    if (this.planet.hasRuins) {
      this.grid[8][15] = { type: "ruin", name: this.planet.artifact };
    }

    // Place Rare Tech Component Ruin/Wreck on ~18% of planets (seeded random check)
    const hasTechRuin = (rand() < 0.18);
    if (hasTechRuin) {
      const wx = 12 + Math.floor(rand() * 26);
      const wy = 8 + Math.floor(rand() * 18);
      const techKeys = Object.keys(GameData.techParts);
      const partKey = techKeys[Math.floor(rand() * techKeys.length)];
      const techPart = GameData.techParts[partKey];

      const isAlienWreck = (rand() < 0.5);
      this.grid[wy][wx] = {
        type: isAlienWreck ? "wreck" : "tech_ruin",
        part: techPart,
        name: techPart.name
      };
    }

    // Distribute obstacles (Mountains) and Deposits
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        if (this.planet.hasRuins && Math.hypot(x - 15, y - 8) < 2) continue;

        const val = rand();
        if (val < 0.18) {
          this.grid[y][x] = { type: "mountain" };
        } else if (val < 0.18 + (this.planet.minerals * 0.07)) {
          const minVal = rand();
          let itemKey = "iron";
          if (minVal > 0.9) itemKey = "precursor_alloy";
          else if (minVal > 0.7) itemKey = "endurium_ore";
          else if (minVal > 0.4) itemKey = "platinum";
          else if (minVal > 0.2) itemKey = "gold";
          
          this.grid[y][x] = { type: "mineral", item: itemKey };
        } else if (val < 0.22 + (this.planet.minerals * 0.07) + (this.planet.bio * 0.06)) {
          const bioVal = rand();
          const itemKey = bioVal > 0.75 ? "bio_fauna" : "bio_flora";
          this.grid[y][x] = { type: "bio", item: itemKey };
        }
      }
    }

    // Apply Mined Tiles persistence (previously picked up items stay GONE!)
    if (pState.minedTiles) {
      for (let posKey in pState.minedTiles) {
        const [mx, my] = posKey.split("_").map(Number);
        if (this.grid[my] && this.grid[my][mx]) {
          this.grid[my][mx] = { type: "empty" };
        }
      }
    }

    // Apply Dropped Items persistence
    if (pState.droppedItems) {
      for (let posKey in pState.droppedItems) {
        const [dx, dy] = posKey.split("_").map(Number);
        if (this.grid[dy] && this.grid[dy][dx]) {
          this.grid[dy][dx] = { type: "dropped", item: pState.droppedItems[posKey] };
        }
      }
    }

    // Restore Previous Landing Sites as marked gold lander pads [H]
    if (pState.landingSites) {
      pState.landingSites.forEach((site, idx) => {
        if (site.x !== this.roverX || site.y !== this.roverY) {
          if (this.grid[site.y] && this.grid[site.y][site.x]) {
            this.grid[site.y][site.x] = { type: "past_lander", label: `[H${idx + 1}]` };
          }
        }
      });
    }

    // Place current Lander at target coordinates (targetLandingX, targetLandingY)
    this.grid[this.roverY][this.roverX] = { type: "lander" };

    // Spawn 3 wandering storm hazards
    for (let i = 0; i < 3; i++) {
      this.monsters.push({
        x: Math.floor(rand() * this.gridWidth),
        y: Math.floor(rand() * 8) + 1,
        lastMove: 0
      });
    }
  },

  analyzeCurrentDeposit() {
    const rx = this.roverX;
    const ry = this.roverY;

    // Check current tile first, then adjacent 4-directional tiles
    let targetTile = this.grid[ry][rx];
    let tx = rx;
    let ty = ry;

    if (!["mineral", "bio", "dropped", "ruin"].includes(targetTile.type)) {
      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      for (let [dx, dy] of dirs) {
        const nx = rx + dx;
        const ny = ry + dy;
        if (nx >= 0 && nx < this.gridWidth && ny >= 0 && ny < this.gridHeight) {
          const tile = this.grid[ny][nx];
          if (["mineral", "bio", "dropped", "ruin"].includes(tile.type)) {
            targetTile = tile;
            tx = nx;
            ty = ny;
            break;
          }
        }
      }
    }

    AudioController.playScan();

    if (["mineral", "bio", "dropped", "ruin"].includes(targetTile.type)) {
      const pState = this.getPlanetState();
      pState.analyzedTiles[`${tx}_${ty}`] = true;
    }

    if (targetTile.type === "mineral") {
      const item = GameData.commodities[targetTile.item] || { name: targetTile.item, mass: 1, sellVal: 50 };
      UI.addLog(`SPECTROGRAPHIC DEPOSIT ANALYSIS AT SECTOR (${tx}, ${ty}):`);
      UI.addLog(`- ORE TYPE: ${item.name.toUpperCase()}`);
      UI.addLog(`- SPECIFIC MASS: ${item.mass} TONS | MARKET VALUE: ${item.sellVal} M.U.`);
      UI.addLog(`- COMPOSITION: HIGH PURITY MINERAL DEPOSIT. MOVE OVER TO MINE.`);
    } else if (targetTile.type === "bio") {
      const item = GameData.commodities[targetTile.item] || { name: targetTile.item, mass: 1, sellVal: 50 };
      UI.addLog(`BIO-RESONANCE ANALYSIS AT SECTOR (${tx}, ${ty}):`);
      UI.addLog(`- ORGANISM: ${item.name.toUpperCase()}`);
      UI.addLog(`- SPECIFIC MASS: ${item.mass} TONS | MARKET VALUE: ${item.sellVal} M.U.`);
      UI.addLog(`- BIO-CONTAINMENT: ${item.needsBio ? 'LIVE FAUNA (REQUIRES BIO-CONTAINMENT UPGRADE)' : 'SAFE FLORA SAMPLE'}`);
    } else if (targetTile.type === "dropped") {
      const item = GameData.commodities[targetTile.item] || { name: targetTile.item, mass: 1, sellVal: 50 };
      UI.addLog(`SURFACE CONTAINMENT ANALYSIS AT SECTOR (${tx}, ${ty}):`);
      UI.addLog(`- CARGO CRATE: DISCARDED ${item.name.toUpperCase()}`);
      UI.addLog(`- SPECIFIC MASS: ${item.mass} TONS | VALUE: ${item.sellVal} M.U.`);
      UI.addLog(`- STATUS: READY FOR RECOVERY INTO TV ROVER BED.`);
    } else if (targetTile.type === "ruin") {
      UI.addLog(`PRECURSOR MONOLITH ANALYSIS AT SECTOR (${tx}, ${ty}):`);
      UI.addLog(`- ARCHIVE ANOMALY: ANCIENT PRECURSOR DATA VAULT [${targetTile.name.toUpperCase()}]`);
      UI.addLog(`- DECRYPTION: READY FOR EXTRACT ON INTERACTION.`);
    } else {
      UI.addLog(`SURFACE SCANNER AT SECTOR (${rx}, ${ry}): STANDARD PLANETARY SOIL & ROCK FORMATIONS.`);
    }
  },

  handleInput(key) {
    if (!this.active) return;
    
    let dx = 0;
    let dy = 0;

    if (key === "ArrowUp" || key === "w" || key === "W") dy = -1;
    else if (key === "ArrowDown" || key === "s" || key === "S") dy = 1;
    else if (key === "ArrowLeft") dx = -1;
    else if (key === "ArrowRight") dx = 1;
    else if (key === "a" || key === "A") dx = -1;
    else if (key === "d" || key === "D") dx = 1;
    else if (key === "l" || key === "L") {
      this.returnToShip();
      return;
    }
    else if (key === "v" || key === "V" || key === "x" || key === "X") {
      this.analyzeCurrentDeposit();
      return;
    }
    else if (key === "Enter" || key === " " || key === "e" || key === "E" || key === "m" || key === "M") {
      this.harvestCurrentTile();
      return;
    }

    if (dx !== 0 || dy !== 0) {
      this.moveRover(dx, dy);
    }
  },

  harvestCurrentTile() {
    const rx = this.roverX;
    const ry = this.roverY;

    // Check current tile first, then adjacent 4-directional tiles
    let targetTile = this.grid[ry][rx];
    let tx = rx;
    let ty = ry;

    if (!["mineral", "bio", "dropped", "ruin"].includes(targetTile.type)) {
      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      for (let [dx, dy] of dirs) {
        const nx = rx + dx;
        const ny = ry + dy;
        if (nx >= 0 && nx < this.gridWidth && ny >= 0 && ny < this.gridHeight) {
          const tile = this.grid[ny][nx];
          if (["mineral", "bio", "dropped", "ruin"].includes(tile.type)) {
            targetTile = tile;
            tx = nx;
            ty = ny;
            break;
          }
        }
      }
    }

    if (["mineral", "bio", "dropped", "ruin"].includes(targetTile.type)) {
      this.checkTileInteraction(tx, ty);
    } else {
      AudioController.playBeep('error');
      UI.addLog("MINING DRILL: No mineral, bio, or cargo deposit detected on or adjacent to Rover.");
    }
  },

  moveRover(dx, dy) {
    const nx = this.roverX + dx;
    const ny = this.roverY + dy;

    // Bounds checking
    if (nx < 0 || nx >= this.gridWidth || ny < 0 || ny >= this.gridHeight) {
      AudioController.playBeep('error');
      return;
    }

    const ship = window.game.ship;
    const dest = this.grid[ny][nx];
    
    // Mountain blocker check (depends on TV Engine and Skill)
    let moveCost = 1.0;
    if (!ship.tvUpgrades) ship.tvUpgrades = { engine: 1, armor: 1, blaster: 0, cargo: 1 };
    const tvEngineIdx = Math.max(0, (ship.tvUpgrades.engine || 1) - 1);
    const engineUpgrade = GameData.upgrades.tvUpgrades.engine[tvEngineIdx] || GameData.upgrades.tvUpgrades.engine[0];

    if (dest.type === "mountain") {
      const engLevel = ship.tvUpgrades.engine || 1;
      if (engLevel === 1) {
        AudioController.playBeep('error');
        UI.addLog("ROVER ENG-LIMIT: Standard treads cannot climb mountain structures.");
        return;
      }
      moveCost = 3.0; // mountains cost more energy
    }

    // Consume Energy per move
    const energyDecay = moveCost * (engineUpgrade.energyCost || 1.0) * (1.1 - (ship.crew && ship.crew.engineer ? ship.crew.engineer.skill / 200 : 0.2));
    this.energy = Math.max(0, this.energy - energyDecay);

    // Apply move
    this.roverX = nx;
    this.roverY = ny;
    AudioController.playBeep('hover');

    // Record surface area exploration trail (2-tile radius) & auto-identify deposits driven past (1-tile radius)
    const pState = this.getPlanetState();
    for (let sdy = -2; sdy <= 2; sdy++) {
      for (let sdx = -2; sdx <= 2; sdx++) {
        const tx = nx + sdx;
        const ty = ny + sdy;
        if (tx >= 0 && tx < this.gridWidth && ty >= 0 && ty < this.gridHeight) {
          pState.exploredTiles[`${tx}_${ty}`] = true;
          if (Math.abs(sdx) <= 1 && Math.abs(sdy) <= 1) {
            const tile = this.grid[ty][tx];
            if (tile && ["mineral", "bio", "dropped", "ruin"].includes(tile.type)) {
              pState.analyzedTiles[`${tx}_${ty}`] = true;
            }
          }
        }
      }
    }

    // Notify if standing over a deposit (DO NOT AUTO-MINE)
    const currentTile = this.grid[ny][nx];
    if (["mineral", "bio", "dropped", "ruin"].includes(currentTile.type)) {
      const item = GameData.commodities[currentTile.item] || { name: currentTile.item || "Deposit" };
      UI.addLog(`OVER ${currentTile.type.toUpperCase()}: ${item.name.toUpperCase()}. PRESS [ENTER] TO MINE | PRESS [V] TO ANALYZE.`);
    }

    // Hazard storm movement
    this.updateStorms();

    // Stranded check
    if (this.energy <= 0) {
      this.triggerStrandedRecovery();
    }
  },

  calculateRoverCargoMass() {
    let mass = 0;
    for (let i = 0; i < this.cargo.length; i++) {
      const itemKey = this.cargo[i];
      const comm = GameData.commodities[itemKey];
      if (comm) mass += (comm.mass || 1.0);
    }
    return Math.max(0, mass);
  },

  checkTileInteraction(x, y) {
    const tile = this.grid[y][x];
    const ship = window.game.ship;
    const tvCargoLimit = GameData.upgrades.tvUpgrades.cargo[ship.tvUpgrades.cargo - 1].cap;
    const pState = this.getPlanetState();

    if (tile.type === "mineral") {
      const item = GameData.commodities[tile.item];
      if (this.cargo.length >= tvCargoLimit) {
        AudioController.playBeep('error');
        UI.addLog("ROVER CARGO LIMIT: Capacity full. Return to Lander to unload samples.");
        return;
      }
      this.cargo.push(tile.item);
      this.grid[y][x] = { type: "empty" };
      pState.minedTiles[`${x}_${y}`] = true;
      AudioController.playBeep('success');
      UI.addLog(`Mined: Collected ${item.name} into Rover bed (${this.cargo.length}/${tvCargoLimit}).`);
      window.game.saveGame();
    } 
    else if (tile.type === "bio") {
      const item = GameData.commodities[tile.item];
      if (this.cargo.length >= tvCargoLimit) {
        AudioController.playBeep('error');
        UI.addLog("ROVER CARGO LIMIT: Capacity full.");
        return;
      }

      // Check if carrying live fauna without bio-containment module
      if (item.needsBio && ship.cargoLevel < 4) {
        AudioController.playBeep('error');
        UI.addLog("BIO WARNING: Collecting live fauna requires ship Bio-Containment bays upgrade.");
        return;
      }

      this.cargo.push(tile.item);
      this.grid[y][x] = { type: "empty" };
      pState.minedTiles[`${x}_${y}`] = true;
      AudioController.playBeep('success');
      UI.addLog(`Sampled: Collected ${item.name} into Rover container (${this.cargo.length}/${tvCargoLimit}).`);
      window.game.saveGame();
    }
    else if (tile.type === "dropped") {
      const item = GameData.commodities[tile.item] || { name: tile.item };
      if (this.cargo.length >= tvCargoLimit) {
        AudioController.playBeep('error');
        UI.addLog("ROVER CARGO LIMIT: Capacity full. Drop items off to pick up dropped cargo.");
        return;
      }
      this.cargo.push(tile.item);
      this.grid[y][x] = { type: "empty" };
      delete pState.droppedItems[`${x}_${y}`];
      AudioController.playBeep('success');
      UI.addLog(`RECOVERED: Picked up dropped ${item.name} from surface into Rover bed (${this.cargo.length}/${tvCargoLimit}).`);
      window.game.saveGame();
    }
    else if (tile.type === "ruin") {
      const artifactName = tile.name;
      
      // Collect artifact directly to ship's special manifest (massless)
      if (!ship.artifactsCollected.includes(artifactName)) {
        ship.artifactsCollected.push(artifactName);
        this.grid[y][x] = { type: "empty" };
        pState.minedTiles[`${x}_${y}`] = true;
        AudioController.playVictory();
        UI.addLog(`PRECURSOR MONOLITH DECRYPTED! ARCHIVE RETRIEVED: ${artifactName.toUpperCase()}`);
        UI.addLog("Lore logs decrypted. Starbase Prime HQ database unlocked.");
        
        if (typeof QuestEngine !== "undefined") {
          QuestEngine.notify("artifact", { artifact: artifactName });
        }
        window.game.saveGame();
        Spaceport.renderHqLogs();
      }
    }
    else if (tile.type === "tech_ruin" || tile.type === "wreck") {
      const part = tile.part || GameData.techParts.warp_conduit;
      this.grid[y][x] = { type: "empty" };
      pState.minedTiles[`${x}_${y}`] = true;
      AudioController.playVictory();
      UI.addLog(`PRECURSOR SALVAGE DECRYPTED! RARE TECH PART RECOVERED: ${part.name.toUpperCase()}`);
      UI.openTechPartModal(part);
      window.game.saveGame();
    }
  },

  updateStorms() {
    this.stormTicks++;
    if (this.stormTicks % 2 !== 0) return; // move every two steps

    const ship = window.game.ship;
    if (!ship.tvUpgrades) ship.tvUpgrades = { engine: 1, armor: 1, blaster: 0, cargo: 1 };
    const tvArmorIdx = Math.max(0, (ship.tvUpgrades.armor || 1) - 1);
    const armorUpgrade = GameData.upgrades.tvUpgrades.armor[tvArmorIdx] || GameData.upgrades.tvUpgrades.armor[0];
    const armorMod = armorUpgrade.defense;

    this.monsters.forEach(m => {
      // Wandering drift toward rover
      const dx = Math.sign(this.roverX - m.x);
      const dy = Math.sign(this.roverY - m.y);

      // 50% random chance to move toward player
      if (Math.random() < 0.5) {
        const nx = m.x + (Math.random() < 0.5 ? dx : 0);
        const ny = m.y + (Math.random() < 0.5 ? dy : 0);

        if (nx >= 0 && nx < this.gridWidth && ny >= 0 && ny < this.gridHeight) {
          if (this.grid[ny][nx].type !== "mountain" && this.grid[ny][nx].type !== "lander") {
            m.x = nx;
            m.y = ny;
          }
        }
      }

      // Check collision with rover
      if (m.x === this.roverX && m.y === this.roverY) {
        const dmg = (15 + Math.floor(Math.random() * 15)) * armorMod;
        this.hull = Math.max(0, this.hull - dmg);
        AudioController.playExplosion();
        UI.addLog(`STORM HAZARD IMPACT: TV Hull sustained -${Math.round(dmg)}% damage!`);

        if (this.hull <= 0) {
          this.triggerRoverDestroyed();
        }
      }
    });
  },

  triggerStrandedRecovery() {
    AudioController.playBeep('error');
    UI.addLog("CRITICAL ENERGY DEPLETED: ROVER ENGINE POWER COLLAPSED.");
    UI.addLog("EMERGENCY RECOVERY POD LAUNCHED. TV DISCARDED ON SURFACE.");
    UI.addLog("- ALL UNLOADED SAMPLES LOST.");

    this.cargo = [];
    this.active = false;
    window.game.viewState = "navigation";
    UI.switchView("navigation");
    
    UI.updateShip(window.game.ship);
    window.game.saveGame();
  },

  triggerRoverDestroyed() {
    const game = window.game;
    AudioController.playExplosion();
    UI.addLog("ROVER CRITICAL STRUCTURAL FAILURE: EXPLODED.");
    UI.addLog("CREW EVACUATED TO ORBIT VIA DOCK POD.");
    UI.addLog("- GATHERED CARGO SAMPLES: DESTROYED.");

    // Injury checking on crew
    const roles = ['captain', 'science', 'navigator', 'engineer', 'comm', 'doctor'];
    roles.forEach(role => {
      const member = game.ship.crew[role];
      if (member) {
        member.hp = Math.max(10, member.hp - 35); // injure crew
      }
    });

    this.cargo = [];
    this.active = false;
    game.viewState = "navigation";
    UI.switchView("navigation");
    
    UI.updateCrew(game.ship);
    UI.updateShip(game.ship);
    game.saveGame();
  },

  // Surface TV Cargo Manifest Popup
  openRoverCargoModal() {
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) {
      AudioController.playBeep('click');
    }
    const modal = document.getElementById("tv-cargo-modal");
    const container = document.getElementById("tv-cargo-manifest-details");
    if (!modal || !container) return;

    const ship = window.game.ship;
    const tvCap = GameData.upgrades.tvUpgrades.cargo[ship.tvUpgrades.cargo - 1].cap;
    const counts = {};
    let totalValue = 0;
    let totalMass = 0;

    this.cargo.forEach(k => {
      counts[k] = (counts[k] || 0) + 1;
      const comm = GameData.commodities[k];
      if (comm) {
        totalValue += (comm.sellVal || 0);
        totalMass += (comm.mass || 1.0);
      }
    });

    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; background-color: rgba(0, 204, 255, 0.08); padding: 8px 12px; border: 1px solid rgba(0, 204, 255, 0.3); border-radius: 4px; margin-bottom: 10px;">
        <span style="color: #00ccff; font-weight: bold;">BED CAPACITY: ${this.cargo.length} / ${tvCap} ITEMS (${totalMass.toFixed(1)} TONS)</span>
        <span style="color: #ffcc00; font-weight: bold; font-size: 12px;">EST. TOTAL VALUE: $${totalValue.toLocaleString()} M.U.</span>
      </div>
    `;

    let empty = true;

    for (let key in counts) {
      empty = false;
      const count = counts[key];
      const item = GameData.commodities[key] || { name: key, mass: 1, sellVal: 10 };
      const stackVal = item.sellVal * count;
      const stackMass = item.mass * count;

      html += `
        <div class="cargo-row" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px dashed rgba(0,204,255,0.25); margin-bottom: 4px; background-color: rgba(0, 204, 255, 0.03);">
          <div style="flex-grow: 1;">
            <strong style="color: #00ccff; font-size: 13px;">${item.name.toUpperCase()}</strong> <span style="color: #88ccaa;">(${count} ${count === 1 ? 'unit' : 'units'})</span><br>
            <span style="font-size: 11px; color: #ffcc00; font-weight: bold;">VALUE: $${item.sellVal} / unit &nbsp;➔&nbsp; TOTAL: $${stackVal.toLocaleString()} M.U.</span><br>
            <span style="font-size: 10px; color: #88ccaa;">Mass: ${stackMass.toFixed(1)} T (${item.mass} T/unit)</span>
          </div>
          <div class="cargo-row-actions" style="display: flex; gap: 6px;">
            <button class="glow-btn red-glow btn-sm" onclick="PlanetExploration.discardRoverItem('${key}')">DISCARD 1</button>
            <button class="glow-btn red-glow btn-sm" onclick="PlanetExploration.discardAllRoverItemsOfKey('${key}')">DISCARD ALL</button>
          </div>
        </div>
      `;
    }

    if (empty) {
      html += `<div style="text-align:center; padding: 30px 0; color: rgba(0, 204, 255, 0.4);">ROVER BED IS EMPTY. MINED ORES & BIO-SAMPLES WILL APPEAR HERE.</div>`;
    }

    container.innerHTML = html;
    modal.classList.remove("hidden");
  },

  closeRoverCargoModal() {
    if (typeof AudioController !== 'undefined' && AudioController.playBeep) {
      AudioController.playBeep('click');
    }
    const modal = document.getElementById("tv-cargo-modal");
    if (modal) modal.classList.add("hidden");
  },

  dropItemOntoSurface(itemKey) {
    if (!this.grid) return;
    const rx = this.roverX;
    const ry = this.roverY;
    const pState = this.getPlanetState();

    // Check if current tile can hold dropped item
    if (this.grid[ry][rx].type === "empty") {
      this.grid[ry][rx] = { type: "dropped", item: itemKey };
      pState.droppedItems[`${rx}_${ry}`] = itemKey;
      delete pState.minedTiles[`${rx}_${ry}`];
      window.game.saveGame();
      return;
    }

    // Search adjacent cells for an empty tile
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = rx + dx;
        const ty = ry + dy;
        if (tx >= 0 && tx < this.gridWidth && ty >= 0 && ty < this.gridHeight) {
          if (this.grid[ty][tx].type === "empty") {
            this.grid[ty][tx] = { type: "dropped", item: itemKey };
            pState.droppedItems[`${tx}_${ty}`] = itemKey;
            delete pState.minedTiles[`${tx}_${ty}`];
            window.game.saveGame();
            return;
          }
        }
      }
    }
  },

  discardRoverItem(key) {
    const idx = this.cargo.indexOf(key);
    if (idx !== -1) {
      this.cargo.splice(idx, 1);
      this.dropItemOntoSurface(key);

      const item = GameData.commodities[key] || { name: key };
      UI.addLog(`DISCARDED 1 ${item.name.toUpperCase()} ONTO SURFACE AT SECTOR (${this.roverX}, ${this.roverY}).`);
      if (typeof AudioController !== 'undefined' && AudioController.playBeep) {
        AudioController.playBeep('error');
      }
    }
    this.openRoverCargoModal();
  },

  discardAllRoverItemsOfKey(key) {
    const item = GameData.commodities[key] || { name: key };
    let removed = 0;
    this.cargo = this.cargo.filter(k => {
      if (k === key) {
        removed++;
        this.dropItemOntoSurface(key);
        return false;
      }
      return true;
    });
    if (removed > 0) {
      UI.addLog(`DISCARDED ${removed} UNITS OF ${item.name.toUpperCase()} ONTO PLANET SURFACE.`);
      if (typeof AudioController !== 'undefined' && AudioController.playBeep) {
        AudioController.playBeep('error');
      }
    }
    this.openRoverCargoModal();
  },

  discardAllRoverCargo() {
    if (this.cargo.length === 0) return;
    if (confirm("Discard all harvested items onto planet surface?")) {
      const count = this.cargo.length;
      this.cargo.forEach(key => this.dropItemOntoSurface(key));
      this.cargo = [];
      UI.addLog(`DISCARDED ALL ${count} ITEMS ONTO PLANET SURFACE.`);
      if (typeof AudioController !== 'undefined' && AudioController.playBeep) {
        AudioController.playBeep('error');
      }
      this.openRoverCargoModal();
    }
  },

  // Unload cargo at lander tile without ascending to orbit
  unloadAtLander() {
    const tile = this.grid[this.roverY][this.roverX];
    if (tile.type !== "lander") {
      AudioController.playBeep('error');
      UI.addLog("ROVER ERROR: Must position Rover on Lander tile [H] to unload into ship.");
      return;
    }

    if (this.cargo.length === 0) {
      AudioController.playBeep('error');
      UI.addLog("LANDER UNLOAD: Rover cargo bed is already empty.");
      return;
    }

    const ship = window.game.ship;
    const currentShipMass = UI.calculateCargoMass(ship.cargo);
    const roverMass = this.calculateRoverCargoMass();

    if (currentShipMass + roverMass <= ship.cargoCap) {
      const count = this.cargo.length;
      this.cargo.forEach(itemKey => {
        ship.cargo[itemKey] = (ship.cargo[itemKey] || 0) + 1;
      });
      this.cargo = [];

      AudioController.playBeep('success');
      UI.addLog(`UNLOAD SUCCESSFUL: +${count} samples moved into ship hold. ROVER REMAINS DEPLOYED ON SURFACE.`);
      UI.updateShip(ship);
      window.game.saveGame();
    } else {
      AudioController.playBeep('error');
      UI.addLog("SHIP CARGO CAPACITY REACHED! Open transfer manifest to manage hold.");
      this.openTransferModal();
    }
  },

  returnToShip() {
    // Only works when standing on the lander tile
    const tile = this.grid[this.roverY][this.roverX];
    if (tile.type !== "lander") {
      AudioController.playBeep('error');
      UI.addLog("ROVER ERROR: Must navigate back to Lander Zone coordinates to launch.");
      return;
    }

    const ship = window.game.ship;
    const currentShipMass = UI.calculateCargoMass(ship.cargo);
    const roverMass = this.calculateRoverCargoMass();

    if (currentShipMass + roverMass <= ship.cargoCap) {
      // Auto transfer all items into ship
      this.cargo.forEach(itemKey => {
        ship.cargo[itemKey] = (ship.cargo[itemKey] || 0) + 1;
      });
      if (this.cargo.length > 0) {
        UI.addLog(`TRANSFER COMPLETED: ${this.cargo.length} samples transferred to ship hold.`);
      }
      this.cargo = [];
      
      this.active = false;
      window.game.viewState = "navigation";
      UI.switchView("navigation");
      
      AudioController.playBeep('success');
      UI.addLog("LAUNCHING LANDER VESSEL. DOCKING COMPLETED IN SYSTEM ORBIT.");
      UI.updateShip(ship);
      window.game.saveGame();
    } else {
      // Ship cargo cannot hold everything: open interactive transfer modal!
      AudioController.playBeep('error');
      UI.addLog("SHIP CARGO CAPACITY REACHED! Select items to transfer, jettison, or leave in Rover.");
      this.openTransferModal();
    }
  },

  openTransferModal() {
    const modal = document.getElementById("transfer-modal");
    if (!modal) return;
    this.renderTransferModal();
    modal.classList.remove("hidden");
  },

  renderTransferModal() {
    const ship = window.game.ship;
    const currentShipMass = UI.calculateCargoMass(ship.cargo);
    const roverMass = this.calculateRoverCargoMass();
    const details = document.getElementById("transfer-modal-details");

    let shipTotalVal = 0;
    for (let k in ship.cargo) {
      const comm = GameData.commodities[k];
      if (comm) shipTotalVal += (ship.cargo[k] * comm.sellVal);
    }

    let roverTotalVal = 0;
    this.cargo.forEach(k => {
      const comm = GameData.commodities[k];
      if (comm) roverTotalVal += comm.sellVal;
    });

    let shipHtml = `
      <div class="transfer-column">
        <h3 style="color: #00ff66;">SHIP HOLD (${currentShipMass.toFixed(1)} / ${ship.cargoCap} T) &nbsp;|&nbsp; <span style="color: #ffcc00;">$${shipTotalVal.toLocaleString()} M.U.</span></h3>
        <div class="transfer-list">
    `;

    let emptyShip = true;
    for (let key in ship.cargo) {
      const count = ship.cargo[key];
      if (count > 0) {
        emptyShip = false;
        const item = GameData.commodities[key] || { name: key, mass: 1, sellVal: 10 };
        shipHtml += `
          <div class="cargo-row" style="align-items: center; padding: 6px 0;">
            <div style="flex-grow: 1;">
              <strong style="color: #00ff66;">${item.name.toUpperCase()}</strong> (${count})<br>
              <span style="font-size: 10px; color: #ffcc00; font-weight: bold;">Val: $${item.sellVal}/ea ($${(item.sellVal * count).toLocaleString()})</span> &nbsp;|&nbsp; <span style="font-size: 10px; color: #88ccaa;">Mass: ${item.mass} T/ea</span>
            </div>
            <button class="glow-btn red-glow btn-sm" onclick="PlanetExploration.jettisonShipItemInTransfer('${key}')">JETTISON 1</button>
          </div>
        `;
      }
    }
    if (emptyShip) shipHtml += `<div style="color:#666; font-size:11px; padding: 10px 0;">Ship cargo is empty.</div>`;
    shipHtml += `</div></div>`;

    // Rover cargo list
    let roverHtml = `
      <div class="transfer-column">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0, 255, 102, 0.3); padding-bottom: 4px; margin-bottom: 8px;">
          <h3 style="margin: 0; border: none; padding: 0; color: #00ccff;">ROVER CARGO (${this.cargo.length} Items, ${roverMass.toFixed(1)} T) &nbsp;|&nbsp; <span style="color: #ffcc00;">$${roverTotalVal.toLocaleString()} M.U.</span></h3>
          <button class="glow-btn green-glow btn-sm" onclick="PlanetExploration.transferAllFittingToShip()">TRANSFER ALL (FIT)</button>
        </div>
        <div class="transfer-list">
    `;

    if (this.cargo.length === 0) {
      roverHtml += `<div style="color:#666; font-size:11px; padding: 10px 0;">No items remaining in Rover bed.</div>`;
    } else {
      // Group rover cargo
      const counts = {};
      this.cargo.forEach(k => counts[k] = (counts[k] || 0) + 1);

      for (let key in counts) {
        const count = counts[key];
        const item = GameData.commodities[key] || { name: key, mass: 1, sellVal: 10 };
        const canFit = (currentShipMass + item.mass) <= ship.cargoCap;
        roverHtml += `
          <div class="cargo-row" style="align-items: center; padding: 6px 0;">
            <div style="flex-grow: 1;">
              <strong style="color: #00ccff;">${item.name.toUpperCase()}</strong> (${count})<br>
              <span style="font-size: 10px; color: #ffcc00; font-weight: bold;">Val: $${item.sellVal}/ea ($${(item.sellVal * count).toLocaleString()})</span> &nbsp;|&nbsp; <span style="font-size: 10px; color: #88ccaa;">Mass: ${item.mass} T/ea</span>
            </div>
            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
              <button class="glow-btn green-glow btn-sm" ${canFit ? '' : 'disabled'} onclick="PlanetExploration.transferItemToShip('${key}')">TRANSFER 1</button>
              <button class="glow-btn green-glow btn-sm" ${canFit ? '' : 'disabled'} onclick="PlanetExploration.transferAllOfKeyToShip('${key}')">TRANSFER ALL</button>
              <button class="glow-btn red-glow btn-sm" onclick="PlanetExploration.discardRoverItem('${key}')">DISCARD 1</button>
            </div>
          </div>
        `;
      }
    }
    roverHtml += `</div></div>`;

    details.innerHTML = shipHtml + roverHtml;
  },

  transferItemToShip(key) {
    const ship = window.game.ship;
    const item = GameData.commodities[key] || { name: key, mass: 1 };
    const currentShipMass = UI.calculateCargoMass(ship.cargo);

    if (currentShipMass + item.mass <= ship.cargoCap) {
      const idx = this.cargo.indexOf(key);
      if (idx !== -1) {
        this.cargo.splice(idx, 1);
        ship.cargo[key] = (ship.cargo[key] || 0) + 1;
        UI.updateShip(ship);
        this.renderTransferModal();
      }
    } else {
      // Never fail silently - the player clicked a button and deserves a reason
      AudioController.playBeep('error');
      UI.addLog(`TRANSFER BLOCKED: ${item.name.toUpperCase()} NEEDS ${item.mass} T BUT ONLY ${(ship.cargoCap - currentShipMass).toFixed(1)} T OF HOLD REMAINS.`);
    }
  },

  transferAllOfKeyToShip(key) {
    const ship = window.game.ship;
    const item = GameData.commodities[key] || { name: key, mass: 1 };
    let moved = 0;

    while (this.cargo.includes(key)) {
      const currentShipMass = UI.calculateCargoMass(ship.cargo);
      if (currentShipMass + item.mass <= ship.cargoCap) {
        const idx = this.cargo.indexOf(key);
        this.cargo.splice(idx, 1);
        ship.cargo[key] = (ship.cargo[key] || 0) + 1;
        moved++;
      } else {
        break; // Ship full
      }
    }

    const stillLeft = this.cargo.filter(k => k === key).length;
    if (moved > 0) {
      AudioController.playBeep('success');
      UI.addLog(`TRANSFERRED ${moved} x ${item.name.toUpperCase()} INTO SHIP HOLD.`);
      if (stillLeft > 0) UI.addLog(`HOLD FULL: ${stillLeft} x ${item.name.toUpperCase()} REMAIN IN THE ROVER BED.`);
    } else {
      AudioController.playBeep('error');
      UI.addLog(`TRANSFER BLOCKED: NO ROOM FOR ${item.name.toUpperCase()} (${item.mass} T EACH).`);
    }

    UI.updateShip(ship);
    this.renderTransferModal();
  },

  // Shared mover: shifts every Rover sample that still fits into the ship hold.
  // Returns { moved, left } so callers can report honestly instead of claiming success.
  moveFittingCargoToShip() {
    const ship = window.game.ship;
    let moved = 0;

    for (let i = this.cargo.length - 1; i >= 0; i--) {
      const key = this.cargo[i];
      const item = GameData.commodities[key] || { name: key, mass: 1 };
      const currentShipMass = UI.calculateCargoMass(ship.cargo);

      if (currentShipMass + item.mass <= ship.cargoCap) {
        this.cargo.splice(i, 1);
        ship.cargo[key] = (ship.cargo[key] || 0) + 1;
        moved++;
      }
    }

    return { moved: moved, left: this.cargo.length };
  },

  transferAllFittingToShip() {
    const ship = window.game.ship;
    const res = this.moveFittingCargoToShip();

    if (res.moved > 0) {
      AudioController.playBeep('success');
      UI.addLog(`TRANSFER COMPLETED: ${res.moved} SAMPLES MOVED INTO SHIP HOLD.`);
      if (res.left > 0) UI.addLog(`${res.left} SAMPLES DID NOT FIT AND REMAIN IN THE ROVER BED.`);
    } else {
      AudioController.playBeep('error');
      UI.addLog("TRANSFER BLOCKED: SHIP HOLD IS FULL. JETTISON CARGO TO MAKE ROOM.");
    }

    UI.updateShip(ship);
    this.renderTransferModal();
  },

  jettisonShipItemInTransfer(key) {
    UI.jettisonCargoItem(key, 1);
    this.renderTransferModal();
  },

  confirmTransferAndStay() {
    const ship = window.game.ship;

    // Actually move the cargo. This button is labelled UNLOAD - it must unload.
    const res = this.moveFittingCargoToShip();

    const modal = document.getElementById("transfer-modal");
    if (modal) modal.classList.add("hidden");

    AudioController.playBeep(res.moved > 0 ? 'success' : 'error');
    if (res.moved > 0) {
      UI.addLog(`UNLOAD COMPLETED: ${res.moved} SAMPLES MOVED INTO SHIP HOLD. ROVER REMAINS ACTIVE ON SURFACE.`);
    } else {
      UI.addLog("UNLOAD FAILED: SHIP HOLD IS FULL. NOTHING WAS TRANSFERRED.");
    }
    if (res.left > 0) {
      UI.addLog(`ROVER STORAGE: ${res.left} SAMPLES DID NOT FIT AND REMAIN IN THE ROVER BED.`);
    }

    UI.updateShip(ship);
    window.game.saveGame();
  },

  confirmTransferAndAscend() {
    const ship = window.game.ship;

    // Actually move the cargo before lifting off, otherwise samples silently
    // ride back up still sitting in the Rover bed.
    const res = this.moveFittingCargoToShip();

    const modal = document.getElementById("transfer-modal");
    if (modal) modal.classList.add("hidden");

    this.active = false;
    window.game.viewState = "navigation";
    UI.switchView("navigation");

    AudioController.playBeep('success');
    if (res.moved > 0) {
      UI.addLog(`UNLOAD COMPLETED: ${res.moved} SAMPLES MOVED INTO SHIP HOLD.`);
    }
    UI.addLog("LAUNCHING LANDER VESSEL. DOCKING COMPLETED IN SYSTEM ORBIT.");
    if (res.left > 0) {
      UI.addLog(`ROVER STORAGE: ${res.left} SAMPLES DID NOT FIT AND REMAIN STORED IN THE ROVER FOR FUTURE DESCENT.`);
    }
    UI.updateShip(ship);
    window.game.saveGame();
  },

  getItemIconAndBadge(itemKey, tileType) {
    if (tileType === "ruin") {
      return { icon: "🏛️", label: "RUIN", color: "#00ff66" };
    }
    switch (itemKey) {
      case "endurium_ore":
        return { icon: "🔋", label: "ENDURIUM", color: "#00ff66" };
      case "precursor_alloy":
        return { icon: "💠", label: "PRECURSOR", color: "#00ccff" };
      case "gold":
        return { icon: "🪙", label: "GOLD", color: "#ffcc00" };
      case "platinum":
        return { icon: "💎", label: "PLATINUM", color: "#e0e0e0" };
      case "iron":
        return { icon: "🧱", label: "IRON ORE", color: "#ffaa55" };
      case "bio_fauna":
        return { icon: "👾", label: "FAUNA", color: "#ff66cc" };
      case "bio_flora":
        return { icon: "🌱", label: "FLORA", color: "#66ffaa" };
      default:
        if (tileType === "mineral") return { icon: "⛏️", label: "MINERAL", color: "#ffcc00" };
        if (tileType === "bio") return { icon: "🧬", label: "SPECIMEN", color: "#8888ff" };
        return { icon: "📦", label: "CRATE", color: "#ffcc00" };
    }
  },

  draw() {
    if (!this.ctx || !this.canvas) return;

    if (this.canvas.parentElement) {
      const w = this.canvas.parentElement.clientWidth;
      const h = this.canvas.parentElement.clientHeight - 24;
      if (w > 100 && h > 100 && (this.canvas.width !== w || this.canvas.height !== h)) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
    }

    if (!this.planet && window.game && window.game.ship) {
      this.planet = window.game.ship.currentPlanet;
    }

    if (this.planet && (!this.grid || this.grid.length === 0)) {
      this.generatePlanetaryGrid();
    }

    if (!this.grid || this.grid.length === 0) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw dark soil surface
    this.ctx.fillStyle = "#0c150c";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const hudHeight = 54;
    const availableW = this.canvas.width - 24;
    const availableH = this.canvas.height - hudHeight - 20;

    // Dynamic Viewport Coverage: Calculate tile count based on fixed visual density (~48px x ~44px)
    const targetTileW = 48;
    const targetTileH = 44;

    this.viewportW = Math.min(this.gridWidth, Math.max(12, Math.floor(availableW / targetTileW)));
    this.viewportH = Math.min(this.gridHeight, Math.max(8, Math.floor(availableH / targetTileH)));

    // Snap tile dimensions to fill available space smoothly
    this.cellW = Math.floor(availableW / this.viewportW);
    this.cellH = Math.floor(availableH / this.viewportH);

    const camX = Math.max(0, Math.min(this.gridWidth - this.viewportW, this.roverX - Math.floor(this.viewportW / 2)));
    const camY = Math.max(0, Math.min(this.gridHeight - this.viewportH, this.roverY - Math.floor(this.viewportH / 2)));

    const offsetX = Math.floor((this.canvas.width - (this.viewportW * this.cellW)) / 2);
    const offsetY = hudHeight + Math.floor((availableH - (this.viewportH * this.cellH)) / 2);

    const fontScale = (window.UI && window.UI.getFontScale) ? window.UI.getFontScale() : 1.0;
    const itemFontSize = Math.max(18, Math.floor(this.cellH * 0.58 * fontScale));
    const roverFontSize = Math.max(20, Math.floor(this.cellH * 0.70 * fontScale));

    // Draw Grid Cell lines
    this.ctx.strokeStyle = "rgba(0, 255, 102, 0.08)";
    this.ctx.lineWidth = 1;
    for (let vy = 0; vy <= this.viewportH; vy++) {
      this.ctx.beginPath();
      this.ctx.moveTo(offsetX, offsetY + (vy * this.cellH));
      this.ctx.lineTo(offsetX + (this.viewportW * this.cellW), offsetY + (vy * this.cellH));
      this.ctx.stroke();
    }
    for (let vx = 0; vx <= this.viewportW; vx++) {
      this.ctx.beginPath();
      this.ctx.moveTo(offsetX + (vx * this.cellW), offsetY);
      this.ctx.lineTo(offsetX + (vx * this.cellW), offsetY + (this.viewportH * this.cellH));
      this.ctx.stroke();
    }

    // Render Viewport cells
    const pState = this.getPlanetState();

    for (let vy = 0; vy < this.viewportH; vy++) {
      for (let vx = 0; vx < this.viewportW; vx++) {
        const gx = camX + vx;
        const gy = camY + vy;
        if (gy >= this.gridHeight || gx >= this.gridWidth) continue;
        
        const tileX = offsetX + (vx * this.cellW);
        const tileY = offsetY + (vy * this.cellH);

        // Highlight explored / traveled territory with clean high-contrast border (no dark fill overlay)
        if (pState.exploredTiles && pState.exploredTiles[`${gx}_${gy}`]) {
          this.ctx.strokeStyle = "rgba(0, 255, 102, 0.22)";
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(tileX + 2, tileY + 2, this.cellW - 4, this.cellH - 4);
        }

        const cell = this.grid[gy][gx];
        const px = tileX + Math.floor(this.cellW * 0.16);
        const py = tileY + Math.floor(this.cellH * 0.72);

        if (cell.type === "lander") {
          this.ctx.font = `bold ${itemFontSize}px Share Tech Mono`;
          this.ctx.fillStyle = "#00ccff";
          this.ctx.shadowBlur = 10;
          this.ctx.shadowColor = "#00ccff";
          this.ctx.fillText("[H]", px, py);
          this.ctx.shadowBlur = 0;
        }
        else if (cell.type === "past_lander") {
          this.ctx.font = `bold ${itemFontSize}px Share Tech Mono`;
          this.ctx.fillStyle = "#ffcc00";
          this.ctx.shadowBlur = 10;
          this.ctx.shadowColor = "#ffcc00";
          this.ctx.fillText("✕", px + 4, py);
          this.ctx.shadowBlur = 0;
        }
        else if (cell.type === "mountain") {
          this.ctx.beginPath();
          const cx = tileX + this.cellW / 2;
          const cy = tileY + this.cellH / 2;
          const mtnH = Math.floor(this.cellH * 0.38);
          const mtnW = Math.floor(this.cellW * 0.38);
          this.ctx.moveTo(cx, cy - mtnH);
          this.ctx.lineTo(cx - mtnW, cy + mtnH);
          this.ctx.lineTo(cx + mtnW, cy + mtnH);
          this.ctx.closePath();
          this.ctx.fillStyle = "#5c665e";
          this.ctx.fill();
        } 
        else if (cell.type === "mineral" || cell.type === "bio" || cell.type === "dropped") {
          const isAnalyzed = pState.analyzedTiles && pState.analyzedTiles[`${gx}_${gy}`];
          const itemInfo = this.getItemIconAndBadge(cell.item, cell.type);

          if (isAnalyzed) {
            // Render clean, large deposit icon (icon-only, no text overlay)
            this.ctx.font = `${itemFontSize + 2}px Share Tech Mono`;
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = itemInfo.color;
            this.ctx.fillText(itemInfo.icon, px, py);
            this.ctx.shadowBlur = 0;
          } else {
            // Un-scanned deposit (glowing Pickaxe ⛏️ or DNA 🧬 icon)
            const iconSym = (cell.type === "bio") ? "🧬" : (cell.type === "dropped" ? "📦" : "⛏️");
            const iconColor = (cell.type === "bio") ? "#00e5ff" : (cell.type === "dropped" ? "#ffaa00" : "#ffcc00");

            this.ctx.font = `${itemFontSize + 2}px Share Tech Mono`;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = iconColor;
            this.ctx.fillText(iconSym, px, py);
            this.ctx.shadowBlur = 0;
          }
        }
        else if (cell.type === "ruin" || cell.type === "tech_ruin") {
          this.ctx.font = `${itemFontSize + 4}px Share Tech Mono`;
          this.ctx.fillStyle = "#00ff66";
          this.ctx.shadowBlur = 10;
          this.ctx.shadowColor = "#00ff66";
          this.ctx.fillText("🏛️", px, py);
          this.ctx.shadowBlur = 0;
        }
        else if (cell.type === "wreck") {
          this.ctx.font = `${itemFontSize + 4}px Share Tech Mono`;
          this.ctx.fillStyle = "#00e5ff";
          this.ctx.shadowBlur = 10;
          this.ctx.shadowColor = "#00e5ff";
          this.ctx.fillText("🛸", px, py);
          this.ctx.shadowBlur = 0;
        }
      }
    }

    // Render Hazards relative to camera
    this.monsters.forEach(m => {
      if (m.x >= camX && m.x < camX + this.viewportW && m.y >= camY && m.y < camY + this.viewportH) {
        const vx = m.x - camX;
        const vy = m.y - camY;
        const px = offsetX + (vx * this.cellW) + Math.floor(this.cellW * 0.16);
        const py = offsetY + (vy * this.cellH) + Math.floor(this.cellH * 0.72);
        this.ctx.font = `${itemFontSize}px Share Tech Mono`;
        this.ctx.fillStyle = varColor("--danger-color");
        this.ctx.fillText("⚡", px, py);
      }
    });

    // Render Rover TV relative to camera
    const rvx = this.roverX - camX;
    const rvy = this.roverY - camY;
    const rpx = offsetX + (rvx * this.cellW) + Math.floor(this.cellW * 0.16);
    const rpy = offsetY + (rvy * this.cellH) + Math.floor(this.cellH * 0.72);

    this.ctx.font = `bold ${roverFontSize}px Share Tech Mono`;
    this.ctx.fillStyle = varColor("--primary-color");
    this.ctx.shadowBlur = 12;
    this.ctx.shadowColor = varColor("--primary-color");
    this.ctx.fillText("◎", rpx, rpy);
    this.ctx.shadowBlur = 0;

    // Check if standing on lander tile
    const atLander = (this.grid[this.roverY][this.roverX].type === "lander");
    if (atLander) {
      UI.elements.btnLand.disabled = false;
      UI.elements.btnLand.textContent = "UNLOAD AT LANDER [U]";
      UI.elements.btnScan.disabled = false;
      UI.elements.btnScan.textContent = "RETURN TO SHIP [L]";
    } else {
      UI.elements.btnLand.disabled = false;
      UI.elements.btnLand.textContent = "TV CARGO [I]";
      UI.elements.btnScan.disabled = false;
      UI.elements.btnScan.textContent = "ANALYZE DEPOSIT [A]";
    }

    // Calculate distance and compass direction to Lander pad
    const landerX = this.targetLandingX;
    const landerY = this.targetLandingY;
    const dx = landerX - this.roverX;
    const dy = landerY - this.roverY;
    const distSectors = Math.hypot(dx, dy);

    // Calculate Compass Direction Angle (dx: +East / -West, dy: +South / -North)
    const angleDeg = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
    
    let compassSymbol = "➡";
    let compassLabel = "EAST";
    if (angleDeg >= 22.5 && angleDeg < 67.5) { compassSymbol = "↘"; compassLabel = "SOUTHEAST"; }
    else if (angleDeg >= 67.5 && angleDeg < 112.5) { compassSymbol = "⬇"; compassLabel = "SOUTH"; }
    else if (angleDeg >= 112.5 && angleDeg < 157.5) { compassSymbol = "↙"; compassLabel = "SOUTHWEST"; }
    else if (angleDeg >= 157.5 && angleDeg < 202.5) { compassSymbol = "⬅"; compassLabel = "WEST"; }
    else if (angleDeg >= 202.5 && angleDeg < 247.5) { compassSymbol = "↖"; compassLabel = "NORTHWEST"; }
    else if (angleDeg >= 247.5 && angleDeg < 292.5) { compassSymbol = "⬆"; compassLabel = "NORTH"; }
    else if (angleDeg >= 292.5 && angleDeg < 337.5) { compassSymbol = "↗"; compassLabel = "NORTHEAST"; }
    if (distSectors < 0.5) { compassSymbol = "🎯"; compassLabel = "AT LANDER"; }

    // Energy burn per sector move
    const ship = window.game.ship;
    if (!ship.tvUpgrades) ship.tvUpgrades = { engine: 1, armor: 1, blaster: 0, cargo: 1 };

    const tvCargoIdx = Math.max(0, (ship.tvUpgrades.cargo || 1) - 1);
    const tvEngineIdx = Math.max(0, (ship.tvUpgrades.engine || 1) - 1);

    const cargoUpgrade = GameData.upgrades.tvUpgrades.cargo[tvCargoIdx] || GameData.upgrades.tvUpgrades.cargo[0];
    const engineUpgrade = GameData.upgrades.tvUpgrades.engine[tvEngineIdx] || GameData.upgrades.tvUpgrades.engine[0];

    const tvCap = cargoUpgrade.cap;
    const roverMass = this.calculateRoverCargoMass();
    const energyPerStep = (engineUpgrade.energyCost || 1.0) * (1.1 - (ship.crew && ship.crew.engineer ? ship.crew.engineer.skill / 200 : 0.2));
    const reqPowerToReturn = Math.ceil(distSectors * energyPerStep);
    const powerMargin = Math.round(this.energy - reqPowerToReturn);

    let returnStatusText = `SAFE (+${powerMargin}% MARGIN)`;
    let returnColor = varColor("--primary-color"); // Green

    if (this.energy < reqPowerToReturn) {
      returnStatusText = `CRITICAL! INSUFFICIENT RETURN POWER (-${Math.abs(powerMargin)}%)`;
      returnColor = varColor("--danger-color"); // Red
    } else if (powerMargin <= 15) {
      returnStatusText = `WARNING! LOW MARGIN (+${powerMargin}%)`;
      returnColor = varColor("--warning-color"); // Yellow
    }

    if (distSectors < 0.5) {
      returnStatusText = "STATIONED AT LANDER";
      returnColor = "#00ccff";
    }

    // Render Full-Width Telemetry HUD Banner
    const hudW = this.canvas.width - 24;
    const hudX = 12;
    const hudY = 6;
    const hudH = 44;

    this.ctx.fillStyle = "rgba(3, 12, 6, 0.94)";
    this.ctx.fillRect(hudX, hudY, hudW, hudH);
    this.ctx.strokeStyle = "rgba(0, 255, 102, 0.4)";
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeRect(hudX, hudY, hudW, hudH);

    const hudFontSize = Math.max(12, Math.floor(13 * fontScale));
    this.ctx.font = `bold ${hudFontSize}px Share Tech Mono`;

    const col1 = hudX + 10;
    const col2 = hudX + Math.floor(hudW * 0.20);
    const col3 = hudX + Math.floor(hudW * 0.38);
    const col4 = hudX + Math.floor(hudW * 0.54);
    const col5 = hudX + Math.floor(hudW * 0.82);

    // Line 1: Sector, Power %, Hull %, TV Cargo, Scan Prompt
    this.ctx.fillStyle = varColor("--primary-color");
    this.ctx.fillText(`SECTOR: (${this.roverX}, ${this.roverY})`, col1, hudY + 17);

    this.ctx.fillStyle = (this.energy > 30) ? varColor("--primary-color") : varColor("--warning-color");
    this.ctx.fillText(`POWER: ${Math.round(this.energy)}%`, col2, hudY + 17);

    this.ctx.fillStyle = (this.hull > 40) ? varColor("--danger-color") : "#ff6666";
    this.ctx.fillText(`HULL: ${Math.round(this.hull)}%`, col3, hudY + 17);

    this.ctx.fillStyle = varColor("--secondary-color");
    this.ctx.fillText(`CARGO: ${this.cargo.length}/${tvCap} (${roverMass.toFixed(1)}T)`, col4, hudY + 17);

    this.ctx.fillStyle = "#ffcc00";
    this.ctx.fillText(`ANALYZE: [A]`, col5, hudY + 17);

    // Line 2: Prominent Glowing Lander Compass Arrow Badge & Telemetry
    this.ctx.font = `bold ${hudFontSize + 6}px Share Tech Mono`;
    this.ctx.fillStyle = "#ffcc00";
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = "#ffcc00";
    this.ctx.fillText(compassSymbol, col1, hudY + 36);
    this.ctx.shadowBlur = 0;

    this.ctx.font = `bold ${hudFontSize}px Share Tech Mono`;
    this.ctx.fillStyle = "#ffcc00";
    this.ctx.fillText(`LANDER: ${compassLabel} (${distSectors.toFixed(1)} SEC)`, col1 + 22, hudY + 34);

    this.ctx.fillText(`REQ POWER: ${reqPowerToReturn}%`, col3, hudY + 34);
    this.ctx.fillStyle = returnColor;
    this.ctx.fillText(`STATUS: ${returnStatusText}`, col4, hudY + 34);
  }
};

// Helper function to read CSS variables programmatically
function varColor(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

window.PlanetExploration = PlanetExploration;
