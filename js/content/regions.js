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
        desc: "The far side of the Cygnus fold. Enter to return to charted space." }
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
        event: "probe_salvage",
        desc: "A Corps survey beacon. Its registry predates the founding of Starbase Prime by four centuries." }
    ],

    nebulae: [
      { id: "neb_reach_1", name: "The Pall", x: 250, y: 330, radius: 90,
        color: "rgba(120, 60, 160, 0.30)",
        desc: "A shroud of heavy elements. Sensors read almost nothing through it." }
    ]
  }
};
