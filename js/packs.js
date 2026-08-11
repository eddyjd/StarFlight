/**
 * ContentPacks for StarFlight: Odyssey
 *
 * A content pack is one file of pure data that adds to the game: a quadrant, a
 * quest, an archive, a race's dialogue, new commodities. It is the mechanism
 * behind "hand any AI a prompt and load what it writes" - see CONTENT_PACKS.md,
 * which is both the schema and the prompt.
 *
 * TWO OPERATIONS, because the existing content files already need both:
 *
 *   add     new records into a collection
 *           (js/content/regions.js sets window.GameData.regions outright)
 *   extend  patch records that already exist
 *           (js/content/dialogue.js and resources.js reach into GameData.aliens
 *           and GameData.commodities from an IIFE)
 *
 * `extend` is not a convenience. A new quadrant is UNREACHABLE unless the pack
 * can also append a singularity to an existing region with `leadsTo` pointing at
 * itself. Without it, packs could only ever add places nobody can get to.
 *
 * NOTHING MERGES UNTIL IT VALIDATES. A pack is applied to a throwaway copy of
 * GameData first, ContentValidator runs over the result, and only a clean result
 * is committed. A pack that fails is rejected with a readable report and the game
 * boots exactly as it would have without it - this project has shipped enough
 * silent failures for one session.
 */

