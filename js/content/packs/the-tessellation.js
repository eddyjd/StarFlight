/**
 * THE TESSELLATION - reference content pack for StarFlight: Odyssey
 *
 * This quadrant exists to prove the pack format is sufficient. It was authored
 * entirely through js/packs.js with NO engine changes, and it uses every feature
 * a generated pack is likely to need:
 *
 *   add.regions          a whole new quadrant, systems, worlds, hazards, a port
 *   add.archiveLocations + add.archives    somewhere to read, and things to read
 *   add.quests           a mission with staged objectives and clue payloads
 *   add.puzzles          a cipher guarding a derelict
 *   add.commodities      a resource that exists nowhere else
 *   extend regions.core  the singularity that makes any of it reachable
 *   extend aliens        new conversation nodes for an existing race
 *
 * If you are an AI reading this to learn the format: this file is the worked
 * example referenced by CONTENT_PACKS.md. Copy its shape.
 *
 * To load it, add "the-tessellation.js" to js/content/packs/manifest.js.
 */

ContentPacks.register({
  id: "the_tessellation",
  name: "The Tessellation",
  version: "1",
  author: "Reference pack",
  description: "A quadrant of repeating geometry beyond the Kettle Void, where the " +
               "Precursors appear to have been practising.",

  // =======================================================================
  // ADD - entirely new content
  // =======================================================================
  add: {

    // ---- a resource found nowhere else --------------------------------
    commodities: {
      lattice_resin: {
        name: "Lattice Resin",
        sellVal: 540,
        buyVal: 1300,
        mass: 0.8,
        tier: "exotic",
        icon: "🔷"
      }
    },

    // ---- the quadrant --------------------------------------------------
    regions: {
      the_tessellation: {
        id: "the_tessellation",
        name: "The Tessellation",
        blurb: "Every system here is the same system, repeated at a slightly different " +
               "scale. The Corps chart calls this a survey error. It is not a survey error.",
        danger: "Precursor practice work, still running. It does not appear to be finished.",
        arrival: { x: 250, y: 100 },
        // Clear of every well in the core. The first draft of this pack put the
        // return point at (330, 120) - which is exactly where the gate below
        // sits - so coming home dropped the ship inside the mouth it had just
        // left. That is the v1.14.1 Lattice trap, and the validator refused the
        // pack rather than let it ship. Rules earn their keep.
        returnTo: { region: "core", x: 200, y: 60 },
        wormholeCfg: { pairs: 2, solos: 1 },
        traffic: { count: 5, races: ["thrynn", "veloxi", "spemin"] },

        starSystems: [
          {
            name: "First Iteration", x: 250, y: 150, starClass: "G", starColor: "#ffee99",
            descr: "A yellow star with three worlds in perfectly even orbits. Perfectly even.",
            planets: [
              { name: "Iteration I", radius: 50, speed: 0.015, color: "#99aa88", size: 9,
                gravity: 1.0, temp: 18, atmosphere: "Nitrogen/Oxygen", bio: 0.55, minerals: 0.5,
                hasRuins: true, artifact: null },
              { name: "Iteration II", radius: 90, speed: 0.010, color: "#8899aa", size: 11,
                gravity: 1.4, temp: -30, atmosphere: "Thin Argon", bio: 0.1, minerals: 0.85,
                hasRuins: false, artifact: null }
            ]
          },
          {
            name: "Second Iteration", x: 140, y: 280, starClass: "G", starColor: "#ffee99",
            descr: "The same star. The same three worlds. Nine percent larger, and nothing else differs.",
            planets: [
              { name: "Second Iteration I", radius: 55, speed: 0.014, color: "#99aa88", size: 10,
                gravity: 1.1, temp: 19, atmosphere: "Nitrogen/Oxygen", bio: 0.55, minerals: 0.5,
                hasRuins: true, artifact: "Tessellation Key" },
              { name: "Second Iteration II", radius: 98, speed: 0.009, color: "#8899aa", size: 12,
                gravity: 1.5, temp: -28, atmosphere: "Thin Argon", bio: 0.1, minerals: 0.9,
                hasRuins: false, artifact: null }
            ]
          },
          {
            name: "The Draft", x: 370, y: 300, starClass: "K", starColor: "#ffaa66",
            descr: "An iteration that failed. The orbits are wrong and one world is simply missing.",
            planets: [
              { name: "Draft Remnant", radius: 60, speed: 0.02, color: "#775544", size: 7,
                gravity: 0.5, temp: 210, atmosphere: "Sulfur Fog", bio: 0.0, minerals: 1.0,
                hasRuins: true, artifact: null }
            ]
          },
          {
            name: "Last Iteration", x: 250, y: 400, starClass: "O", starColor: "#ddeeff",
            descr: "Enormous, and surrounded by worlds arranged at intervals no accretion produces.",
            planets: [
              { name: "Final Draft", radius: 70, speed: 0.011, color: "#aabbcc", size: 13,
                gravity: 3.2, temp: 60, atmosphere: "Manufactured", bio: 0.3, minerals: 0.95,
                hasRuins: true, artifact: null }
            ]
          }
        ],

        // The way home, paired with the gate pushed onto the core below
        blackHoles: [
          { id: "bh_tess_return", name: "The Repeating Mouth", x: 250, y: 455,
            gravityRadius: 30, coreRadius: 4, pullForce: 40, destX: 250, destY: 430,
            returnsTo: "core",
            desc: "A fold that reads as four identical folds stacked on one another." }
        ],

        derelicts: [
          { id: "der_tess_1", name: "The Drafting Table", x: 200, y: 220, searched: false,
            puzzleId: "puz_tess_lock",
            loot: { type: "lattice_resin", amount: 4, credits: 2600, artifact: null,
                    tech: "Sensor Amplifier", techPartKey: "sensor_amplifier" },
            desc: "A Precursor workshop, not a warship. Something was being designed here, repeatedly." }
        ],

        spaceWrecks: [
          { id: "sw_tess_1", name: "Corps Survey Cutter Iteration", x: 330, y: 190,
            searched: false, techPartKey: "quantum_shield_core" }
        ],

        distressSignals: [
          { id: "sig_tess_1", name: "Distress Beacon: The Same Message", x: 175, y: 350,
            active: true, event: "corps_beacon", bounty: 1100, chartRadius: 140,
            desc: "A Corps beacon transmitting a message that repeats with a very slightly " +
                  "different timestamp each cycle. It has done this for two hundred years.",
            grantsClue: {
              id: "clue_tess_repeat",
              title: "The Same Message",
              text: "CORPS SURVEY, THE TESSELLATION: \"WE HAVE CHARTED FOUR SYSTEMS AND THEY ARE " +
                    "THE SAME SYSTEM. NOT SIMILAR. THE SAME, AT DIFFERENT SCALES, AS THOUGH " +
                    "SOMEONE WERE WORKING OUT HOW BIG TO MAKE IT. WE THINK THE LATTICE IS THE " +
                    "FINISHED ARTICLE AND THIS IS WHERE THEY PRACTISED.\"",
              coords: { x: 175, y: 350 }
            } }
        ],

        nebulae: [
          { id: "neb_tess_1", name: "The Grid", x: 250, y: 270, radius: 100,
            color: "rgba(90, 160, 220, 0.24)",
            desc: "Dust settled into a regular lattice. Dust does not do this.",
            effect: "scanner_blind" }
        ],

        alienPorts: [
          { id: "port_tess_thrynn", name: "Ninth House Assay Office", raceKey: "thrynn",
            archive: "tess_assay",
            x: 300, y: 240, color: "#ffcc00", icon: "⌂",
            fuelPrice: 44,
            wants: ["lattice_resin", "precursor_alloy", "iridium"],
            wantMult: 2.2, baseMult: 0.7,
            tradeLine: "We are here for the resin and we are not pretending otherwise. Name your price " +
                       "and we will tell you why it is too high.",
            greeting: "The House keeps an assay office wherever something is worth weighing. " +
                      "This quadrant is worth weighing." }
        ]
      }
    },

    // ---- somewhere to read --------------------------------------------
    archiveLocations: {
      tess_assay: {
        id: "tess_assay",
        name: "Assay Office Records",
        icon: "📜",
        blurb: "What the Ninth House has weighed, measured and declined to explain."
      }
    },

    archives: [
      {
        id: "vol_tess_resin",
        location: "tess_assay",
        title: "On Lattice Resin",
        author: "Assayer Thessil, Ninth House",
        text: "It is not a mineral. It does not occur. It is a MANUFACTURED substance found in the " +
              "crust of worlds that have never been inhabited, in quantities that suggest spillage.\n\n" +
              "The House sells it as an exotic. The House does not speculate in writing about what it " +
              "was spilled from."
      },
      {
        id: "vol_tess_practice",
        location: "tess_assay",
        title: "Four Systems, One Design",
        author: "Assayer Thessil, Ninth House",
        unlockedBy: { volume: "vol_tess_resin" },
        grantsClue: {
          id: "clue_tess_practice",
          title: "They Were Practising",
          source: "archive",
          sourceName: "Assay Office Records",
          coords: { x: 250, y: 400 },
          text: "THE NINTH HOUSE, ASSAY OFFICE: the four systems of the Tessellation are one design at " +
                "four scales, each larger than the last. The largest, at (250, 400), matches the " +
                "spacing recorded in the Lattice. This quadrant is a rehearsal."
        },
        text: "I have measured all four. They are one design at four scales, each larger than the last, " +
              "and the largest matches the spacing our surveys record in the Lattice.\n\n" +
              "The conclusion is not difficult and I will write it once: somebody built this quadrant to " +
              "find out how to build that one. We are standing in the workings."
      }
    ],

    // ---- a mission ------------------------------------------------------
    quests: [
      {
        id: "quest_tessellation",
        title: "The Rehearsal",
        autoStart: false,
        stages: [
          {
            brief: "Establish what the Tessellation actually is",
            clues: [{
              id: "clue_tess_open",
              title: "AN ERROR THAT IS NOT AN ERROR",
              text: "Corps charts mark four systems in the Tessellation as a survey error - the same " +
                    "system logged four times. The survey wing that filed it was not mistaken.",
              source: "hq"
            }],
            objectives: [
              { type: "visit_region", region: "the_tessellation",
                text: "Reach the Tessellation" },
              { type: "read_volume", volumeId: "vol_tess_practice",
                text: "Read the Ninth House assay on the four systems" }
            ]
          },
          {
            brief: "Recover the key from the second iteration",
            objectives: [
              { type: "collect_artifact", artifact: "Tessellation Key",
                text: "Recover the Tessellation Key from Second Iteration I" },
              { type: "solve_puzzle", puzzleId: "puz_tess_lock",
                text: "Open the workshop cache aboard the Drafting Table" }
            ],
            reward: {
              credits: 4000,
              log: "The rehearsal is documented. Corps Command has been informed that the Lattice was built twice.",
              clues: [{
                id: "clue_tess_conclusion",
                title: "BUILT TWICE",
                text: "The Tessellation is a rehearsal for the Lattice. Whoever built one built the " +
                      "other, and did it in this order. They were learning."
              }]
            }
          }
        ]
      }
    ],

    // ---- a sealed mechanism --------------------------------------------
    puzzles: [
      {
        id: "puz_tess_lock",
        type: "cipher",
        title: "Drafting Table Cache",
        prompt: "The workshop cache is closed behind a rotation cipher. The Assay Office records note " +
                "that Precursor draft work is indexed by the number of iterations in the series.",
        ciphertext: "XLI PEXXMGI MW XLI JEMV GSTC",
        plaintext: "THE LATTICE IS THE FAIR COPY",
        grantsClue: {
          id: "puz_tess_plaintext",
          title: "DECRYPTED: DRAFTING TABLE CACHE",
          source: "derelict",
          sourceName: "The Drafting Table",
          text: "The workshop cache, decoded: 'THE LATTICE IS THE FAIR COPY.' Everything in the " +
                "Tessellation is a draft of it."
        },
        reward: { credits: 900, log: "Workshop cache opened. Draft records recovered." }
      }
    ]
  },

  // =======================================================================
  // EXTEND - reach into content that already exists
  // =======================================================================
  extend: {

    // Without this the quadrant is unreachable. This is the whole reason
    // `extend` exists.
    regions: {
      core: {
        push: {
          blackHoles: [
            { id: "bh_to_tessellation", name: "The Duplicate Reading", x: 60, y: 200,
              gravityRadius: 32, coreRadius: 4, pullForce: 42,
              destX: 60, destY: 200, leadsTo: "the_tessellation",
              desc: "A fold on the western rim, hard against the Aquila Dark Veil, which Corps " +
                    "telemetry has logged as a duplicate reading for four hundred years. " +
                    "It is not a duplicate reading." }
          ]
        }
      }
    },

    // New conversation for a race that already exists
    aliens: {
      thrynn: {
        // Dotted path: conversation nodes live at aliens.<race>.dialogue.nodes.
        // Writing "nodes" alone put them on aliens.thrynn.nodes, which nothing
        // reads - the pack reported success and the content was not there.
        merge: {
          "dialogue.nodes": {
            thrynn_tessellation: {
              text: "\"The Tessellation. Yes. We keep an assay office there and we would rather you " +
                    "did not ask why, but you are going to.\"",
              choices: [
                { text: "Ask what the resin is worth.",
                  response: "\"More than you will be offered for it anywhere else, which should tell " +
                            "you the House would rather have the resin than the margin.\"" },
                { text: "Ask why the House cares about a survey error.",
                  once: "thrynn_tess_why",
                  response: "\"Because it is not an error, and a House that can tell the difference " +
                            "between an error and a rehearsal is a House that gets there first.\"",
                  clue: { id: "thrynn_tess_rehearsal", title: "THE HOUSE GOT THERE FIRST",
                          coords: { x: 60, y: 200 },
                          text: "A Thrynn factor confirms the Ninth House knows the Tessellation is not a " +
                                "survey error. Their way in is a fold on the western rim at (60, 200)." } },
                { text: "Trade 2 lattice resin for 8 iridium.",
                  action: "swap",
                  swap: { give: { key: "lattice_resin", count: 2 }, get: { key: "iridium", count: 8 } },
                  response: "\"Done, and gladly. You are getting metal. We are getting the thing the " +
                            "metal was measured against.\"",
                  refuse: "\"You are not carrying two units of resin. We would have weighed it by now.\"" }
              ]
            }
          }
        }
      }
    }
  }
});
