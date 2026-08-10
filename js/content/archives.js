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
  },

  // ---- Beyond the folds --------------------------------------------------
  // The deep-region ports originally pointed at their own race's CORE archive,
  // so crossing a one-way gate into a quadrant nobody returns from got you the
  // same pamphlet you could have read at home. People who have been stranded for
  // eleven generations know different things.
  spemin_stranded: {
    id: "spemin_stranded",
    name: "The Moss Archive",
    icon: "🫧",
    blurb: "Eleven generations of notes by Spemin who came through the Gate and could not go back."
  },
  thrynn_forward: {
    id: "thrynn_forward",
    name: "Ninth House Forward Ledger",
    icon: "📜",
    blurb: "The accounts of a trading post that should not be profitable, and somehow is."
  },
  veloxi_deep: {
    id: "veloxi_deep",
    name: "Deep Survey Standing Orders",
    icon: "🏛️",
    blurb: "Six hundred years of observations of something that has not moved once."
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
,

  // ---- The Marrow: Spemin who came through and stayed --------------------
  {
    id: "vol_moss_first",
    location: "spemin_stranded",
    title: "We Have Been Counting",
    author: "The Spemin Who Stayed, Generation Eleven",
    text: "IMPORTANT SPEMIN RECORD! Generation One came through the Abyssal Gate looking for a " +
          "shortcut. Generation One found out there is no shortcut, there is only a Gate, and it " +
          "opens ONE WAY. Generations Two through Six were very upset about this. Generation " +
          "Seven invented the moss. Generations Eight through Eleven have been mostly fine!\\n\\n" +
          "We are telling you this because you came through it too and nobody told YOU either. " +
          "The Gate does not open from this side. We have checked. We have checked A LOT."
  },
  {
    id: "vol_moss_fuel",
    location: "spemin_stranded",
    title: "On The Making Of Fuel From Moss",
    author: "Bubble-Of-Reasonable-Confidence, Fuel Priest",
    text: "The moss grows on the hulls of ships that stopped. There are many of those. You press " +
          "the moss, you cook the moss, you do NOT eat the moss, and what comes out will run a " +
          "reactor for a while.\\n\\nIt is not good fuel. It is fuel that EXISTS, which out here " +
          "is the more important quality. Nobody has exploded in four generations. Generation " +
          "Seven had a harder time of it and we do not talk about Generation Seven's kitchen."
  },
  {
    id: "vol_moss_sounding",
    location: "spemin_stranded",
    title: "The Thing At The Bottom",
    author: "The Spemin Who Stayed, Collectively, Nervously",
    unlockedBy: { volume: "vol_moss_first" },
    grantsClue: {
      id: "clue_marrow_sounding_current",
      title: "Everything Drifts Toward The Sounding",
      source: "archive",
      sourceName: "The Moss Archive",
      coords: { x: 300, y: 420 },
      text: "THE MOSS ARCHIVE, GENERATION ELEVEN: \"Everything in the Marrow is falling toward the " +
            "hole in the south at (300, 420). Slowly. Us as well. Ships that go in do not come " +
            "back, but they also do not stop transmitting immediately, which is not what a ship " +
            "being destroyed sounds like. Whatever is down there, they ARRIVE somewhere. " +
            "Generation Nine wanted to follow them. Generation Nine may have been right.\""
    },
    text: "There is a hole in the south of this quadrant and everything is falling into it. Us " +
          "too, very slowly, which is a thing we try not to think about on the bad days.\\n\\n" +
          "Ships that fall in keep transmitting for a while afterward. That is NOT what a ship " +
          "being crushed sounds like. That is what a ship ARRIVING somewhere sounds like.\\n\\n" +
          "Generation Nine wanted to fly into it on purpose. We said that was the worst idea we " +
          "had ever heard. We have had eleven generations to think about it and we are no longer " +
          "as sure as we were."
  },

  // ---- The Shattered Reach: a Thrynn post that should not exist ----------
  {
    id: "vol_forward_ledger",
    location: "thrynn_forward",
    title: "Why This Post Is Not Closed",
    author: "Factor Ssareth, Ninth House, Forward Accounts",
    text: "The House does not run unprofitable posts. This post is unprofitable. Both statements " +
          "are true and the reconciliation is not in these ledgers, which should tell you " +
          "something about who wants it kept open.\\n\\nWhat I will record: Corps hulls come " +
          "through the Cygnus fold at a rate of roughly one a decade. None have ever gone back " +
          "through it. They buy fuel, they ask about the deep folds, and then the ledger closes " +
          "on them. I sell to them anyway. Their credits spend."
  },
  {
    id: "vol_forward_wrecks",
    location: "thrynn_forward",
    title: "Salvage Valuations, Reach Sector",
    author: "Factor Ssareth, Ninth House, Forward Accounts",
    unlockedBy: { volume: "vol_forward_ledger" },
    text: "Precursor alloy out of the Reach assays higher than anything out of charted space. Not " +
          "a little higher. Twice.\\n\\nThe House assumed a better vein. I have handled enough of " +
          "it to disagree. It is not better ore. It is the same ore, WORKED - and worked by " +
          "something that understood it far better than the people mining it now. Every fragment " +
          "out here is a piece of something that used to be a whole."
  },

  // ---- The Lattice: Veloxi watching something that does not move ---------
  {
    id: "vol_deep_orders",
    location: "veloxi_deep",
    title: "Standing Orders, Deep Survey Station",
    author: "Imperial Survey Directorate",
    text: "The station observes and does not intervene. The station has observed and not " +
          "intervened for six hundred and eleven years.\\n\\nSubject of observation: the " +
          "structures. Change in subject over the observation period: none measurable. Change in " +
          "the Imperium over the observation period: three dynasties, two civil wars and a " +
          "reform of the calendar.\\n\\nThe Directorate notes without comment that the thing " +
          "being watched has outlasted every government that ordered it watched."
  },
  {
    id: "vol_deep_arranged",
    location: "veloxi_deep",
    title: "On The Placement Of Stars",
    author: "Observer-Prime, Deep Survey Station",
    unlockedBy: { volume: "vol_deep_orders" },
    grantsClue: {
      id: "clue_lattice_arranged",
      title: "The Stars Here Are Placed",
      source: "archive",
      sourceName: "Deep Survey Standing Orders",
      text: "VELOXI DEEP SURVEY: \"The stellar distribution in this quadrant is not natural and is " +
            "not random. The stars are arranged, at a spacing that does not occur by accretion, " +
            "around a common focus. Whatever moved them was working at a scale the Imperium has " +
            "no unit for. It is the considered position of this station that the Lattice is not " +
            "a place the Precursors built IN. It is a thing they built.\""
    },
    text: "I am required to record observations, not conclusions. I have recorded observations " +
          "for forty years and I am going to record one conclusion before I am rotated out.\\n\\n" +
          "The stars in this quadrant are PLACED. The spacing does not occur by accretion. They " +
          "sit around a common focus at intervals that are regular to four decimals. No natural " +
          "process does this.\\n\\nThe Lattice is not somewhere the Precursors built. The Lattice " +
          "is the thing they built. We have been calling it a region for six centuries because " +
          "the alternative required a bigger word than the Directorate had approved."
  }];
