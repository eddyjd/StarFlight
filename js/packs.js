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

  installed: [],      // { id, name, version, hash, source, counts }
  failures: [],       // { id, source, errors }

  // ---- identity ----------------------------------------------------------

  /**
   * A stable fingerprint of a pack's content.
   *
   * A version string is what the author claims; this is what the pack actually
   * is. The common real-world failure is not a version bump - it is an author
   * editing a published pack in place and leaving the version alone, after which
   * a save says "built with v1" and gets something else entirely.
   *
   * Keys are sorted so the fingerprint depends on content and not on the order
   * the author happened to type the fields in.
   */
  hash(pack) {
    const canon = (v) => {
      if (v === null || typeof v !== "object") return JSON.stringify(v);
      if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
      return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
    };
    // Identity is the content, not the label - name/author/description changes
    // are not a different pack.
    const body = canon({ add: pack.add || {}, extend: pack.extend || {} });
    let h = 0x811c9dc5;                       // FNV-1a, 32-bit
    for (let i = 0; i < body.length; i++) {
      h ^= body.charCodeAt(i) & 0xff;
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
      if (body.charCodeAt(i) > 0xff) {        // keep non-ASCII significant
        h ^= (body.charCodeAt(i) >> 8) & 0xff;
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
      }
    }
    return ("0000000" + h.toString(16)).slice(-8);
  },

  /** The installed-record for a pack that has just been merged. */
  record(pack, counts) {
    return {
      id: pack.id,
      name: pack.name || pack.id,
      version: String(pack.version || "1"),
      hash: this.hash(pack),
      author: pack.author || "",
      source: pack.__source || "manifest",
      counts: counts
    };
  },

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

        // Field names may be dotted paths. The thing a pack most obviously wants
        // to extend - a race's conversation - lives at aliens.<race>.dialogue.nodes,
        // two levels down. Without this, `merge: { nodes: ... }` wrote to
        // aliens.<race>.nodes, a field nothing reads: the pack reported success,
        // the loader counted the records, and the content was simply not there.
        // Found by authoring the reference pack, which is what it is for.
        const resolve = (root, path, createAs) => {
          const parts = String(path).split(".");
          let node = root;
          for (let i = 0; i < parts.length - 1; i++) {
            const seg = parts[i];
            if (node[seg] === undefined || node[seg] === null) node[seg] = {};
            if (typeof node[seg] !== "object") return null;
            node = node[seg];
          }
          const leaf = parts[parts.length - 1];
          if (createAs === "array" && !Array.isArray(node[leaf])) node[leaf] = [];
          if (createAs === "object" && (!node[leaf] || typeof node[leaf] !== "object")) node[leaf] = {};
          return { parent: node, leaf: leaf };
        };

        Object.keys(op.push || {}).forEach(field => {
          const items = op.push[field];
          if (!Array.isArray(items)) { problems.push(`extend.${key}["${recId}"].push.${field} must be an array`); return; }
          const at = resolve(record, field, "array");
          if (!at) { problems.push(`extend.${key}["${recId}"].push.${field} does not resolve to a field`); return; }
          const arr = at.parent[at.leaf];
          items.forEach(it => {
            if (it && it.id && arr.some(x => x && x.id === it.id)) {
              problems.push(`extend.${key}["${recId}"].push.${field} record "${it.id}" already exists`);
              return;
            }
            arr.push(it);
            bump(key + "." + field, 1);
          });
        });

        Object.keys(op.set || {}).forEach(field => {
          const at = resolve(record, field, null);
          if (!at) { problems.push(`extend.${key}["${recId}"].set.${field} does not resolve to a field`); return; }
          at.parent[at.leaf] = op.set[field];
          bump(key + "." + field, 1);
        });

        // merge: shallow-merge into an object field, e.g. dialogue.nodes
        Object.keys(op.merge || {}).forEach(field => {
          const src = op.merge[field];
          if (!src || typeof src !== "object") { problems.push(`extend.${key}["${recId}"].merge.${field} must be an object`); return; }
          const at = resolve(record, field, "object");
          if (!at) { problems.push(`extend.${key}["${recId}"].merge.${field} does not resolve to a field`); return; }
          const dest = at.parent[at.leaf];
          Object.keys(src).forEach(k2 => {
            if (dest[k2] !== undefined) {
              problems.push(`extend.${key}["${recId}"].merge.${field}["${k2}"] already exists`);
              return;
            }
            dest[k2] = src[k2];
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
        this.installed.push(this.record(pack, r.counts));
      });
      this.pendingReport = { verdict: verdict, failed: [] };
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
          this.installed.push(this.record(pack, r.counts));
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
    this.pendingReport = { verdict: verdict, failed: failed };
    return { installed: this.installed.slice(), failed: failed };
  },

  /**
   * Say what happened, in the terminal and the console.
   *
   * Called AFTER UI.init(), never during the merge. applyAll() has to run before
   * loadGame() so a save resolves against pack content, but that is earlier than
   * the terminal exists - writing to it there threw inside the merge and took the
   * whole pack load down with it, silently.
   */
  announce(verdict, failed) {
    const ready = (typeof UI !== "undefined" && UI.addLog && UI.elements && UI.elements.logTerminal);
    const log = (m) => { if (ready) { try { UI.addLog(m); } catch (e) { console.warn(m); } } else { console.log(m); } };

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

  /** Flush whatever applyAll() decided, once there is a terminal to say it in. */
  flushReport() {
    const r = this.pendingReport;
    this.pendingReport = null;
    if (!r) return;
    this.announce(r.verdict, r.failed);
  },

  // ---- queries -----------------------------------------------------------

  isInstalled(id) { return this.installed.some(p => p.id === id); },

  /**
   * What a save says it was built with, always as records.
   *
   * Saves from before v1.17.6 hold a bare array of ids, and some hold nothing at
   * all because nothing ever wrote the field. Both are normalised here rather
   * than at every call site, and a null version is an honest "we do not know"
   * instead of a guess.
   */
  requiredBy(ship) {
    const raw = (ship && Array.isArray(ship.contentPacks)) ? ship.contentPacks : [];
    return raw.map(e => (typeof e === "string")
      ? { id: e, version: null, hash: null }
      : { id: e.id, version: e.version || null, hash: e.hash || null })
      .filter(e => !!e.id);
  },

  /** Which of a save's packs are not loaded right now. Ids, for the report. */
  missingFor(ship) {
    return this.requiredBy(ship).filter(e => !this.isInstalled(e.id)).map(e => e.id);
  },

  /**
   * Packs that ARE loaded but are not the ones this save was built with.
   *
   * This is the failure the version stamp exists for. It is silent by nature -
   * the region is there, the ids resolve, and the content behind them is
   * different from the content the captain played. Worth saying out loud even
   * before there is a server to fetch the right version from.
   */
  driftFor(ship) {
    const out = [];
    this.requiredBy(ship).forEach(want => {
      const have = this.installed.find(p => p.id === want.id);
      if (!have) return;                                  // that is missingFor's business
      if (want.hash && have.hash && want.hash !== have.hash) {
        out.push({ id: want.id, name: have.name,
                   wasVersion: want.version, nowVersion: have.version,
                   reason: (want.version === have.version)
                     ? "same version, different content"
                     : "different version" });
      } else if (want.version && have.version && want.version !== have.version) {
        out.push({ id: want.id, name: have.name,
                   wasVersion: want.version, nowVersion: have.version,
                   reason: "different version" });
      }
    });
    return out;
  },

  /**
   * Stamp the current pack set onto the ship so a save records what built it.
   *
   * Called from saveGame(). It was written for A6 and then never wired up, which
   * meant every audit read a field nothing had ever set: a real save made inside
   * a pack's quadrant recorded the region but not the pack, so re-opening it
   * without the pack produced no report and no recovery at all. Reproduced
   * before fixing - the ship sat at (250, 100) in a region that did not exist
   * and the game said nothing.
   */
  stamp(ship) {
    if (!ship) return;
    ship.contentPacks = this.installed.map(p => ({ id: p.id, version: p.version, hash: p.hash }));
  },

  /**
   * What does this save reference that is no longer here?
   *
   * A save records the packs that built it. Open it without one and the ship can
   * be standing in a region that does not exist, holding a quest nothing defines,
   * carrying cargo no commodity table knows. This project has shipped four bugs
   * of exactly that shape, so the answer is not to guess - it is to look, report
   * it in plain words, and never quietly discard what the captain earned.
   *
   * Reports only. Nothing here modifies the save.
   */
  auditSave(ship) {
    const D = (typeof GameData !== "undefined") ? GameData : {};
    const missingPacks = this.missingFor(ship);
    const out = {
      missingPacks: missingPacks,
      strandedIn: null,
      lostRegions: [],
      lostSystems: [],
      lostQuests: [],
      lostCommodities: [],
      lostArtifacts: [],
      drift: []
    };
    if (!ship) return out;
    out.drift = this.driftFor(ship);

    // Where the ship is standing
    const here = ship.region || "core";
    if (here !== "core" && !(D.regions || {})[here]) out.strandedIn = here;

    // Region records with nowhere to belong
    Object.keys(ship.regions || {}).forEach(rid => {
      if (rid !== "core" && !(D.regions || {})[rid]) out.lostRegions.push(rid);
    });

    // Systems charted in regions that are still present
    const knownSystems = new Set();
    (D.starSystems || []).forEach(sy => knownSystems.add(sy.name));
    Object.keys(D.regions || {}).forEach(rid =>
      ((D.regions[rid] || {}).starSystems || []).forEach(sy => knownSystems.add(sy.name)));
    Object.keys(ship.discoveredSystems || {}).forEach(n => {
      if (n !== "Starbase Prime" && !knownSystems.has(n)) out.lostSystems.push(n);
    });

    // Quests in progress that nothing defines any more
    Object.keys(ship.quests || {}).forEach(qid => {
      const st = ship.quests[qid];
      if (!st || st.stage < 0) return;
      if (!(D.quests || []).some(q => q.id === qid)) out.lostQuests.push(qid);
    });

    // Cargo and artifacts with no record behind them
    Object.keys(ship.cargo || {}).forEach(k => {
      if (!(D.commodities || {})[k]) out.lostCommodities.push(k);
    });
    (ship.artifactsCollected || []).forEach(a => {
      if (typeof a !== "string" || !a) return;
      const known = Object.keys(D.regions || {}).some(rid =>
        ((D.regions[rid] || {}).starSystems || []).some(sy =>
          (sy.planets || []).some(pl => pl.artifact === a)))
        || (D.starSystems || []).some(sy => (sy.planets || []).some(pl => pl.artifact === a));
      if (!known) out.lostArtifacts.push(a);
    });

    return out;
  },

  /**
   * Bring a ship home if it is standing somewhere that no longer exists.
   *
   * The region's own exploration record is LEFT INTACT under ship.regions, so
   * re-installing the pack restores the chart, the salvage ledger and everything
   * else exactly as it was. Only the vessel moves.
   */
  recoverStranded(ship) {
    if (!ship) return false;
    const D = (typeof GameData !== "undefined") ? GameData : {};
    const here = ship.region || "core";
    if (here === "core" || (D.regions || {})[here]) return false;

    // Stash what the ship currently has live, so the record survives for later
    try {
      if (typeof RegionManager !== "undefined") {
        RegionManager.migrate(ship);
        RegionManager.stash(ship, here);
      }
    } catch (e) { console.warn("Could not stash the stranded region's record", e); }

    ship.region = "core";
    try {
      if (typeof RegionManager !== "undefined") RegionManager.restore(ship, "core");
    } catch (e) { console.warn("Could not restore the core record", e); }

    ship.coordinates = { x: 250, y: 250 };
    ship.currentSystem = null;
    ship.currentPlanet = null;
    ship.isInSpacebase = true;
    if (typeof Navigation !== "undefined" && Navigation.resetPhysics) Navigation.resetPhysics(250, 250);
    return true;
  },

  /**
   * Does this audit need saying out loud?
   *
   * Deliberately not keyed on missingPacks. A save written before the stamp
   * existed names no packs at all, and is exactly the save most likely to be
   * standing in a region that is gone.
   */
  auditNeedsReport(audit) {
    if (!audit) return false;
    return !!(audit.missingPacks.length || audit.strandedIn || audit.lostRegions.length ||
              audit.lostQuests.length || (audit.drift || []).length);
  },

  /** Tell the captain what happened, in the terminal, once there is one. */
  reportAudit(audit, recovered) {
    const log = (m) => {
      if (typeof UI !== "undefined" && UI.addLog && UI.elements && UI.elements.logTerminal) UI.addLog(m);
      else console.log(m);
    };
    if (!this.auditNeedsReport(audit)) return;

    // A pack whose content changed under a finished save. Nothing is broken and
    // nothing needs recovering - but the galaxy is not the one that was played,
    // and saying so is the whole point of stamping a version.
    if (audit.drift.length) {
      log("=== CONTENT PACK CHANGED ===");
      audit.drift.forEach(d => {
        log(`${String(d.name || d.id).toUpperCase()}: SAVED AGAINST ${String(d.wasVersion || "AN UNRECORDED VERSION").toUpperCase()}, ` +
            `NOW RUNNING ${String(d.nowVersion).toUpperCase()} - ${d.reason.toUpperCase()}.`);
      });
      log("CHARTED CONTENT MAY HAVE MOVED OR BEEN REWRITTEN.");
    }
    if (!audit.missingPacks.length && !audit.strandedIn && !audit.lostRegions.length &&
        !audit.lostQuests.length) return;

    log("=== CONTENT PACK MISSING ===");
    log(audit.missingPacks.length
      ? `THIS SAVE WAS MADE WITH: ${audit.missingPacks.join(", ").toUpperCase()} - NOT CURRENTLY LOADED.`
      : "THIS SAVE REFERENCES CONTENT THAT IS NOT LOADED. IT PREDATES PACK VERSION STAMPING, SO THE PACK CANNOT BE NAMED.");

    if (recovered) {
      log(`THE VESSEL WAS IN ${String(audit.strandedIn).toUpperCase()}, WHICH IS NOT PRESENT. RECOVERED TO STARBASE PRIME.`);
      log("THAT REGION'S CHART AND SALVAGE RECORD ARE KEPT. RE-INSTALL THE PACK AND IT RESUMES.");
    }
    if (audit.lostQuests.length) log(`SUSPENDED DIRECTIVE(S): ${audit.lostQuests.join(", ").toUpperCase()}.`);
    if (audit.lostSystems.length) {
      log(`${audit.lostSystems.length} CHARTED SYSTEM(S) BELONG TO THE MISSING PACK AND ARE HIDDEN, NOT ERASED.`);
    }
    if (audit.lostCommodities.length) {
      log(`CARGO WITH NO MANIFEST ENTRY: ${audit.lostCommodities.join(", ").toUpperCase()} - STILL IN THE HOLD.`);
    }
    if (audit.lostArtifacts.length) {
      log(`ARTIFACT(S) FROM THE MISSING PACK: ${audit.lostArtifacts.join(", ").toUpperCase()} - STILL RECORDED.`);
    }
    log("NOTHING HAS BEEN DELETED. RE-INSTALL THE PACK TO RESTORE IT.");
  },

  summary() {
    return {
      installed: this.installed.map(p => `${p.name} (${p.id})`),
      failed: this.failures.map(f => `${f.name}: ${f.errors.length} problem(s)`)
    };
  }
};

window.ContentPacks = ContentPacks;
