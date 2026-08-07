/**
 * QuestEngine for StarFlight: Odyssey
 *
 * Quests are DATA (see js/content/quests.js). This file is the machinery that
 * runs them and knows nothing about any particular story. Authoring a new main
 * quest should mean adding a record to GameData.quests - never editing this file.
 *
 * A quest is an ordered list of stages. Entering a stage grants its clues to the
 * ClueLog. A stage completes when every objective is satisfied; the quest
 * completes when the last stage does.
 *
 * Objectives are matched by a registry keyed on `type`, so new objective kinds
 * are added by registering a handler rather than editing a conditional chain.
 * A handler returns true when the objective is satisfied. It receives:
 *   (objective, payload, ship)  -  payload is {} for state-based re-evaluation.
 */

const QuestEngine = {

  // ---- objective type registry -------------------------------------------
  // Each handler answers one question: is this objective satisfied right now?
  handlers: {
    // Event-driven: fired by an action somewhere in the game
    collect_artifact: (obj, payload, ship) =>
      Array.isArray(ship.artifactsCollected) && ship.artifactsCollected.includes(obj.artifact),

    collect_all_artifacts: (obj, payload, ship) => {
      const need = obj.artifacts || [];
      return need.length > 0 && need.every(a => (ship.artifactsCollected || []).includes(a));
    },

    dock_at: (obj, payload) =>
      payload && payload.event === "dock" && (!obj.station || payload.station === obj.station),

    visit_coords: (obj, payload) => {
      if (!payload || payload.event !== "position") return false;
      const tol = obj.tolerance || 8.0;
      return Math.hypot(payload.x - obj.x, payload.y - obj.y) <= tol;
    },

    talk_to_race: (obj, payload) =>
      payload && payload.event === "dialogue" && payload.raceKey === obj.raceKey,

    // State-driven: re-checked on every notify, no specific event required
    solve_puzzle: (obj, payload, ship) =>
      !!(ship.puzzlesSolved && ship.puzzlesSolved[obj.puzzleId]),

    assemble_set: (obj, payload, ship) => {
      const set = ship.relics && ship.relics[obj.setId];
      return !!(set && set.assembled);
    },

    read_volume: (obj, payload, ship) =>
      Array.isArray(ship.volumesRead) && ship.volumesRead.includes(obj.volumeId),

    salvage_site: (obj, payload, ship) =>
      !!(ship.salvagedIds && ship.salvagedIds[obj.siteId]),

    have_credits: (obj, payload, ship) => (ship.credits || 0) >= (obj.amount || 0)
  },

  /** Register a new objective type. Additive - no core edits required. */
  registerObjective(type, handler) {
    if (typeof handler === "function") this.handlers[type] = handler;
  },

  // ---- state --------------------------------------------------------------
  all() {
    return (typeof GameData !== "undefined" && Array.isArray(GameData.quests)) ? GameData.quests : [];
  },

  get(questId) {
    return this.all().find(q => q.id === questId) || null;
  },

  states() {
    const ship = window.game && window.game.ship;
    if (!ship) return {};
    if (!ship.quests) ship.quests = {};
    return ship.quests;
  },

  state(questId) {
    const states = this.states();
    if (!states[questId]) states[questId] = { stage: -1, done: false, objectives: {} };
    return states[questId];
  },

  isActive(questId) {
    const st = this.state(questId);
    return st.stage >= 0 && !st.done;
  },

  isComplete(questId) {
    return this.state(questId).done === true;
  },

  currentStage(questId) {
    const q = this.get(questId);
    const st = this.state(questId);
    if (!q || st.stage < 0 || st.done) return null;
    return q.stages[st.stage] || null;
  },

  /** Quests the captain is currently pursuing. */
  active() {
    return this.all().filter(q => this.isActive(q.id));
  },

  // ---- lifecycle ----------------------------------------------------------
  init() {
    this.all().forEach(q => {
      if (q.autoStart && this.state(q.id).stage === -1) this.start(q.id);
    });
    // Catch anything already satisfied by a loaded save
    this.evaluateAll({ event: "init" });
  },

  start(questId) {
    const q = this.get(questId);
    if (!q) return false;
    const st = this.state(questId);
    if (st.stage >= 0 || st.done) return false;

    st.stage = 0;
    st.objectives = {};
    if (typeof UI !== "undefined" && UI.addLog) {
      UI.addLog(`NEW DIRECTIVE LOGGED: ${String(q.title || questId).toUpperCase()}`);
    }
    this.enterStage(questId, 0);
    return true;
  },

  /** Grant a stage's clues and announce its brief. */
  enterStage(questId, index) {
    const q = this.get(questId);
    if (!q) return;
    const stage = q.stages[index];
    if (!stage) return;

    if (Array.isArray(stage.clues) && typeof ClueLog !== "undefined") {
      stage.clues.forEach(c => ClueLog.record(Object.assign({ questId: questId }, c)));
    }
    if (stage.brief && typeof UI !== "undefined" && UI.addLog) {
      UI.addLog(`OBJECTIVE: ${stage.brief.toUpperCase()}`);
    }
  },

  // ---- evaluation ---------------------------------------------------------
  /**
   * Feed an event to every active quest. `event` names the thing that happened;
   * handlers decide whether it satisfies their objective.
   */
  notify(event, payload) {
    const data = Object.assign({ event: event }, payload || {});
    this.evaluateAll(data);
  },

  evaluateAll(payload) {
    const ship = window.game && window.game.ship;
    if (!ship) return;
    this.all().forEach(q => {
      if (this.isActive(q.id)) this.evaluate(q.id, payload);
    });
  },

  evaluate(questId, payload) {
    const q = this.get(questId);
    const st = this.state(questId);
    if (!q || st.done || st.stage < 0) return;
    const ship = window.game.ship;
    const stage = q.stages[st.stage];
    if (!stage) return;

    const objectives = stage.objectives || [];
    let changed = false;

    objectives.forEach((obj, i) => {
      const key = `${st.stage}:${i}`;
      if (st.objectives[key]) return; // already satisfied - objectives never un-satisfy

      const handler = this.handlers[obj.type];
      if (!handler) {
        console.warn("QuestEngine: no handler for objective type", obj.type);
        return;
      }
      let ok = false;
      try { ok = !!handler(obj, payload || {}, ship); } catch (e) {
        console.warn("QuestEngine: objective handler threw", obj.type, e);
      }
      if (ok) {
        st.objectives[key] = true;
        changed = true;
        if (obj.log && typeof UI !== "undefined" && UI.addLog) UI.addLog(obj.log.toUpperCase());
      }
    });

    const allDone = objectives.length > 0 && objectives.every((o, i) => st.objectives[`${st.stage}:${i}`]);
    if (allDone) {
      this.completeStage(questId);
    } else if (changed) {
      try { window.game.saveGame(); } catch (e) {}
    }
  },

  completeStage(questId) {
    const q = this.get(questId);
    const st = this.state(questId);
    const stage = q.stages[st.stage];

    if (stage && stage.onComplete) this.applyReward(stage.onComplete, q, stage);

    if (st.stage + 1 < q.stages.length) {
      st.stage++;
      this.enterStage(questId, st.stage);
      // A newly entered stage may already be satisfied by existing state
      this.evaluate(questId, { event: "stage_entered" });
    } else {
      st.done = true;
      if (typeof UI !== "undefined" && UI.addLog) {
        UI.addLog(`DIRECTIVE COMPLETE: ${String(q.title || questId).toUpperCase()}`);
      }
      if (q.onComplete) this.applyReward(q.onComplete, q, null);
    }
    try { window.game.saveGame(); } catch (e) {}
  },

  /**
   * Rewards are declarative so quest authors never write code. Unknown keys are
   * ignored, and `fn` names a function on window for the rare bespoke payoff
   * (the endgame sequence, for instance).
   */
  applyReward(reward, quest, stage) {
    const ship = window.game.ship;
    if (!reward) return;

    if (reward.log && typeof UI !== "undefined" && UI.addLog) UI.addLog(String(reward.log).toUpperCase());
    if (reward.credits) {
      ship.credits += reward.credits;
      if (typeof UI !== "undefined") UI.updateShip(ship);
    }
    if (reward.clues && typeof ClueLog !== "undefined") {
      reward.clues.forEach(c => ClueLog.record(Object.assign({ questId: quest.id }, c)));
    }
    if (reward.startQuest) this.start(reward.startQuest);
    if (reward.sound && typeof AudioController !== "undefined") {
      if (reward.sound === "victory" && AudioController.playVictory) AudioController.playVictory();
      else if (AudioController.playBeep) AudioController.playBeep(reward.sound);
    }
    if (reward.fn && typeof window[reward.fn] === "function") {
      try { window[reward.fn](quest, stage); } catch (e) { console.error("Quest reward fn failed", e); }
    }
  },

  /** Human-readable progress for the Captain's Log. */
  progress(questId) {
    const q = this.get(questId);
    const st = this.state(questId);
    if (!q) return null;
    if (st.done) return { title: q.title, stageTitle: "COMPLETE", done: true, items: [] };
    if (st.stage < 0) return null;
    const stage = q.stages[st.stage] || {};
    const items = (stage.objectives || []).map((o, i) => ({
      text: o.text || o.type,
      done: !!st.objectives[`${st.stage}:${i}`]
    }));
    return {
      title: q.title,
      stageTitle: stage.title || `STAGE ${st.stage + 1}`,
      stageIndex: st.stage,
      stageCount: q.stages.length,
      done: false,
      items: items
    };
  }
};

window.QuestEngine = QuestEngine;
