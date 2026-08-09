/**
 * Region content for StarFlight: Odyssey.
 *
 * PURE DATA. A region is a self-contained volume of space with its own systems,
 * hazards and character. The core quadrant is the galaxy the game has always
 * had; further regions are reached only by falling into a singularity.
 *
 * To author a new region: append a record here. RegionManager needs no edits.
 *
 * Fields:
 *   id, name, blurb
 *   entryFrom   black hole id in the PARENT region that leads here
 *   returnTo    { region, x, y } where the paired singularity puts you back
 *   arrival     { x, y } where you emerge
 *   starSystems / blackHoles / derelicts / spaceWrecks / distressSignals / nebulae
 *   danger      flavour + a hint at what lives here
 *   wormholeCfg { pairs, solos } how many throats WormholeNet rolls here
 *
 * A black hole may declare:
 *   leadsTo     region id this singularity opens onto (the modern, explicit form)
 *   exitAt      { x, y } where you emerge - defaults to the target's `arrival`
 *   oneWay      true when nothing on the far side leads back the way you came
 *
 * TOPOLOGY. The point of the one-way gates is that the deep regions are a
 * circuit, not a set of side rooms you can back out of:
 *
 *   CORE --bh_1 (Cygnus)------> SHATTERED REACH --bh_reach_return--> CORE
 *   CORE --bh_2 (Abyssal)-----> THE MARROW            [ONE WAY]
 *   THE MARROW --bh_marrow_fall--> THE LATTICE        [ONE WAY]
 *   THE LATTICE --bh_lattice_gate--> CORE <--bh_3 (Precursor)--
 *
 * So the Reach is safe to poke at, and the Abyssal Gate is a commitment: you
 * come home the long way, through two regions, or not at all.
 */

