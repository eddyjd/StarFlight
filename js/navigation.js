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
      if (e.key === "k" || e.key === "K") {
        UI.openLegendModal();
      }
      if (e.key === "w" || e.key === "W") {
        if (this.nearbyWormhole) {
          this.enterNearbyWormhole();
        }
      }
      if (e.key === "b" || e.key === "B") {
        if (this.nearbySpaceWreck) {
          this.salvageSpaceWreck();
        } else if (this.nearbyDerelict) {
          this.boardNearbyDerelict();
        }
      }
      if (e.key === "e" || e.key === "E") {
        if (this.nearbyDistressSignal) {
          this.investigateDistressSignal();
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

    // Starmap Canvas Mouse Wheel Zoom & Drag Pan Listeners
    const starmapCanvas = document.getElementById("starmapCanvas");
    if (starmapCanvas) {
      starmapCanvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
        this.mapZoom = Math.max(0.4, Math.min(4.0, this.mapZoom * zoomFactor));
        this.drawStarMap();
      });

      starmapCanvas.addEventListener("mousedown", (e) => {
        this.isDraggingMap = true;
        this.dragStartX = e.clientX - this.mapOffsetX;
        this.dragStartY = e.clientY - this.mapOffsetY;
      });

      window.addEventListener("mousemove", (e) => {
        if (this.isDraggingMap) {
          this.mapOffsetX = e.clientX - this.dragStartX;
          this.mapOffsetY = e.clientY - this.dragStartY;
          this.drawStarMap();
        }
      });

      window.addEventListener("mouseup", () => {
        this.isDraggingMap = false;
      });
    }
  },

  enterNearbyWormhole() {
    if (!this.nearbyWormhole) return;
    const wh = this.nearbyWormhole;
    if (typeof AudioController !== "undefined" && AudioController.playBeep) AudioController.playBeep("powerup");
    UI.addLog(`QUANTUM RIFT DETECTED! ENTERING ${wh.name.toUpperCase()}...`);
    UI.addLog(`SPACE-TIME WARP COMPLETED. ARRIVED AT ${wh.destName.toUpperCase()} (${wh.targetX}, ${wh.targetY}).`);
    this.shipX = wh.targetX;
    this.shipY = wh.targetY;
    this.shipVx = 0;
    this.shipVy = 0;
    window.game.ship.coordinates.x = this.shipX;
    window.game.ship.coordinates.y = this.shipY;
  },

  boardNearbyDerelict() {
    if (!this.nearbyDerelict) return;
    UI.openDerelictModal(this.nearbyDerelict);
  },

  salvageSpaceWreck() {
    if (!this.nearbySpaceWreck || this.nearbySpaceWreck.searched) return;
    const sw = this.nearbySpaceWreck;
    sw.searched = true;
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
        ship.cargo[chunk.type] = (ship.cargo[chunk.type] || 0) + 1;

        if (typeof AudioController !== "undefined" && AudioController.playBeep) AudioController.playBeep("powerup");
        UI.addLog(`TRACTOR SCOOP: RECOVERED 1 UNIT OF ${typeName} ORE INTO CARGO!`);
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
      this.bgStars.push({
        u: Math.random(),
        v: Math.random(),
        size: Math.random() * 1.8 + 0.5,
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
    ship.exploredSectors[`${secX}_${secY}`] = true;

    // 1. Singularity Black Hole Gravitational Pull Physics
    this.nearbyBlackHole = null;
    if (GameData.blackHoles) {
      GameData.blackHoles.forEach(bh => {
        const dist = Math.hypot(this.shipX - bh.x, this.shipY - bh.y);
        if (dist < bh.gravityRadius) {
          this.nearbyBlackHole = bh;
          // Apply continuous gravitational pull toward singularity core
          const angle = Math.atan2(bh.y - this.shipY, bh.x - this.shipX);
          const pullIntensity = (1 - (dist / bh.gravityRadius)) * bh.pullForce;
          this.shipVx += Math.cos(angle) * pullIntensity * dt;
          this.shipVy += Math.sin(angle) * pullIntensity * dt;

          // Check if pulled inside event horizon core
          if (dist < bh.coreRadius) {
            if (typeof AudioController !== "undefined" && AudioController.playBeep) AudioController.playBeep("powerup");
            UI.addLog(`CRITICAL WARP DISPLACEMENT! PULLED INTO ${bh.name.toUpperCase()} EVENT HORIZON!`);
            UI.addLog(`REEMERGED AT DISPLACED COORDINATES (${bh.destX}, ${bh.destY}).`);
            this.shipX = bh.destX;
            this.shipY = bh.destY;
            this.shipVx = 0;
            this.shipVy = 0;
          }
        }
      });
    }

    // 2. Derelict Station Proximity
    this.nearbyDerelict = null;
    if (GameData.derelicts) {
      GameData.derelicts.forEach(der => {
        const dist = Math.hypot(this.shipX - der.x, this.shipY - der.y);
        if (dist < 4.0) {
          this.nearbyDerelict = der;
        }
      });
    }

    // 3. Subspace Distress Signal Proximity
    this.nearbyDistressSignal = null;
    if (GameData.distressSignals) {
      GameData.distressSignals.forEach(sig => {
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

    // Check Proximity to Quantum Wormholes
    this.nearbyWormhole = null;
    if (GameData.wormholes) {
      GameData.wormholes.forEach(wh => {
        const dist = Math.hypot(this.shipX - wh.x, this.shipY - wh.y);
        if (dist < 4.0) {
          this.nearbyWormhole = wh;
        }
      });
    }

    // 5. Drifting Alien Space Wrecks Proximity
    this.nearbySpaceWreck = null;
    if (GameData.spaceWrecks) {
      GameData.spaceWrecks.forEach(sw => {
        if (!sw.searched) {
          const dist = Math.hypot(this.shipX - sw.x, this.shipY - sw.y);
          if (dist < 4.0) {
            this.nearbySpaceWreck = sw;
          }
        }
      });
    }

    // Update Control Panel Buttons dynamically
    if (UI.elements && UI.elements.btnEnterSystem) {
      if (this.nearbySpaceWreck) {
        UI.elements.btnEnterSystem.disabled = false;
        UI.elements.btnEnterSystem.textContent = `SALVAGE ALIEN WRECK [B]`;
      } else if (this.nearbyDerelict) {
        UI.elements.btnEnterSystem.disabled = false;
        UI.elements.btnEnterSystem.textContent = `BOARD DERELICT [B]`;
      } else if (this.nearbyDistressSignal) {
        UI.elements.btnEnterSystem.disabled = false;
        UI.elements.btnEnterSystem.textContent = `INVESTIGATE SIGNAL [E]`;
      } else if (this.nearbyWormhole) {
        UI.elements.btnEnterSystem.disabled = false;
        UI.elements.btnEnterSystem.textContent = `ENTER WORMHOLE [W]`;
      } else if (Math.hypot(this.shipX - 250.0, this.shipY - 250.0) < 4.0) {
        UI.elements.btnEnterSystem.disabled = false;
        UI.elements.btnEnterSystem.textContent = `DOCK AT STARBASE [L]`;
      }
    }

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
    if (!ship.exploredSectors) ship.exploredSectors = { "250_250": true };
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
      const basePx = originX + (coordX / 500) * mapW;
      return centerX + (basePx - centerX + this.mapOffsetX) * this.mapZoom;
    };

    const toCanvasY = (coordY) => {
      const basePy = originY + (coordY / 500) * mapH;
      return centerY + (basePy - centerY + this.mapOffsetY) * this.mapZoom;
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
    const fontSize = Math.min(18, Math.max(9, Math.round(10 * zScale)));

    // Draw Deep Space Nebulae Gas Clouds on Star Map
    if (GameData.nebulae) {
      GameData.nebulae.forEach(neb => {
        const nx = toCanvasX(neb.x);
        const ny = toCanvasY(neb.y);
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
          x: nx, y: ny, radius: nr,
          title: `☁ NEBULA: ${neb.name.toUpperCase()}`,
          details: `Location: (${neb.x}, ${neb.y})\nType: Deep Space Cloud Field\nProperties: ${neb.desc}`
        });
      });
    }

    // Draw Quantum Wormholes Portals on Star Map
    if (GameData.wormholes) {
      GameData.wormholes.forEach(wh => {
        const whPx = toCanvasX(wh.x);
        const whPy = toCanvasY(wh.y);
        const pulseRad = (7 + Math.abs(Math.sin(Date.now() / 250)) * 4) * zScale;

        ctx.strokeStyle = "#00e5ff";
        ctx.lineWidth = Math.max(1.5, 2 * zScale);
        ctx.shadowBlur = 10 * zScale;
        ctx.shadowColor = "#00e5ff";
        ctx.beginPath();
        ctx.arc(whPx, whPy, pulseRad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.font = `${fontSize + 4}px Share Tech Mono`;
        ctx.fillStyle = "#00e5ff";
        ctx.fillText("🌀", whPx - (fontSize / 2), whPy + (fontSize / 3));

        this.mapTargets.push({
          type: "wormhole",
          x: whPx, y: whPy, radius: 14 * zScale,
          title: `🌀 QUANTUM WORMHOLE: ${wh.name.toUpperCase()}`,
          details: `Coordinates: (${wh.x}, ${wh.y})\nTarget Jump Destination: ${wh.destName}\nStatus: Active Space-Time Fold Portal`
        });
      });
    }

    // Draw Supermassive Black Holes on Star Map
    if (GameData.blackHoles) {
      GameData.blackHoles.forEach(bh => {
        const bhPx = toCanvasX(bh.x);
        const bhPy = toCanvasY(bh.y);
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

        this.mapTargets.push({
          type: "blackhole",
          x: bhPx, y: bhPy, radius: gravRad,
          title: `🕳 BLACK HOLE: ${bh.name.toUpperCase()}`,
          details: `Location: (${bh.x}, ${bh.y})\nHazard: Extreme Gravitational Core\nProperties: ${bh.desc}`
        });
      });
    }

    // Draw Derelict Space Stations on Star Map
    if (GameData.derelicts) {
      GameData.derelicts.forEach(der => {
        const derPx = toCanvasX(der.x);
        const derPy = toCanvasY(der.y);

        ctx.font = `${fontSize + 3}px Share Tech Mono`;
        ctx.fillStyle = der.searched ? "#888888" : "#00e5ff";
        ctx.fillText("🛰️", derPx - (fontSize / 2), derPy + (fontSize / 3));

        this.mapTargets.push({
          type: "derelict",
          x: derPx, y: derPy, radius: 12 * zScale,
          title: `🛰️ PRECURSOR DERELICT: ${der.name.toUpperCase()}`,
          details: `Location: (${der.x}, ${der.y})\nStatus: ${der.searched ? 'Salvaged' : 'Unsearched Artifact Vault'}\nDetails: ${der.desc}`
        });
      });
    }

    // Draw Drifting Space Alien Wrecks on Star Map
    if (GameData.spaceWrecks) {
      GameData.spaceWrecks.forEach(sw => {
        const swPx = toCanvasX(sw.x);
        const swPy = toCanvasY(sw.y);

        ctx.font = `${fontSize + 3}px Share Tech Mono`;
        ctx.fillStyle = sw.searched ? "#777777" : "#00ffcc";
        ctx.fillText("🛸", swPx - (fontSize / 2), swPy + (fontSize / 3));

        this.mapTargets.push({
          type: "space_wreck",
          x: swPx, y: swPy, radius: 12 * zScale,
          title: `🛸 ALIEN WRECK: ${sw.name.toUpperCase()}`,
          details: `Location: (${sw.x}, ${sw.y})\nStatus: ${sw.searched ? 'Salvaged' : 'Unsearched Tech Component Wreck'}`
        });
      });
    }

    // Draw Subspace Distress Beacons on Star Map
    if (GameData.distressSignals) {
      GameData.distressSignals.forEach(sig => {
        if (!sig.active) return;
        const sigPx = toCanvasX(sig.x);
        const sigPy = toCanvasY(sig.y);
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
          x: sigPx, y: sigPy, radius: 12 * zScale,
          title: `📡 DISTRESS BEACON: ${sig.name.toUpperCase()}`,
          details: `Location: (${sig.x}, ${sig.y})\nBroadcast: ${sig.desc}`
        });
      });
    }

    // Check if any star system in a sector is discovered
    const systemInSectorDiscovered = (sx, sy) => {
      return GameData.starSystems.some(sys => {
        return sys.x >= sx && sys.x < sx + 25 && sys.y >= sy && sys.y < sy + 25 && ship.discoveredSystems[sys.name];
      });
    };

    // Draw Fog of War over unexplored 25x25 LY sectors
    for (let sx = 0; sx < 500; sx += 25) {
      for (let sy = 0; sy < 500; sy += 25) {
        const secKey = `${sx}_${sy}`;
        const isExplored = ship.exploredSectors[secKey] || systemInSectorDiscovered(sx, sy) || (Math.hypot(sx - 250, sy - 250) < 40);
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
    GameData.starSystems.forEach(sys => {
      const secX = Math.floor(sys.x / 25) * 25;
      const secY = Math.floor(sys.y / 25) * 25;
      const isDiscovered = ship.discoveredSystems && ship.discoveredSystems[sys.name];
      const isExplored = isDiscovered || ship.exploredSectors[`${secX}_${secY}`] || (Math.hypot(sys.x - 250, sys.y - 250) < 40);

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

    // Render Supermassive Black Holes in Viewport
    if (GameData.blackHoles) {
      GameData.blackHoles.forEach(bh => {
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
        }
      });
    }

    // Render Space Alien Wrecks in Viewport
    if (GameData.spaceWrecks) {
      GameData.spaceWrecks.forEach(sw => {
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
          this.ctx.fillText(`${sw.name.toUpperCase()} ${sw.searched ? '[SALVAGED]' : ''}`, px + 12, py + 3);
        }
      });
    }

    // Render Derelict Space Stations in Viewport
    if (GameData.derelicts) {
      GameData.derelicts.forEach(der => {
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
          this.ctx.fillText(`${der.name.toUpperCase()} ${der.searched ? '[SALVAGED]' : ''}`, px + 12, py + 3);
        }
      });
    }

    // Render Subspace Distress Beacons in Viewport
    if (GameData.distressSignals) {
      GameData.distressSignals.forEach(sig => {
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
