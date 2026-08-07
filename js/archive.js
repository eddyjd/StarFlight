/**
 * ArchiveReader for StarFlight: Odyssey
 *
 * Libraries you research rather than stumble into. Volumes are DATA
 * (js/content/archives.js); this file only decides what is legible yet, renders
 * the shelf, and records what reading a volume teaches you.
 *
 * The progressive-unlock idea is lifted from Spaceport.renderHqLogs(), which
 * already gated HQ dispatches on artifact count - generalised here so a volume
 * can be gated on artifacts, another clue, another volume, quest progress, or a
 * salvaged site.
 */

const ArchiveReader = {
  currentLocation: null,

  locations() {
    return (typeof GameData !== "undefined" && GameData.archiveLocations) || {};
  },

  volumes() {
    return (typeof GameData !== "undefined" && Array.isArray(GameData.archives)) ? GameData.archives : [];
  },

  at(locationId) {
    return this.volumes().filter(v => v.location === locationId);
  },

  read() {
    const ship = window.game && window.game.ship;
    if (!ship) return [];
    if (!Array.isArray(ship.volumesRead)) ship.volumesRead = [];
    return ship.volumesRead;
  },

  hasRead(volumeId) {
    return this.read().includes(volumeId);
  },

  /**
   * Is this volume legible yet? Unknown gate keys deny by default so a typo in
   * content data fails closed and visibly, rather than silently unlocking.
   */
  isUnlocked(vol) {
    const gate = vol.unlockedBy;
    if (!gate) return true;
    const ship = window.game && window.game.ship;
    if (!ship) return false;

    if (typeof gate.artifacts === "number") {
      return (ship.artifactsCollected || []).length >= gate.artifacts;
    }
    if (gate.clue) {
      return typeof ClueLog !== "undefined" && ClueLog.has(gate.clue);
    }
    if (gate.volume) {
      return this.hasRead(gate.volume);
    }
    if (gate.salvaged) {
      return !!(ship.salvagedIds && ship.salvagedIds[gate.salvaged]);
    }
    if (gate.quest) {
      if (typeof QuestEngine === "undefined") return false;
      const st = QuestEngine.state(gate.quest);
      if (typeof gate.stage === "number") return st.done || st.stage >= gate.stage;
      return st.done || st.stage >= 0;
    }
    return false;
  },

  /** Plain-language reason a locked volume is locked, shown on the shelf. */
  lockHint(vol) {
    const gate = vol.unlockedBy || {};
    if (typeof gate.artifacts === "number") {
      const have = ((window.game && window.game.ship.artifactsCollected) || []).length;
      return `SEALED - requires ${gate.artifacts} Precursor artifact(s). You carry ${have}.`;
    }
    if (gate.volume) {
      const prior = this.volumes().find(v => v.id === gate.volume);
      return `SEALED - read "${prior ? prior.title : gate.volume}" first.`;
    }
    if (gate.clue) return "SEALED - requires intelligence you have not yet gathered.";
    if (gate.salvaged) return "SEALED - requires data recovered from a specific site.";
    if (gate.quest) return "SEALED - requires further progress on an active directive.";
    return "SEALED - access restricted.";
  },

  open(locationId) {
    const loc = this.locations()[locationId];
    if (!loc) return;
    this.currentLocation = locationId;
    if (typeof UI !== "undefined" && UI.openArchiveModal) UI.openArchiveModal(locationId);
  },

  /**
   * Read a volume: record its clue once, mark it read, and notify the quest
   * engine so `read_volume` objectives resolve.
   */
  readVolume(volumeId) {
    const vol = this.volumes().find(v => v.id === volumeId);
    if (!vol) return false;
    if (!this.isUnlocked(vol)) return false;

    const first = !this.hasRead(volumeId);
    if (first) {
      this.read().push(volumeId);
      if (vol.grantsClue && typeof ClueLog !== "undefined") {
        ClueLog.record(vol.grantsClue);
      }
      if (typeof UI !== "undefined" && UI.addLog) {
        UI.addLog(`ARCHIVE: STUDIED "${vol.title.toUpperCase()}".`);
      }
      if (typeof QuestEngine !== "undefined") {
        QuestEngine.notify("volume", { volumeId: volumeId });
      }
      try { window.game.saveGame(); } catch (e) {}
    }
    if (typeof AudioController !== "undefined" && AudioController.playBeep) {
      AudioController.playBeep("click");
    }
    return first;
  },

  /** Progress summary for a location, used in the shelf header. */
  progress(locationId) {
    const vols = this.at(locationId);
    const unlocked = vols.filter(v => this.isUnlocked(v));
    const read = unlocked.filter(v => this.hasRead(v.id));
    return { total: vols.length, unlocked: unlocked.length, read: read.length };
  }
};

window.ArchiveReader = ArchiveReader;
