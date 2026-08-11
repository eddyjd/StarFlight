/**
 * CloudSync for StarFlight: Odyssey
 *
 * Optional. The game is a zero-dependency browser app that runs off file:// with
 * no network at all, and that stays true: with no server configured this module
 * does nothing, touches nothing, and never appears. localStorage remains the
 * source of truth in every case, including a sync that fails halfway.
 *
 * WHY file:// CAN TALK TO A SERVER AT ALL
 * The restriction everyone remembers - "fetch does not work on file://" - is
 * about fetching local FILES. Calling an HTTP API is fine; the page just sends
 * "Origin: null" and the server allows it. Measured before this was written:
 * preflight passes with an Authorization header and a full save round-trips.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * It does not merge. Two divergent saves cannot be reconciled field by field
 * without inventing a state nobody played, so a conflict is shown to the captain
 * with both sides described and the choice is theirs. Nothing is overwritten
 * without being asked, and the server keeps every revision either way.
 */

const CloudSync = {

  STORE_KEY: "starflight_cloud",

  // Long enough for a cold server, short enough that nobody thinks it hung.
  TIMEOUT_MS: 8000,

  state: null,        // { url, key, device, lastRevision, lastSyncUtc }
  busy: false,
  lastConflict: null, // held while the captain decides

  // ---- settings ----------------------------------------------------------
  //
  // Deliberately NOT part of the save. A captain key and a server address belong
  // to the device, not to the voyage - putting them in `ship` would export them
  // inside every save file the player shares.

  load() {
    if (this.state) return this.state;
    let s = null;
    try { s = JSON.parse(localStorage.getItem(this.STORE_KEY) || "null"); } catch (e) { s = null; }
    this.state = Object.assign({
      url: "", key: "", device: this.defaultDeviceName(),
      lastRevision: 0, lastSyncUtc: "", autoPush: false
    }, s || {});
    return this.state;
  },

  save() {
    try { localStorage.setItem(this.STORE_KEY, JSON.stringify(this.load())); return true; }
    catch (e) { console.warn("CloudSync: could not persist settings", e); return false; }
  },

  defaultDeviceName() {
    const ua = (navigator.userAgent || "");
    if (/Windows/i.test(ua)) return "Windows";
    if (/Macintosh|Mac OS/i.test(ua)) return "Mac";
    if (/Android/i.test(ua)) return "Android";
    if (/iPhone|iPad/i.test(ua)) return "iOS";
    if (/Linux/i.test(ua)) return "Linux";
    return "Unknown device";
  },

  /** Is there anywhere to sync to? Everything else short-circuits on this. */
  configured() {
    const s = this.load();
    return !!(s.url && s.key);
  },

  endpoint(path) {
    const base = String(this.load().url || "").replace(/\/+$/, "");
    return base + path;
  },

  // ---- transport ---------------------------------------------------------

  /**
   * One request. Never throws: every caller gets { ok, status, body, error } so
   * a dead server is a message in the log rather than an exception somewhere in
   * the middle of a save.
   */
  async call(path, options) {
    const opts = options || {};
    const controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), this.TIMEOUT_MS) : null;
    try {
      const headers = Object.assign({}, opts.headers || {});
      if (this.load().key) headers["Authorization"] = "Bearer " + this.load().key;
      if (opts.body) headers["Content-Type"] = "application/json";

      const res = await fetch(this.endpoint(path), {
        method: opts.method || "GET",
        headers: headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: controller ? controller.signal : undefined
      });

      let body = null;
      try { body = await res.json(); } catch (e) { body = null; }
      return { ok: res.ok, status: res.status, body: body, error: null };
    } catch (e) {
      // "Failed to fetch" is what a browser says for a refused connection, and a
      // relay that is simply switched off is the normal case here, not a fault.
      const aborted = e && (e.name === "AbortError");
      const raw = (e && e.message) || "unreachable";
      const friendly = aborted
        ? "no answer within " + (this.TIMEOUT_MS / 1000) + "s"
        : (/failed to fetch|networkerror|load failed/i.test(raw) ? "relay not answering - is it running?" : raw);
      return { ok: false, status: 0, body: null, error: friendly };
    } finally {
      if (timer) clearTimeout(timer);
    }
  },

  // ---- operations --------------------------------------------------------

  async testConnection() {
    const s = this.load();
    if (!s.url) return { ok: false, message: "No relay address set." };
    const r = await this.call("/api/health");
    if (!r.ok) return { ok: false, message: "No answer from " + s.url + " (" + (r.error || r.status) + ")." };
    return { ok: true, message: "Relay answering: " + ((r.body && r.body.service) || "unknown service") + "." };
  },

  async createKey() {
    const s = this.load();
    if (!s.url) return { ok: false, message: "Set the relay address first." };
    const r = await this.call("/api/captains", { method: "POST" });
    if (!r.ok || !r.body || !r.body.captainKey) {
      return { ok: false, message: "Relay would not issue a key (" + (r.error || r.status) + ")." };
    }
    s.key = r.body.captainKey;
    s.lastRevision = 0;
    s.lastSyncUtc = "";
    this.save();
    return { ok: true, key: r.body.captainKey,
             message: "New captain key issued. Copy it to your other device - it is shown once." };
  },

  /**
   * Send this device's save up.
   *
   * `baseRevision` is the revision this device last saw. If the server has moved
   * past it, another device has played since, and the answer is a conflict rather
   * than a write - see lastConflict.
   */
  async push(force) {
    if (!this.configured()) return { ok: false, message: "Cloud save is not set up." };
    if (this.busy) return { ok: false, message: "A sync is already running." };
    this.busy = true;
    try {
      const s = this.load();
      let raw = null;
      try { raw = localStorage.getItem("starflight_odyssey_save"); } catch (e) { raw = null; }
      if (!raw) return { ok: false, message: "There is no local save to send." };

      let ship;
      try { ship = JSON.parse(raw); }
      catch (e) { return { ok: false, message: "The local save will not parse - refusing to upload it." }; }

      const path = force ? "/api/saves/force" : "/api/saves";
      const r = await this.call(path, {
        method: "PUT",
        body: { baseRevision: s.lastRevision || 0, device: s.device || "unknown", save: ship }
      });

      if (r.status === 409 && r.body) {
        this.lastConflict = r.body;
        return { ok: false, conflict: r.body,
                 message: "The relay holds a newer save from " +
                          String(r.body.serverDevice || "another device").toUpperCase() + "." };
      }
      if (!r.ok) return { ok: false, message: "Upload refused (" + (r.error || r.status) + ")." };

      s.lastRevision = (r.body && r.body.revision) || s.lastRevision;
      s.lastSyncUtc = new Date().toISOString();
      this.lastConflict = null;
      this.save();
      return { ok: true, revision: s.lastRevision,
               message: "SAVE UPLOADED. RELAY REVISION " + s.lastRevision + "." };
    } finally { this.busy = false; }
  },

  /**
   * Bring the relay's save down and adopt it.
   *
   * The local save is written into the history slot first. Pulling is the one
   * operation here that discards something the player has, so it leaves a way
   * back that does not depend on the server being reachable afterwards.
   */
  async pull() {
    if (!this.configured()) return { ok: false, message: "Cloud save is not set up." };
    if (this.busy) return { ok: false, message: "A sync is already running." };
    this.busy = true;
    try {
      const r = await this.call("/api/saves");
      if (!r.ok) return { ok: false, message: "Download refused (" + (r.error || r.status) + ")." };
      if (!r.body || r.body.empty) return { ok: false, message: "The relay is holding no save yet." };

      try {
        const local = localStorage.getItem("starflight_odyssey_save");
        if (local) localStorage.setItem("starflight_odyssey_save_before_pull", local);
      } catch (e) { console.warn("CloudSync: could not stash the local save", e); }

      localStorage.setItem("starflight_odyssey_save", JSON.stringify(r.body.save));
      const s = this.load();
      s.lastRevision = r.body.revision || 0;
      s.lastSyncUtc = new Date().toISOString();
      this.lastConflict = null;
      this.save();

      return { ok: true, revision: s.lastRevision, device: r.body.device,
               message: "SAVE DOWNLOADED FROM " + String(r.body.device || "RELAY").toUpperCase() +
                        " (REVISION " + s.lastRevision + "). RELOADING." };
    } finally { this.busy = false; }
  },

  /** Undo a pull, from local storage alone. */
  restoreBeforePull() {
    let prior = null;
    try { prior = localStorage.getItem("starflight_odyssey_save_before_pull"); } catch (e) { prior = null; }
    if (!prior) return { ok: false, message: "There is no pre-download save to restore." };
    localStorage.setItem("starflight_odyssey_save", prior);
    return { ok: true, message: "THE SAVE FROM BEFORE THE DOWNLOAD IS BACK. RELOADING." };
  },

  async status() {
    if (!this.configured()) return { configured: false };
    const s = this.load();
    const r = await this.call("/api/saves");
    return {
      configured: true,
      reachable: r.ok,
      error: r.error,
      localRevision: s.lastRevision || 0,
      serverRevision: (r.body && r.body.revision) || 0,
      serverDevice: (r.body && r.body.device) || "",
      serverUpdatedUtc: (r.body && r.body.updatedUtc) || "",
      empty: !!(r.body && r.body.empty),
      lastSyncUtc: s.lastSyncUtc || ""
    };
  },

  /**
   * Called after every local save when the captain has switched auto-push on.
   *
   * Failure here is silent by design. This runs on a timer nobody asked to see,
   * and a relay that is off must never interrupt play with an error - the manual
   * screen is where problems get reported.
   */
  async autoPushAfterSave() {
    const s = this.load();
    if (!s.autoPush || !this.configured() || this.busy) return;
    try {
      const r = await this.push(false);
      if (!r.ok && r.conflict && typeof UI !== "undefined" && UI.addLog) {
        UI.addLog("CLOUD RELAY HOLDS A NEWER SAVE. OPEN CLOUD SAVE TO RESOLVE IT.");
      }
    } catch (e) { /* never interrupt play */ }
  }
};

window.CloudSync = CloudSync;
