/**
 * Quest content for StarFlight: Odyssey.
 *
 * PURE DATA. The engine lives in js/quest.js and must never need editing to add
 * a quest here. To author a new main quest: append a record to GameData.quests
 * with ordered stages, objectives drawn from the registered types, and the clues
 * each stage reveals.
 *
 * Objective types available (see QuestEngine.handlers):
 *   collect_artifact      { artifact }
 *   collect_all_artifacts { artifacts: [] }
 *   dock_at               { station }
 *   visit_coords          { x, y, tolerance }
 *   talk_to_race          { raceKey }
 *   solve_puzzle          { puzzleId }
 *   assemble_set          { setId }
 *   read_volume           { volumeId }
 *   salvage_site          { siteId }
 *   have_credits          { amount }
 */

window.GameData.quests = [
  {
    id: "quest_precursor_aegis",
    title: "The Precursor Aegis",
    autoStart: true,
    summary: "Stars across the quadrant are collapsing decades early. Starbase Command believes " +
             "the Precursors built a stabilising matrix and scattered its three crystal conduits. " +
             "Recover all three and bring them home.",

    stages: [
      {
        id: "brief",
        title: "STELLAR COLLAPSE ADVISORY",
        brief: "Investigate the Precursor monoliths for data on the stellar collapse",
        clues: [
          {
            id: "aegis_dispatch_1",
            title: "DISPATCH LOG 1 (URGENT)",
            source: "hq",
            sourceName: "Starbase Prime Command",
            text: "Sol-like G stars are bloating and emitting hyper-radiation. We need data from " +
                  "the Precursor monoliths. Ancient ruin worlds carry decryptable archives - land " +
                  "and search any planet flagged as bearing ruins."
          }
        ],
        objectives: [
          {
            type: "collect_artifact",
            artifact: "Earth Artifact",
            text: "Recover the Earth Artifact from a Precursor ruin",
            log: "Monolith archive decrypted. Aegis conduit one secured."
          }
        ],
        onComplete: {
          log: "Starbase Prime has decoded the first monolith record.",
          clues: [
            {
              id: "aegis_ruin_record",
              title: "DECODED RUIN RECORD ALPHA",
              source: "ruin",
              sourceName: "Arth-IV Monolith",
              text: "'...the Flare occurred 20,000 cycles ago. The Precursor Aegis matrix stabilised " +
                    "the cores. It requires three crystal conduits: the Earth Artifact, the Nebular " +
                    "Crystal and the Void Core. The remaining two were carried to the luminous white " +
                    "star at (180, 220) and to the dying red supergiant at (320, 190).'"
            }
          ]
        }
      },

      {
        id: "conduits",
        title: "RECOVER THE REMAINING CONDUITS",
        brief: "Recover the Nebular Crystal and the Void Core",
        clues: [
          {
            id: "aegis_sirius",
            title: "SURVEY CROSS-REFERENCE",
            source: "survey",
            sourceName: "Nav-Computer",
            coords: { x: 180, y: 220 },
            text: "The luminous white star in the record matches SIRIUS SECTOR at (180, 220). " +
                  "One of its worlds registers Precursor ruin signatures."
          },
          {
            id: "aegis_nebular",
            title: "SURVEY CROSS-REFERENCE",
            source: "survey",
            sourceName: "Nav-Computer",
            coords: { x: 320, y: 190 },
            text: "The dying red supergiant matches NEBULAR GATE at (320, 190). Its second world " +
                  "carries ruin signatures. The star is already in pre-nova collapse."
          }
        ],
        objectives: [
          {
            type: "collect_artifact",
            artifact: "Nebular Crystal",
            text: "Recover the Nebular Crystal (Sirius Sector, 180/220)",
            log: "Aegis conduit two secured."
          },
          {
            type: "collect_artifact",
            artifact: "Void Core",
            text: "Recover the Void Core (Nebular Gate, 320/190)",
            log: "Aegis conduit three secured."
          }
        ],
        onComplete: {
          log: "All three Aegis conduits are aboard. Return to Starbase Prime.",
          sound: "powerup",
          clues: [
            {
              id: "aegis_final_orders",
              title: "RESEARCH SUMMARY: SAVING THE CORPS",
              source: "hq",
              sourceName: "Starbase Prime Command",
              coords: { x: 250, y: 250 },
              text: "Bring all three Precursor Artifacts to Starbase Prime at (250, 250). Depot " +
                    "engineers can integrate them with the warp reactor, triggering a dampening " +
                    "wave to stabilise every local star."
            }
          ]
        }
      },

      {
        id: "deliver",
        title: "DELIVER THE AEGIS",
        brief: "Dock at Starbase Prime with all three conduits",
        objectives: [
          {
            type: "collect_all_artifacts",
            artifacts: ["Earth Artifact", "Nebular Crystal", "Void Core"],
            text: "Carry all three Precursor conduits"
          },
          {
            type: "dock_at",
            station: "Starbase Prime",
            text: "Dock at Starbase Prime (250, 250)"
          }
        ]
      }
    ],

    onComplete: {
      sound: "victory",
      log: "The Aegis matrix is whole.",
      fn: "triggerAegisVictory"
    }
  }
];
