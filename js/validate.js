/**
 * ContentValidator for StarFlight: Odyssey
 *
 * One definition of "valid game content", used by two callers:
 *
 *   - the regression sweep, which runs it against the shipped game. If a rule
 *     here flags real content, the RULE is wrong and gets fixed - that is what
 *     keeps the validator honest.
 *   - the content pack loader (js/packs.js), which runs it against the result of
 *     merging a pack. Nothing merges until it passes.
 *
 * Every rule below was already being enforced somewhere - roughly 25 checks in
 * the sweep encoded exactly these invariants, each one written after a real bug:
 *
 *   unknown commodity keys        v1.15.1  one killed every alien port
 *   dangling clue coordinates     v1.11.x  clues pointing at empty space
 *   names colliding across regions v1.15.5 "The Undertow" in two quadrants
 *   arrival inside a gravity well v1.14.1  an unbreakable loop between regions
 *   region-scoped ids reused      v1.15.6  one key naming four different throats
 *   unimplemented effect keys     v1.12.2  nebulae that promised and did nothing
 *
 * Scattered across a test file, those rules could not protect generated content.
 * Here, they can.
 *
 * A rule returns an array of problem strings. `severity: "warn"` marks the ones
 * that describe a thin or suspect pack rather than a broken one.
 */