const ContentPacks = {

  // Collections a pack may touch. Anything else is refused rather than silently
  // written into GameData, so a typo cannot invent a collection nothing reads.
  ARRAY_COLLECTIONS: [
    "starSystems", "blackHoles", "derelicts", "spaceWrecks", "distressSignals",
    "alienPorts", "nebulae", "asteroidFields", "quests", "archives", "puzzles",
    "resourceProfiles", "signalTemplates", "crewCandidates", "hqLogs"
  ],
  MAP_COLLECTIONS: [
    "regions", "commodities", "techParts", "aliens", "consumables", "archiveLocations"
  ],

  installed: [],      // { id, name, version, source, counts }
  failures: [],       // { id, source, errors }

  // ---- registration ------------------------------------------------------

  /**
   * Called by a pack file at load time. The pack is queued, not applied - every
   * pack is validated together at the end of boot so that packs which reference
   * each other are judged on the finished galaxy rather than the order they load.
   */
  register(pack) {
    if (!pack || !pack.id) {
      console.error("ContentPacks: a pack must declare an id");
      return false;
    }
    if (!this.pending) this.pending = [];
    if (this.pending.some(p => p.id === pack.id) || this.installed.some(p => p.id === pack.id)) {
      console.warn(`ContentPacks: pack "${pack.id}" is already registered - ignoring the duplicate`);
      return false;
    }
    this.pending.push(pack);
    return true;
  },

  // ---- merge -------------------------------------------------------------

  /** Deep clone of the parts of GameData a pack can affect. */
  snapshot() {
    const D = GameData;
    const out = {};
    this.ARRAY_COLLECTIONS.concat(this.MAP_COLLECTIONS).forEach(k => {
      if (D[k] !== undefined) out[k] = JSON.parse(JSON.stringify(D[k]));
    });
    // Read-only context the validator needs but a pack must not rewrite
    ["traffic", "patrolZone", "patrols", "customs", "upgrades", "resourceBonuses"].forEach(k => {
      if (D[k] !== undefined) out[k] = JSON.parse(JSON.stringify(D[k]));
    });
    return out;
  },

  /**
   * Apply one pack's `add` and `extend` blocks to a target (a snapshot or the
   * live GameData). Returns { counts, problems } - a structural problem here is a
   * malformed pack, distinct from a content problem the validator finds.
   */
  applyTo(target, pack) {
    const counts = {};
    const problems = [];
    const bump = (k, n) => { counts[k] = (counts[k] || 0) + n; };

    // ---- add ----
    const add = pack.add || {};
    Object.keys(add).forEach(key => {
      const isArray = this.ARRAY_COLLECTIONS.indexOf(key) >= 0;
      const isMap = this.MAP_COLLECTIONS.indexOf(key) >= 0;
      if (!isArray && !isMap) {
        problems.push(`add.${key} is not a collection a pack may write to`);
        return;
      }
      const value = add[key];

      if (isArray) {
        if (!Array.isArray(value)) { problems.push(`add.${key} must be an array`); return; }
        if (!Array.isArray(target[key])) target[key] = [];
        value.forEach(rec => {
          if (rec && rec.id && target[key].some(x => x.id === rec.id)) {
            problems.push(`add.${key} record "${rec.id}" already exists`);
            return;
          }
          target[key].push(rec);
          bump(key, 1);
        });
      } else {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          problems.push(`add.${key} must be an object keyed by id`); return;
        }
        if (!target[key]) target[key] = {};
        Object.keys(value).forEach(id => {
          if (target[key][id]) { problems.push(`add.${key}["${id}"] already exists`); return; }
          target[key][id] = value[id];
          bump(key, 1);
        });
      }
    });

    // ---- extend ----
    // Shape: extend.<collection>.<recordId> = { push: {field: [...]}, set: {field: v} }
    // A quadrant pack uses this to hang its gate off an existing region:
    //   extend: { regions: { core: { push: { blackHoles: [ {...leadsTo:"my_region"} ] } } } }
    const ext = pack.extend || {};
    Object.keys(ext).forEach(key => {
      const isArray = this.ARRAY_COLLECTIONS.indexOf(key) >= 0;
      const isMap = this.MAP_COLLECTIONS.indexOf(key) >= 0;
      if (!isArray && !isMap) { problems.push(`extend.${key} is not a collection a pack may write to`); return; }

      Object.keys(ext[key]).forEach(recId => {
        const op = ext[key][recId] || {};
        let record = null;

        if (isMap) {
          // `core` is not a record inside GameData.regions - it IS GameData
          if (key === "regions" && recId === "core") record = target;
          else record = (target[key] || {})[recId];
        } else {
          record = (target[key] || []).find(x => x.id === recId);
        }
        if (!record) { problems.push(`extend.${key}["${recId}"] does not exist`); return; }

        Object.keys(op.push || {}).forEach(field => {
          const items = op.push[field];
          if (!Array.isArray(items)) { problems.push(`extend.${key}["${recId}"].push.${field} must be an array`); return; }
          if (!Array.isArray(record[field])) record[field] = [];
          items.forEach(it => {
            if (it && it.id && record[field].some(x => x && x.id === it.id)) {
              problems.push(`extend.${key}["${recId}"].push.${field} record "${it.id}" already exists`);
              return;
            }
            record[field].push(it);
            bump(key + "." + field, 1);
          });
        });

        Object.keys(op.set || {}).forEach(field => {
          record[field] = op.set[field];
          bump(key + "." + field, 1);
        });

        // merge: shallow-merge into an object field, e.g. a race's dialogue.nodes
        Object.keys(op.merge || {}).forEach(field => {
          const src = op.merge[field];
          if (!src || typeof src !== "object") { problems.push(`extend.${key}["${recId}"].merge.${field} must be an object`); return; }
          if (!record[field] || typeof record[field] !== "object") record[field] = {};
          Object.keys(src).forEach(k2 => {
            if (record[field][k2] !== undefined) {
              problems.push(`extend.${key}["${recId}"].merge.${field}["${k2}"] already exists`);
              return;
            }
            record[field][k2] = src[k2];
            bump(key + "." + field, 1);
          });
        });
      });
    });

    return { counts: counts, problems: problems };
  },

  // ---- the gate ----------------------------------------------------------

  /**
   * Validate every queued pack against a trial merge, then commit the ones that
   * pass. Called once at boot, after core content and before the engines read
   * anything.
   */
  applyAll() {
    if (!this.pending || !this.pending.length) return { installed: [], failed: [] };

    const queue = this.pending.slice();
    this.pending = [];

    // Trial: apply everything to a throwaway copy and see what the galaxy looks like
    const trial = this.snapshot();
    const structural = {};
    queue.forEach(pack => {
      const r = this.applyTo(trial, pack);
      if (r.problems.length) structural[pack.id] = r.problems;
    });

    const verdict = (typeof ContentValidator !== "undefined")
      ? ContentValidator.validate(trial)
      : { ok: true, errors: [], warnings: [], ruleCount: 0 };

    const failedAll = Object.keys(structural).length > 0 || !verdict.ok;

    if (!failedAll) {
      queue.forEach(pack => {
        const r = this.applyTo(GameData, pack);
        this.installed.push({
          id: pack.id, name: pack.name || pack.id, version: pack.version || "1",
          author: pack.author || "", source: pack.__source || "manifest", counts: r.counts
        });
      });
      this.announce(verdict);
      return { installed: this.installed.slice(), failed: [] };
    }

    // Something is wrong. Find out whether one pack is at fault or the combination,
    // so the report can name the culprit rather than blaming all of them.
    const failed = [];
    const good = [];
    queue.forEach(pack => {
      const solo = this.snapshot();
      const r = this.applyTo(solo, pack);
      const v = (typeof ContentValidator !== "undefined") ? ContentValidator.validate(solo) : { ok: true, errors: [] };
      if (r.problems.length || !v.ok) {
        failed.push({ id: pack.id, name: pack.name || pack.id, source: pack.__source || "manifest",
                      errors: r.problems.concat(v.errors) });
      } else {
        good.push(pack);
      }
    });

    // Re-test the survivors together - a pack can be individually fine and still
    // collide with another (two quadrants claiming the same name, say).
    if (good.length) {
      const combined = this.snapshot();
      // Collect STRUCTURAL problems from the combined merge as well as content
      // errors. Checking only the validator missed the most obvious collision
      // there is: two packs claiming the same region id. The second one's records
      // simply did not merge, the validator saw one valid region, and both packs
      // were reported as installed while one had quietly done nothing.
      let clash = [];
      good.forEach(p => { clash = clash.concat(this.applyTo(combined, p).problems); });
      const cv = (typeof ContentValidator !== "undefined") ? ContentValidator.validate(combined) : { ok: true, errors: [] };
      if (cv.ok && !clash.length) {
        good.forEach(pack => {
          const r = this.applyTo(GameData, pack);
          this.installed.push({
            id: pack.id, name: pack.name || pack.id, version: pack.version || "1",
            author: pack.author || "", source: pack.__source || "manifest", counts: r.counts
          });
        });
      } else {
        const why = clash.length ? clash : cv.errors;
        good.forEach(pack => failed.push({
          id: pack.id, name: pack.name || pack.id, source: pack.__source || "manifest",
          errors: ["conflicts with another loaded pack: " + why.slice(0, 3).join(" | ")]
        }));
      }
    }

    this.failures = this.failures.concat(failed);
    this.announce(verdict, failed);
    return { installed: this.installed.slice(), failed: failed };
  },

  /** Say what happened, in the terminal and the console. */
  announce(verdict, failed) {
    const log = (m) => { if (typeof UI !== "undefined" && UI.addLog) UI.addLog(m); };

    this.installed.forEach(p => {
      const total = Object.keys(p.counts).reduce((n, k) => n + p.counts[k], 0);
      log(`CONTENT PACK LOADED: ${String(p.name).toUpperCase()} (${total} RECORDS).`);
    });

    (failed || []).forEach(f => {
      console.error(`ContentPacks: rejected "${f.id}"`, f.errors);
      log(`CONTENT PACK REJECTED: ${String(f.name).toUpperCase()} - ${f.errors.length} PROBLEM(S).`);
      log(`  ${String(f.errors[0]).toUpperCase()}`);
      if (f.errors.length > 1) log(`  ...AND ${f.errors.length - 1} MORE. SEE THE CONSOLE.`);
    });

    if (verdict && verdict.warnings && verdict.warnings.length && this.installed.length) {
      console.warn("ContentPacks: warnings\n" + verdict.warnings.join("\n"));
    }
  },

  // ---- queries -----------------------------------------------------------

  isInstalled(id) { return this.installed.some(p => p.id === id); },

  /** Pack ids a save says it was created with. */
  requiredBy(ship) {
    return (ship && Array.isArray(ship.contentPacks)) ? ship.contentPacks.slice() : [];
  },

  /** Which of a save's packs are not loaded right now. */
  missingFor(ship) {
    return this.requiredBy(ship).filter(id => !this.isInstalled(id));
  },

  /** Stamp the current pack set onto the ship so a save records what built it. */
  stamp(ship) {
    if (!ship) return;
    ship.contentPacks = this.installed.map(p => p.id);
  },

  summary() {
    return {
      installed: this.installed.map(p => `${p.name} (${p.id})`),
      failed: this.failures.map(f => `${f.name}: ${f.errors.length} problem(s)`)
    };
  }
};

window.ContentPacks = ContentPacks;
