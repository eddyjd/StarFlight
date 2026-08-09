/**
 * Templates for distress calls that appear during play.
 *
 * PURE DATA. js/distress.js picks one of these, drops it somewhere in the active
 * region, gives it a lifetime and lets it expire if it is ignored.
 *
 * `weight` biases the roll. `clue` is optional - most calls are just a call, and
 * that is deliberate: a beacon that always paid out in intelligence would make
 * ignoring one unthinkable, and the choice is the point.
 *
 * `{X}` and `{Y}` in clue text are replaced with the signal's own coordinates.
 */

window.GameData.signalTemplates = [

  {
    id: "sig_dyn_hauler",
    weight: 3,
    name: "Distress Beacon: Hauler Adrift",
    event: "trade_rescue",
    desc: "An independent bulk hauler with a cracked injector manifold. They are offering " +
          "well over the going rate for ten units of Endurium, which usually means they can afford it."
  },

  {
    id: "sig_dyn_probe",
    weight: 3,
    name: "Distress Beacon: Derelict Telemetry Probe",
    event: "probe_salvage",
    chartRadius: 70,
    desc: "An old survey probe still transmitting on a dead carrier. Nobody has come for it, " +
          "and by the registry nobody is going to."
  },

  {
    id: "sig_dyn_pod",
    weight: 2,
    name: "Distress Beacon: Escape Pod",
    event: "rescue_pod",
    desc: "A single occupied cryo-pod on a slow tumble. The transponder has been repeating " +
          "the same four words for eleven days."
  },

  // ---- calls that carry intelligence --------------------------------------

  {
    id: "sig_dyn_prospector",
    weight: 2,
    name: "Distress Beacon: Prospector's Last Fix",
    event: "corps_beacon",
    bounty: 700,
    chartRadius: 90,
    desc: "An independent prospector's beacon, set to fire only when the reactor went cold.",
    clue: {
      title: "The Prospector's Fix",
      text: "PROSPECTOR'S LOG, FINAL ENTRY: \"FOUND THE SEAM. NOT SAYING WHERE ON AN OPEN BAND - " +
            "IT IS IN THE FIX, AND THE FIX IS IN THE BEACON. WHOEVER PULLS THIS, YOU EARNED IT " +
            "MORE THAN THE COMPANY WOULD HAVE. TAKE THE READING AT ({X}, {Y}) AND WORK OUTWARD. " +
            "MIND THE THIRD ROCK. IT IS NOT A ROCK.\""
    }
  },

  {
    id: "sig_dyn_courier",
    weight: 2,
    name: "Distress Beacon: Corps Courier, Overdue",
    event: "corps_beacon",
    bounty: 850,
    chartRadius: 100,
    desc: "A Corps courier packet transmitting an overdue flag. The hull is nowhere in sensor range.",
    clue: {
      title: "Overdue Courier",
      text: "CORPS COURIER PACKET, AUTOMATED: \"CARRYING SEALED TRAFFIC FOR STARBASE PRIME. " +
            "INTERCEPTED AT ({X}, {Y}) BY A VESSEL THAT DID NOT ANSWER A CHALLENGE AND DID NOT " +
            "MATCH ANY REGISTRY. THE PACKET WAS EJECTED BEFORE BOARDING. THE COURIER WAS NOT.\""
    }
  },

  {
    id: "sig_dyn_survey",
    weight: 1,
    name: "Distress Beacon: Deep Survey Wing",
    event: "corps_beacon",
    bounty: 1200,
    chartRadius: 120,
    desc: "A survey beacon on a Corps carrier that was retired before most of the fleet was built.",
    clue: {
      title: "Another One Of Ours",
      text: "SURVEY BEACON, REGISTRY WORN PAST READING: \"WE WERE CHARTING THE FOLDS. THEY ARE NOT " +
            "WHERE THE OLD CHARTS PUT THEM AND THEY DO NOT STAY PUT. WE LOGGED ONE AT ({X}, {Y}) " +
            "AND WHEN WE CAME BACK FOR IT, IT HAD MOVED. TELL THE CORPS THE THROATS DRIFT.\""
    }
  }
];
