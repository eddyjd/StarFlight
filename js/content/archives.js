/**
 * Archive content for StarFlight: Odyssey.
 *
 * PURE DATA. The reader lives in js/archive.js and never needs editing to add a
 * volume. Archives are the research half of the clue economy: dispatches tell you
 * what Command knows, ruins tell you what the Precursors left, and archives let
 * you go looking for context nobody handed you.
 *
 * Volume fields:
 *   id          unique
 *   location    which archive stocks it (see GameData.archiveLocations)
 *   title       shelf title
 *   author      attribution flavour
 *   text        the body the captain reads
 *   unlockedBy  optional gate: { artifacts: n } | { clue: id } | { volume: id }
 *                              | { quest: id, stage: n } | { salvaged: id }
 *   grantsClue  optional clue recorded on first read (ClueLog shape)
 */

window.GameData.archiveLocations = {
  starbase_prime: {
    id: "starbase_prime",
    name: "Starbase Prime Central Archive",
    icon: "📚",
    blurb: "Four centuries of Corps survey records, dispatches and salvaged Precursor translations."
  },
  thrynn_reliquary: {
    id: "thrynn_reliquary",
    name: "Thrynn Trade Reliquary",
    icon: "📜",
    blurb: "A merchant house archive. The Thrynn keep meticulous ledgers, and sell access to them."
  },
  veloxi_codex: {
    id: "veloxi_codex",
    name: "Veloxi Imperial Codex",
    icon: "🏛️",
    blurb: "Imperial survey doctrine. Precise, humourless, and unusually accurate."
  },
  spemin_hoard: {
    id: "spemin_hoard",
    name: "Spemin Collected Wisdoms",
    icon: "🫧",
    blurb: "Mostly nonsense. Occasionally, accidentally, the truth."
  }
};

