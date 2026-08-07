/**
 * RegionManager for StarFlight: Odyssey
 *
 * Regions are separate volumes of space. The core quadrant is the galaxy the game
 * has always had; further regions (js/content/regions.js) are reached only by
 * falling into a singularity, and each keeps its own systems, hazards and
 * exploration record.
 *
 * The awkward part is state. Five fields - exploredSectors, discoveredSystems,
 * contactLog, salvagedIds, traversedLinks - describe what the captain knows about
 * a PLACE, so they cannot stay global once there is more than one place. They are
 * now stored per region under ship.regions[id], with the live fields on `ship`
 * acting as the working copy for whichever region is active. Old saves are
 * migrated by adopting their flat fields as the core region's record.
 */

const RegionManager = {

  // Fields that describe knowledge of a place rather than the ship itself
  SCOPED: ["exploredSectors", "discoveredSystems", "contactLog", "salvagedIds", "traversedLinks"],

  all() {
    return (typeof GameData !== "undefined" && GameData.regions) || {};
  },

  get(id) {
    return this.all()[id] || null;
  },

  currentId() {
    const ship = window.game && window.game.ship;
    return (ship && ship.region) || "core";
  },

  current() {
    return this.get(this.currentId()) || this.get("core");
  },

  isCore() {
    return this.currentId() === "core";
  },

  /**
   * Adopt an old save. Its flat exploration fields describe the core quadrant, so
   * they become core's record verbatim - nothing is lost and nothing is invented.
   */
  migrate(ship) {
    if (!ship) return;
    if (!ship.region) ship.region = "core";
    if (!ship.regions) ship.regions = {};
    if (!ship.regions.core) {
      const core = {};
      this.SCOPED.forEach(f => { core[f] = ship[f] || (f === "exploredSectors" ? { "250_250": true } : {}); });
      ship.regions.core = core;
    }
    // Ensure every authored region has a record, so switching never hits undefined
    Object.keys(this.all()).forEach(id => {
      if (!ship.regions[id]) {
        const blank = {};
        this.SCOPED.forEach(f => { blank[f] = {}; });
        ship.regions[id] = blank;
      }
    });
  },

  /** Copy the live working fields back into the region they belong to. */
  stash(ship, regionId) {
    if (!ship || !ship.regions || !ship.regions[regionId]) return;
    this.SCOPED.forEach(f => { ship.regions[regionId][f] = ship[f] || {}; });
  },

  /** Make a region's record the live working set. */
  restore(ship, regionId) {
    if (!ship || !ship.regions || !ship.regions[regionId]) return;
    this.SCOPED.forEach(f => { ship[f] = ship.regions[regionId][f] || {}; });
  },

  /**
   * Everything in the active region, merged from GameData. The core quadrant's
   * content lives at the top level of GameData for backwards compatibility; other
   * regions carry their own arrays.
   */
  content(kind) {
    const id = this.currentId();
    if (id === "core") return GameData[kind] || [];
    const region = this.get(id);
    return (region && region[kind]) || [];
  },

  /**
   * Move the ship to another region. Called when a singularity is entered, which
   * is the only way across.
   */
  travelTo(regionId, arrivalX, arrivalY) {
    const game = window.game;
    const ship = game.ship;
    const target = this.get(regionId);
    if (!target) { console.warn("RegionManager: unknown region", regionId); return false; }

    const from = this.currentId();
    if (from === regionId) return false;

    this.migrate(ship);
    this.stash(ship, from);
    ship.region = regionId;
    if (!ship.visitedRegions) ship.visitedRegions = { core: true };
    ship.visitedRegions[regionId] = true;
    this.mapView = regionId;         // follow the ship by default
    this.restore(ship, regionId);

    const ax = (typeof arrivalX === "number") ? arrivalX : ((target.arrival && target.arrival.x) || 250);
    const ay = (typeof arrivalY === "number") ? arrivalY : ((target.arrival && target.arrival.y) || 250);

    Navigation.resetPhysics(ax, ay);
    ship.coordinates.x = ax;
    ship.coordinates.y = ay;
    ship.currentSystem = null;
    ship.currentPlanet = null;
    game.spaceState = "hyper";

    // The in-memory GameData flags belong to the region we just left
    if (typeof game.applySalvageState === "function") game.applySalvageState();
    Navigation.activePatrols = null;
    Navigation.lastSectorKey = null;
    Navigation.generateBackground();

    UI.addLog(`=== TRANSITED TO ${String(target.name).toUpperCase()} ===`);
    if (target.blurb) UI.addLog(target.blurb);
    if (target.danger) UI.addLog(`ADVISORY: ${target.danger.toUpperCase()}`);
    if (typeof QuestEngine !== "undefined") QuestEngine.notify("region", { region: regionId });

    game.saveGame();
    return true;
  },

  /** Regions the captain has actually set foot in - used by the star map selector. */
  visited() {
    const ship = window.game && window.game.ship;
    if (!ship) return ["core"];
    if (!ship.visitedRegions) ship.visitedRegions = { core: true };
    ship.visitedRegions[ship.region || "core"] = true;
    return Object.keys(this.all()).filter(id => ship.visitedRegions[id]);
  },

  /**
   * Which region the star map is currently DISPLAYING. Defaults to where the ship
   * is, but a captain may review any region already visited - the charts do not
   * evaporate because you flew home.
   */
  viewedId() {
    return this.mapView || this.currentId();
  },

  setViewed(id) {
    if (!this.get(id)) return;
    this.mapView = id;
  },

  /** Content for whichever region the MAP is showing, not where the ship is. */
  viewedContent(kind) {
    const id = this.viewedId();
    if (id === "core") return GameData[kind] || [];
    const region = this.get(id);
    return (region && region[kind]) || [];
  },

  /** The exploration record for the region being viewed. */
  viewedRecord() {
    const ship = window.game && window.game.ship;
    const id = this.viewedId();
    if (!ship) return {};
    if (id === this.currentId()) return ship;             // live working copy
    return (ship.regions && ship.regions[id]) || {};
  },

  /** Star systems visible from the active region - used by nav and the star map. */
  systems() {
    return this.content("starSystems");
  }
};

/**
 * Regions declare their own quest objective type rather than the engine growing a
 * branch for them. This is the extension point QuestEngine.registerObjective()
 * exists for: the module that owns a concept teaches the quest system about it.
 *
 * Caught by the Phase 6 acceptance test - Phase 5 added a whole new volume of
 * space and never made it addressable from a quest.
 */
if (typeof QuestEngine !== "undefined") {
  QuestEngine.registerObjective("visit_region", function (obj, payload, ship) {
    // State-based, so it also resolves for a captain already standing there
    return (ship.region || "core") === obj.region;
  });
}

window.RegionManager = RegionManager;
