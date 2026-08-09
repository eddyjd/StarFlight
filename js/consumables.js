/**
 * Consumables for StarFlight: Odyssey
 *
 * One-use equipment. The point of these is to give credits somewhere to go that
 * is not another permanent upgrade, and to hand the captain a way out of a
 * situation that would otherwise be a reload - a dry reactor a long way from
 * anywhere, a hull that will not survive the trip home, a fold you would rather
 * choose than find.
 *
 * They are priced to be found more often than bought. Buying one should feel
 * like a decision, not a purchase.
 *
 * Items live in ship.consumables as { id: count } so the existing save path
 * carries them for free.
 */

const Consumables = {

  all() {
    return (typeof GameData !== "undefined" && GameData.consumables) || {};
  },

  get(id) {
    return this.all()[id] || null;
  },

  held() {
    const ship = window.game && window.game.ship;
    if (!ship) return {};
    if (!ship.consumables) ship.consumables = {};
    return ship.consumables;
  },

  count(id) {
    return this.held()[id] || 0;
  },

  grant(id, n) {
    const item = this.get(id);
    if (!item) return false;
    const held = this.held();
    held[id] = (held[id] || 0) + (n || 1);
    return true;
  },

  consume(id) {
    const held = this.held();
    if (!held[id]) return false;
    held[id]--;
    if (held[id] <= 0) delete held[id];
    return true;
  },

  /** Anything the captain is carrying, as records rather than bare ids. */
  inventory() {
    const held = this.held();
    return Object.keys(held).map(id => ({ item: this.get(id), count: held[id] })).filter(r => r.item);
  },

  /**
   * Can this be used right now? Returns null when it can, or a reason when it
   * cannot - checked before the item is spent, never after.
   */
  blockedReason(item) {
    const game = window.game;
    const ship = game.ship;
    if (!item) return "No such item.";
    if (item.where === "space" && (game.viewState !== "navigation" || game.spaceState !== "hyper")) {
      return "This can only be used in hyperspace flight.";
    }
    if (item.where === "docked" && !ship.isInSpacebase) return "This can only be used while docked.";
    if (item.where === "any" && ship.isInSpacebase && item.effect === "repair") {
      return "The dock repairs the hull for nothing. Save it.";
    }
    const eff = this.EFFECTS[item.effect];
    return (eff && eff.blocked) ? eff.blocked(ship) : null;
  },

  /** Spend one. The effect handler runs first and may decline. */
  use(id) {
    const item = this.get(id);
    if (!item) return false;
    if (this.count(id) <= 0) {
      UI.addLog(`NONE ABOARD: ${item.name.toUpperCase()}.`);
      return false;
    }

    const blocked = this.blockedReason(item);
    if (blocked) {
      UI.addLog(`CANNOT USE ${item.name.toUpperCase()}: ${blocked.toUpperCase()}`);
      if (typeof AudioController !== "undefined" && AudioController.playBeep) AudioController.playBeep("error");
      return false;
    }

    const eff = this.EFFECTS[item.effect];
    if (!eff || typeof eff.run !== "function") {
      UI.addLog(`${item.name.toUpperCase()} FAILED: NO EFFECT WIRED.`);
      return false;
    }

    // A handler may decline after inspecting state (a cancelled fold, say) - the
    // item is only spent once it has actually done something.
    if (eff.run(window.game.ship, item) === false) return false;

    this.consume(id);
    if (typeof AudioController !== "undefined" && AudioController.playBeep) AudioController.playBeep("powerup");
    UI.updateShip(window.game.ship);
    window.game.saveGame();
    return true;
  },

  // ---- effects -----------------------------------------------------------
  EFFECTS: {
    refuel: {
      blocked: (ship) => (ship.fuel >= ship.maxFuel) ? "The tank is already full." : null,
      run: (ship) => {
        const before = ship.fuel;
        ship.fuel = Math.min(ship.maxFuel, ship.fuel + 40);
        UI.addLog(`EMERGENCY CELLS BROKEN OPEN. REACTOR MASS ${Math.floor(before)} → ${Math.floor(ship.fuel)}.`);
      }
    },

    repair: {
      blocked: (ship) => (ship.hull >= ship.maxHull) ? "The hull is already sound." : null,
      run: (ship) => {
        const before = ship.hull;
        ship.hull = Math.min(ship.maxHull, ship.hull + 60);
        UI.addLog(`HULL PATCHED IN THE FIELD. INTEGRITY ${Math.round(before)} → ${Math.round(ship.hull)}.`);
      }
    },

    shields: {
      blocked: (ship) => {
        if (!ship.shieldLevel || ship.shieldLevel <= 0) return "No deflector matrix fitted.";
        if (ship.shieldsCharge >= ship.maxShields) return "The capacitors are already full.";
        return null;
      },
      run: (ship) => {
        ship.shieldsCharge = ship.maxShields;
        UI.addLog(`DEFLECTOR OVERCHARGE DUMPED. SHIELDS AT ${ship.maxShields}.`);
      }
    },

    survey: {
      run: (ship) => {
        const charted = Navigation.revealSectorsWithin(160);
        const found = [];
        RegionManager.content("starSystems").forEach(sys => {
          if (Math.hypot(Navigation.shipX - sys.x, Navigation.shipY - sys.y) > 160) return;
          if (!ship.discoveredSystems[sys.name]) { ship.discoveredSystems[sys.name] = true; found.push(sys.name); }
        });
        Navigation.getDeepSpaceContacts().forEach(c => {
          if (Math.hypot(Navigation.shipX - c.x, Navigation.shipY - c.y) <= 160) Navigation.markContact(c.id, 1);
        });
        UI.addLog(`SURVEY DRONE AWAY. ${charted} SECTORS CHARTED WITHIN 160 LY.`);
        if (found.length) UI.addLog(`NEW SYSTEMS LOGGED: ${found.join(", ").toUpperCase()}.`);
        UI.addLog("THE DRONE DOES NOT COME BACK. THEY NEVER DO.");
      }
    },

    cloak: {
      run: (ship) => {
        Navigation.ghostUntil = (ship.playClock || 0) + 120;
        UI.addLog("GHOST BAFFLE ACTIVE. NOTHING IS LOOKING AT THIS SHIP FOR THE NEXT TWO MINUTES.");
      }
    },

    fold: {
      run: (ship) => {
        // A fold charge is worth more when aimed, so offer the choice - but a
        // captain who has charted nothing can still fire it blind.
        const targets = RegionManager.content("starSystems")
          .filter(sys => ship.discoveredSystems[sys.name])
          .map(sys => ({ name: sys.name, x: sys.x, y: sys.y }));

        const aimed = targets.length > 0 &&
          confirm("PRECURSOR FOLD CHARGE\n\n" +
                  "Aim the fold at a charted system?\n\n" +
                  "OK  - choose a destination from the chart\n" +
                  "Cancel - fire it blind and take what it opens onto");

        if (aimed) {
          // Hand off to the star map: the next click sets the fold's far end.
          Navigation.foldPicking = true;
          Navigation.openStarMapModal();
          UI.addLog("FOLD CHARGE ARMED. CLICK A CHARTED SYSTEM ON THE CHART TO SET THE FAR END.");
          UI.addLog("CLOSE THE CHART WITHOUT CLICKING TO STAND DOWN - THE CHARGE IS NOT SPENT UNTIL IT FIRES.");
          return false;   // spent by Navigation.fireFoldCharge(), not here
        }

        // Blind fire: somewhere genuinely elsewhere, not next door
        let x, y, tries = 0;
        do {
          x = 30 + Math.random() * 440;
          y = 30 + Math.random() * 440;
          tries++;
        } while (Math.hypot(x - Navigation.shipX, y - Navigation.shipY) < 120 && tries < 60);

        Navigation.executeFold(x, y, null);
      }
    }
  }
};

window.Consumables = Consumables;
