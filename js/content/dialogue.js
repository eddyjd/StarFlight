/**
 * Extended alien conversation for StarFlight: Odyssey.
 *
 * PURE DATA. The engine lives in js/encounter.js and needs no edits to add a
 * subject, a condition or a trade.
 *
 * Each race in GameData.aliens gains a `nodes` map. A choice with `next: "id"`
 * opens the node of that id, so a subject can be pursued instead of producing one
 * line and stopping. Postures remain the three top-level entry points.
 *
 * Choice fields the engine understands:
 *   text        the button
 *   response    what they say (when the choice does not open a node)
 *   next        node id to open
 *   clue        recorded to the Captain's Log on first use (ClueLog shape)
 *   once        an id; the choice disappears after it has been used
 *   requires    { clue, volume, artifact, artifacts, cargo, credits, quest, region }
 *   hideWhenBlocked  omit entirely rather than showing it greyed with a reason
 *   highlight   draw attention to it
 *   action      exit | combat | trade | surrender | bribe | fine | swap | buy
 *   swap        { give: {key,count}, get: {key,count} }
 *   buy         { key, count, price }
 *   refuse      what they say when the captain cannot meet the terms
 */

(function extendAlienDialogue() {
  const A = window.GameData.aliens;

  // =======================================================================
  // SPEMIN - talkative, cowardly, accidentally useful
  // =======================================================================
  if (A.spemin) {
    A.spemin.dialogue.nodes = {
      spemin_topics: {
        text: "\"ASK US THINGS! We know things! Some of the things are even things we know!\"",
        choices: [
          { text: "Ask what they are carrying.", next: "spemin_wares" },
          { text: "Ask about the Corps.", response: "\"The Corps! With the grey ships and the FORMS. So many forms. " +
                   "They came asking about the old holes in space, and then they went into one, and then they did not come out. " +
                   "We did not fill in a form about it. Should we have filled in a form?\"" },
          { text: "Ask what frightens them most.", next: "spemin_fear" },
          { text: "Ask about the star that is going wrong.",
            requires: { quest: "quest_precursor_aegis" },
            once: "spemin_star",
            response: "\"OH. That. Yes. The big ones are getting BIGGER and that is bad because we live near " +
                      "several of them. The old builders left machines about it. Not FOR it. ABOUT it. There is " +
                      "a difference and we do not know what it is.\"",
            clue: { id: "spemin_machines_about", title: "SPEMIN HEARSAY", questId: "quest_precursor_aegis",
                    text: "A Spemin insists the Precursors left machines \"about\" the stellar collapse rather than " +
                          "\"for\" it - and that the difference matters. They could not say how." } }
        ]
      },
      spemin_wares: {
        text: "\"WARES! We have SO many wares. Most of them are moss. Some of them are NOT moss!\"",
        choices: [
          { text: "Buy a crate of spice. (900 M.U.)",
            action: "buy", buy: { key: "contraband", count: 2, price: 900 },
            response: "\"You did not get it from us. We were never here. We are ALWAYS here, but not for this.\"",
            refuse: "\"You cannot afford the not-moss. The moss is cheaper. The moss is always cheaper.\"" },
          { text: "Trade 3 flora for a slab of void glass.",
            action: "swap", swap: { give: { key: "bio_flora", count: 3 }, get: { key: "void_glass", count: 1 } },
            response: "\"YES! Living things for the dark shiny! We got the dark shiny from a hole. Do not ask which hole.\"",
            refuse: "\"That is not three living things. That is fewer living things than three.\"" },
          { text: "Open the full ledger instead.", action: "trade", response: "\"EVERYTHING is negotiable! Show us!\"" }
        ]
      },
      spemin_fear: {
        text: "\"The Uhlek. Obviously the Uhlek. Next question please.\"",
        choices: [
          { text: "Press them on it.", once: "spemin_uhlek",
            response: "\"They do not TRADE. They do not TALK. A thing that will not talk has already decided about you. " +
                      "They sit out past the rim and they are not doing anything, and they have not been doing anything " +
                      "for a very long time, and that is worse than if they were.\"",
            clue: { id: "spemin_uhlek_waiting", title: "WHAT THE SPEMIN FEAR",
                    text: "The Spemin say the Uhlek are not idle out past the rim - they are WAITING, and have been for " +
                          "a long time. \"A thing that will not talk has already decided about you.\"" } },
          { text: "Ask what they do about it.", response: "\"We go somewhere else! It has worked for eleven generations " +
                   "and we see no reason to stop now.\"" }
        ]
      }
    };
    A.spemin.dialogue.friendly.choices.push(
      { text: "Ask them about anything at all.", next: "spemin_topics", highlight: true });
  }

  // =======================================================================
  // THRYNN - merchants; everything is a transaction, including conversation
  // =======================================================================
  if (A.thrynn) {
    A.thrynn.dialogue.nodes = {
      thrynn_business: {
        text: "\"Business, then. The House deals in three things: metal, beautiful objects, and information. " +
              "You are carrying one of them and asking about another.\"",
        choices: [
          { text: "Buy a cargo of platinum. (2,400 M.U.)",
            action: "buy", buy: { key: "platinum", count: 4, price: 2400 },
            response: "\"Assayed, weighed and yours. The House does not sell short measure; it would cost more in " +
                      "reputation than it saves in metal.\"",
            refuse: "\"Come back with the credits. We will still be here - we are always still here.\"" },
          { text: "Trade 2 precursor alloy for 6 iridium.",
            action: "swap", swap: { give: { key: "precursor_alloy", count: 2 }, get: { key: "iridium", count: 6 } },
            response: "\"A fair rate, and we both know it favours us slightly. That is what makes it fair.\"",
            refuse: "\"You do not have two units of worked alloy. We would know. We can smell it.\"" },
          { text: "Ask what information costs.", next: "thrynn_information" }
        ]
      },
      thrynn_information: {
        text: "\"Information is priced by what it saves you. Some of it we will simply give you, because a captain " +
              "who survives is a captain who trades again.\"",
        choices: [
          { text: "Ask about the singularities.", once: "thrynn_folds",
            response: "\"We do not run routes past them. A ship that goes through stops filing manifests, and a House " +
                      "that cannot audit a route does not run it. What we will tell you for nothing: they are not all " +
                      "the same kind of thing. Some are doors. Some are only holes.\"",
            clue: { id: "thrynn_doors_and_holes", title: "DOORS AND HOLES",
                    text: "A Thrynn factor: the singularities are not all the same kind of object. \"Some are doors. " +
                          "Some are only holes.\" The House will not run routes past any of them." } },
          { text: "Ask who else has been asking.", once: "thrynn_asking",
            response: "\"Corps hulls. One a decade, near enough, all of them wanting the same charts. None of them " +
                      "have come back to complain about the price, which tells you something about the charts or " +
                      "something about the captains.\"" },
          { text: "Ask about the Uhlek.", response: "\"We do not trade with the Uhlek. There is nothing they want that " +
                   "we have, which is the most frightening sentence in commerce.\"" }
        ]
      }
    };
    A.thrynn.dialogue.friendly.choices.push(
      { text: "Talk business.", next: "thrynn_business", highlight: true });
  }

  // =======================================================================
  // VELOXI - imperial, precise, and utterly convinced
  // =======================================================================
  if (A.veloxi) {
    A.veloxi.dialogue.nodes = {
      veloxi_protocol: {
        text: "\"You are permitted three questions. The Imperium has found that captains who ask a fourth are " +
              "rarely asking in good faith.\"",
        choices: [
          { text: "Ask what the Imperium wants out here.",
            response: "\"To observe. The Directorate has observed this quadrant for six centuries and recorded no " +
                      "change worth reporting. We are told this is a success. We are not told how.\"" },
          { text: "Ask about the structures.", requires: { region: "the_lattice" }, hideWhenBlocked: true,
            once: "veloxi_structures", highlight: true,
            response: "\"You are standing inside the answer and asking for it anyway. The stars here are PLACED. " +
                      "Regular to four decimals. No accretion does that. Draw your own conclusion, human, and note " +
                      "that the Imperium has declined to draw it for six hundred years.\"",
            clue: { id: "veloxi_placed_stars", title: "THE IMPERIUM DECLINES TO CONCLUDE",
                    text: "A Veloxi officer in the Lattice: the stellar spacing here is regular to four decimals and " +
                          "no natural process produces that. The Imperium has observed it for six centuries and has " +
                          "formally declined to say what it means." } },
          { text: "Offer reactor mass for imperial alloy.",
            action: "swap", swap: { give: { key: "endurium_ore", count: 4 }, get: { key: "precursor_alloy", count: 2 } },
            response: "\"Acceptable. The Imperium always needs mass and never needs relics.\"",
            refuse: "\"You have offered what you do not carry. This is logged.\"" },
          { text: "Buy a shielded munitions lot. (3,600 M.U.)",
            action: "buy", buy: { key: "titanium", count: 6, price: 3600 },
            response: "\"Imperial plate. It will outlast the hull you fit it to, which is not a compliment.\"",
            refuse: "\"Your credit is insufficient and your manner is worse.\"" }
        ]
      }
    };
    A.veloxi.dialogue.friendly.choices.push(
      { text: "Request permission to ask questions.", next: "veloxi_protocol", highlight: true });
  }

  // =======================================================================
  // UHLEK - they do not converse. What little there is, is worse for it.
  // =======================================================================
  if (A.uhlek) {
    A.uhlek.dialogue.nodes = {
      uhlek_silence: {
        text: "\"...\"\n\nThe carrier is open. Nothing is using it. Something on the far end is listening and has " +
              "not decided that answering is worth the energy.",
        choices: [
          { text: "Keep the channel open and wait.", once: "uhlek_wait",
            response: "\"WE REMEMBER THE BUILDERS. WE REMEMBER WHAT THEY MADE AND WE REMEMBER WHAT IT DID. " +
                      "YOU ARE WALKING IN IT AND CALLING IT DISCOVERY.\"\n\nThe channel closes from their end.",
            clue: { id: "uhlek_remember_builders", title: "THE UHLEK REMEMBER",
                    text: "The only thing an Uhlek has ever said on an open channel: \"WE REMEMBER THE BUILDERS. WE " +
                          "REMEMBER WHAT THEY MADE AND WE REMEMBER WHAT IT DID. YOU ARE WALKING IN IT AND CALLING IT " +
                          "DISCOVERY.\" They have not answered a hail since." } },
          { text: "Close the channel.", action: "exit", response: "Nothing acknowledges the disconnection." }
        ]
      }
    };
    if (A.uhlek.dialogue.friendly) {
      A.uhlek.dialogue.friendly.choices.push(
        { text: "Hold the channel open and say nothing.", next: "uhlek_silence", highlight: true });
    }
  }
})();
