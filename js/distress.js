/**
 * DistressNet for StarFlight: Odyssey
 *
 * The three authored distress beacons sat at fixed coordinates forever. Once you
 * had answered them the band was silent for the rest of the game.
 *
 * Calls now come in during play. They are deliberately occasional - a signal
 * every few minutes at most, never more than a couple live at once - and they
 * EXPIRE. A beacon you ignore stops transmitting, and whatever it was carrying
 * goes with it. That is what makes answering one a decision rather than a chore.
 *
 * Everything ages on ship.playClock (seconds of actual play) rather than the wall
 * clock, so a save carries its pending calls across sessions intact.
 */

const DistressNet = {

  MIN_GAP: 150,        // seconds of play between calls, at the earliest
  MAX_GAP: 330,        // and at the latest
  MAX_LIVE: 2,         // concurrent dynamic calls
  LIFETIME: 420,       // seconds of play before a call goes silent
  MIN_RANGE: 45,       // never spawn on top of the ship
  MAX_RANGE: 190,      // nor so far that answering is absurd

  templates() {
    return (typeof GameData !== "undefined" && GameData.signalTemplates) || [];
  },

  live() {
    const ship = window.game && window.game.ship;
    if (!ship) return [];
    if (!Array.isArray(ship.dynamicSignals)) ship.dynamicSignals = [];
    return ship.dynamicSignals;
  },

  /** Live calls in the region the ship is in, as signal records. */
  activeHere() {
    const ship = window.game && window.game.ship;
    if (!ship) return [];
    const region = ship.region || "core";
    return this.live().filter(s => s.region === region && s.active);
  },

  pickTemplate(rand) {
    const list = this.templates();
    if (!list.length) return null;
    const total = list.reduce((n, t) => n + (t.weight || 1), 0);
    let roll = rand() * total;
    for (let i = 0; i < list.length; i++) {
      roll -= (list[i].weight || 1);
      if (roll <= 0) return list[i];
    }
    return list[list.length - 1];
  },

  /**
   * Drop a new call somewhere the ship could plausibly reach. Returns the signal,
   * or null if nowhere suitable came up.
   */
  spawn() {
    const ship = window.game.ship;
    const rand = Math.random;
    const tpl = this.pickTemplate(rand);
    if (!tpl) return null;

    let x, y, tries = 0;
    do {
      const ang = rand() * Math.PI * 2;
      const dist = this.MIN_RANGE + rand() * (this.MAX_RANGE - this.MIN_RANGE);
      x = Math.round(Navigation.shipX + Math.cos(ang) * dist);
      y = Math.round(Navigation.shipY + Math.sin(ang) * dist);
      tries++;
    } while ((x < 20 || x > 480 || y < 20 || y > 480) && tries < 40);
    if (x < 20 || x > 480 || y < 20 || y > 480) return null;

    const serial = (ship.signalSerial = (ship.signalSerial || 0) + 1);
    const sig = {
      id: `${tpl.id}_${serial}`,
      templateId: tpl.id,
      name: tpl.name,
      event: tpl.event,
      desc: tpl.desc,
      bounty: tpl.bounty,
      chartRadius: tpl.chartRadius,
      x: x, y: y,
      active: true,
      dynamic: true,
      region: ship.region || "core",
      bornAt: ship.playClock || 0,
      expiresAt: (ship.playClock || 0) + this.LIFETIME
    };

    if (tpl.clue) {
      sig.grantsClue = {
        id: `clue_${sig.id}`,
        title: tpl.clue.title,
        text: String(tpl.clue.text).replace(/\{X\}/g, x).replace(/\{Y\}/g, y),
        coords: { x: x, y: y }
      };
    }

    this.live().push(sig);

    const bearing = Math.round(((Math.atan2(y - Navigation.shipY, x - Navigation.shipX) * 180 / Math.PI) + 360) % 360);
    const range = Math.hypot(x - Navigation.shipX, y - Navigation.shipY);
    UI.addLog(`>>> SUBSPACE DISTRESS CALL INBOUND <<<`);
    UI.addLog(`${sig.name.toUpperCase()} - BEARING ${bearing}°, RANGE ${range.toFixed(0)} LY, AT (${x}, ${y}).`);
    UI.addLog("THE BAND WILL NOT CARRY IT FOREVER.");
    if (typeof AudioController !== "undefined" && AudioController.playBeep) AudioController.playBeep("click");

    // Customs answers calls inside its own jurisdiction
    if (typeof Navigation.dispatchPatrolTo === "function") Navigation.dispatchPatrolTo(sig);
    return sig;
  },

  /**
   * Tick the band. Called every frame from the main loop; almost every call is a
   * pair of comparisons, so this is cheap.
   */
  update(dt) {
    const game = window.game;
    if (!game || !game.ship) return;
    const ship = game.ship;

    // Only while actually flying - calls arriving while docked or on a surface
    // would be missed, and a beacon nobody could have answered is just noise.
    if (game.viewState !== "navigation" || game.spaceState !== "hyper" || ship.isInSpacebase) return;

    const now = ship.playClock || 0;

    // Expire anything the captain let go
    const list = this.live();
    for (let i = list.length - 1; i >= 0; i--) {
      const sig = list[i];
      if (!sig.active) { list.splice(i, 1); continue; }
      if (now >= sig.expiresAt) {
        sig.active = false;
        list.splice(i, 1);
        if (sig.region === (ship.region || "core")) {
          UI.addLog(`SIGNAL LOST: ${sig.name.toUpperCase()} HAS STOPPED TRANSMITTING.`);
        }
        if (typeof Navigation.recallPatrolFrom === "function") Navigation.recallPatrolFrom(sig);
      }
    }

    if (ship.nextSignalAt == null) {
      ship.nextSignalAt = now + this.MIN_GAP + Math.random() * (this.MAX_GAP - this.MIN_GAP);
      return;
    }
    if (now < ship.nextSignalAt) return;

    ship.nextSignalAt = now + this.MIN_GAP + Math.random() * (this.MAX_GAP - this.MIN_GAP);
    if (this.activeHere().length >= this.MAX_LIVE) return;

    this.spawn();
  },

  /** Mark a call answered so it stops being offered and stops being tracked. */
  resolve(id) {
    const list = this.live();
    const idx = list.findIndex(s => s.id === id);
    if (idx < 0) return false;
    const sig = list[idx];
    sig.active = false;
    list.splice(idx, 1);
    if (typeof Navigation.recallPatrolFrom === "function") Navigation.recallPatrolFrom(sig);
    return true;
  }
};

window.DistressNet = DistressNet;
