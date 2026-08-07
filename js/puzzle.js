/**
 * PuzzleEngine for StarFlight: Odyssey
 *
 * Puzzles are DATA (js/content/puzzles.js). This file is a registry plus a shell:
 * each puzzle TYPE supplies a `render` that draws its controls into a container
 * and a `validate` that answers whether the player's input is correct. Adding a
 * new kind of puzzle is `PuzzleEngine.register(type, {...})` - never an edit to
 * the shell, the modal, or any call site.
 *
 * Solving marks ship.puzzlesSolved, grants the reward, and notifies QuestEngine
 * so `solve_puzzle` objectives resolve.
 */

const PuzzleEngine = {
  types: {},
  current: null,

  register(type, impl) {
    if (!type || !impl || typeof impl.render !== "function" || typeof impl.validate !== "function") {
      console.warn("PuzzleEngine.register: needs {render, validate} for", type);
      return;
    }
    this.types[type] = impl;
  },

  all() {
    return (typeof GameData !== "undefined" && Array.isArray(GameData.puzzles)) ? GameData.puzzles : [];
  },

  get(id) {
    return this.all().find(p => p.id === id) || null;
  },

  solved() {
    const ship = window.game && window.game.ship;
    if (!ship) return {};
    if (!ship.puzzlesSolved) ship.puzzlesSolved = {};
    return ship.puzzlesSolved;
  },

  isSolved(id) {
    return this.solved()[id] === true;
  },

  /**
   * Some puzzles need something learned elsewhere - a cipher key from an archive,
   * a glyph rubbing from a ruin. Expressed as `requires` on the puzzle data so the
   * dependency is authored, not coded.
   */
  hasPrerequisite(puzzle) {
    const req = puzzle.requires;
    if (!req) return true;
    const ship = window.game && window.game.ship;
    if (!ship) return false;
    if (req.clue) return typeof ClueLog !== "undefined" && ClueLog.has(req.clue);
    if (req.volume) return (ship.volumesRead || []).includes(req.volume);
    if (req.puzzle) return this.isSolved(req.puzzle);
    if (typeof req.artifacts === "number") return (ship.artifactsCollected || []).length >= req.artifacts;
    return false;
  },

  prerequisiteHint(puzzle) {
    const req = puzzle.requires || {};
    if (req.clue) return "You lack the key. Something you have not yet read or been told would decode this.";
    if (req.volume) return "An archive volume you have not studied holds the method for this.";
    if (req.puzzle) return "Another mechanism must be solved before this one will respond.";
    if (typeof req.artifacts === "number") return `Requires ${req.artifacts} Precursor artifact(s) aboard.`;
    return "Prerequisite unmet.";
  },

  open(puzzleId, hostName) {
    const puzzle = this.get(puzzleId);
    if (!puzzle) { console.warn("PuzzleEngine: unknown puzzle", puzzleId); return; }
    const impl = this.types[puzzle.type];
    if (!impl) { console.warn("PuzzleEngine: no handler for type", puzzle.type); return; }

    this.current = { puzzle: puzzle, host: hostName || "" };
    if (typeof UI !== "undefined" && UI.openPuzzleModal) UI.openPuzzleModal(puzzle, hostName, impl);
  },

  /** Called by the modal's SUBMIT. Returns true on a correct solution. */
  attempt(input) {
    if (!this.current) return false;
    const puzzle = this.current.puzzle;
    const impl = this.types[puzzle.type];
    if (!impl) return false;

    let ok = false;
    try { ok = !!impl.validate(puzzle, input); } catch (e) {
      console.warn("PuzzleEngine: validate threw for", puzzle.id, e);
    }

    if (ok) this.solve(puzzle.id);
    return ok;
  },

  solve(puzzleId) {
    const puzzle = this.get(puzzleId);
    if (!puzzle || this.isSolved(puzzleId)) return false;

    this.solved()[puzzleId] = true;

    if (typeof UI !== "undefined" && UI.addLog) {
      UI.addLog(`MECHANISM SOLVED: ${String(puzzle.title || puzzleId).toUpperCase()}.`);
    }
    if (puzzle.grantsClue && typeof ClueLog !== "undefined") {
      ClueLog.record(puzzle.grantsClue);
    }
    if (puzzle.reward && typeof QuestEngine !== "undefined") {
      QuestEngine.applyReward(puzzle.reward, { id: puzzle.questId || null }, null);
    }
    if (typeof AudioController !== "undefined" && AudioController.playBeep) {
      AudioController.playBeep("powerup");
    }
    if (typeof QuestEngine !== "undefined") {
      QuestEngine.notify("puzzle", { puzzleId: puzzleId });
    }
    try { window.game.saveGame(); } catch (e) {}
    return true;
  }
};

/* ------------------------------------------------------------------ *
 * Built-in puzzle types. Each is self-contained: it owns its markup
 * and its validation, and knows nothing about the others.
 * ------------------------------------------------------------------ */

