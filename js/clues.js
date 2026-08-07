/**
 * ClueLog for StarFlight: Odyssey
 *
 * A single place to record every hint the captain learns, from any source: HQ
 * dispatches, Precursor ruins, alien transmissions, archive volumes, salvaged
 * wrecks. Before this existed, clues scrolled past in the terminal and were gone.
 *
 * Clues are data. Nothing here knows about any particular quest - a clue simply
 * carries an optional questId so the Captain's Log can group it.
 */

const ClueLog = {
  // Where a clue came from. Used for grouping and iconography in the log.
  SOURCES: {
    hq: { label: "STARBASE DISPATCH", icon: "📡" },
    ruin: { label: "PRECURSOR RUIN", icon: "🏛️" },
    alien: { label: "ALIEN TRANSMISSION", icon: "👾" },
    archive: { label: "ARCHIVE VOLUME", icon: "📚" },
    wreck: { label: "SALVAGED DATA CORE", icon: "🛸" },
    derelict: { label: "DERELICT STATION", icon: "🛰️" },
    beacon: { label: "SUBSPACE BEACON", icon: "📶" },
    survey: { label: "SURVEY TELEMETRY", icon: "🔬" }
  },

  list() {
    const ship = window.game && window.game.ship;
    if (!ship) return [];
    if (!Array.isArray(ship.clues)) ship.clues = [];
    return ship.clues;
  },

  has(id) {
    return this.list().some(c => c.id === id);
  },

  /**
   * Record a clue. Deduped by id, so the same ruin or dialogue branch can be
   * revisited without spamming the log. Returns true only if newly recorded.
   *
   * clue: { id, text, source, sourceName, questId?, coords?, title? }
   */
  record(clue) {
    if (!clue || !clue.id || !clue.text) return false;
    const ship = window.game && window.game.ship;
    if (!ship) return false;
    if (this.has(clue.id)) return false;

    const entry = {
      id: clue.id,
      title: clue.title || "",
      text: clue.text,
      source: clue.source || "survey",
      sourceName: clue.sourceName || "",
      questId: clue.questId || null,
      coords: clue.coords || null,
      region: ship.region || "core",
      foundAt: this.list().length + 1 // ordinal, not a wall clock - saves stay portable
    };
    this.list().push(entry);

    const src = this.SOURCES[entry.source] || this.SOURCES.survey;
    if (typeof UI !== "undefined" && UI.addLog) {
      UI.addLog(`${src.icon} CLUE RECORDED (${src.label}): ${entry.text}`);
      UI.addLog("LOGGED TO CAPTAIN'S LOG - CLUES TAB [G].");
    }
    if (typeof AudioController !== "undefined" && AudioController.playBeep) {
      AudioController.playBeep("powerup");
    }

    try { window.game.saveGame(); } catch (e) {}
    return true;
  },

  /** Record several at once; returns how many were new. */
  recordAll(clues) {
    if (!Array.isArray(clues)) return 0;
    let n = 0;
    clues.forEach(c => { if (this.record(c)) n++; });
    return n;
  },

  byQuest(questId) {
    return this.list().filter(c => c.questId === questId);
  },

  bySource(source) {
    return this.list().filter(c => c.source === source);
  },

  /** Clues not tied to any quest - ambient lore and stray hints. */
  unattached() {
    return this.list().filter(c => !c.questId);
  },

  count() {
    return this.list().length;
  }
};

window.ClueLog = ClueLog;
