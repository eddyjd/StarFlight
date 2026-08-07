/**
 * Puzzle content for StarFlight: Odyssey.
 *
 * PURE DATA. The engine (js/puzzle.js) resolves each by `type` through its
 * registry, so a new puzzle here needs no code. A new KIND of puzzle needs one
 * PuzzleEngine.register() call and nothing else.
 *
 * Fields:
 *   id, type, title, prompt
 *   requires     optional gate: { clue } | { volume } | { puzzle } | { artifacts:n }
 *   grantsClue   recorded on solve
 *   reward       declarative, same shape QuestEngine.applyReward understands
 *
 * cipher   -> ciphertext, plaintext
 * sequence -> glyphs[], solution[]
 * assembly -> setId, fragments[{id,name,icon,hint}]
 */

window.GameData.puzzles = [

  {
    id: "puz_kronos_lock",
    type: "cipher",
    title: "Kronos-9 Command Cipher",
    prompt: "The station's final log is rotated by a fixed key. Corps signal doctrine records " +
            "that Precursor-era human outposts used a rotation matching the count of conduits " +
            "in the Aegis matrix.",
    ciphertext: "WKH ILUVW FRQGXLW OLHV EHQHDWK RXU RZQ VXQ",
    plaintext: "THE FIRST CONDUIT LIES BENEATH OUR OWN SUN",
    grantsClue: {
      id: "puz_kronos_plaintext",
      title: "DECRYPTED: KRONOS-9 FINAL LOG",
      source: "derelict",
      sourceName: "Derelict Station Kronos-9",
      questId: "quest_precursor_aegis",
      coords: { x: 250, y: 250 },
      text: "Kronos-9's last transmission, decoded: 'THE FIRST CONDUIT LIES BENEATH OUR OWN SUN.' " +
            "They meant Starbase Prime's own system, (250, 250)."
    },
    reward: { credits: 400, log: "Salvage bonus logged for recovered station records." }
  },

  {
    id: "puz_vanguard_helm",
    type: "sequence",
    title: "Ghost Vessel Helm Lockout",
    prompt: "The Vanguard's helm is sealed behind an ignition sequence. A brass rubbing found " +
            "in the wreckage shows four glyphs in order - if you have seen it.",
    glyphs: ["▲", "◆", "●", "■", "✦", "▼"],
    solution: ["◆", "▲", "■", "✦"],
    requires: { clue: "arch_rift_pairing" },
    grantsClue: {
      id: "puz_vanguard_charts",
      title: "RECOVERED: VANGUARD NAVIGATION CHARTS",
      source: "derelict",
      sourceName: "Ghost Vessel Vanguard",
      text: "The Vanguard's helm yields her final charts. Her crew were running the fold network " +
            "as a trade route, and mapped both mouths of every rift they used."
    },
    reward: { credits: 800, log: "Vanguard navigation charts recovered." }
  },

  {
    id: "puz_aegis_cradle",
    type: "assembly",
    title: "Precursor Cradle Assembly",
    prompt: "The cradle that once held the Aegis conduits can be rebuilt from scattered " +
            "components. Recover all three and it will seat them.",
    setId: "aegis_cradle",
    fragments: [
      { id: "frag_lattice", name: "Resonance Lattice", icon: "❉", hint: "aboard a drifting alien wreck" },
      { id: "frag_socket", name: "Conduit Socket Ring", icon: "◎", hint: "aboard a derelict station" },
      { id: "frag_governor", name: "Field Governor", icon: "⚙", hint: "beneath a ruin world" }
    ],
    grantsClue: {
      id: "puz_cradle_built",
      title: "ASSEMBLED: PRECURSOR CRADLE",
      source: "ruin",
      sourceName: "Precursor Cradle",
      text: "The cradle is whole. Its three sockets are cut for crystal conduits - and it hums " +
            "faintly even empty, as though still waiting."
    },
    reward: { credits: 1200, log: "The cradle is assembled and seated in the cargo bay." }
  }
];
