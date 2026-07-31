/**
 * Space Navigation Controller for StarFlight: Odyssey
 * Implements 2D Canvas space flight, inertia physics, Hyperspace map,
 * Solar systems, orbiting planets, and docking detection.
 */

const Navigation = {
  canvas: null,
  ctx: null,
  keys: {},

  // Physics state
  shipX: 100.0,
  shipY: 100.0,
  shipVx: 0,
  shipVy: 0,
  shipAngle: -Math.PI / 2, // facing up
  
  // Starfield backdrop
  bgStars: [],
  nebulae: [],
  
  // Radar sonar sweep
  sonarRadius: 0,
  sonarActive: false,

  // Active Alien Spacecraft flying in space
  alienShips: [
    { raceKey: "spemin", name: "Spemin Scout", x: 78.0, y: 72.0, vx: 0.8, vy: 0.5, angle: 0, color: "#00ff66" },
    { raceKey: "veloxi", name: "Veloxi Cruiser", x: 135.0, y: 105.0, vx: -0.6, vy: 0.7, angle: Math.PI / 4, color: "#ff5533" },
    { raceKey: "uhlek", name: "Uhlek Interceptor", x: 148.0, y: 152.0, vx: 0.3, vy: -0.8, angle: Math.PI, color: "#ff3333" }
  ],
  nearbyAlien: null,

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
        const factor = e.deltaY < 0 ? 1.15 : 0.85;
        this.zoomStarMap(factor);
      }, { passive: false });

      starmapCanvas.addEventListener("mousedown", (e) => {
        this.isDraggingMap = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
      });

      window.addEventListener("mousemove", (e) => {
        const modal = document.getElementById("starmap-modal");
        if (!modal || modal.classList.contains("hidden")) return;

        const rect = starmapCanvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        if (this.isDraggingMap) {
          const dx = e.clientX - this.dragStartX;
          const dy = e.clientY - this.dragStartY;
          this.dragStartX = e.clientX;
          this.dragStartY = e.clientY;

          this.mapOffsetX += dx / (this.mapZoom * 1.5);
          this.mapOffsetY += dy / (this.mapZoom * 1.5);
          this.drawStarMapCanvas();
          return;
        }

        const tooltip = document.getElementById("starmap-tooltip");
        let hoveredTarget = null;

        if (this.mapTargets) {
          for (let target of this.mapTargets) {
            const dist = Math.hypot(mx - target.x, my - target.y);
            if (dist <= target.radius) {
              hoveredTarget = target;
              break;
            }
          }
        }

        if (hoveredTarget && tooltip) {
          tooltip.innerHTML = `<strong>${hoveredTarget.title}</strong><div class="subtext">${hoveredTarget.details}</div>`;
          tooltip.style.left = `${Math.min(rect.width - 290, Math.max(10, mx + 15))}px`;
          tooltip.style.top = `${Math.min(rect.height - 80, Math.max(10, my + 15))}px`;
          tooltip.classList.remove("hidden");
          starmapCanvas.style.cursor = "pointer";
        } else if (tooltip) {
          tooltip.classList.add("hidden");
          starmapCanvas.style.cursor = "crosshair";
        }
      });

      window.addEventListener("mouseup", () => {
        this.isDraggingMap = false;
      });
    }
  },

  // Twinkling background star coordinates (normalized 0.0 - 1.0 across full canvas)
  generateBackground() {
    this.bgStars = [];
    for (let i = 0; i < 220; i++) {
      this.bgStars.push({
        u: Math.random(),
        v: Math.random(),
        size: Math.random() * 1.8 + 0.6,
        twinkle: Math.random() * Math.PI
      });
    }

    this.nebulae = [
      { u: 0.15, v: 0.25, rRatio: 0.18, color: "rgba(100, 50, 150, 0.09)" },
      { u: 0.70, v: 0.45, rRatio: 0.22, color: "rgba(0, 100, 150, 0.08)" },
      { u: 0.35, v: 0.75, rRatio: 0.15, color: "rgba(150, 50, 50, 0.07)" },
      { u: 0.85, v: 0.20, rRatio: 0.16, color: "rgba(0, 180, 120, 0.06)" }
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
      const docSkill = ship.crew.doctor ? ship.crew.doctor.skill : 40;
      const drainRate = 2 * (1 - docSkill / 200) * dt;
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

    // Keep coordinates within bounds (0 - 200 light years)
    this.shipX = Math.max(10, Math.min(190, this.shipX));
    this.shipY = Math.max(10, Math.min(190, this.shipY));

    // Update global ship coordinates
    ship.coordinates.x = this.shipX;
    ship.coordinates.y = this.shipY;

    // Track explored sectors in Fog of War
    if (!ship.exploredSectors) ship.exploredSectors = { "100_100": true };
    if (!ship.discoveredSystems) ship.discoveredSystems = { "Starbase Prime": true };
    const secX = Math.floor(this.shipX / 20) * 20;
    const secY = Math.floor(this.shipY / 20) * 20;
    ship.exploredSectors[`${secX}_${secY}`] = true;

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
    if (isNaN(this.shipX)) this.shipX = 100.0;
    if (isNaN(this.shipY)) this.shipY = 100.0;

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
    system.planets.forEach(planet => {
      planet.orbitAngle = (planet.orbitAngle || 0) + planet.speed * dt;
      
      // Calculate planet X, Y relative to star center
      const radiusPx = planet.radius * 1.6;
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
      const radiusPx = planet.radius * 1.6;
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

  // Dock at base (resets fuel, resets velocity vectors, loads Spaceport View)
  enterSpacebase() {
    const game = window.game;
    AudioController.playBeep('success');
    UI.addLog("DOCKING CLEARED. TRANSITING TO STARPORT BAY 1.");
    
    game.ship.isInSpacebase = true;
    game.ship.shieldsActive = false;
    game.ship.weaponsArmed = false;
    game.viewState = "spaceport";
    
    // Auto restore hull on docking
    game.ship.hull = game.ship.maxHull;

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
    Spaceport.renderAll();
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
    if (!ship.missiles || ship.missiles <= 0) {
      if (typeof AudioController !== 'undefined' && AudioController.playBeep) AudioController.playBeep('error');
      UI.addLog("WEAPON ALERT: Out of homing missiles.");
      return;
    }
    ship.missiles -= 1;
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
    UI.addLog(`TACTICAL: HOMING MISSILE LAUNCHED! (REMAINING: ${ship.missiles})`);
    UI.updateShip(ship);
  },

  enterSystem(system) {
    const game = window.game;
    AudioController.playBeep('success');
    UI.addLog(`ENTERED SOLAR SYSTEM: ${system.name.toUpperCase()}`);
    UI.addLog("ORBITAL PLANE GRID DETECTED.");
    
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
    this.mapOffsetX = (100 - coords.x) * 2.0;
    this.mapOffsetY = (100 - coords.y) * 2.0;
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

    this.drawStarMapCanvas();
    modal.classList.remove("hidden");
  },

  closeStarMapModal() {
    AudioController.playBeep('click');
    const modal = document.getElementById("starmap-modal");
    if (modal) modal.classList.add("hidden");
  },

  drawStarMapCanvas() {
    const canvas = document.getElementById("starmapCanvas");
    if (!canvas) return;
    
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
    if (!ship.exploredSectors) ship.exploredSectors = { "100_100": true };
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
      const basePx = originX + (coordX / 200) * mapW;
      return centerX + (basePx - centerX + this.mapOffsetX) * this.mapZoom;
    };

    const toCanvasY = (coordY) => {
      const basePy = originY + (coordY / 200) * mapH;
      return centerY + (basePy - centerY + this.mapOffsetY) * this.mapZoom;
    };

    // Draw background grid lines (every 20 LY)
    ctx.strokeStyle = "rgba(0, 255, 102, 0.12)";
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= 200; gx += 20) {
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
    for (let gy = 0; gy <= 200; gy += 20) {
      const py = toCanvasY(gy);
      ctx.beginPath();
      ctx.moveTo(originX, py);
      ctx.lineTo(originX + mapW, py);
      ctx.stroke();

      ctx.font = "9px Share Tech Mono";
      ctx.fillStyle = "rgba(0, 255, 102, 0.4)";
      ctx.fillText(gy, originX - 25, py + 3);
    }

    // Check if any star system in a sector is discovered
    const systemInSectorDiscovered = (sx, sy) => {
      return GameData.starSystems.some(sys => {
        return sys.x >= sx && sys.x < sx + 20 && sys.y >= sy && sys.y < sy + 20 && ship.discoveredSystems[sys.name];
      });
    };

    // Draw Fog of War over unexplored 20x20 LY sectors
    for (let sx = 0; sx < 200; sx += 20) {
      for (let sy = 0; sy < 200; sy += 20) {
        const secKey = `${sx}_${sy}`;
        const isExplored = ship.exploredSectors[secKey] || systemInSectorDiscovered(sx, sy) || (Math.hypot(sx - 100, sy - 100) < 30);
        if (!isExplored) {
          const px1 = toCanvasX(sx);
          const py1 = toCanvasY(sy);
          const px2 = toCanvasX(sx + 20);
          const py2 = toCanvasY(sy + 20);

          ctx.fillStyle = "rgba(4, 12, 6, 0.88)";
          ctx.fillRect(px1, py1, px2 - px1, py2 - py1);

          ctx.strokeStyle = "rgba(0, 50, 20, 0.25)";
          ctx.beginPath();
          ctx.moveTo(px1, py1); ctx.lineTo(px2, py2);
          ctx.stroke();
        }
      }
    }

    this.mapTargets = [];

    // Proportional zoom scale factor (sqrt scale for smooth natural growth)
    const zScale = Math.sqrt(this.mapZoom);
    const fontSize = Math.min(18, Math.max(9, Math.round(10 * zScale)));

    // Draw Explored/Discovered Star Systems (including Starbase Prime)
    GameData.starSystems.forEach(sys => {
      const secX = Math.floor(sys.x / 20) * 20;
      const secY = Math.floor(sys.y / 20) * 20;
      const isDiscovered = ship.discoveredSystems && ship.discoveredSystems[sys.name];
      const isExplored = isDiscovered || ship.exploredSectors[`${secX}_${secY}`] || (Math.hypot(sys.x - 100, sys.y - 100) < 30);

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
          ctx.fillText("★ STARBASE PRIME (100, 100)", sysPx + baseRadius + 4, sysPy + 4);

          this.mapTargets.push({
            type: "system",
            x: sysPx, y: sysPy, radius: (baseRadius + 6) * zScale,
            title: "★ STARBASE PRIME HQ",
            details: `Location: (100.0, 100.0)\nStatus: Operational Galactic Hub\nFacility: Refuel, Repairs, Upgrades & Personnel Command`
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
            x: sysPx, y: sysPy, radius: (starRadius + 6) * zScale,
            title: `⭐ STAR SYSTEM: ${sys.name.toUpperCase()}`,
            details: `Location: (${sys.x}, ${sys.y})\nPrimary Bodies: ${sys.planets ? sys.planets.length : 'Uncharted'} Planets`
          });
        }
      }
    });

    // Draw Past Alien Encounter History Markers
    if (ship.encounterHistory) {
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
          x: encPx, y: encPy, radius: 12 * zScale,
          title: `⚔ LOGGED ALIEN CONTACT: ${enc.raceName.toUpperCase()}`,
          details: `Coordinates: (${enc.x.toFixed(1)}, ${enc.y.toFixed(1)})\nClassification: Subspace Meeting Log\nStatus: Verified Record`
        });
      });
    }

    // Draw Active Alien Spacecraft flying in space on Starmap
    this.alienShips.forEach(alien => {
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
      UI.addLog("RADAR SCAN EMITTED... SCANNING FOR LOCAL STAR SYSTEM VECTORS & ALIEN SIGNATURES.");
      GameData.starSystems.forEach(sys => {
        const dist = Math.hypot(this.shipX - sys.x, this.shipY - sys.y);
        if (dist < 35.0) {
          if (!game.ship.discoveredSystems[sys.name]) {
            game.ship.discoveredSystems[sys.name] = true;
            AudioController.playBeep('success');
            UI.addLog(`NEW STAR SYSTEM DISCOVERED: ${sys.name.toUpperCase()} (COORD: X ${sys.x}, Y ${sys.y}) - CLASS ${sys.starClass}`);
          } else {
            UI.addLog(`STAR DETECTED: ${sys.name.toUpperCase()} (COORD: X ${sys.x}, Y ${sys.y}) - CLASS ${sys.starClass}`);
          }
        }
      });

      // Scan active alien spacecraft in space
      this.alienShips.forEach(alien => {
        const dist = Math.hypot(this.shipX - alien.x, this.shipY - alien.y);
        if (dist < 40.0) {
          const bearing = Math.round(((Math.atan2(alien.y - this.shipY, alien.x - this.shipX) * 180 / Math.PI) + 360) % 360);
          UI.addLog(`RADAR CONTACT: ${alien.name.toUpperCase()} DETECTED AT (COORD: X ${alien.x.toFixed(1)}, Y ${alien.y.toFixed(1)}) - DIST ${dist.toFixed(1)} LY - BEARING ${bearing}°`);
        }
      });
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
          this.ctx.fillText(`★ STARBASE PRIME (100, 100)`, px + 12, py + 4);
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
    system.planets.forEach(planet => {
      const radiusPx = planet.radius * 1.6;
      
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
  }
};

window.Navigation = Navigation;