window.GameData.regions = {

  core: {
    id: "core",
    name: "Corps Quadrant",
    blurb: "Charted space. Starbase Prime sits at its heart and Customs patrols the core sectors.",
    isCore: true
  },

  // ---- The Shattered Reach ------------------------------------------------
  // Reached through the Cygnus Singularity. Everything here is older, emptier
  // and richer than the Corps Quadrant.
  deep_reach: {
    id: "deep_reach",
    name: "The Shattered Reach",
    blurb: "Beyond the Cygnus event horizon. A quadrant of dead stars and Precursor wreckage, " +
           "uncharted by any Corps survey. Nothing here has been catalogued, and nothing here is friendly.",
    entryFrom: "bh_1",
    arrival: { x: 250, y: 360 },
    returnTo: { region: "core", x: 210, y: 258 },
    danger: "Uhlek deep patrols. No Customs jurisdiction, no rescue, no resupply.",
    wormholeCfg: { pairs: 1, solos: 1 },
    // Who flies here, and how many. Uhlek deep patrols, and little else alive.
    traffic: { count: 7, races: ["uhlek", "uhlek", "uhlek", "veloxi"] },

    starSystems: [
      {
        name: "Cinder Gate", x: 250, y: 400, starClass: "M", starColor: "#ff4422",
        descr: "A collapsed red dwarf barely holding fusion. Its worlds are slag.",
        planets: [
          { name: "Cinder-I", radius: 45, speed: 0.016, color: "#883322", size: 9, gravity: 1.3, temp: 340,
            atmosphere: "Sulfur Fog", bio: 0.0, minerals: 0.95, hasRuins: false, artifact: null },
          { name: "Cinder-II", radius: 90, speed: 0.009, color: "#553333", size: 11, gravity: 2.4, temp: 210,
            atmosphere: "Dense CO2", bio: 0.0, minerals: 0.9, hasRuins: false, artifact: null }
        ]
      },
      {
        name: "The Ossuary", x: 155, y: 330, starClass: "B", starColor: "#aaccff",
        descr: "A blue giant surrounded by the shattered remains of an inner system.",
        planets: [
          { name: "Ossuary Shard", radius: 50, speed: 0.02, color: "#ccddee", size: 7, gravity: 0.6, temp: -95,
            atmosphere: "None", bio: 0.0, minerals: 0.98, hasRuins: false, artifact: null },
          { name: "Reliquary", radius: 105, speed: 0.007, color: "#88aacc", size: 10, gravity: 1.1, temp: -140,
            atmosphere: "Thin Argon", bio: 0.15, minerals: 0.8, hasRuins: true, artifact: "Aegis Keystone" }
        ]
      },
      {
        name: "Mourner's Veil", x: 360, y: 345, starClass: "K", starColor: "#ffaa66",
        descr: "An orange dwarf wrapped in the dust of a world that no longer exists.",
        planets: [
          { name: "Veil-I", radius: 55, speed: 0.014, color: "#997755", size: 10, gravity: 1.7, temp: 40,
            atmosphere: "Corrosive Acid", bio: 0.2, minerals: 0.85, hasRuins: false, artifact: null },
          { name: "Widow's Rest", radius: 120, speed: 0.005, color: "#66aa88", size: 12, gravity: 1.0, temp: 12,
            atmosphere: "Nitrogen/Oxygen", bio: 0.75, minerals: 0.5, hasRuins: true, artifact: null }
        ]
      },
      {
        name: "The Long Silence", x: 250, y: 250, starClass: "O", starColor: "#ddeeff",
        descr: "A supergiant at the heart of the Reach. Every world within reach of it is sterile.",
        planets: [
          { name: "Silence-I", radius: 60, speed: 0.018, color: "#dddddd", size: 8, gravity: 2.6, temp: 480,
            atmosphere: "None", bio: 0.0, minerals: 1.0, hasRuins: false, artifact: null },
          { name: "The Anvil", radius: 130, speed: 0.004, color: "#8899aa", size: 14, gravity: 3.1, temp: 90,
            atmosphere: "Thick Methane", bio: 0.0, minerals: 0.95, hasRuins: true, artifact: null }
        ]
      }
    ],

    // The way home. Paired with the Cygnus Singularity in the core quadrant.
    blackHoles: [
      { id: "bh_reach_return", name: "The Cygnus Mouth", x: 250, y: 455, gravityRadius: 30, coreRadius: 4,
        pullForce: 40, destX: 250, destY: 430, returnsTo: "core",
        desc: "The far side of the Cygnus fold. Enter to return to charted space." },

      // A second road into the Marrow, for a captain who found the Reach first.
      { id: "bh_reach_fall", name: "The Undertow Well", x: 130, y: 195, gravityRadius: 34, coreRadius: 4,
        pullForce: 46, destX: 130, destY: 195, leadsTo: "the_marrow", oneWay: true,
        desc: "A well with no matching mouth on any Corps chart. Whatever is on the far side, it is not the Reach." }
    ],

    derelicts: [
      { id: "der_reach_1", name: "Ossuary Vault Station", x: 165, y: 315, searched: false,
        loot: { type: "precursor_alloy", amount: 6, credits: 2200, artifact: null,
                tech: "Sensor Amplifier", techPartKey: "sensor_amplifier" },
        desc: "A Precursor vault station, intact and utterly silent. Nothing has boarded it in twenty thousand cycles." }
    ],

    spaceWrecks: [
      { id: "sw_reach_1", name: "Uhlek Hive Fragment", x: 330, y: 285, searched: false,
        techPartKey: "plasma_overcharger" }
    ],

    distressSignals: [
      { id: "sig_reach_1", name: "Distress Beacon: Corps Survey Lost", x: 205, y: 375, active: true,
        event: "corps_beacon", bounty: 900, chartRadius: 130,
        desc: "A Corps survey beacon, still transmitting on a carrier the fleet retired long ago. " +
              "Its registry predates the founding of Starbase Prime by four centuries.",
        grantsClue: {
          id: "clue_corps_first_survey",
          title: "The First Survey",
          text: "SURVEY VESSEL ENDURANCE, CORPS REGISTRY 004. FINAL ENTRY, UNDATED: " +
                "\"WE CAME THROUGH THE WELL AND IT CLOSED BEHIND US. NO RETURN VECTOR. " +
                "THE CHART IS ATTACHED - IT IS ALL WE HAVE LEFT TO SEND. " +
                "TELL THEM THE CORPS WAS HERE FIRST, AND THAT WE DID NOT FIND IT EMPTY.\" " +
                "STARBASE PRIME WAS FOUNDED FOUR CENTURIES AFTER THIS TRANSMISSION BEGAN.",
          coords: { x: 205, y: 375 }
        } }
    ],

    // The only place to buy fuel outside charted space. It knows it, and prices
    // accordingly - but a captain who finds it is no longer stranded out here.
    alienPorts: [
      { id: "port_reach_thrynn", name: "Ninth House Forward Post", raceKey: "thrynn", archive: "thrynn_reliquary",
        x: 195, y: 285, color: "#ffcc00", icon: "\u2302",
        fuelPrice: 48, wants: ["precursor_alloy", "iridium", "alien_art"], wantMult: 2.1, baseMult: 0.75,
        tradeLine: "You are a very long way from your Starbase, captain. We are a very long way from ours. " +
                   "One of us is selling fuel and one of us is buying it, and we both know which.",
        greeting: "The Ninth House keeps a post here. Not a profitable one. Not usually." }
    ],

    nebulae: [
      { id: "neb_reach_1", name: "The Pall", x: 250, y: 330, radius: 90,
        color: "rgba(120, 60, 160, 0.30)",
        desc: "A shroud of heavy elements. Sensors read almost nothing through it.",
        effect: "scanner_blind" }
    ]
  },

  // ---- The Marrow ---------------------------------------------------------
  // Reached through the Abyssal Gate Void, and NOT left the same way. Nothing
  // here opens back onto the Corps Quadrant: the only exit falls deeper.
  the_marrow: {
    id: "the_marrow",
    name: "The Marrow",
    blurb: "A quadrant packed dense with old stars, so crowded with mass that light bends visibly between them. " +
           "The Abyssal Gate does not open from this side.",
    arrival: { x: 250, y: 120 },
    danger: "No route back to charted space. The only way out of the Marrow goes further down.",
    wormholeCfg: { pairs: 1, solos: 2 },
    // Everyone here came through the Gate and could not get back out. They are
    // not hostile so much as extremely tired.
    traffic: { count: 6, races: ["spemin", "spemin", "thrynn", "veloxi"] },

    starSystems: [
      {
        name: "Rung", x: 250, y: 165, starClass: "K", starColor: "#ffcc88",
        descr: "The first star inside the gate. Its worlds are stripped to the bone and someone did the stripping.",
        planets: [
          { name: "Rung-I", radius: 45, speed: 0.018, color: "#aa8866", size: 8, gravity: 0.9, temp: 155,
            atmosphere: "None", bio: 0.0, minerals: 0.9, hasRuins: true, artifact: null },
          { name: "The Quarry", radius: 95, speed: 0.008, color: "#776655", size: 12, gravity: 1.8, temp: 60,
            atmosphere: "Thin CO2", bio: 0.05, minerals: 1.0, hasRuins: true, artifact: null }
        ]
      },
      {
        name: "Cradle", x: 140, y: 260, starClass: "G", starColor: "#ffee99",
        descr: "A yellow star with a living world under it, which should not be possible this deep.",
        planets: [
          { name: "Cradle Prime", radius: 70, speed: 0.012, color: "#55aa77", size: 11, gravity: 1.0, temp: 18,
            atmosphere: "Nitrogen/Oxygen", bio: 0.9, minerals: 0.4, hasRuins: true, artifact: "Marrow Seed" },
          { name: "Cradle-II", radius: 125, speed: 0.006, color: "#446688", size: 9, gravity: 0.7, temp: -80,
            atmosphere: "Methane Ice", bio: 0.1, minerals: 0.7, hasRuins: false, artifact: null }
        ]
      },
      {
        name: "The Press", x: 370, y: 300, starClass: "B", starColor: "#bbddff",
        descr: "Two blue giants close enough to trade fire. Everything nearby is being slowly crushed.",
        planets: [
          { name: "Anvil-Prime", radius: 60, speed: 0.02, color: "#99aabb", size: 13, gravity: 3.4, temp: 520,
            atmosphere: "Vaporised Rock", bio: 0.0, minerals: 1.0, hasRuins: false, artifact: null },
          { name: "Slagfall", radius: 115, speed: 0.007, color: "#cc7744", size: 10, gravity: 2.1, temp: 290,
            atmosphere: "Sulfur Fog", bio: 0.0, minerals: 0.95, hasRuins: true, artifact: null }
        ]
      },
      {
        name: "Hollow", x: 190, y: 395, starClass: "M", starColor: "#cc5544",
        descr: "A dying ember with a single world in close orbit, and something built across half of it.",
        planets: [
          { name: "The Hollow World", radius: 50, speed: 0.015, color: "#664466", size: 14, gravity: 0.4, temp: -20,
            atmosphere: "Argon Trace", bio: 0.3, minerals: 0.6, hasRuins: true, artifact: "Hollow Lens" }
        ]
      }
    ],

    blackHoles: [
      { id: "bh_marrow_fall", name: "The Sounding", x: 300, y: 420, gravityRadius: 38, coreRadius: 5,
        pullForce: 52, destX: 300, destY: 420, leadsTo: "the_lattice", oneWay: true,
        desc: "The floor of the Marrow. Every mass in this quadrant is drifting toward it, including you." }
    ],

    derelicts: [
      { id: "der_marrow_1", name: "The Long Ledger", x: 205, y: 215, searched: false,
        loot: { type: "precursor_alloy", amount: 8, credits: 3100, artifact: null,
                tech: "Quantum Shield Core", techPartKey: "quantum_shield_core" },
        desc: "A Thrynn counting-house, abandoned mid-audit. The ledgers are still open and still accurate." },
      { id: "der_marrow_2", name: "Gatekeeper Array", x: 355, y: 165, searched: false,
        loot: { type: "iridium", amount: 5, credits: 2600, artifact: null,
                tech: "Precursor Warp Conduit", techPartKey: "warp_conduit" },
        desc: "A Precursor navigation array facing the Abyssal Gate, as though watching who comes through." }
    ],

    spaceWrecks: [
      { id: "sw_marrow_1", name: "Corps Cutter Perseverance", x: 120, y: 340, searched: false,
        techPartKey: "titanium_composite" }
    ],

    distressSignals: [
      { id: "sig_marrow_1", name: "Distress Beacon: The Gate Does Not Open", x: 265, y: 145, active: true,
        event: "corps_beacon", bounty: 1400, chartRadius: 150,
        desc: "A automated loop on a Corps carrier, transmitting from just inside the arrival point. " +
              "It has been repeating the same eleven seconds for a very long time.",
        grantsClue: {
          id: "clue_marrow_no_return",
          title: "The Gate Does Not Open",
          text: "AUTOMATED LOOP, CORPS SURVEY WING: \"WE CAME THROUGH THE ABYSSAL GATE AND IT DOES NOT OPEN " +
                "FROM THIS SIDE. WE HAVE SOUNDED THE WHOLE QUADRANT. THERE IS ONE WAY OUT AND IT GOES DOWN, " +
                "NOT BACK. WE ARE TAKING IT. IF YOU ARE HEARING THIS YOU HAVE ALREADY MADE OUR MISTAKE - " +
                "SO MAKE IT PROPERLY AND FOLLOW US TO THE SOUNDING.\"",
          coords: { x: 300, y: 420 }
        } }
    ],

    // Trapped here exactly like you are, and delighted about it.
    alienPorts: [
      { id: "port_marrow_spemin", name: "The Spemin Who Stayed", raceKey: "spemin", archive: "spemin_hoard",
        x: 165, y: 230, color: "#00ff66", icon: "\u2302",
        fuelPrice: 39, wants: ["bio_flora", "bio_fauna", "contraband", "precursor_seed"], wantMult: 2.4, baseMult: 0.55,
        tradeLine: "WE MAKE FUEL! Out of the moss! It is GOOD fuel, mostly! We have been here " +
                   "eleven generations and nobody has exploded in four of them!",
        greeting: "A SHIP! A REAL SHIP! Did you come through the Gate? Everyone comes through the Gate. " +
                  "Nobody goes back through the Gate. Would you like some moss?" }
    ],

    nebulae: [
      { id: "neb_marrow_1", name: "The Weight", x: 300, y: 300, radius: 110,
        color: "rgba(200, 140, 60, 0.26)",
        desc: "Compressed dust under enormous pressure. Hulls groan crossing it.",
        effect: "hull_stress" }
    ]
  },

  // ---- The Lattice --------------------------------------------------------
  // The bottom of the fall, and the long way home. Also reachable directly from
  // the core through the Precursor Singularity - once you know it is there.
  the_lattice: {
    id: "the_lattice",
    name: "The Lattice",
    blurb: "Precursor engineering on the scale of a quadrant. The stars here are arranged, and they are arranged " +
           "around something. This is the deepest charted space and the only place the Corps has never named.",
    arrival: { x: 250, y: 250 },
    returnTo: { region: "core", x: 128, y: 432 },
    danger: "Precursor automation, still running. It has had twenty thousand cycles to decide what you are.",
    wormholeCfg: { pairs: 2, solos: 1 },
    // Veloxi survey pickets watching something that has not moved in six centuries.
    traffic: { count: 5, races: ["veloxi", "veloxi", "uhlek"] },

    starSystems: [
      {
        name: "First Node", x: 250, y: 190, starClass: "A", starColor: "#eeffff",
        descr: "A white star held in a geometric shell of orbiting structures, each the size of a moon.",
        planets: [
          { name: "Node-Alpha", radius: 55, speed: 0.014, color: "#ccddee", size: 9, gravity: 1.0, temp: 20,
            atmosphere: "Regulated", bio: 0.4, minerals: 0.8, hasRuins: true, artifact: "Lattice Key" },
          { name: "Node-Beta", radius: 110, speed: 0.006, color: "#99bbcc", size: 11, gravity: 1.4, temp: -40,
            atmosphere: "Thin Neon", bio: 0.0, minerals: 0.9, hasRuins: true, artifact: null }
        ]
      },
      {
        name: "The Spindle", x: 130, y: 300, starClass: "F", starColor: "#ffffdd",
        descr: "A star with a ring of worked metal around its equator, still turning after twenty thousand cycles.",
        planets: [
          { name: "Spindle Shard", radius: 48, speed: 0.019, color: "#ddccaa", size: 7, gravity: 0.5, temp: 110,
            atmosphere: "None", bio: 0.0, minerals: 1.0, hasRuins: false, artifact: null },
          { name: "The Governor", radius: 100, speed: 0.008, color: "#aabbaa", size: 12, gravity: 1.2, temp: 5,
            atmosphere: "Nitrogen/Oxygen", bio: 0.6, minerals: 0.7, hasRuins: true, artifact: null }
        ]
      },
      {
        name: "Terminus", x: 375, y: 360, starClass: "O", starColor: "#ccddff",
        descr: "The largest star in the Lattice, and the one every structure in the quadrant is pointed at.",
        planets: [
          { name: "Terminus-I", radius: 65, speed: 0.016, color: "#bbccdd", size: 10, gravity: 2.2, temp: 400,
            atmosphere: "Ionised", bio: 0.0, minerals: 1.0, hasRuins: true, artifact: null },
          { name: "The Last Foundry", radius: 135, speed: 0.004, color: "#778899", size: 15, gravity: 1.6, temp: 45,
            atmosphere: "Manufactured", bio: 0.2, minerals: 0.95, hasRuins: true, artifact: "Foundry Core" }
        ]
      }
    ],

    // Paired with the Precursor Singularity in the core quadrant. This is the way
    // home from the bottom of the fall.
    blackHoles: [
      { id: "bh_lattice_gate", name: "The Open Door", x: 250, y: 445, gravityRadius: 32, coreRadius: 4,
        pullForce: 42, destX: 250, destY: 420, returnsTo: "core",
        desc: "A singularity that is plainly a door, built rather than formed. It opens onto charted space." },

      // Not a door. Something the Lattice's builders left running and did not aim.
      { id: "bh_lattice_churn", name: "The Unfinished", x: 400, y: 180, gravityRadius: 36, coreRadius: 4,
        pullForce: 48, destX: 150, destY: 380,
        desc: "A fold that was under construction when the work stopped. It displaces, but it does not arrive anywhere." }
    ],

    derelicts: [
      { id: "der_lattice_1", name: "The Cartographer", x: 200, y: 265, searched: false,
        loot: { type: "precursor_alloy", amount: 12, credits: 4200, artifact: null,
                tech: "Sensor Amplifier", techPartKey: "sensor_amplifier" },
        desc: "A Precursor survey engine the size of a city, still holding a chart of somewhere that is not here." },
      { id: "der_lattice_2", name: "Foundry Tender", x: 340, y: 400, searched: false,
        loot: { type: "iridium", amount: 9, credits: 3800, artifact: null,
                tech: "Plasma Overcharger", techPartKey: "plasma_overcharger" },
        desc: "A maintenance vessel that has been repairing the same structure, patiently, since before the Corps existed." }
    ],

    spaceWrecks: [
      { id: "sw_lattice_1", name: "The Sounding's Toll", x: 165, y: 400, searched: false,
        techPartKey: "hyper_cargo_compressor" }
    ],

    distressSignals: [
      { id: "sig_lattice_1", name: "Distress Beacon: Survey Wing, Last Position", x: 290, y: 210, active: true,
        event: "corps_beacon", bounty: 2200, chartRadius: 170,
        desc: "The Corps survey wing that fell through the Sounding. This is where they stopped transmitting.",
        grantsClue: {
          id: "clue_lattice_arrival",
          title: "They Made It Out",
          text: "CORPS SURVEY WING, FINAL POSITION REPORT: \"WE CAME OUT OF THE SOUNDING INTO SOMETHING BUILT. " +
                "THE STARS HERE ARE PLACED. THERE IS A DOOR AT THE SOUTHERN EDGE THAT OPENS ONTO HOME - " +
                "WE HAVE CONFIRMED IT, WE HAVE FLOWN IT, AND WE ARE GOING BACK THROUGH TO REPORT. " +
                "IF THIS BEACON IS STILL HERE, WE DID NOT ARRIVE. TAKE THE DOOR ANYWAY. IT WORKS.\"",
          coords: { x: 250, y: 445 }
        } }
    ],

    alienPorts: [
      { id: "port_lattice_veloxi", name: "Veloxi Deep Survey Station", raceKey: "veloxi", archive: "veloxi_codex",
        x: 310, y: 285, color: "#ff5533", icon: "\u2302",
        fuelPrice: 62, wants: ["precursor_alloy", "iridium", "singularity_dust", "void_glass"], wantMult: 2.6, baseMult: 0.5,
        tradeLine: "Reactor mass is carried here from the Imperium at enormous cost. The price is the price. " +
                   "You are welcome to fly home without it.",
        greeting: "The Imperium has watched this quadrant for six hundred years and recorded no change in it. " +
                  "You are the change. This is noted." }
    ],

    nebulae: [
      { id: "neb_lattice_1", name: "The Weave", x: 250, y: 300, radius: 130,
        color: "rgba(60, 200, 180, 0.24)",
        desc: "A structured plasma field, held in a geometric pattern by something still running.",
        effect: "shield_boost" }
    ]
  }
};