// CIPHER - a shifted Precursor transcription. The shift is the "key", learned
// elsewhere; without it the player can still brute force 25 options, which is a
// fair fallback rather than a wall.
PuzzleEngine.register("cipher", {
  render(puzzle) {
    return `
      <div style="font-size:12px; color:#88ccaa; margin-bottom:8px;">${puzzle.prompt || "Decode the transcription."}</div>
      <div class="log-card" style="margin-bottom:10px;">
        <div class="log-card-body" style="font-family:var(--terminal-font); font-size:15px; letter-spacing:2px; color:#ffcc00; word-break:break-word;">
          ${puzzle.ciphertext}
        </div>
      </div>
      <label style="font-size:11px; color:#88ccaa;">ROTATION KEY (1-25):</label>
      <input id="puzzle-input" type="number" min="1" max="25" value="1"
             style="width:100%; margin-top:6px; padding:8px; background:#050f08; color:#00ff66;
                    border:1px solid var(--primary-color); font-family:var(--terminal-font); font-size:14px;">
      <div id="puzzle-preview" style="margin-top:10px; font-size:13px; color:#00e5ff; min-height:40px; word-break:break-word;"></div>`;
  },

  // Live preview as the player turns the dial - the discovery should be visible,
  // not a guess-and-submit loop.
  onInput(puzzle, value) {
    const shift = parseInt(value, 10);
    if (isNaN(shift)) return "";
    return PuzzleEngine.rot(puzzle.ciphertext, -shift);
  },

  validate(puzzle, input) {
    const shift = parseInt(input, 10);
    if (isNaN(shift)) return false;
    return PuzzleEngine.rot(puzzle.ciphertext, -shift).toUpperCase() === String(puzzle.plaintext).toUpperCase();
  }
});

// SEQUENCE - reproduce an order of glyphs recorded somewhere else.
PuzzleEngine.register("sequence", {
  render(puzzle) {
    const glyphs = puzzle.glyphs || [];
    return `
      <div style="font-size:12px; color:#88ccaa; margin-bottom:10px;">${puzzle.prompt || "Enter the activation sequence."}</div>
      <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-bottom:12px;">
        ${glyphs.map((g, i) => `
          <button class="glow-btn" style="font-size:20px; padding:10px 14px;"
                  onclick="UI.puzzleGlyphPressed('${g}')">${g}</button>`).join("")}
      </div>
      <div style="font-size:11px; color:#88ccaa;">ENTERED SEQUENCE:</div>
      <div id="puzzle-sequence" style="min-height:38px; margin-top:6px; padding:8px; background:#050f08;
           border:1px solid var(--primary-color); font-size:20px; letter-spacing:6px; color:#ffcc00;"></div>
      <input id="puzzle-input" type="hidden" value="">
      <div style="margin-top:8px; text-align:right;">
        <button class="glow-btn btn-sm red-glow" onclick="UI.puzzleClearSequence()">CLEAR</button>
      </div>`;
  },

  validate(puzzle, input) {
    return String(input) === (puzzle.solution || []).join("");
  }
});

// ASSEMBLY - combine recovered fragments into a working device. Validation is
// possession, not dexterity: the puzzle is finding the pieces.
PuzzleEngine.register("assembly", {
  render(puzzle) {
    const ship = window.game.ship;
    const set = (ship.relics && ship.relics[puzzle.setId]) || { fragments: [] };
    const need = puzzle.fragments || [];
    const have = set.fragments || [];

    return `
      <div style="font-size:12px; color:#88ccaa; margin-bottom:10px;">${puzzle.prompt || "Assemble the device."}</div>
      <div class="log-card">
        <div class="log-card-header"><span>COMPONENT MANIFEST</span></div>
        <div class="log-card-body" style="line-height:2;">
          ${need.map(f => {
            const got = have.includes(f.id);
            return `<div style="color:${got ? "#00ff66" : "#666"};">
                      ${got ? "✔" : "✗"} ${f.icon || "⚙"} ${f.name}
                      <span style="font-size:10px; color:#88ccaa;"> - ${got ? "recovered" : (f.hint || "location unknown")}</span>
                    </div>`;
          }).join("")}
        </div>
      </div>
      <div style="margin-top:10px; font-size:12px; color:${have.length >= need.length ? "#00ff66" : "#ffcc00"};">
        ${have.length} of ${need.length} components aboard.
        ${have.length >= need.length ? "Ready to assemble." : "Recover the remainder before assembly is possible."}
      </div>
      <input id="puzzle-input" type="hidden" value="assemble">`;
  },

  validate(puzzle) {
    const ship = window.game.ship;
    const set = (ship.relics && ship.relics[puzzle.setId]) || { fragments: [] };
    const need = (puzzle.fragments || []).map(f => f.id);
    const ok = need.every(id => (set.fragments || []).includes(id));
    if (ok) {
      if (!ship.relics) ship.relics = {};
      if (!ship.relics[puzzle.setId]) ship.relics[puzzle.setId] = { fragments: [] };
      ship.relics[puzzle.setId].assembled = true;
    }
    return ok;
  }
});

/** Caesar rotation used by the cipher type; letters only, punctuation intact. */
PuzzleEngine.rot = function (text, shift) {
  const s = ((shift % 26) + 26) % 26;
  return String(text).replace(/[a-z]/gi, ch => {
    const base = ch <= "Z" ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - base + s) % 26) + base);
  });
};

/** Award a relic fragment. Called from wherever a fragment is found. */
PuzzleEngine.grantFragment = function (setId, fragmentId, fragmentName) {
  const ship = window.game && window.game.ship;
  if (!ship || !setId || !fragmentId) return false;
  if (!ship.relics) ship.relics = {};
  if (!ship.relics[setId]) ship.relics[setId] = { fragments: [], assembled: false };
  const set = ship.relics[setId];
  if (set.fragments.includes(fragmentId)) return false;

  set.fragments.push(fragmentId);
  if (typeof UI !== "undefined" && UI.addLog) {
    UI.addLog(`COMPONENT RECOVERED: ${String(fragmentName || fragmentId).toUpperCase()}.`);
  }
  if (typeof QuestEngine !== "undefined") {
    QuestEngine.notify("fragment", { setId: setId, fragmentId: fragmentId });
  }
  try { window.game.saveGame(); } catch (e) {}
  return true;
};

window.PuzzleEngine = PuzzleEngine;