const ContentValidator = {

  // ---- helpers -----------------------------------------------------------

  /** Every landmark a coordinate is allowed to refer to, across all regions. */
  landmarks(D) {
    const out = [{ x: 250, y: 250, what: "Starbase Prime" }];
    const push = (arr, what) => (arr || []).forEach(o => {
      if (typeof o.x === "number" && typeof o.y === "number") out.push({ x: o.x, y: o.y, what: what });
    });
    const scan = (src, label) => {
      push(src.starSystems, label + " system");
      push(src.blackHoles, label + " singularity");
      push(src.derelicts, label + " derelict");
      push(src.spaceWrecks, label + " wreck");
      push(src.distressSignals, label + " beacon");
      push(src.alienPorts, label + " port");
      push(src.nebulae, label + " nebula");
      push(src.asteroidFields, label + " asteroid field");
    };
    scan(D, "core");
    Object.keys(D.regions || {}).forEach(rid => scan(D.regions[rid] || {}, rid));
    return out;
  },

  /** Walk every region, core included, as { id, data } - core lives at the top level. */
  eachRegion(D, fn) {
    fn("core", D);
    Object.keys(D.regions || {}).forEach(rid => {
      if (rid === "core") return;
      fn(rid, D.regions[rid] || {});
    });
  },

  /** Every dialogue node across all races, flattened. */
  dialogueNodes(D) {
    const out = [];
    Object.keys(D.aliens || {}).forEach(rk => {
      const d = (D.aliens[rk] || {}).dialogue || {};
      ["friendly", "hostile", "obsequious"].forEach(p => {
        if (d[p]) out.push({ race: rk, id: p, node: d[p], nodes: d.nodes || {} });
      });
      Object.keys(d.nodes || {}).forEach(nid => {
        out.push({ race: rk, id: nid, node: d.nodes[nid], nodes: d.nodes || {} });
      });
    });
    return out;
  },

  // ---- rules -------------------------------------------------------------
  // Each: { id, what it protects, run(D) -> [problem strings] }

  RULES: [

    // ---------------------------------------------------------------- refs
    {
      id: "commodity-keys",
      title: "Everything that names a commodity names a real one",
      run(D) {
        const bad = [];
        const check = (key, where) => {
          if (key && !D.commodities[key]) bad.push(`${where} refers to unknown commodity "${key}"`);
        };
        (D.asteroidFields || []).forEach(f => (f.ores || []).forEach(o => check(o, `asteroid field ${f.id}`)));
        ContentValidator.eachRegion(D, (rid, src) => {
          (src.derelicts || []).forEach(dr => check((dr.loot || {}).type === "endurium" ? null : (dr.loot || {}).type,
            `${rid} derelict ${dr.id} loot`));
          (src.alienPorts || []).forEach(p => (p.wants || []).forEach(w => check(w, `${rid} port ${p.id} wants`)));
        });
        // Profile entries are weighted records - { key, w } - not bare keys.
        (D.resourceProfiles || []).forEach(p => {
          [].concat(p.minerals || [], p.bio || []).forEach(e => {
            const k = (e && typeof e === "object") ? e.key : e;
            check(k, `resource profile ${p.id}`);
            if (e && typeof e === "object" && typeof e.w !== "number") {
              bad.push(`resource profile ${p.id} entry "${k}" has no weight`);
            }
          });
        });
        ContentValidator.dialogueNodes(D).forEach(n => {
          (n.node.choices || []).forEach(c => {
            if (c.swap) {
              check((c.swap.give || {}).key, `${n.race}/${n.id} swap.give`);
              check((c.swap.get || {}).key, `${n.race}/${n.id} swap.get`);
            }
            if (c.buy) check(c.buy.key, `${n.race}/${n.id} buy`);
            if (c.requires && c.requires.cargo) {
              Object.keys(c.requires.cargo).forEach(k => check(k, `${n.race}/${n.id} requires.cargo`));
            }
          });
        });
        return bad;
      }
    },

    {
      id: "techpart-keys",
      title: "Salvage sites yield modules that exist",
      run(D) {
        const bad = [];
        ContentValidator.eachRegion(D, (rid, src) => {
          (src.derelicts || []).forEach(dr => {
            const k = (dr.loot || {}).techPartKey;
            if (k && !D.techParts[k]) bad.push(`${rid} derelict ${dr.id} yields unknown module "${k}"`);
          });
          (src.spaceWrecks || []).forEach(w => {
            if (w.techPartKey && !D.techParts[w.techPartKey]) {
              bad.push(`${rid} wreck ${w.id} yields unknown module "${w.techPartKey}"`);
            }
          });
        });
        return bad;
      }
    },

    {
      id: "dialogue-targets",
      title: "Follow-up nodes resolve",
      run(D) {
        const bad = [];
        ContentValidator.dialogueNodes(D).forEach(n => {
          (n.node.choices || []).forEach(c => {
            if (c.next && !n.nodes[c.next]) {
              bad.push(`${n.race}/${n.id} choice opens missing node "${c.next}"`);
            }
          });
        });
        return bad;
      }
    },

    {
      id: "archive-wiring",
      title: "Every port's archive exists, is stocked, and belongs to one region",
      run(D) {
        const bad = [];
        const byArchive = {};
        ContentValidator.eachRegion(D, (rid, src) => {
          (src.alienPorts || []).forEach(p => {
            if (!p.archive) { bad.push(`${rid} port ${p.id} names no archive`); return; }
            if (!(D.archiveLocations || {})[p.archive]) {
              bad.push(`${rid} port ${p.id} names unknown archive "${p.archive}"`);
              return;
            }
            const stock = (D.archives || []).filter(v => v.location === p.archive).length;
            if (!stock) bad.push(`${rid} port ${p.id} names empty archive "${p.archive}"`);
            (byArchive[p.archive] = byArchive[p.archive] || []).push(rid);
          });
        });
        Object.keys(byArchive).forEach(a => {
          if (new Set(byArchive[a]).size > 1) {
            bad.push(`archive "${a}" is stocked by ports in ${[...new Set(byArchive[a])].join(" and ")}`);
          }
        });
        (D.archives || []).forEach(v => {
          if (!(D.archiveLocations || {})[v.location]) {
            bad.push(`archive volume ${v.id} sits in unknown location "${v.location}"`);
          }
          const g = v.unlockedBy;
          if (g && g.volume && !(D.archives || []).some(x => x.id === g.volume)) {
            bad.push(`archive volume ${v.id} is gated on missing volume "${g.volume}"`);
          }
        });
        return bad;
      }
    },

    {
      id: "puzzle-wiring",
      title: "Puzzle sites and fragments resolve",
      run(D) {
        const bad = [];
        const ids = new Set((D.puzzles || []).map(p => p.id));
        ContentValidator.eachRegion(D, (rid, src) => {
          [].concat(src.derelicts || [], src.spaceWrecks || []).forEach(site => {
            if (site.puzzleId && !ids.has(site.puzzleId)) {
              bad.push(`${rid} site ${site.id} guards missing puzzle "${site.puzzleId}"`);
            }
          });
        });
        (D.puzzles || []).forEach(p => {
          if (!p.type) bad.push(`puzzle ${p.id} declares no type`);
          if (p.type === "cipher" && (!p.ciphertext || !p.plaintext)) {
            bad.push(`cipher puzzle ${p.id} is missing ciphertext or plaintext`);
          }
          if (p.type === "sequence" && !(p.solution || []).length) {
            bad.push(`sequence puzzle ${p.id} has no solution`);
          }
        });
        return bad;
      }
    },

    {
      id: "quest-wiring",
      title: "Quest objectives and rewards resolve to real content",
      run(D) {
        const bad = [];
        (D.quests || []).forEach(q => {
          (q.stages || []).forEach((st, si) => {
            (st.objectives || []).forEach(o => {
              const at = `quest ${q.id} stage ${si} objective ${o.type}`;
              if (o.type === "solve_puzzle" && !(D.puzzles || []).some(p => p.id === o.puzzleId)) {
                bad.push(`${at} names missing puzzle "${o.puzzleId}"`);
              }
              if (o.type === "read_volume" && !(D.archives || []).some(v => v.id === o.volumeId)) {
                bad.push(`${at} names missing volume "${o.volumeId}"`);
              }
              if (o.type === "visit_region" && !(D.regions || {})[o.region]) {
                bad.push(`${at} names missing region "${o.region}"`);
              }
              if (o.type === "talk_to_race" && !(D.aliens || {})[o.raceKey]) {
                bad.push(`${at} names missing race "${o.raceKey}"`);
              }
            });
          });
          if (q.reward && q.reward.startQuest && !(D.quests || []).some(x => x.id === q.reward.startQuest)) {
            bad.push(`quest ${q.id} rewards a missing quest "${q.reward.startQuest}"`);
          }
        });
        return bad;
      }
    },

    {
      id: "region-gates",
      title: "Every gate leads somewhere real, and every region can be entered",
      run(D) {
        const bad = [];
        const known = new Set(["core"].concat(Object.keys(D.regions || {})));
        const entered = new Set(["core"]);

        ContentValidator.eachRegion(D, (rid, src) => {
          (src.blackHoles || []).forEach(bh => {
            const dest = bh.leadsTo || bh.returnsTo;
            if (dest) {
              if (!known.has(dest)) bad.push(`${rid} gate ${bh.id} leads to unknown region "${dest}"`);
              else entered.add(dest);
            }
            if (typeof bh.gravityRadius !== "number" || typeof bh.coreRadius !== "number") {
              bad.push(`${rid} gate ${bh.id} is missing gravityRadius or coreRadius`);
            }
          });
        });
        Object.keys(D.regions || {}).forEach(rid => {
          if (rid === "core") return;
          const r = D.regions[rid] || {};
          if (r.entryFrom) entered.add(rid);
          if (r.returnTo && !known.has(r.returnTo.region)) {
            bad.push(`region ${rid} returns to unknown region "${r.returnTo.region}"`);
          }
          if (!entered.has(rid)) {
            bad.push(`region ${rid} has no gate leading into it - it is unreachable`);
          }
        });
        return bad;
      }
    },

    // -------------------------------------------------------- coordinates
    {
      id: "coords-in-bounds",
      title: "Everything sits inside the 500x500 quadrant",
      run(D) {
        const bad = [];
        const check = (o, what) => {
          if (typeof o.x !== "number" || typeof o.y !== "number") return;
          if (o.x < 5 || o.x > 495 || o.y < 5 || o.y > 495) bad.push(`${what} is outside the quadrant at (${o.x}, ${o.y})`);
        };
        ContentValidator.eachRegion(D, (rid, src) => {
          ["starSystems", "blackHoles", "derelicts", "spaceWrecks", "distressSignals", "alienPorts", "nebulae", "asteroidFields"]
            .forEach(k => (src[k] || []).forEach(o => check(o, `${rid} ${k} ${o.id || o.name}`)));
        });
        return bad;
      }
    },

    {
      id: "clue-coords",
      title: "Clue coordinates point at something real",
      run(D) {
        const bad = [];
        const marks = ContentValidator.landmarks(D);
        const near = (c) => marks.some(m => Math.abs(m.x - c.x) < 3 && Math.abs(m.y - c.y) < 3);
        const check = (clue, where) => {
          if (!clue || !clue.coords) return;
          if (!near(clue.coords)) {
            bad.push(`${where} clue "${clue.id}" points at empty space (${clue.coords.x}, ${clue.coords.y})`);
          }
        };
        (D.quests || []).forEach(q => (q.stages || []).forEach((st, i) =>
          (st.clues || []).forEach(c => check(c, `quest ${q.id} stage ${i}`))));
        (D.archives || []).forEach(v => check(v.grantsClue, `archive ${v.id}`));
        (D.puzzles || []).forEach(p => check(p.grantsClue, `puzzle ${p.id}`));
        ContentValidator.eachRegion(D, (rid, src) =>
          (src.distressSignals || []).forEach(s => check(s.grantsClue, `${rid} beacon ${s.id}`)));
        ContentValidator.dialogueNodes(D).forEach(n =>
          (n.node.choices || []).forEach(c => check(c.clue, `${n.race}/${n.id}`)));
        return bad;
      }
    },

    {
      id: "arrival-clear-of-wells",
      title: "No gate drops a ship inside a gravity well",
      run(D) {
        const bad = [];
        ContentValidator.eachRegion(D, (rid, src) => {
          (src.blackHoles || []).forEach(bh => {
            const dest = bh.leadsTo || bh.returnsTo;
            if (!dest) return;
            const target = dest === "core" ? D : (D.regions || {})[dest];
            if (!target) return;
            let ax, ay;
            if (bh.exitAt) { ax = bh.exitAt.x; ay = bh.exitAt.y; }
            else if (bh.returnsTo) {
              const here = rid === "core" ? D : (D.regions || {})[rid];
              if (here && here.returnTo) { ax = here.returnTo.x; ay = here.returnTo.y; }
            }
            if (typeof ax !== "number") {
              ax = (target.arrival && target.arrival.x) || 250;
              ay = (target.arrival && target.arrival.y) || 250;
            }
            (target.blackHoles || (dest === "core" ? D.blackHoles : []) || []).forEach(b => {
              if (Math.hypot(ax - b.x, ay - b.y) < (b.gravityRadius || 30)) {
                bad.push(`${rid} gate ${bh.id} lands at (${Math.round(ax)}, ${Math.round(ay)}), inside ${b.id}'s well`);
              }
            });
          });
        });
        return bad;
      }
    },

    // ---------------------------------------------------------- uniqueness
    {
      id: "unique-ids",
      title: "No two records in a collection share an id",
      run(D) {
        const bad = [];
        const seen = {};
        ContentValidator.eachRegion(D, (rid, src) => {
          ["starSystems", "blackHoles", "derelicts", "spaceWrecks", "distressSignals", "alienPorts", "nebulae"]
            .forEach(k => (src[k] || []).forEach(o => {
              if (!o.id) return;
              const key = k + ":" + o.id;
              if (seen[key]) bad.push(`${k} id "${o.id}" is used in both ${seen[key]} and ${rid}`);
              else seen[key] = rid;
            }));
        });
        [["quests", D.quests], ["archives", D.archives], ["puzzles", D.puzzles],
         ["asteroidFields", D.asteroidFields], ["resourceProfiles", D.resourceProfiles]].forEach(([k, arr]) => {
          const ids = (arr || []).map(o => o.id).filter(Boolean);
          const dupes = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
          dupes.forEach(d => bad.push(`${k} has two records with id "${d}"`));
        });
        return bad;
      }
    },

    {
      id: "unique-names",
      title: "Systems and singularities do not share names across regions",
      run(D) {
        const bad = [];
        const sys = {}, holes = {};
        ContentValidator.eachRegion(D, (rid, src) => {
          (src.starSystems || []).forEach(s => {
            if (sys[s.name]) bad.push(`star system "${s.name}" exists in both ${sys[s.name]} and ${rid}`);
            else sys[s.name] = rid;
          });
          (src.blackHoles || []).forEach(b => {
            if (holes[b.name]) bad.push(`singularity "${b.name}" exists in both ${holes[b.name]} and ${rid}`);
            else holes[b.name] = rid;
          });
        });
        return bad;
      }
    },

    {
      id: "unique-planet-names",
      title: "Planet names are unique - surfaces are generated from the name",
      run(D) {
        const bad = [];
        const seen = {};
        ContentValidator.eachRegion(D, (rid, src) => {
          (src.starSystems || []).forEach(sy => (sy.planets || []).forEach(pl => {
            if (seen[pl.name]) {
              bad.push(`planet "${pl.name}" exists in both ${seen[pl.name]} and ${rid}/${sy.name} - ` +
                       `surfaces are seeded from the name, so both would be the same world`);
            } else seen[pl.name] = rid + "/" + sy.name;
          }));
        });
        return bad;
      }
    },

    // -------------------------------------------------------- completeness
    {
      id: "commodity-shape",
      title: "Commodities carry a name, a value, a mass and a tier",
      run(D) {
        const bad = [];
        Object.keys(D.commodities || {}).forEach(k => {
          const c = D.commodities[k];
          if (!c.name) bad.push(`commodity "${k}" has no name`);
          if (typeof c.sellVal !== "number") bad.push(`commodity "${k}" has no sellVal`);
          if (typeof c.mass !== "number") bad.push(`commodity "${k}" has no mass`);
          // Salvaged modules are carryable cargo, not mined resources - no tier
          if (!c.tier && !c.isSalvagedModule && k !== "fuel") {
            bad.push(`commodity "${k}" declares no rarity tier`);
          }
        });
        return bad;
      }
    },

    {
      id: "implemented-effects",
      title: "Declared effects have an implementation",
      run(D) {
        const bad = [];
        const nebEffects = (typeof Navigation !== "undefined" && Navigation.NEBULA_EFFECTS) || null;
        const consEffects = (typeof Consumables !== "undefined" && Consumables.EFFECTS) || null;
        ContentValidator.eachRegion(D, (rid, src) => {
          (src.nebulae || []).forEach(n => {
            if (!n.effect) bad.push(`${rid} nebula ${n.id} declares no effect`);
            else if (nebEffects && !nebEffects[n.effect]) {
              bad.push(`${rid} nebula ${n.id} declares unimplemented effect "${n.effect}"`);
            }
          });
        });
        Object.keys(D.consumables || {}).forEach(k => {
          const it = D.consumables[k];
          if (consEffects && !consEffects[it.effect]) {
            bad.push(`consumable "${k}" declares unimplemented effect "${it.effect}"`);
          }
        });
        return bad;
      }
    },

    {
      id: "alien-shape",
      title: "Every flyable race is contactable",
      run(D) {
        const bad = [];
        Object.keys(D.aliens || {}).forEach(k => {
          const a = D.aliens[k];
          if (typeof a.aggression !== "number") bad.push(`race "${k}" declares no aggression`);
          if (!a.dialogue || !a.dialogue.friendly) bad.push(`race "${k}" has no friendly dialogue`);
        });
        const flyable = new Set();
        ((D.traffic || {}).races || []).forEach(r => flyable.add(r));
        Object.keys(D.regions || {}).forEach(rid =>
          (((D.regions[rid] || {}).traffic || {}).races || []).forEach(r => flyable.add(r)));
        [...flyable].forEach(r => {
          if (!(D.aliens || {})[r]) bad.push(`traffic flies race "${r}", which has no dialogue record - hailing it would do nothing`);
        });
        return bad;
      }
    },

    {
      id: "region-shape",
      title: "Regions declare the fields the engines read",
      severity: "warn",
      run(D) {
        const bad = [];
        Object.keys(D.regions || {}).forEach(rid => {
          if (rid === "core") return;
          const r = D.regions[rid];
          if (!r.name) bad.push(`region ${rid} has no name`);
          if (!r.arrival) bad.push(`region ${rid} declares no arrival point`);
          if (!(r.starSystems || []).length) bad.push(`region ${rid} contains no star systems`);
          if (!(r.blackHoles || []).length) bad.push(`region ${rid} has no singularity - nothing can leave it`);
        });
        return bad;
      }
    }
  ],

  // ---- entry points ------------------------------------------------------

  /**
   * Run every rule over a GameData-shaped object.
   * Returns { errors, warnings, ruleCount, ok }.
   */
  validate(D) {
    const data = D || (typeof GameData !== "undefined" ? GameData : null);
    if (!data) return { errors: ["no GameData to validate"], warnings: [], ruleCount: 0, ok: false };

    const errors = [], warnings = [];
    this.RULES.forEach(rule => {
      let found;
      try {
        found = rule.run(data) || [];
      } catch (e) {
        errors.push(`[${rule.id}] rule itself failed: ${e.message}`);
        return;
      }
      found.forEach(msg => {
        const line = `[${rule.id}] ${msg}`;
        if (rule.severity === "warn") warnings.push(line); else errors.push(line);
      });
    });
    return { errors: errors, warnings: warnings, ruleCount: this.RULES.length, ok: errors.length === 0 };
  },

  /** Convenience: validate the live game exactly as it is loaded. */
  validateGame() {
    return this.validate(typeof GameData !== "undefined" ? GameData : null);
  },

  /** A readable report, for a console or a modal. */
  report(result) {
    if (!result) return "no result";
    const lines = [];
    lines.push(`${result.ruleCount} rules checked - ${result.errors.length} error(s), ${result.warnings.length} warning(s)`);
    result.errors.forEach(e => lines.push("  ERROR   " + e));
    result.warnings.forEach(w => lines.push("  warning " + w));
    return lines.join("\n");
  }
};

window.ContentValidator = ContentValidator;