window.GameData.archives = [

  // ---- Starbase Prime: Corps records ------------------------------------
  {
    id: "vol_survey_primer",
    location: "starbase_prime",
    title: "Survey Primer: Reading a Dead World",
    author: "Cdr. E. Salas, Corps Survey Doctrine",
    text: "Ruin worlds share three markers: anomalous surface geometry, elevated mineral " +
          "concentration in the crust, and an atmosphere that has been chemically stable far " +
          "longer than the local star should allow. Where you find all three, land. The " +
          "Precursors did not build where it was convenient. They built where it would last."
  },
  {
    id: "vol_aegis_theory",
    location: "starbase_prime",
    title: "On the Aegis Hypothesis",
    author: "Dr. M. Oyelaran, Stellar Physics",
    text: "The collapse cycle is not natural. Stars of this class do not bloat on this " +
          "timescale. Something once held them steady, and that something has stopped. If the " +
          "Precursor matrix was real, its conduits were crystalline - and crystal survives.",
    unlockedBy: { artifacts: 1 },
    grantsClue: {
      id: "arch_aegis_theory",
      title: "ARCHIVE: ON THE AEGIS HYPOTHESIS",
      source: "archive",
      sourceName: "Starbase Prime Central Archive",
      questId: "quest_precursor_aegis",
      text: "The collapse is artificial. The Precursor conduits are crystalline and will have " +
            "survived - look for them interred on worlds bearing ruin signatures."
    }
  },
  {
    id: "vol_uhlek_warning",
    location: "starbase_prime",
    title: "Threat Assessment: The Uhlek Swarm",
    author: "Corps Intelligence, Restricted",
    text: "The Uhlek are a distributed machine intelligence occupying the far southeast rim " +
          "around (440, 420). They do not negotiate, trade, or acknowledge hails. Assume any " +
          "approach is hostile. Deflectors to full before crossing 400 on either axis.",
    grantsClue: {
      id: "arch_uhlek_territory",
      title: "ARCHIVE: UHLEK THREAT ASSESSMENT",
      source: "archive",
      sourceName: "Starbase Prime Central Archive",
      coords: { x: 440, y: 420 },
      text: "Uhlek machine intelligence holds the southeast rim around (440, 420). They do not " +
            "negotiate. Shields to full before crossing 400 on either axis."
    }
  },
  {
    id: "vol_salvage_law",
    location: "starbase_prime",
    title: "Customs Directive 19: Restricted Cargo",
    author: "Starbase Prime Customs Authority",
    text: "Spemin Spice is prohibited within 130 light years of this station. Cutters run " +
          "routine scans of passing hulls. Note that ablative shielding of the type fitted to " +
          "Class 3 cargo bays renders a hold opaque to those scans. This notice is provided " +
          "for compliance purposes only.",
    grantsClue: {
      id: "arch_customs_loophole",
      title: "ARCHIVE: CUSTOMS DIRECTIVE 19",
      source: "archive",
      sourceName: "Starbase Prime Central Archive",
      text: "Customs cutters scan hulls within 130 LY of Starbase Prime. Class 3 Shielded Cargo " +
            "Bays render a hold opaque to those scans - the directive says so itself."
    }
  },

  // ---- Thrynn: merchants who write everything down -----------------------
  {
    id: "vol_thrynn_ledger",
    location: "thrynn_reliquary",
    title: "Ledger of Uncommon Cargo, Vol. XI",
    author: "Factor Ssarik of the Ninth House",
    text: "Buyers pay best for what cannot be farmed. Raw Endurium from volcanic crust. " +
          "Precursor alloy from ruin strata. Live fauna, which requires cryo-containment no " +
          "sensible trader carries. We note that Corps captains routinely sell such goods below " +
          "value, and we thank them for it."
  },
  {
    id: "vol_thrynn_rift_charts",
    location: "thrynn_reliquary",
    title: "Rift Charts of the Outer Reach",
    author: "Thrynn Navigators' Guild",
    text: "The quantum folds are paired. Enter one and you exit its twin, always, without " +
          "exception. What the Corps calls a hazard we call a trade route. Chart both mouths " +
          "before you commit - a fold you have not mapped is a fold that has you.",
    grantsClue: {
      id: "arch_rift_pairing",
      title: "ARCHIVE: THRYNN RIFT CHARTS",
      source: "archive",
      sourceName: "Thrynn Trade Reliquary",
      text: "Quantum folds are strictly paired - each exit is another fold's mouth. Traverse one " +
            "and the Nav-Computer will chart the route permanently."
    }
  },

  // ---- Veloxi: imperial precision ----------------------------------------
  {
    id: "vol_veloxi_doctrine",
    location: "veloxi_codex",
    title: "Imperial Survey Doctrine, Third Revision",
    author: "Archivist-Prime of the Veloxi Ascendancy",
    text: "The ancient worlds are catalogued. Of those within the mapped quadrant, three bore " +
          "interment chambers. Two were opened by our surveyors and found emptied by an earlier " +
          "hand. The third we did not open. It orbits the yellow dwarf the humans have made " +
          "their home, and they have never looked beneath their own feet.",
    grantsClue: {
      id: "arch_veloxi_third_chamber",
      title: "ARCHIVE: VELOXI SURVEY DOCTRINE",
      source: "archive",
      sourceName: "Veloxi Imperial Codex",
      questId: "quest_precursor_aegis",
      coords: { x: 250, y: 250 },
      text: "Veloxi surveyors catalogued three Precursor interment chambers. The one they never " +
            "opened orbits the yellow dwarf humans call home - Starbase Prime, (250, 250). They " +
            "note the humans have never looked beneath their own feet."
    }
  },
  {
    id: "vol_veloxi_collapse",
    location: "veloxi_codex",
    title: "Observations on Stellar Failure",
    author: "Ascendancy Astrometrics",
    text: "We have logged the collapse cycle for eleven of our own systems. The progression is " +
          "identical in each: nine decades of stability, then rapid bloat. It does not resemble " +
          "stellar aging. It resembles a machine being switched off.",
    unlockedBy: { artifacts: 2 }
  },

  // ---- Spemin: mostly wrong, occasionally not -----------------------------
  {
    id: "vol_spemin_wisdom",
    location: "spemin_hoard",
    title: "Great Spemin Truths (Abridged)",
    author: "The Spemin, Collectively, Probably",
    text: "TRUTH ONE: the big spiky ships are bad. TRUTH TWO: if a rock glows, do not eat the " +
          "rock. TRUTH THREE: there is a place where the dark holes go, and things come back " +
          "from it changed and shinier. We did not go. We are not brave. But we watched, and " +
          "the ones who came back had metal we have never seen."
  }
];
