/**
 * StarFlight: Odyssey Static Database
 * Holds star systems, planets, ship modules, crew candidates, commodities, and dialogue templates.
 */

const GameData = {
  // Rare Ship Upgrade Tech Components (found in planet ruins/wrecks and space debris)
  techParts: {
    warp_conduit: {
      id: "warp_conduit",
      name: "Precursor Warp Conduit",
      icon: "⚡",
      desc: "An ancient chronos conduit that accelerates warp field generation. Permanently boosts Engine Level (+20% Speed & Efficiency)!",
      value: 2500,
      effect: "engine_boost"
    },
    quantum_shield_core: {
      id: "quantum_shield_core",
      name: "Quantum Shield Matrix Core",
      icon: "🛡️",
      desc: "A sub-atomic phase shielding core. Permanently increases Ship Shield Energy capacity by +30 points!",
      value: 2800,
      effect: "shield_boost"
    },
    titanium_composite: {
      id: "titanium_composite",
      name: "Titanium Composite Armor Plate",
      icon: "🧱",
      desc: "Molecularly-bonded precursor armor. Permanently increases Ship Max Hull integrity by +25 points!",
      value: 2200,
      effect: "hull_boost"
    },
    plasma_overcharger: {
      id: "plasma_overcharger",
      name: "Plasma Blaster Overcharger",
      icon: "🔫",
      desc: "Supercharges laser and plasma weapons. Permanently increases Ship Blaster Weapon Level (+15 Firepower)!",
      value: 3000,
      effect: "weapon_boost"
    },
    sensor_amplifier: {
      id: "sensor_amplifier",
      name: "Precursor Sensor Amplifier",
      icon: "📡",
      desc: "A resonance lattice that widens the deflector-array sensor cone. Permanently upgrades the Scanner module one class, extending both short-range and long-range sweeps!",
      value: 2600,
      effect: "scanner_boost"
    },
    hyper_cargo_compressor: {
      id: "hyper_cargo_compressor",
      name: "Subspace Cargo Compressor",
      icon: "📦",
      desc: "Uses dimensional folding to compress hold volume. Permanently expands Ship Cargo Hold by +15 slots!",
      value: 2400,
      effect: "cargo_boost"
    }
  },

  // Rare Drifting Alien Ship Wrecks in Hyperspace & Solar Systems
  spaceWrecks: [
    { id: "sw_1", name: "Alien Fighter Wreck Alpha", x: 160, y: 290, searched: false, techPartKey: "warp_conduit" },
    { id: "sw_2", name: "Precursor Scout Wreck Beta", x: 340, y: 120, searched: false, techPartKey: "quantum_shield_core" },
    { id: "sw_3", name: "Uhlek Assault Wreck Gamma", x: 430, y: 380, searched: false, techPartKey: "plasma_overcharger" },
    { id: "sw_4", name: "Deep Void Wreck Delta", x: 70, y: 370, searched: false, techPartKey: "titanium_composite" },
    { id: "sw_5", name: "Exploration Wreck Epsilon", x: 290, y: 440, searched: false, techPartKey: "hyper_cargo_compressor" }
  ],

  // Upgrades purchasable at Starport
  upgrades: {
    engines: [
      { level: 1, name: "Class 1 Fusion Impulse", cost: 0, weight: 10, fuelMult: 1.0, desc: "Standard fusion thruster. Slow sub-warp cruise speed." },
      { level: 2, name: "Class 2 Ion Sub-Warp Drive", cost: 1800, weight: 12, fuelMult: 0.8, desc: "High-grade ion engine. +50% sub-warp speed & better fuel range." },
      { level: 3, name: "Class 3 Hyper-Burner Core", cost: 4500, weight: 15, fuelMult: 0.65, desc: "Sub-light plasma burner. +100% solar cruising speed & low fuel burn." },
      { level: 4, name: "Class 4 Quantum Impulse Drive", cost: 10000, weight: 18, fuelMult: 0.5, desc: "Military grade quantum drive. +160% blazing speed, highly efficient." },
      { level: 5, name: "Class 5 Sub-Space Fold Engine", cost: 22000, weight: 20, fuelMult: 0.35, desc: "Ultimate graviton drive. +230% maximum velocity & minimal Endurium usage." }
    ],
    shields: [
      { level: 0, name: "No Shield Generator", cost: 0, maxEnergy: 0, desc: "Completely vulnerable to space hazards and blasters." },
      { level: 1, name: "Class 1 Deflector", cost: 800, maxEnergy: 40, desc: "Basic electromagnetic screen. Absorbs light fire." },
      { level: 2, name: "Class 2 Vector Screen", cost: 2000, maxEnergy: 85, desc: "Phased energy barrier. Moderate protection." },
      { level: 3, name: "Class 3 Kinetic Shield", cost: 4200, maxEnergy: 150, desc: "Dynamic absorption grid. Deals well with impact and lasers." },
      { level: 4, name: "Class 4 Phase Deflector", cost: 7500, maxEnergy: 240, desc: "Heavy phase-shifted shield. Advanced protection." },
      { level: 5, name: "Class 5 Multiplex Aegis", cost: 12000, maxEnergy: 380, desc: "Precursor-derived multi-phase grid. Elite shields." }
    ],
    armor: [
      { level: 1, name: "Titanium Plating", cost: 0, extraHull: 0, desc: "Standard hull plating. Weak to direct collisions." },
      { level: 2, name: "Duranium Lattice", cost: 1200, extraHull: 50, desc: "Reinforced duranium lattice. Increases hull durability." },
      { level: 3, name: "Adamant Alloy", cost: 3000, extraHull: 120, desc: "Synthetic alloy mesh. Absorbs significant physical shock." },
      { level: 4, name: "Neutronium Plate", cost: 6000, extraHull: 250, desc: "Ultra-dense heavy neutronium plates. Extreme defense." },
      { level: 5, name: "Bio-Organic Carapace", cost: 11000, extraHull: 450, desc: "Self-healing organic hull structure. Ultimate resilience." }
    ],
    blasters: [
      { level: 0, name: "Unarmed", cost: 0, damage: 0, energyCost: 0, desc: "No energy weapons installed." },
      { level: 1, name: "Laser Cannon", cost: 600, damage: 10, energyCost: 2, desc: "Light focus laser. Fast, low damage, energy efficient." },
      { level: 2, name: "Plasma Bolter", cost: 1800, damage: 22, energyCost: 5, desc: "Fires compressed plasma bolts. Good impact damage." },
      { level: 3, name: "Phased Disrupter", cost: 3800, damage: 45, energyCost: 10, desc: "Sub-atomic structural disruption beam. High damage." },
      { level: 4, name: "Antimatter Projector", cost: 7000, damage: 80, energyCost: 18, desc: "Injects anti-protons into targets. Massive armor decay." },
      { level: 5, name: "Singularity Beam", cost: 12500, damage: 140, energyCost: 30, desc: "Creates micro-singularities on target hull. Devastating power." }
    ],
    missiles: [
      { level: 0, name: "No Launcher", cost: 0, damage: 0, maxAmmo: 0, desc: "No projectile launcher equipped." },
      { level: 1, name: "Viper Rocket pod", cost: 1000, damage: 35, maxAmmo: 6, costPerMissile: 50, desc: "Unguided heavy kinetic rockets. Ignores energy shields." },
      { level: 2, name: "Stalker Torpedoes", cost: 2400, damage: 70, maxAmmo: 10, costPerMissile: 100, desc: "Guided fusion-warhead missiles. High hull impact." },
      { level: 3, name: "Doomfire Barrage", cost: 5500, damage: 150, maxAmmo: 14, costPerMissile: 220, desc: "Cluster missiles that tear through heavy plating. Devastating." }
    ],
    scanners: [
      { level: 1, name: "Standard Scanner", cost: 0, radius: 100, type: "std", desc: "Basic planetary mass and thermal sensor." },
      { level: 2, name: "Deep Grav-Sensor", cost: 1000, radius: 200, type: "deep", desc: "Measures localized gravitational waves and planetary orbits." },
      { level: 3, name: "Bio-Spectrometer", cost: 2500, radius: 300, type: "bio", desc: "Detections organic signatures and chemical compounds." },
      { level: 4, name: "Mineral Resonance Scan", cost: 4500, radius: 500, type: "min", desc: "Deep crust sub-surface sonar. Pinpoints ore veins." }
    ],
    cargos: [
      { level: 1, name: "Standard Cargo Bays", cost: 0, cap: 20, desc: "Holds minerals and trading commodities." },
      { level: 2, name: "Expanded Cargo Pods", cost: 1500, cap: 50, desc: "Doubles ship cargo capacity. Increases mass slightly." },
      { level: 3, name: "Shielded Cargo Bays", cost: 3500, cap: 45, desc: "Ablative shielding plates displace 5 T of usable volume, but mask the hold from hostile scans." },
      { level: 4, name: "Cold Bio-Containment", cost: 3000, cap: 40, desc: "Cryo-freeze grids displace a further 5 T of volume. REQUIRED to carry live alien fauna." }
    ],
    tvUpgrades: {
      engine: [
        { level: 1, name: "Tread Wheels", cost: 0, speed: 1, energyCost: 1.0, desc: "Standard heavy rover treads." },
        { level: 2, name: "Nitrous Thrusters", cost: 1000, speed: 1.4, energyCost: 0.8, desc: "Lightweight hover jet-assisted treads. Moves faster." },
        { level: 3, name: "Magnetic Repulsors", cost: 2500, speed: 1.8, energyCost: 0.5, desc: "Gravitational hover pads. Floating movement, super efficient." }
      ],
      armor: [
        { level: 1, name: "Steel Shell", cost: 0, defense: 1.0, desc: "Basic metal plates. Absorbs light bumps." },
        { level: 2, name: "Shielded Shell", cost: 1200, defense: 0.6, desc: "Fitted deflector barrier on rover. Absorbs 40% hazard damage." },
        { level: 3, name: "Refractory Alloy", cost: 3000, defense: 0.25, desc: "Absorbs 75% hazard damage, ignores acidic tiles and lava heat." }
      ],
      blaster: [
        { level: 0, name: "No TV Blaster", cost: 0, damage: 0, desc: "Rover is unarmed. Must flee from monsters." },
        { level: 1, name: "Light Phaser", cost: 800, damage: 20, desc: "Laser turret for clearing path and planetary lifeforms." },
        { level: 2, name: "Heavy Sonic Pulse", cost: 2200, damage: 60, desc: "Sonic shockwave blaster. Disintegrates hostile fauna easily." }
      ],
      cargo: [
        { level: 1, name: "Small Bed", cost: 0, cap: 5, desc: "Carries up to 5 items back to lander." },
        { level: 2, name: "Deep Bed", cost: 800, cap: 12, desc: "Rover cargo expansion. Holds 12 minerals/samples." },
        { level: 3, name: "Compressor Bed", cost: 1800, cap: 24, desc: "Sub-space compression storage. Carries 24 items." }
      ]
    }
  },

  // Crew candidates available at Starport Personnel
  crewCandidates: [
    { id: "cand_1", name: "Commander Vane", race: "Human", role: "Captain", skill: 45, cost: 400, hp: 100, maxHp: 100, desc: "Experienced star pilot with strict military background." },
    { id: "cand_2", name: "Dr. Lirix", race: "Elowan", role: "Doctor", skill: 60, cost: 500, hp: 80, maxHp: 80, desc: "Elowan herbal-physician. High medical skill, fragile health." },
    { id: "cand_3", name: "Tack-Tack", race: "Veloxi", role: "Engineer", skill: 55, cost: 450, hp: 110, maxHp: 110, desc: "Veloxi mechanic. Efficient with armor repairs and warp calibration." },
    { id: "cand_4", name: "Slyth", race: "Thrynn", role: "Comm", skill: 50, cost: 350, hp: 90, maxHp: 90, desc: "Cunning Thrynn merchant. High barter ability, silver-tongued communicator." },
    { id: "cand_5", name: "Zeta-7", race: "Human", role: "Navigator", skill: 40, cost: 300, hp: 100, maxHp: 100, desc: "Cyborg navigation officer. Quick spatial mapping calculations." },
    { id: "cand_6", name: "Professor Elos", race: "Human", role: "Science", skill: 65, cost: 600, hp: 70, maxHp: 70, desc: "Grizzled academic. Knows planet mineral vectors and precursor history." },
    { id: "cand_7", name: "Krogan", race: "Spemin", role: "Captain", skill: 20, cost: 150, hp: 120, maxHp: 120, desc: "Cowardly Spemin commander. Low skill, but works cheap and takes beatings." },
    { id: "cand_8", name: "Neri", race: "Elowan", role: "Navigator", skill: 55, cost: 450, hp: 85, maxHp: 85, desc: "Spiritual mapper. Intuitive navigation through solar gravity fields." }
  ],

  // Trade commodities and resources with realistic, distinct masses
  commodities: {
    fuel: { name: "Endurium Fuel", sellVal: 10, buyVal: 15, mass: 0.1 },
    iron: { name: "Iron Ore", sellVal: 20, buyVal: 60, mass: 2.0 },
    gold: { name: "Gold Nuggets", sellVal: 75, buyVal: 220, mass: 3.0 },
    platinum: { name: "Platinum Crystals", sellVal: 175, buyVal: 480, mass: 3.5 },
    endurium_ore: { name: "Raw Endurium", sellVal: 250, buyVal: 700, mass: 1.5 },
    precursor_alloy: { name: "Precursor Metal", sellVal: 600, buyVal: 1800, mass: 4.0 },
    bio_flora: { name: "Flora Specimen", sellVal: 50, buyVal: 150, mass: 0.5, needsBio: false },
    bio_fauna: { name: "Live Alien Fauna", sellVal: 400, buyVal: 1100, mass: 1.0, needsBio: true },
    alien_art: { name: "Veloxi Carving", sellVal: 600, buyVal: 900, mass: 0.8 },
    contraband: { name: "Spemin Spice", sellVal: 1500, buyVal: 2200, mass: 0.5, isContraband: true }
  },

  // Starport Command logs (unlocked through progression)
  hqLogs: [
    { title: "DISPATCH LOG 1 (URGENT)", text: "Commander, stellar activity in outer quadrants shows sudden collapse cycles. Sol-like G stars are bloating rapidly, emitting hyper-radiation. We need data from precursor monoliths. Scan sector 180, 220 for clues." },
    { title: "DECODED RUIN RECORD ALPHA", text: "Found on Arth-IV: '...the Flare occurred 20,000 cycles ago. The Precursor Aegis matrix stabilized the cores. It requires three crystal conduits: Earth Artifact, Nebular Crystal, and Void Core. They were scattered to coordinate matrices: (180, 220), (320, 190), and (85, 380).'" },
    { title: "INTELLIGENCE REPORT: UHLEK BORDER", text: "Warning: The Uhlek race is extremely territorial. They guard the quantum wormhole in coordinate sector (440, 420). DO NOT attempt communication. Shields must be fully charged if entering their territory." },
    { title: "RESEARCH SUMMARY: SAVING THE CORPS", text: "Bring all three Precursor Artifacts to Starbase Prime at (250, 250). The Depot engineers can integrate them with the warp reactor, triggering a dampening wave to stabilize all local stars." }
  ],

  // Deep Space Nebulae Regions (500x500 map)
  nebulae: [
    { id: "neb_1", name: "Tarantula Nebula", x: 100, y: 120, radius: 65, color: "rgba(255, 50, 120, 0.28)", desc: "Ionized hydrogen cloud. Shield recharge rate boosted by 50% inside gas field." },
    { id: "neb_2", name: "Crimson Cloud", x: 400, y: 320, radius: 75, color: "rgba(255, 80, 50, 0.28)", desc: "Dense energetic dust cloud. Scanners experience severe interference." },
    { id: "neb_3", name: "Emerald Veil", x: 160, y: 380, radius: 70, color: "rgba(50, 255, 120, 0.28)", desc: "Bio-organic plasma mist. Rich in rare flora and mineral deposits." },
    { id: "neb_4", name: "Orion Expanse", x: 280, y: 150, radius: 60, color: "rgba(80, 120, 255, 0.28)", desc: "Luminous stellar nursery. High Endurium energy concentrations." },
    { id: "neb_5", name: "Cygnus Rift", x: 430, y: 100, radius: 80, color: "rgba(180, 80, 255, 0.28)", desc: "Gamma radiation rift. Unstable warp vectors." },
    { id: "neb_6", name: "Phoenix Dust Field", x: 350, y: 440, radius: 70, color: "rgba(255, 180, 50, 0.28)", desc: "Glowing stellar ash. Ancient Precursor combat debris." },
    { id: "neb_7", name: "Aquila Dark Veil", x: 60, y: 260, radius: 55, color: "rgba(50, 200, 255, 0.28)", desc: "Dark absorption nebula. Stealth dampening field." },
    { id: "neb_8", name: "Precursor Core Mist", x: 250, y: 250, radius: 45, color: "rgba(0, 255, 160, 0.22)", desc: "Central sector aura surrounding Starbase Prime." }
  ],

  // Quantum Wormhole Pairs (500x500 map bidirectional teleporters)
  wormholes: [
    { id: "wh_1", name: "Wormhole Alpha-1", x: 80, y: 80, targetX: 420, targetY: 420, destName: "Wormhole Alpha-2 (Southeast Abyss)" },
    { id: "wh_2", name: "Wormhole Alpha-2", x: 420, y: 420, targetX: 80, targetY: 80, destName: "Wormhole Alpha-1 (Northwest Rim)" },
    { id: "wh_3", name: "Wormhole Beta-1", x: 420, y: 80, targetX: 80, targetY: 420, destName: "Wormhole Beta-2 (Southwest Reach)" },
    { id: "wh_4", name: "Wormhole Beta-2", x: 80, y: 420, targetX: 420, targetY: 80, destName: "Wormhole Beta-1 (Northeast Horizon)" },
    { id: "wh_5", name: "Wormhole Gamma-1", x: 250, y: 50, targetX: 250, targetY: 450, destName: "Wormhole Gamma-2 (Galactic South)" },
    { id: "wh_6", name: "Wormhole Gamma-2", x: 250, y: 450, targetX: 250, targetY: 50, destName: "Wormhole Gamma-1 (Galactic North)" },
    { id: "wh_7", name: "Wormhole Delta-1", x: 50, y: 250, targetX: 450, targetY: 250, destName: "Wormhole Delta-2 (Eastern Frontier)" },
    { id: "wh_8", name: "Wormhole Delta-2", x: 450, y: 250, targetX: 50, targetY: 250, destName: "Wormhole Delta-1 (Western Rim)" }
  ],

  // Supermassive Black Holes & Gravitational Singularities
  blackHoles: [
    { id: "bh_1", name: "Cygnus Singularity", x: 210, y: 310, gravityRadius: 35, coreRadius: 4, pullForce: 45, destX: 450, destY: 120, desc: "Extreme gravitational distortion field. High risk of warp displacement!" },
    { id: "bh_2", name: "Abyssal Gate Void", x: 410, y: 220, gravityRadius: 40, coreRadius: 5, pullForce: 50, destX: 90, destY: 380, desc: "Collapses space-time continuum. Teleports ships to remote southwest rim." },
    { id: "bh_3", name: "Precursor Singularity", x: 120, y: 440, gravityRadius: 30, coreRadius: 4, pullForce: 40, destX: 300, destY: 300, desc: "Ancient artificial gravity well created by Precursors." }
  ],

  // Abandoned Derelict Space Stations & Starships
  derelicts: [
    { id: "der_1", name: "Derelict Station Kronos-9", x: 140, y: 290, searched: false, loot: { type: "endurium", amount: 25, credits: 450, artifact: null, tech: "Shield Overcharger", techPartKey: "quantum_shield_core" }, desc: "Abandoned military outpost. Inert power signature." },
    { id: "der_2", name: "Precursor Quantum Relay", x: 310, y: 160, searched: false, loot: { type: "precursor_alloy", amount: 3, credits: 800, artifact: null, tech: "Sensor Amplifier", techPartKey: "sensor_amplifier" }, desc: "Massive ancient Precursor satellite matrix floating in high orbit." },
    { id: "der_3", name: "Ghost Vessel Vanguard", x: 440, y: 180, searched: false, loot: { type: "platinum", amount: 4, credits: 600, artifact: null, tech: "Plasma Capacitors", techPartKey: "plasma_overcharger" }, desc: "Drifting Earth exploration cruiser from the early expansion era." },
    { id: "der_4", name: "Spemin Abandoned Hub", x: 90, y: 110, searched: false, loot: { type: "alien_art", amount: 2, credits: 350, artifact: null, tech: "Cargo Injectors", techPartKey: "hyper_cargo_compressor" }, desc: "Deserted Spemin trading outpost filled with uncollected goods." },
    { id: "der_5", name: "Veloxi Dreadnought Wreck", x: 360, y: 390, searched: false, loot: { type: "endurium", amount: 40, credits: 1200, artifact: null, tech: "Heavy Armor Plating", techPartKey: "titanium_composite" }, desc: "Battle-scarred Veloxi flagship hull floating in deep space." },
    { id: "der_6", name: "Void Fortress Reliquary", x: 470, y: 440, searched: false, loot: { type: "precursor_alloy", amount: 5, credits: 1500, artifact: null, tech: "Subspace Warp Drive", techPartKey: "warp_conduit" }, desc: "Forbidden Precursor vault on the border of Uhlek territory." }
  ],

  // Starbase Prime Customs Patrols. They enforce the contraband ban only inside
  // their jurisdiction - the core sectors around the base. Beyond patrolZone.radius
  // is lawless space, which is what makes a Spemin Spice run worth the risk.
  patrolZone: { x: 250, y: 250, radius: 130 },
  patrols: [
    { id: "pat_1", name: "SFC Vigilant", x: 250, y: 205, vx: 4.5, vy: 2.4, angle: 0, color: "#00ccff" },
    { id: "pat_2", name: "SFC Sentinel", x: 200, y: 290, vx: -3.8, vy: 3.3, angle: 0, color: "#00ccff" },
    { id: "pat_3", name: "SFC Bulwark", x: 300, y: 255, vx: 3.0, vy: -4.2, angle: 0, color: "#00ccff" }
  ],

  // Contraband enforcement tuning
  customs: {
    hailRange: 7.0,        // LY at which a cutter hails you
    finePerUnit: 500,      // M.U. per unit of contraband seized
    evadeBaseChance: 0.35, // before engine bonus
    cooldownSeconds: 45    // grace period after any inspection
  },

  // Deep Space Asteroid Mining Fields
  asteroidFields: [
    { id: "ast_1", name: "Sirius Asteroid Belt", x: 190, y: 200, count: 12, density: "High", ores: ["iron", "platinum", "endurium_ore"] },
    { id: "ast_2", name: "Orion Debris Ring", x: 270, y: 130, count: 15, density: "Rich", ores: ["titanium", "gold", "endurium_ore"] },
    { id: "ast_3", name: "Vega Shattered Moon", x: 350, y: 430, count: 10, density: "Medium", ores: ["platinum", "titanium"] },
    { id: "ast_4", name: "Rigel Dust Belt", x: 420, y: 90, count: 14, density: "Rich", ores: ["gold", "endurium_ore", "platinum"] },
    { id: "ast_5", name: "Western Frontier Rocks", x: 50, y: 220, count: 8, density: "Standard", ores: ["iron", "titanium"] }
  ],

  // Dynamic Subspace Distress Signals
  distressSignals: [
    { id: "sig_1", name: "Distress Beacon: Stranded Trader", x: 230, y: 170, active: true, event: "trade_rescue", desc: "Civilian cargo ship with disabled engines requesting 10 Endurium units for 1,000 M.U." },
    { id: "sig_2", name: "Distress Beacon: Survey Probe", x: 380, y: 310, active: true, event: "probe_salvage", desc: "Automated telemetry probe transmitting corrupted precursor data logs." },
    { id: "sig_3", name: "Distress Beacon: Escape Pod", x: 110, y: 390, active: true, event: "rescue_pod", desc: "Cryo-pod carrying an expert Specialist Navigator looking to join a crew!" }
  ],

  // 30+ Star Systems spanning the 500x500 Galaxy Quadrant
  starSystems: [
    {
      name: "Starbase Prime",
      x: 250,
      y: 250,
      starClass: "G",
      starColor: "#ffcc00",
      descr: "G-type yellow dwarf star. Central Command HQ of Starbase Operations.",
      planets: [
        { name: "Arth", radius: 45, speed: 0.015, color: "#4488ff", size: 10, gravity: 1.0, temp: 20, atmosphere: "Nitrogen/Oxygen", bio: 0.6, minerals: 0.2, hasRuins: false, artifact: null },
        { name: "Arth-IV", radius: 85, speed: 0.008, color: "#88ccaa", size: 7, gravity: 0.8, temp: -30, atmosphere: "Thin Nitrogen", bio: 0.1, minerals: 0.5, hasRuins: true, artifact: "Earth Artifact" },
        { name: "Solaria-III", radius: 120, speed: 0.005, color: "#e6aa66", size: 12, gravity: 1.4, temp: 110, atmosphere: "Dense CO2", bio: 0.0, minerals: 0.8, hasRuins: false, artifact: null },
        { name: "Titanis", radius: 160, speed: 0.003, color: "#a5a5d8", size: 14, gravity: 2.1, temp: -140, atmosphere: "Thick Methane", bio: 0.2, minerals: 0.6, hasRuins: false, artifact: null }
      ]
    },
    {
      name: "Sirius Sector",
      x: 180,
      y: 220,
      starClass: "A",
      starColor: "#ffffff",
      descr: "Luminous A-class white star system. High energy radiation grid.",
      planets: [
        { name: "Sirius Prime", radius: 40, speed: 0.02, color: "#ddddff", size: 11, gravity: 1.5, temp: 150, atmosphere: "Dense Carbon", bio: 0.0, minerals: 0.8, hasRuins: false, artifact: null },
        { name: "Sirius-II", radius: 75, speed: 0.012, color: "#a5a5d8", size: 8, gravity: 1.1, temp: 15, atmosphere: "Toxic Ammonia", bio: 0.4, minerals: 0.4, hasRuins: true, artifact: "Nebular Crystal" },
        { name: "Valkyrie", radius: 110, speed: 0.007, color: "#ff8866", size: 9, gravity: 0.9, temp: 95, atmosphere: "Sulfur Fog", bio: 0.1, minerals: 0.9, hasRuins: false, artifact: null }
      ]
    },
    {
      name: "Nebular Gate",
      x: 320,
      y: 190,
      starClass: "M",
      starColor: "#ff5555",
      descr: "Red Supergiant star, undergoing pre-nova core collapse.",
      planets: [
        { name: "Nebula-I", radius: 55, speed: 0.014, color: "#ff8888", size: 11, gravity: 2.1, temp: 320, atmosphere: "Corrosive Acid", bio: 0.0, minerals: 0.9, hasRuins: false, artifact: null },
        { name: "Nebula-II", radius: 95, speed: 0.008, color: "#aa88bb", size: 9, gravity: 0.7, temp: -110, atmosphere: "None", bio: 0.0, minerals: 0.6, hasRuins: true, artifact: "Void Core" },
        { name: "Ash-V", radius: 135, speed: 0.004, color: "#665555", size: 13, gravity: 1.8, temp: 240, atmosphere: "Volcanic Ash", bio: 0.0, minerals: 0.95, hasRuins: false, artifact: null }
      ]
    },
    {
      name: "Veloxi Shallows",
      x: 380,
      y: 270,
      starClass: "K",
      starColor: "#ffaa33",
      descr: "Orange K-class star. Heart of Veloxi insectoid empire.",
      planets: [
        { name: "Veloxia", radius: 50, speed: 0.016, color: "#ffaa00", size: 10, gravity: 1.3, temp: 40, atmosphere: "Thick Nitrogen", bio: 0.8, minerals: 0.3, hasRuins: false, artifact: null },
        { name: "Velox-B", radius: 85, speed: 0.01, color: "#887755", size: 6, gravity: 0.9, temp: 10, atmosphere: "Toxic Ammonia", bio: 0.5, minerals: 0.7, hasRuins: false, artifact: null },
        { name: "Hive World", radius: 125, speed: 0.006, color: "#bbaa44", size: 12, gravity: 1.4, temp: 32, atmosphere: "High Oxygen", bio: 0.9, minerals: 0.4, hasRuins: false, artifact: null },
        { name: "Chitin-IV", radius: 165, speed: 0.003, color: "#665544", size: 8, gravity: 0.7, temp: -70, atmosphere: "Frozen Nitrogen", bio: 0.2, minerals: 0.6, hasRuins: false, artifact: null }
      ]
    },
    {
      name: "Spemin Outpost",
      x: 120,
      y: 160,
      starClass: "F",
      starColor: "#ffffaa",
      descr: "Yellow-white star. Sovereign center of Spemin blob territory.",
      planets: [
        { name: "Spemia Prime", radius: 45, speed: 0.018, color: "#bbff99", size: 9, gravity: 0.9, temp: 35, atmosphere: "Nitrogen/Oxygen", bio: 0.7, minerals: 0.2, hasRuins: false, artifact: null },
        { name: "Blob-V", radius: 80, speed: 0.011, color: "#88cc88", size: 7, gravity: 0.6, temp: -50, atmosphere: "Methane", bio: 0.3, minerals: 0.5, hasRuins: false, artifact: null },
        { name: "Slime-world", radius: 115, speed: 0.007, color: "#66ff66", size: 11, gravity: 1.2, temp: 25, atmosphere: "Dense Moisture", bio: 0.95, minerals: 0.1, hasRuins: false, artifact: null }
      ]
    },
    {
      name: "Uhlek Void Fortress",
      x: 440,
      y: 420,
      starClass: "O",
      starColor: "#8888ff",
      descr: "Blue Hypergiant. Heavy gravity wells and fatal magnetic storms. Uhlek military core.",
      planets: [
        { name: "Uhlekia", radius: 65, speed: 0.012, color: "#5555bb", size: 14, gravity: 3.4, temp: 480, atmosphere: "Super-dense Methane", bio: 0.0, minerals: 0.9, hasRuins: false, artifact: null },
        { name: "Dread-II", radius: 105, speed: 0.007, color: "#333366", size: 10, gravity: 2.2, temp: -90, atmosphere: "Argon", bio: 0.0, minerals: 0.85, hasRuins: true, artifact: null },
        { name: "Cyber-Forge", radius: 145, speed: 0.004, color: "#aa3333", size: 13, gravity: 1.9, temp: 350, atmosphere: "Sulfur Gas", bio: 0.0, minerals: 0.95, hasRuins: false, artifact: null }
      ]
    },
    {
      name: "Eridani Beta",
      x: 65,
      y: 80,
      starClass: "K",
      starColor: "#ffaa44",
      descr: "Deep western frontier orange dwarf.",
      planets: [
        { name: "Eridani-I", radius: 40, speed: 0.02, color: "#cc9955", size: 8, gravity: 0.8, temp: 120, atmosphere: "Thin CO2", bio: 0.1, minerals: 0.7, hasRuins: false, artifact: null },
        { name: "Eridani-II", radius: 75, speed: 0.013, color: "#55aaff", size: 11, gravity: 1.1, temp: 18, atmosphere: "Oceanic Water Vapor", bio: 0.8, minerals: 0.4, hasRuins: false, artifact: null },
        { name: "Eridani-III", radius: 110, speed: 0.008, color: "#ddbb88", size: 9, gravity: 1.0, temp: -20, atmosphere: "Nitrogen", bio: 0.3, minerals: 0.6, hasRuins: true, artifact: null }
      ]
    },
    {
      name: "Proxima Centauri",
      x: 195,
      y: 310,
      starClass: "M",
      starColor: "#ff4444",
      descr: "Dim red dwarf with turbulent solar flares.",
      planets: [
        { name: "Proxima-b", radius: 35, speed: 0.022, color: "#aa5555", size: 9, gravity: 1.0, temp: 5, atmosphere: "Thin Nitrogen", bio: 0.4, minerals: 0.5, hasRuins: false, artifact: null },
        { name: "Proxima-c", radius: 70, speed: 0.014, color: "#88bbdd", size: 13, gravity: 1.8, temp: -130, atmosphere: "Methane/Helium", bio: 0.0, minerals: 0.7, hasRuins: false, artifact: null }
      ]
    },
    {
      name: "Rigel Cluster",
      x: 410,
      y: 110,
      starClass: "B",
      starColor: "#88ffff",
      descr: "Blue Supergiant star. Blazing luminosity across northern quadrants.",
      planets: [
        { name: "Rigel Prime", radius: 50, speed: 0.017, color: "#99ffff", size: 15, gravity: 2.8, temp: 520, atmosphere: "Ionized Gas", bio: 0.0, minerals: 0.95, hasRuins: false, artifact: null },
        { name: "Rigel-IV", radius: 95, speed: 0.009, color: "#5588cc", size: 10, gravity: 1.3, temp: 40, atmosphere: "Nitrogen/Oxygen", bio: 0.75, minerals: 0.4, hasRuins: true, artifact: null },
        { name: "Rigel-V", radius: 140, speed: 0.005, color: "#77aadd", size: 12, gravity: 1.6, temp: -80, atmosphere: "Ammonia Ice", bio: 0.2, minerals: 0.8, hasRuins: false, artifact: null }
      ]
    },
    {
      name: "Antares Reach",
      x: 85,
      y: 380,
      starClass: "M",
      starColor: "#ff3333",
      descr: "Pulsating Red Giant in southwestern deep space.",
      planets: [
        { name: "Antares Alpha", radius: 60, speed: 0.015, color: "#ff6644", size: 12, gravity: 1.7, temp: 280, atmosphere: "Sulfur Dioxide", bio: 0.0, minerals: 0.85, hasRuins: false, artifact: null },
        { name: "Antares Beta", radius: 100, speed: 0.009, color: "#88ccbb", size: 8, gravity: 0.8, temp: -15, atmosphere: "Oxygen/Nitrogen", bio: 0.65, minerals: 0.5, hasRuins: true, artifact: null },
        { name: "Antares Gamma", radius: 145, speed: 0.005, color: "#bb99dd", size: 11, gravity: 1.2, temp: -110, atmosphere: "Thick Methane", bio: 0.1, minerals: 0.7, hasRuins: false, artifact: null }
      ]
    },
    {
      name: "Betelgeuse Expanse",
      x: 450,
      y: 290,
      starClass: "M",
      starColor: "#ff4422",
      descr: "Massive variable red supergiant emitting plasma plumes.",
      planets: [
        { name: "Betel-I", radius: 50, speed: 0.018, color: "#ffaa44", size: 14, gravity: 2.5, temp: 420, atmosphere: "Dense Ash", bio: 0.0, minerals: 0.9, hasRuins: false, artifact: null },
        { name: "Betel-II", radius: 90, speed: 0.011, color: "#bb9977", size: 9, gravity: 1.1, temp: 60, atmosphere: "Toxic Vapor", bio: 0.3, minerals: 0.7, hasRuins: false, artifact: null },
        { name: "Betel-III", radius: 130, speed: 0.006, color: "#5588aa", size: 10, gravity: 0.9, temp: -40, atmosphere: "Nitrogen", bio: 0.5, minerals: 0.6, hasRuins: true, artifact: null }
      ]
    },
    {
      name: "Aldebaran Core",
      x: 290,
      y: 360,
      starClass: "K",
      starColor: "#ff9933",
      descr: "Orange Giant star in central southern sector.",
      planets: [
        { name: "Aldebar-A", radius: 45, speed: 0.02, color: "#ffcc66", size: 11, gravity: 1.4, temp: 130, atmosphere: "Carbonic Gas", bio: 0.0, minerals: 0.8, hasRuins: false, artifact: null },
        { name: "Aldebar-B", radius: 85, speed: 0.012, color: "#66cc99", size: 8, gravity: 0.9, temp: 22, atmosphere: "Lush Oxygen", bio: 0.85, minerals: 0.3, hasRuins: true, artifact: null },
        { name: "Aldebar-C", radius: 125, speed: 0.007, color: "#9999cc", size: 12, gravity: 1.5, temp: -85, atmosphere: "Argon/Methane", bio: 0.1, minerals: 0.75, hasRuins: false, artifact: null }
      ]
    },
    {
      name: "Altair Nexus",
      x: 150,
      y: 420,
      starClass: "A",
      starColor: "#ffffff",
      descr: "Fast rotating A-class star with compressed equator line.",
      planets: [
        { name: "Altair-I", radius: 40, speed: 0.022, color: "#eeeeff", size: 7, gravity: 0.7, temp: 180, atmosphere: "Silica Dust", bio: 0.0, minerals: 0.85, hasRuins: false, artifact: null },
        { name: "Altair-II", radius: 75, speed: 0.014, color: "#88aaff", size: 10, gravity: 1.1, temp: 15, atmosphere: "Nitrogen/Oxygen", bio: 0.6, minerals: 0.5, hasRuins: false, artifact: null },
        { name: "Altair-III", radius: 115, speed: 0.008, color: "#aacc88", size: 12, gravity: 1.3, temp: -60, atmosphere: "Thin CO2", bio: 0.3, minerals: 0.65, hasRuins: false, artifact: null }
      ]
    },
    {
      name: "Vega Stellaris",
      x: 340,
      y: 410,
      starClass: "A",
      starColor: "#ddffff",
      descr: "Bright bluish-white star surrounded by a debris disk.",
      planets: [
        { name: "Vega-Alpha", radius: 50, speed: 0.017, color: "#bbddff", size: 13, gravity: 2.0, temp: 210, atmosphere: "Thick Steam", bio: 0.0, minerals: 0.8, hasRuins: false, artifact: null },
        { name: "Vega-Beta", radius: 90, speed: 0.01, color: "#77ccaa", size: 9, gravity: 0.95, temp: 28, atmosphere: "Nitrogen/Oxygen", bio: 0.7, minerals: 0.4, hasRuins: true, artifact: null },
        { name: "Vega-Gamma", radius: 135, speed: 0.006, color: "#bbaadd", size: 11, gravity: 1.2, temp: -95, atmosphere: "Methane Ice", bio: 0.15, minerals: 0.7, hasRuins: false, artifact: null }
      ]
    },
    {
      name: "Capella Vault",
      x: 210,
      y: 130,
      starClass: "G",
      starColor: "#ffff66",
      descr: "Quadruple star system anchored by two yellow giant stars.",
      planets: [
        { name: "Capella-I", radius: 45, speed: 0.02, color: "#ffdd88", size: 10, gravity: 1.2, temp: 140, atmosphere: "Carbon Monoxide", bio: 0.0, minerals: 0.85, hasRuins: false, artifact: null },
        { name: "Capella-II", radius: 80, speed: 0.012, color: "#66bbee", size: 11, gravity: 1.0, temp: 12, atmosphere: "Oxygen Matrix", bio: 0.8, minerals: 0.35, hasRuins: true, artifact: null },
        { name: "Capella-III", radius: 120, speed: 0.007, color: "#ccaaee", size: 8, gravity: 0.75, temp: -75, atmosphere: "Nitrogen Gas", bio: 0.2, minerals: 0.6, hasRuins: false, artifact: null }
      ]
    },
    {
      name: "Deneb Veil",
      x: 90,
      y: 240,
      starClass: "A",
      starColor: "#ffffff",
      descr: "White Supergiant star located at western galactic edge.",
      planets: [
        { name: "Deneb-I", radius: 55, speed: 0.015, color: "#e0e0ff", size: 14, gravity: 2.6, temp: 390, atmosphere: "Corrosive Acid", bio: 0.0, minerals: 0.9, hasRuins: false, artifact: null },
        { name: "Deneb-II", radius: 95, speed: 0.009, color: "#99ccbb", size: 9, gravity: 0.85, temp: 5, atmosphere: "Nitrogen/Argon", bio: 0.5, minerals: 0.5, hasRuins: true, artifact: null },
        { name: "Deneb-III", radius: 140, speed: 0.005, color: "#8888aa", size: 12, gravity: 1.5, temp: -120, atmosphere: "Frozen Carbon", bio: 0.0, minerals: 0.8, hasRuins: false, artifact: null }
      ]
    },
    {
      name: "Polari Station",
      x: 460,
      y: 80,
      starClass: "F",
      starColor: "#ffffbb",
      descr: "North-Eastern pole star anchor system.",
      planets: [
        { name: "Polaris Prime", radius: 45, speed: 0.019, color: "#ccffdd", size: 10, gravity: 1.1, temp: 8, atmosphere: "Thin Nitrogen", bio: 0.45, minerals: 0.55, hasRuins: false, artifact: null },
        { name: "Polaris-II", radius: 85, speed: 0.011, color: "#aaddff", size: 12, gravity: 1.4, temp: -60, atmosphere: "Methane Ice", bio: 0.1, minerals: 0.75, hasRuins: false, artifact: null }
      ]
    },
    {
      name: "Fomalhaut Reach",
      x: 40,
      y: 190,
      starClass: "A",
      starColor: "#eeeeff",
      descr: "Solitary A-type star enclosed by dense dust ring.",
      planets: [
        { name: "Fomal-A", radius: 50, speed: 0.017, color: "#bbaadd", size: 11, gravity: 1.3, temp: 85, atmosphere: "Dust & CO2", bio: 0.0, minerals: 0.85, hasRuins: false, artifact: null },
        { name: "Fomal-B", radius: 90, speed: 0.01, color: "#55ccbb", size: 9, gravity: 0.9, temp: 16, atmosphere: "Nitrogen/Oxygen", bio: 0.65, minerals: 0.4, hasRuins: true, artifact: null }
      ]
    },
    {
      name: "Castor Haven",
      x: 310,
      y: 60,
      starClass: "A",
      starColor: "#ffffff",
      descr: "Sextuple star system in northern sky.",
      planets: [
        { name: "Castor-I", radius: 40, speed: 0.021, color: "#ffccbb", size: 8, gravity: 0.8, temp: 160, atmosphere: "Sulfur Gas", bio: 0.0, minerals: 0.9, hasRuins: false, artifact: null },
        { name: "Castor-II", radius: 75, speed: 0.013, color: "#66aadd", size: 10, gravity: 1.0, temp: 24, atmosphere: "Oxygen Rich", bio: 0.75, minerals: 0.3, hasRuins: false, artifact: null },
        { name: "Castor-III", radius: 115, speed: 0.008, color: "#bb99cc", size: 13, gravity: 1.7, temp: -50, atmosphere: "Nitrogen", bio: 0.25, minerals: 0.6, hasRuins: false, artifact: null }
      ]
    },
    {
      name: "Pollux Trench",
      x: 370,
      y: 140,
      starClass: "K",
      starColor: "#ffbb44",
      descr: "Orange Giant star with rich inner asteroid belts.",
      planets: [
        { name: "Pollux-Alpha", radius: 50, speed: 0.016, color: "#eeaa55", size: 12, gravity: 1.6, temp: 110, atmosphere: "Carbonic Gas", bio: 0.0, minerals: 0.85, hasRuins: false, artifact: null },
        { name: "Pollux-Beta", radius: 90, speed: 0.01, color: "#77ddaa", size: 9, gravity: 0.95, temp: 18, atmosphere: "Nitrogen/Oxygen", bio: 0.7, minerals: 0.4, hasRuins: true, artifact: null }
      ]
    },
    {
      name: "Procyon Rim",
      x: 110,
      y: 310,
      starClass: "F",
      starColor: "#ffffaa",
      descr: "Yellow-white subgiant star with white dwarf companion.",
      planets: [
        { name: "Procyon-A", radius: 45, speed: 0.019, color: "#eedd99", size: 9, gravity: 0.9, temp: 65, atmosphere: "Thin Nitrogen", bio: 0.3, minerals: 0.6, hasRuins: false, artifact: null },
        { name: "Procyon-B", radius: 85, speed: 0.011, color: "#44bbee", size: 11, gravity: 1.1, temp: -10, atmosphere: "Water Vapor", bio: 0.8, minerals: 0.35, hasRuins: false, artifact: null }
      ]
    },
    {
      name: "Arcturus Spire",
      x: 270,
      y: 440,
      starClass: "K",
      starColor: "#ff9922",
      descr: "Orange Giant star moving rapidly across southern sector.",
      planets: [
        { name: "Arcturus-I", radius: 50, speed: 0.017, color: "#ff9955", size: 13, gravity: 2.1, temp: 230, atmosphere: "Corrosive Acid", bio: 0.0, minerals: 0.95, hasRuins: false, artifact: null },
        { name: "Arcturus-II", radius: 90, speed: 0.01, color: "#88ccaa", size: 10, gravity: 1.0, temp: 12, atmosphere: "Nitrogen/Oxygen", bio: 0.65, minerals: 0.5, hasRuins: true, artifact: null },
        { name: "Arcturus-III", radius: 130, speed: 0.006, color: "#9988bb", size: 12, gravity: 1.4, temp: -90, atmosphere: "Methane Ice", bio: 0.1, minerals: 0.7, hasRuins: false, artifact: null }
      ]
    },
    {
      name: "Spica Supercluster",
      x: 410,
      y: 370,
      starClass: "B",
      starColor: "#77ffff",
      descr: "Spectroscopic binary system composed of two blue giant stars.",
      planets: [
        { name: "Spica-Prime", radius: 55, speed: 0.015, color: "#77ddff", size: 15, gravity: 3.1, temp: 460, atmosphere: "Ionized Plasma", bio: 0.0, minerals: 0.95, hasRuins: false, artifact: null },
        { name: "Spica-II", radius: 100, speed: 0.008, color: "#55aacc", size: 9, gravity: 1.1, temp: 35, atmosphere: "Thick Moisture", bio: 0.75, minerals: 0.4, hasRuins: true, artifact: null }
      ]
    },
    {
      name: "Regulus Sanctum",
      x: 160,
      y: 60,
      starClass: "B",
      starColor: "#aaffff",
      descr: "Quadruple blue star system spinning near breakup velocity.",
      planets: [
        { name: "Regulus-A", radius: 40, speed: 0.021, color: "#bbffff", size: 12, gravity: 1.8, temp: 310, atmosphere: "Silica Vapor", bio: 0.0, minerals: 0.9, hasRuins: false, artifact: null },
        { name: "Regulus-B", radius: 80, speed: 0.012, color: "#66ccaa", size: 10, gravity: 1.0, temp: 26, atmosphere: "Oxygen/Argon", bio: 0.7, minerals: 0.35, hasRuins: false, artifact: null }
      ]
    },
    {
      name: "Achernar Abyss",
      x: 470,
      y: 220,
      starClass: "B",
      starColor: "#88eeff",
      descr: "Flattest and least spherical star in eastern galactic edge.",
      planets: [
        { name: "Achernar-I", radius: 50, speed: 0.016, color: "#88ccff", size: 14, gravity: 2.5, temp: 380, atmosphere: "Gas Plumes", bio: 0.0, minerals: 0.95, hasRuins: false, artifact: null },
        { name: "Achernar-II", radius: 95, speed: 0.009, color: "#a5a5d8", size: 9, gravity: 0.9, temp: -45, atmosphere: "Frozen Nitrogen", bio: 0.2, minerals: 0.65, hasRuins: true, artifact: null }
      ]
    },
    {
      name: "Bellatrix Anomaly",
      x: 230,
      y: 390,
      starClass: "B",
      starColor: "#aaeedd",
      descr: "Blue giant star surrounded by intense magnetic turbulence.",
      planets: [
        { name: "Bellatrix-I", radius: 45, speed: 0.019, color: "#88eedd", size: 11, gravity: 1.4, temp: 240, atmosphere: "Ion Gas", bio: 0.0, minerals: 0.85, hasRuins: false, artifact: null },
        { name: "Bellatrix-II", radius: 85, speed: 0.011, color: "#66bbaa", size: 10, gravity: 1.1, temp: 15, atmosphere: "Nitrogen/Oxygen", bio: 0.8, minerals: 0.4, hasRuins: true, artifact: null }
      ]
    },
    {
      name: "Mizar Rift",
      x: 380,
      y: 460,
      starClass: "A",
      starColor: "#ffffff",
      descr: "Famous double binary star system in southeastern sector.",
      planets: [
        { name: "Mizar-A", radius: 50, speed: 0.017, color: "#ddddff", size: 10, gravity: 1.2, temp: 140, atmosphere: "Carbonic Gas", bio: 0.0, minerals: 0.8, hasRuins: false, artifact: null },
        { name: "Mizar-B", radius: 90, speed: 0.01, color: "#77ccaa", size: 8, gravity: 0.85, temp: -25, atmosphere: "Thin Nitrogen", bio: 0.4, minerals: 0.6, hasRuins: false, artifact: null }
      ]
    },
    {
      name: "Alcor Basin",
      x: 70,
      y: 460,
      starClass: "F",
      starColor: "#ffffaa",
      descr: "F-type companion star at southwestern boundary.",
      planets: [
        { name: "Alcor-I", radius: 40, speed: 0.02, color: "#eedd88", size: 9, gravity: 0.9, temp: 45, atmosphere: "Nitrogen", bio: 0.5, minerals: 0.5, hasRuins: false, artifact: null },
        { name: "Alcor-II", radius: 80, speed: 0.012, color: "#66aacc", size: 12, gravity: 1.3, temp: -70, atmosphere: "Methane Ice", bio: 0.1, minerals: 0.75, hasRuins: true, artifact: null }
      ]
    },
    {
      name: "Sol Omega",
      x: 300,
      y: 300,
      starClass: "G",
      starColor: "#ffcc00",
      descr: "Yellow G-class star with ancient terraformed ring planets.",
      planets: [
        { name: "Terra-Nova", radius: 45, speed: 0.018, color: "#44aaff", size: 10, gravity: 1.0, temp: 21, atmosphere: "Perfect Oxygen Matrix", bio: 0.9, minerals: 0.4, hasRuins: true, artifact: null },
        { name: "Ares-II", radius: 85, speed: 0.011, color: "#ff6644", size: 8, gravity: 0.7, temp: -10, atmosphere: "Thin CO2", bio: 0.1, minerals: 0.85, hasRuins: false, artifact: null },
        { name: "Chronos Gate", radius: 125, speed: 0.006, color: "#aaddaa", size: 12, gravity: 1.5, temp: -95, atmosphere: "Nitrogen/Helium", bio: 0.3, minerals: 0.65, hasRuins: true, artifact: null }
      ]
    }
  ],

  // Alien Races and initial dialog lines
  aliens: {
    spemin: {
      name: "Spemin Blobs",
      portrait: "spemin",
      health: 80,
      blaster: 25,
      shields: 50,
      aggression: 0.3,
      cargo: [
        { type: "contraband", count: 2 },
        { type: "alien_art", count: 1 }
      ],
      dialogue: {
        friendly: {
          greeting: "Greetings mighty traveler! We are the glorious Spemin. Please do not hurt us! We are extremely peaceful blob creatures.",
          choices: [
            { text: "Ask about precursor artifacts.", response: "Ah, the old precursor relics! We heard they are located in sectors 120,85 and 80,140. We Spemin would never dare touch them! Too spooky." },
            { text: "Propose a cargo trade.", action: "trade", response: "Trade? Yes! We love bargaining. We have rare spice and art, very cheap!" },
            { text: "Politely say goodbye.", action: "exit", response: "Farewell! Remember the Spemin are your friends!" }
          ]
        },
        hostile: {
          greeting: "Ha! Prepare to face the wrath of the Spemin Armada! Yield your cargo or we will... wait, is your ship weapon class higher than 1? Oh no!",
          choices: [
            { text: "Demand surrender of cargo.", response: "Okay! Okay! Take our cargo! Just don't activate those lasers! We surrender!", action: "surrender" },
            { text: "Engage combat.", action: "combat", response: "Squeee! Battle stations! (Blob noises)" },
            { text: "Negotiate peace.", response: "We accept peace! In fact, we pay you 100 M.U. to call it a draw!", action: "bribe" }
          ]
        },
        obsequious: {
          greeting: "Oh, great masters of the cosmos! Your ship is so shiny! We bow before your immense planetary wisdom.",
          choices: [
            { text: "Inquire about Uhlek territories.", response: "The Uhlek? They are horrible cyber-bugs! They live near (145, 150) and shoot anyone on sight. Stay away!" },
            { text: "Offer a trade.", action: "trade", response: "We would be honored to trade with such majestic beings!" },
            { text: "Leave them.", action: "exit", response: "May your exhaust ports never clog, masters!" }
          ]
        }
      }
    },
    veloxi: {
      name: "Veloxi Empire",
      portrait: "veloxi",
      health: 150,
      blaster: 50,
      shields: 120,
      aggression: 0.6,
      cargo: [
        { type: "platinum", count: 3 },
        { type: "iron", count: 5 }
      ],
      dialogue: {
        friendly: {
          greeting: "Halt, traveler. You have entered Veloxi space. State your business immediately. We operate under strict imperial protocols.",
          choices: [
            { text: "State you are on a research mission.", response: "Research? Scan records indicate a catastrophic solar increase in our sectors. If you seek precursors, look to the ancient worlds. Arth-IV is key." },
            { text: "Offer commercial barter.", action: "trade", response: "Commodity trade protocol initialized. Present cargo manifests." },
            { text: "Ask for permission to pass.", action: "exit", response: "Permission granted. Maintain speed vector and disengage blasters." }
          ]
        },
        hostile: {
          greeting: "Vessel detected. You are violating Imperial sector limits. Prepare for termination under protocol 99-B.",
          choices: [
            { text: "Fight back.", action: "combat", response: "Threat assessment updated: Active target. Engaging shield matrix." },
            { text: "Haggle a passage fee.", response: "Imperial fine system requires a transfer of 300 Credits (M.U.) to clear violation.", action: "fine" },
            { text: "Plead for mercy.", response: "Mercy is not programmed in standard protocol. Shields locking." }
          ]
        },
        obsequious: {
          greeting: "You speak with flattering syllables, traveler. Respect for Veloxi authority is noted in database.",
          choices: [
            { text: "Ask about other alien species.", response: "The Spemin blobs are classified as Class-D nuisance. The Uhlek are Class-S lethal threat at coordinate (145, 150)." },
            { text: "Initiate cargo swap.", action: "trade", response: "Agreed. Let us examine the exchange rate matrix." },
            { text: "Bid respect and leave.", action: "exit", response: "Imperial blessing given. Vector cleared." }
          ]
        }
      }
    },
    uhlek: {
      name: "Uhlek Swarm",
      portrait: "uhlek",
      health: 300,
      blaster: 120,
      shields: 250,
      aggression: 1.0, // High aggro, no talk, just combat
      cargo: [
        { type: "precursor_alloy", count: 2 },
        { type: "endurium_ore", count: 3 }
      ],
      dialogue: {
        friendly: {
          greeting: "CRITICAL COMPONENT DETECTED. SWARM MUST ELIMINATE EXTERNAL ANOMALIES. DIE.",
          choices: [
            { text: "Engage battle stations.", action: "combat", response: "EXTERMINATING." }
          ]
        },
        hostile: {
          greeting: "DESTROY. DESTROY. DESTROY.",
          choices: [
            { text: "Engage battle stations.", action: "combat", response: "TARGET ACQUIRED." }
          ]
        },
        obsequious: {
          greeting: "COMMUNICATION PROTOCOL INVALID. HULL PENETRATION INITIALIZED.",
          choices: [
            { text: "Engage battle stations.", action: "combat", response: "NO QUARTER." }
          ]
        }
      }
    }
  }
};

window.GameData = GameData;
