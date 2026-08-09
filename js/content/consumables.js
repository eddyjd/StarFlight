/**
 * One-use equipment for StarFlight: Odyssey.
 *
 * PURE DATA. Every field here is read by js/consumables.js; adding an item is a
 * record, not code - except for the `effect` key, which names a handler in
 * Consumables.EFFECTS.
 *
 * Fields:
 *   id, name, icon, desc
 *   price     what Starbase Prime charges. Deliberately steep: these are meant to
 *             be found more often than bought, and buying one should hurt.
 *   salvage   what it sells for if you would rather have the credits
 *   effect    handler name in Consumables.EFFECTS
 *   where     "space" (hyperspace only), "any", or "docked"
 *   stocked   true if Starbase Prime sells it at all - some are salvage-only
 */

window.GameData.consumables = {

  fold_charge: {
    id: "fold_charge",
    name: "Precursor Fold Charge",
    icon: "🌀",
    desc: "A single-use fold generator. Tears a throat in space and holds it open " +
          "just long enough for one hull to pass. Choose the far end from the chart, " +
          "or let it find its own - it does not much care which.",
    price: 9000,
    salvage: 3200,
    effect: "fold",
    where: "space",
    stocked: true
  },

  survey_drone: {
    id: "survey_drone",
    name: "Long-Range Survey Drone",
    icon: "📡",
    desc: "Burns itself out mapping everything within 160 light years and transmitting " +
          "the chart back before it goes. One flight, one chart.",
    price: 3200,
    salvage: 1100,
    effect: "survey",
    where: "space",
    stocked: true
  },

  emergency_cells: {
    id: "emergency_cells",
    name: "Emergency Endurium Cells",
    icon: "🔋",
    desc: "Sealed reactor mass for a ship that has run dry. Forty units, no questions, " +
          "and the seal only breaks once.",
    price: 2400,
    salvage: 800,
    effect: "refuel",
    where: "any",
    stocked: true
  },

  hull_patch: {
    id: "hull_patch",
    name: "Field Hull Patch Kit",
    icon: "🧱",
    desc: "Foamed alloy and a great deal of optimism. Restores hull integrity in the " +
          "field, which is the only place it is ever needed.",
    price: 1800,
    salvage: 600,
    effect: "repair",
    where: "any",
    stocked: true
  },

  shield_burst: {
    id: "shield_burst",
    name: "Deflector Overcharge Cell",
    icon: "🛡️",
    desc: "Dumps a capacitor bank straight into the deflector matrix. Shields to full, " +
          "instantly, once.",
    price: 2000,
    salvage: 700,
    effect: "shields",
    where: "any",
    stocked: true
  },

  // Not sold anywhere. The Corps does not have these to sell.
  ghost_baffle: {
    id: "ghost_baffle",
    name: "Precursor Ghost Baffle",
    icon: "👁",
    desc: "Wraps the hull in whatever the Precursors used instead of stealth. Nothing " +
          "acquires you, nothing hails you, nothing scans your hold - until it burns out.",
    price: 0,
    salvage: 4500,
    effect: "cloak",
    where: "space",
    stocked: false
  }
};
