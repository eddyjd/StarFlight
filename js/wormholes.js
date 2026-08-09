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

  PAIR_NAMES: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Theta", "Sigma"],
  SOLO_NAMES: ["Vagrant Throat", "The Undertow", "Slipgate", "The Long Fall", "Ravel Mouth", "The Sink"],

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
    const cfg = Object.assign({ pairs: 3, solos: 2, prefix: "Wormhole", avoid: { x: 250, y: 250 } }, opts || {});
    const rand = this.prng(seed);
    const taken = [];
    const out = [];
    let n = 0;

    // --- two-way pairs -----------------------------------------------------
    const pairNames = this.PAIR_NAMES.slice();
    for (let i = 0; i < cfg.pairs; i++) {
      const a = this.placePoint(rand, taken, cfg);
      if (!a) continue;
      const b = this.placeFar(rand, taken.concat([a]), a, cfg);
      if (!b) continue;
      taken.push(a, b);

      const nameIdx = Math.floor(rand() * pairNames.length);
      const label = pairNames.splice(nameIdx, 1)[0] || ("Link-" + i);
      const idA = "wh_" + (++n), idB = "wh_" + (++n);

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
    const soloNames = this.SOLO_NAMES.slice();
    for (let i = 0; i < cfg.solos; i++) {
      const a = this.placePoint(rand, taken, cfg);
      if (!a) continue;
      const b = this.placeFar(rand, taken.concat([a]), a, cfg);
      if (!b) continue;
      taken.push(a);          // only the MOUTH is a fixed feature, not the exit

      const nameIdx = Math.floor(rand() * soloNames.length);
      const label = soloNames.splice(nameIdx, 1)[0] || ("Throat-" + i);

      out.push({
        id: "wh_" + (++n), name: label, x: a.x, y: a.y,
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

    if (!ship.wormholeNet || !ship.wormholeNet.core || !ship.wormholeNet.core.length) {
      const seed = (ship.wormholeSeed = ship.wormholeSeed || this.newSeed());
      ship.wormholeNet = { core: this.generate(seed, { pairs: 3, solos: 2 }) };
    }

    // Regions roll from the same save seed, offset per region, so adding a region
    // later fills in without disturbing the networks already charted.
    const seed = ship.wormholeSeed || 1;
    let offset = 1;
    Object.keys(regions).forEach(id => {
      offset++;
      if (id === "core") return;
      if (ship.wormholeNet[id] && ship.wormholeNet[id].length) return;
      const cfg = regions[id].wormholeCfg || { pairs: 1, solos: 1 };
      ship.wormholeNet[id] = this.generate(
        (seed ^ Math.imul(0x9E3779B9, offset)) >>> 0,
        { pairs: cfg.pairs, solos: cfg.solos, avoid: null }
      );
    });

    this.apply(ship);
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
