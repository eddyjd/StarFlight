/**
 * WormholeNet for StarFlight: Odyssey
 *
 * Wormholes used to be eight fixed records in data.js at the same eight
 * coordinates in every game anyone ever played, arranged as four tidy mirrored
 * pairs. Once you had played once you knew the whole network forever, and the
 * star map had nothing left to tell you.
 *
 * The network is now rolled per save. It is generated ONCE - at new game, or on
 * first load of an older save - and then stored verbatim under ship.wormholeNet.
 * Storing the result rather than a seed matters: a captain's chart must not
 * silently rearrange itself because the generator was later tuned.
 *
 * Two kinds of throat:
 *   PAIRED   two mouths, each leading to the other. The old behaviour.
 *   ONE-WAY  a single mouth that ejects you somewhere with no way back. You do
 *            not learn which you are looking at until you scan it - that is the
 *            reason to spend the scan.
 */

const WormholeNet = {

  // Where mouths may sit, and how far apart they must stay
  MARGIN: 45,        // keep clear of the quadrant edge
  MIN_SEP: 55,       // no two mouths closer than this
  MIN_HOP: 140,      // a throat shorter than this is not worth flying to
  BASE_CLEAR: 70,    // keep clear of Starbase Prime - it has its own traffic

  // Four regions draw from these, and every name must be unique across the whole
  // galaxy - see the `taken` set threaded through generate(). Two throats called
  // "The Undertow" in different quadrants read as the same wormhole, which is
  // exactly what a captain concluded.
  PAIR_NAMES: [
    "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Theta", "Sigma",
    "Kappa", "Lambda", "Omicron", "Upsilon", "Tau", "Rho", "Phi", "Chi"
  ],
  SOLO_NAMES: [
    "Vagrant Throat", "The Undertow", "Slipgate", "The Long Fall", "Ravel Mouth", "The Sink",
    "The Gullet", "Blindmouth", "The Draw", "Nine Fathom", "The Swallow", "Hollow Pipe",
    "The Reave", "Cold Throat", "The Spill", "Deadfall"
  ],

  /**
   * Mulberry32. Small, fast, and identical across browsers - which matters
   * because a save carries its network between machines.
   */
  prng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  newSeed() {
    return (Math.floor(Math.random() * 0xFFFFFFFF) >>> 0);
  },

  /** A point that clears the edges, the starbase, and everything placed so far. */
  placePoint(rand, taken, cfg) {
    const lo = this.MARGIN, hi = 500 - this.MARGIN;
    for (let attempt = 0; attempt < 200; attempt++) {
      const x = Math.round(lo + rand() * (hi - lo));
      const y = Math.round(lo + rand() * (hi - lo));
      if (cfg.avoid && Math.hypot(x - cfg.avoid.x, y - cfg.avoid.y) < this.BASE_CLEAR) continue;
      if (taken.some(p => Math.hypot(x - p.x, y - p.y) < this.MIN_SEP)) continue;
      return { x: x, y: y };
    }
    return null;   // caller drops this throat rather than placing a bad one
  },

  /** A point at least MIN_HOP away from `from`, so the throat is a real shortcut. */
  placeFar(rand, taken, from, cfg) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const p = this.placePoint(rand, taken, cfg);
      if (!p) return null;
      if (Math.hypot(p.x - from.x, p.y - from.y) < this.MIN_HOP) continue;
      return p;
    }
    return null;
  },

  /**
   * Roll a network. `pairs` two-way links and `solos` one-way throats.
   * Returns a flat array of wormhole records in the shape navigation.js expects.
   */
  generate(seed, opts) {
    const cfg = Object.assign({ pairs: 3, solos: 2, prefix: "Wormhole", avoid: { x: 250, y: 250 }, idPrefix: "wh" }, opts || {});
    const rand = this.prng(seed);
    const taken = [];
    const out = [];
    let n = 0;

    // Names already spoken for elsewhere in the galaxy. Without this each region
    // picked from the full pool independently and duplicates were common.
    const reserved = cfg.reserved || null;
    const free = (list) => reserved ? list.filter(x => !reserved.has(x)) : list;
    const claim = (name) => { if (reserved) reserved.add(name); return name; };

    // --- two-way pairs -----------------------------------------------------
    const pairNames = free(this.PAIR_NAMES).slice();
    for (let i = 0; i < cfg.pairs; i++) {
      const a = this.placePoint(rand, taken, cfg);
      if (!a) continue;
      const b = this.placeFar(rand, taken.concat([a]), a, cfg);
      if (!b) continue;
      taken.push(a, b);

      const nameIdx = Math.floor(rand() * pairNames.length);
      const label = claim(pairNames.splice(nameIdx, 1)[0] || ("Link-" + seed % 997 + "-" + i));
      const idA = cfg.idPrefix + "_" + (++n), idB = cfg.idPrefix + "_" + (++n);

      out.push({
        id: idA, name: `Wormhole ${label}-1`, x: a.x, y: a.y,
        targetX: b.x, targetY: b.y, oneWay: false, pairId: idB,
        destName: `Wormhole ${label}-2 (${this.bearing(a, b)})`
      });
      out.push({
        id: idB, name: `Wormhole ${label}-2`, x: b.x, y: b.y,
        targetX: a.x, targetY: a.y, oneWay: false, pairId: idA,
        destName: `Wormhole ${label}-1 (${this.bearing(b, a)})`
      });
    }

    // --- one-way throats ---------------------------------------------------
    // The exit is a bare coordinate. Nothing waits there to take you home, which
    // is the whole point: a one-way throat is a commitment, not a shortcut.
    const soloNames = free(this.SOLO_NAMES).slice();
    for (let i = 0; i < cfg.solos; i++) {
      const a = this.placePoint(rand, taken, cfg);
      if (!a) continue;
      const b = this.placeFar(rand, taken.concat([a]), a, cfg);
      if (!b) continue;
      taken.push(a);          // only the MOUTH is a fixed feature, not the exit

      const nameIdx = Math.floor(rand() * soloNames.length);
      const label = claim(soloNames.splice(nameIdx, 1)[0] || ("Throat-" + seed % 997 + "-" + i));

      out.push({
        id: cfg.idPrefix + "_" + (++n), name: label, x: a.x, y: a.y,
        targetX: b.x, targetY: b.y, oneWay: true, pairId: null,
        destName: `Uncharted space (${this.bearing(a, b)}) - NO RETURN THROAT`
      });
    }

    return out;
  },

  /** Compass flavour for a destination label. */
  bearing(from, to) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const ns = dy < -40 ? "Northern" : (dy > 40 ? "Southern" : "");
    const ew = dx < -40 ? "Western" : (dx > 40 ? "Eastern" : "");
    const dir = (ns + " " + ew).trim();
    return dir ? dir + " Reach" : "Central Sectors";
  },

  // ---- save integration ---------------------------------------------------

  /**
   * Make sure this save has a network, then publish it into GameData so every
   * existing reader (viewport, star map, scanner, transit) sees it unchanged.
   * Safe to call repeatedly - it only rolls when nothing is stored.
   */
  ensure(ship) {
    if (!ship) return;
    const regions = (typeof GameData !== "undefined" && GameData.regions) || {};

    // One reservation set for the whole galaxy, seeded with the names already
    // spoken for by authored singularities - "The Undertow Well" is a black hole
    // in the Reach, so no throat anywhere should also be "The Undertow".
    const reserved = new Set();
    (GameData.blackHoles || []).forEach(b => this.reserveWords(reserved, b.name));
    Object.keys(regions).forEach(id =>
      ((regions[id] || {}).blackHoles || []).forEach(b => this.reserveWords(reserved, b.name)));

    if (!ship.wormholeNet || !ship.wormholeNet.core || !ship.wormholeNet.core.length) {
      const seed = (ship.wormholeSeed = ship.wormholeSeed || this.newSeed());
      ship.wormholeNet = { core: this.generate(seed, { pairs: 3, solos: 2, reserved: reserved, idPrefix: "wh_core" }) };
    } else {
      // Already rolled - claim its names so later regions cannot repeat them
      (ship.wormholeNet.core || []).forEach(w => this.reserveFromRecord(reserved, w));
    }

    // Regions roll from the same save seed, offset per region, so adding a region
    // later fills in without disturbing the networks already charted.
    const seed = ship.wormholeSeed || 1;
    let offset = 1;
    Object.keys(regions).forEach(id => {
      offset++;
      if (id === "core") return;
      if (ship.wormholeNet[id] && ship.wormholeNet[id].length) {
        ship.wormholeNet[id].forEach(w => this.reserveFromRecord(reserved, w));
        return;
      }
      const cfg = regions[id].wormholeCfg || { pairs: 1, solos: 1 };
      ship.wormholeNet[id] = this.generate(
        (seed ^ Math.imul(0x9E3779B9, offset)) >>> 0,
        { pairs: cfg.pairs, solos: cfg.solos, avoid: null, reserved: reserved, idPrefix: "wh_" + id }
      );
    });

    // Saves rolled before ids carried their region reuse wh_1..wh_n in all four,
    // so the same key meant a different throat depending where you stood.
    this.migrateIds(ship);

    // Saves rolled before names were reserved galaxy-wide carry duplicates.
    // Renaming is safe where re-rolling is not: a chart the captain has already
    // flown must not have its throats move.
    this.dedupeNames(ship);

    this.apply(ship);
  },

  /**
   * Give every throat an id that says which region it belongs to.
   *
   * Generated ids used to restart at wh_1 in each region, so `wh_1` named four
   * different throats depending on where the ship was standing. Nothing broke
   * *yet* - traversedLinks, contactLog and salvagedIds are all region-scoped, so
   * each region's ledger happened to be read against its own throats - but any
   * quest objective, clue or save-repair that keys on an id would silently match
   * the wrong object, and the star map bug that prompted this showed how easy it
   * is to read the wrong region's record by accident.
   *
   * The per-region ledgers are rewritten alongside the ids, so nothing a captain
   * has already charted or flown is forgotten.
   */
  migrateIds(ship) {
    if (!ship || !ship.wormholeNet) return 0;
    let moved = 0;

    Object.keys(ship.wormholeNet).forEach(rid => {
      const list = ship.wormholeNet[rid] || [];
      const want = "wh_" + rid + "_";
      const remap = {};

      list.forEach((w, i) => {
        if (!w.id || w.id.indexOf(want) === 0) return;
        const oldId = w.id;
        const newId = want + (i + 1);
        remap[oldId] = newId;
        w.id = newId;
        moved++;
      });
      if (!Object.keys(remap).length) return;

      // pairId references have to follow
      list.forEach(w => { if (w.pairId && remap[w.pairId]) w.pairId = remap[w.pairId]; });

      // and so does everything the captain has learned about them
      const record = (rid === (ship.region || "core"))
        ? ship
        : ((ship.regions && ship.regions[rid]) || null);
      if (!record) return;
      ["traversedLinks", "contactLog"].forEach(field => {
        const src = record[field];
        if (!src) return;
        Object.keys(remap).forEach(oldId => {
          if (Object.prototype.hasOwnProperty.call(src, oldId)) {
            src[remap[oldId]] = src[oldId];
            delete src[oldId];
          }
        });
      });
    });

    if (moved > 0) {
      console.warn(`WormholeNet: re-keyed ${moved} throat id(s) so each region has its own id space`);
    }
    return moved;
  },

  /** Reserve the distinctive words of an authored name, e.g. "The Undertow Well". */
  reserveWords(set, name) {
    if (!name) return;
    set.add(String(name));
    // Also reserve the pool entry it would collide with, if any
    this.SOLO_NAMES.forEach(s2 => { if (String(name).indexOf(s2) >= 0) set.add(s2); });
  },

  /** Reserve whatever label an already-rolled record is using. */
  reserveFromRecord(set, w) {
    if (!w || !w.name) return;
    const m = /^Wormhole (.+)-[12]$/.exec(w.name);
    set.add(m ? m[1] : w.name);
  },

  /**
   * Rename duplicate throats without moving them.
   *
   * Every region used to draw from the full name pool independently, so the same
   * label turned up in two quadrants - "The Undertow" in the Corps Quadrant and
   * again in the Marrow, "Beta" in the core and the Reach. Different coordinates,
   * different destinations, identical names, and a captain quite reasonably read
   * that as the same wormhole appearing on every chart.
   *
   * Positions are left exactly as charted. Only labels change.
   */
  dedupeNames(ship) {
    if (!ship || !ship.wormholeNet) return 0;

    const takenPairs = new Set();
    const takenSolos = new Set();
    let renamed = 0;

    // Authored singularities own their names too
    const holeNames = [];
    (GameData.blackHoles || []).forEach(b => holeNames.push(b.name));
    Object.keys(GameData.regions || {}).forEach(rid =>
      ((GameData.regions[rid] || {}).blackHoles || []).forEach(b => holeNames.push(b.name)));
    this.SOLO_NAMES.forEach(n => {
      if (holeNames.some(h => String(h).indexOf(n) >= 0)) takenSolos.add(n);
    });

    Object.keys(ship.wormholeNet).forEach(rid => {
      const list = ship.wormholeNet[rid] || [];

      // Group by PAIR IDENTITY, not by name. Keying on the family name could not
      // tell two distinct pairs apart when both had been given the same label -
      // which is exactly the case this repair exists to handle.
      const groups = [];
      const placed = new Set();
      list.forEach(w => {
        if (placed.has(w.id)) return;
        const partner = w.pairId ? list.find(v => v.id === w.pairId) : null;
        const group = partner ? [w, partner] : [w];
        group.forEach(v => placed.add(v.id));
        groups.push(group);
      });

      groups.forEach(group => {
        const first = group[0];
        const m = /^Wormhole (.+)-([12])$/.exec(first.name || "");

        if (group.length === 2 || m) {
          const fam = m ? m[1] : String(first.name);
          let family = fam;
          if (takenPairs.has(fam)) {
            family = this.PAIR_NAMES.find(n => !takenPairs.has(n)) || (fam + "-" + (renamed + 2));
            renamed++;
          }
          takenPairs.add(family);
          if (family !== fam) {
            group.forEach((v, i) => {
              const vm = /^Wormhole (.+)-([12])$/.exec(v.name || "");
              const suffix = vm ? vm[2] : String(i + 1);
              v.name = `Wormhole ${family}-${suffix}`;
            });
            // keep each mouth pointing at its partner's new label
            group.forEach((v, i) => {
              const other = group[(i + 1) % group.length];
              if (v.destName) {
                v.destName = v.destName.replace(/^Wormhole .+?-[12]/, other.name);
              }
            });
          }
        } else {
          let label = String(first.name);
          if (takenSolos.has(label)) {
            label = this.SOLO_NAMES.find(n => !takenSolos.has(n)) || (label + " II");
            renamed++;
            first.name = label;
          }
          takenSolos.add(label);
        }
      });
    });

    if (renamed > 0) {
      console.warn(`WormholeNet: renamed ${renamed} duplicate throat name(s) so no two regions share a label`);
    }
    return renamed;
  },

  /** Publish the stored network into GameData and the region records. */
  apply(ship) {
    if (!ship || !ship.wormholeNet || typeof GameData === "undefined") return;
    const net = ship.wormholeNet;

    // Core lives at the GameData top level for backwards compatibility, exactly
    // like every other core content array.
    GameData.wormholes = (net.core || []).map(w => Object.assign({}, w));

    const regions = GameData.regions || {};
    Object.keys(regions).forEach(id => {
      if (id === "core") return;
      regions[id].wormholes = (net[id] || []).map(w => Object.assign({}, w));
    });
  },

  /** Discard the network and roll a fresh one. Used by New Game. */
  reroll(ship) {
    if (!ship) return;
    ship.wormholeSeed = this.newSeed();
    ship.wormholeNet = null;
    this.ensure(ship);
  },

  /**
   * Has the captain established where this throat comes out? A wormhole is only
   * dangerous while unidentified, so this drives both the map label and whether
   * the approach warning can name the far side.
   */
  isCharted(wh) {
    const ship = window.game && window.game.ship;
    if (!ship || !wh) return false;
    if (ship.traversedLinks && ship.traversedLinks[wh.id]) return true;
    const tier = (ship.contactLog && ship.contactLog[wh.id]) || 0;
    return tier >= 2;
  },

  /**
   * Where a throat comes out is learned by flying it, not by looking at it.
   *
   * Scanning reveals the STRUCTURE - whether there is a matching throat on the
   * far side - which is what makes a one-way commitment knowable before you
   * commit. It does not hand over the exit coordinates. Black holes have worked
   * this way since v1.14.0; wormholes were still giving their destination away on
   * a scan, so the chart named routes the ship had never taken.
   */
  isDestinationKnown(wh) {
    const ship = window.game && window.game.ship;
    return !!(ship && wh && ship.traversedLinks && ship.traversedLinks[wh.id]);
  }
};

window.WormholeNet = WormholeNet;
