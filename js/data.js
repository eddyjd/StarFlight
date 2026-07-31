/**
 * StarFlight: Odyssey Static Database
 * Holds star systems, planets, ship modules, crew candidates, commodities, and dialogue templates.
 */

const GameData = {
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
      { level: 3, name: "Shielded Cargo Bays", cost: 3500, cap: 45, desc: "Protected from scanning. Prevents contraband detection by patrols." },
      { level: 4, name: "Cold Bio-Containment", cost: 3000, cap: 40, desc: "Includes cryo-freeze grids. Required to transport live alien species." }
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
    iron: { name: "Iron Ore", sellVal: 40, buyVal: 60, mass: 2.0 },
    gold: { name: "Gold Nuggets", sellVal: 150, buyVal: 220, mass: 3.0 },
    platinum: { name: "Platinum Crystals", sellVal: 350, buyVal: 480, mass: 3.5 },
    endurium_ore: { name: "Raw Endurium", sellVal: 500, buyVal: 700, mass: 1.5 },
    precursor_alloy: { name: "Precursor Metal", sellVal: 1200, buyVal: 1800, mass: 4.0 },
    bio_flora: { name: "Flora Specimen", sellVal: 100, buyVal: 150, mass: 0.5, needsBio: false },
    bio_fauna: { name: "Live Alien Fauna", sellVal: 800, buyVal: 1100, mass: 1.0, needsBio: true },
    alien_art: { name: "Veloxi Carving", sellVal: 600, buyVal: 900, mass: 0.8 },
    contraband: { name: "Spemin Spice", sellVal: 1500, buyVal: 2200, mass: 0.5, isContraband: true }
  },

  // Starport Command logs (unlocked through progression)
  hqLogs: [
    { title: "DISPATCH LOG 1 (URGENT)", text: "Commander, stellar activity in outer quadrants shows sudden collapse cycles. Sol-like G stars are bloating rapidly, emitting hyper-radiation. We need data from precursor monoliths. Scan sector 120, 85 for clues." },
    { title: "DECODED RUIN RECORD ALPHA", text: "Found on Arth-IV: '...the Flare occurred 20,000 cycles ago. The Precursor Aegis matrix stabilized the cores. It requires three crystal conduits: Earth Artifact, Nebular Crystal, and Void Core. They were scattered to coordinate matrices: (120, 85), (80, 140), and (150, 160).'" },
    { title: "INTELLIGENCE REPORT: UHLEK BORDER", text: "Warning: The Uhlek race is extremely territorial. They guard the wormhole in coordinate sector (145, 150). DO NOT attempt communication. Shields must be fully charged if entering their territory." },
    { title: "RESEARCH SUMMARY: SAVING THE CORPS", text: "Bring all three Precursor Artifacts to Starbase at (100,100). The Depot engineers can integrate them with the warp reactor, triggering a dampening wave to stabilize all local stars." }
  ],

  // List of all Star Systems in our galaxy
  starSystems: [
    {
      name: "Starbase Prime",
      x: 100,
      y: 100,
      starClass: "G",
      starColor: "#ffcc00",
      descr: "G-type stable star. HQ of Starbase Operations.",
      planets: [
        { name: "Arth", radius: 50, speed: 0.015, color: "#4488ff", size: 10, gravity: 1.0, temp: 20, atmosphere: "Nitrogen/Oxygen", bio: 0.6, minerals: 0.2, hasRuins: false, artifact: null },
        { name: "Arth-IV", radius: 95, speed: 0.008, color: "#88ccaa", size: 7, gravity: 0.8, temp: -30, atmosphere: "Thin Nitrogen", bio: 0.1, minerals: 0.5, hasRuins: true, artifact: "Earth Artifact" }
      ]
    },
    {
      name: "Sirius Sector",
      x: 120,
      y: 85,
      starClass: "A",
      starColor: "#ffffff",
      descr: "Bright A-class white star. Highly luminous.",
      planets: [
        { name: "Sirius Prime", radius: 45, speed: 0.02, color: "#ddddff", size: 12, gravity: 1.5, temp: 150, atmosphere: "Dense Carbon", bio: 0.0, minerals: 0.8, hasRuins: false, artifact: null },
        { name: "Sirius-II", radius: 80, speed: 0.01, color: "#a5a5d8", size: 8, gravity: 1.1, temp: 15, atmosphere: "Toxic Ammonia", bio: 0.4, minerals: 0.4, hasRuins: true, artifact: "Nebular Crystal" }
      ]
    },
    {
      name: "Nebular Gate",
      x: 80,
      y: 140,
      starClass: "M",
      starColor: "#ff5555",
      descr: "Red Supergiant star, undergoing pre-nova expansion.",
      planets: [
        { name: "Nebula-I", radius: 60, speed: 0.012, color: "#ff8888", size: 11, gravity: 2.1, temp: 320, atmosphere: "Corrosive Acid", bio: 0.0, minerals: 0.9, hasRuins: false, artifact: null },
        { name: "Nebula-II", radius: 100, speed: 0.006, color: "#aa88bb", size: 9, gravity: 0.7, temp: -110, atmosphere: "None", bio: 0.0, minerals: 0.6, hasRuins: true, artifact: "Void Core" }
      ]
    },
    {
      name: "Veloxi Shallows",
      x: 140,
      y: 110,
      starClass: "K",
      starColor: "#ffaa33",
      descr: "Orange star system. Center of Veloxi insectoid territory.",
      planets: [
        { name: "Veloxia", radius: 55, speed: 0.014, color: "#ffaa00", size: 10, gravity: 1.3, temp: 40, atmosphere: "Thick Nitrogen", bio: 0.8, minerals: 0.3, hasRuins: false, artifact: null },
        { name: "Velox-B", radius: 90, speed: 0.009, color: "#887755", size: 6, gravity: 0.9, temp: 10, atmosphere: "Toxic Ammonia", bio: 0.5, minerals: 0.7, hasRuins: false, artifact: null }
      ]
    },
    {
      name: "Spemin Outpost",
      x: 75,
      y: 70,
      starClass: "F",
      starColor: "#ffffaa",
      descr: "Yellow-white star. Controlled by the cowardly Spemin blob Empire.",
      planets: [
        { name: "Spemia Prime", radius: 50, speed: 0.018, color: "#bbff99", size: 9, gravity: 0.9, temp: 35, atmosphere: "Nitrogen/Oxygen", bio: 0.7, minerals: 0.2, hasRuins: false, artifact: null },
        { name: "Blob-V", radius: 85, speed: 0.011, color: "#88cc88", size: 7, gravity: 0.6, temp: -50, atmosphere: "Methane", bio: 0.3, minerals: 0.5, hasRuins: false, artifact: null }
      ]
    },
    {
      name: "Uhlek Void",
      x: 145,
      y: 150,
      starClass: "O",
      starColor: "#8888ff",
      descr: "Blue Hypergiant. Heavy gravity wells and unstable magnetic rifts. Uhlek home territory.",
      planets: [
        { name: "Uhlekia", radius: 70, speed: 0.01, color: "#5555bb", size: 14, gravity: 3.4, temp: 480, atmosphere: "Super-dense Methane", bio: 0.0, minerals: 0.9, hasRuins: false, artifact: null }
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
