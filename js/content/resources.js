/**
 * Resource content for StarFlight: Odyssey.
 *
 * PURE DATA. Two things live here:
 *
 *  1. NEW COMMODITIES, merged into GameData.commodities. Each carries a `tier`
 *     so rarity is declared rather than implied by price.
 *
 *  2. WORLD PROFILES. Previously every planet rolled from the same five minerals,
 *     so an ice moon and a volcanic hell yielded identical ore and worlds had no
 *     character. A profile matches on the planet fields that already exist
 *     (temp, atmosphere, gravity, bio, hasRuins) and declares what that KIND of
 *     world can bear. Anything not in the profile simply is not there.
 *
 * Profiles are tested in order; the first match wins, so put the specific ones
 * first and leave `default` last.
 */

(function () {
  const D = window.GameData;

  // ---- new commodities ---------------------------------------------------
  // tier: common | uncommon | rare | exotic
  const NEW = {
    // minerals
    sulfur:        { name: "Sulfur Compound",   sellVal: 15,   buyVal: 40,   mass: 1.2, tier: "common" },
    silicate:      { name: "Silicate Ore",      sellVal: 18,   buyVal: 45,   mass: 2.2, tier: "common" },
    titanium:      { name: "Titanium Ore",      sellVal: 60,   buyVal: 160,  mass: 2.6, tier: "uncommon" },
    obsidian:      { name: "Volcanic Obsidian", sellVal: 90,   buyVal: 220,  mass: 1.8, tier: "uncommon" },
    cryo_crystal:  { name: "Cryogenic Crystal", sellVal: 210,  buyVal: 520,  mass: 1.4, tier: "rare" },
    iridium:       { name: "Iridium Nodule",    sellVal: 260,  buyVal: 640,  mass: 3.8, tier: "rare" },
    void_glass:    { name: "Void Glass",        sellVal: 480,  buyVal: 1150, mass: 0.9, tier: "exotic" },
    singularity_dust: { name: "Singularity Dust", sellVal: 700, buyVal: 1700, mass: 0.3, tier: "exotic" },

    // biological
    spore_mat:     { name: "Spore Mat",         sellVal: 35,   buyVal: 90,   mass: 0.4, tier: "common" },
    crystal_lichen:{ name: "Crystal Lichen",    sellVal: 120,  buyVal: 300,  mass: 0.6, tier: "uncommon" },
    thermophile:   { name: "Thermophile Colony", sellVal: 240, buyVal: 600,  mass: 0.8, tier: "rare", needsBio: true },
    abyssal_bloom: { name: "Abyssal Bloom",     sellVal: 300,  buyVal: 750,  mass: 0.7, tier: "rare", needsBio: true },
    precursor_seed:{ name: "Precursor Seed Vault", sellVal: 900, buyVal: 2200, mass: 1.0, tier: "exotic", needsBio: true }
  };
  Object.keys(NEW).forEach(k => { if (!D.commodities[k]) D.commodities[k] = NEW[k]; });

  // tag the originals so every commodity has a declared tier
  const TIERS = {
    iron: "common", gold: "uncommon", platinum: "uncommon",
    endurium_ore: "rare", precursor_alloy: "exotic",
    bio_flora: "common", bio_fauna: "uncommon",
    alien_art: "uncommon", contraband: "rare", fuel: "common"
  };
  Object.keys(TIERS).forEach(k => { if (D.commodities[k] && !D.commodities[k].tier) D.commodities[k].tier = TIERS[k]; });

  // ---- world profiles ----------------------------------------------------
  // `match` is evaluated against the planet record. Omitted keys are ignored.
  //   tempMin/tempMax, gravityMin/gravityMax, bioMin/bioMax, atmosphere (substring),
  //   hasRuins
  // Weights are relative within the list; a world simply cannot bear anything
  // absent from its own table.
  D.resourceProfiles = [
    {
      id: "airless",
      label: "Airless Body",
      match: { atmosphere: "None" },
      minerals: [
        { key: "iridium", w: 14 }, { key: "titanium", w: 28 },
        { key: "silicate", w: 30 }, { key: "iron", w: 28 }
      ],
      bio: []   // nothing lives here, and nothing will be generated
    },
    {
      id: "toxic",
      label: "Toxic Atmosphere",
      match: { atmosphere: "Acid" },
      minerals: [
        { key: "sulfur", w: 40 }, { key: "obsidian", w: 20 },
        { key: "iron", w: 25 }, { key: "gold", w: 15 }
      ],
      bio: [{ key: "thermophile", w: 45 }, { key: "spore_mat", w: 55 }]
    },
    {
      id: "gas_giant",
      label: "High-Gravity Giant",
      match: { gravityMin: 2.0 },
      minerals: [
        { key: "singularity_dust", w: 8 }, { key: "iridium", w: 22 },
        { key: "endurium_ore", w: 30 }, { key: "silicate", w: 40 }
      ],
      bio: [{ key: "spore_mat", w: 100 }]
    },
    {
      id: "volcanic",
      label: "Volcanic World",
      match: { tempMin: 200 },
      minerals: [
        { key: "obsidian", w: 26 }, { key: "sulfur", w: 30 }, { key: "iridium", w: 12 },
        { key: "titanium", w: 18 }, { key: "iron", w: 14 }
      ],
      bio: [{ key: "thermophile", w: 70 }, { key: "spore_mat", w: 30 }]
    },
    {
      id: "ice",
      label: "Ice World",
      match: { tempMax: -50 },
      minerals: [
        { key: "cryo_crystal", w: 24 }, { key: "silicate", w: 30 },
        { key: "titanium", w: 22 }, { key: "iron", w: 24 }
      ],
      bio: [{ key: "abyssal_bloom", w: 40 }, { key: "crystal_lichen", w: 60 }]
    },
    {
      id: "lush",
      label: "Living World",
      match: { bioMin: 0.5 },
      minerals: [
        { key: "gold", w: 22 }, { key: "silicate", w: 34 },
        { key: "iron", w: 30 }, { key: "platinum", w: 14 }
      ],
      bio: [
        { key: "bio_fauna", w: 26 }, { key: "bio_flora", w: 46 },
        { key: "crystal_lichen", w: 18 }, { key: "abyssal_bloom", w: 10 }
      ]
    },
    {
      id: "default",
      label: "Standard Terrestrial",
      match: {},
      minerals: [
        { key: "iron", w: 34 }, { key: "silicate", w: 24 }, { key: "gold", w: 18 },
        { key: "platinum", w: 14 }, { key: "titanium", w: 10 }
      ],
      bio: [{ key: "bio_flora", w: 70 }, { key: "bio_fauna", w: 20 }, { key: "spore_mat", w: 10 }]
    }
  ];

  // Ruins overlay. Merged ON TOP of whichever physical profile a world matched,
  // so a Precursor ice moon still yields cryogenic crystal - it just also yields
  // things nobody else has. This is what makes ruin worlds worth the trip.
  D.resourceBonuses = {
    ruins: {
      minerals: [
        { key: "precursor_alloy", w: 12 },
        { key: "void_glass", w: 8 },
        { key: "iridium", w: 10 }
      ],
      bio: [
        { key: "precursor_seed", w: 6 },
        { key: "crystal_lichen", w: 14 }
      ]
    }
  };
})();
