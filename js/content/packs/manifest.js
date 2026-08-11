/**
 * Content pack manifest.
 *
 * fetch() and XHR do not work from file:// - no CORS origin - so a folder cannot
 * be scanned. This list is how the loader knows what to inject, which is why the
 * manifest is a .js file rather than .json.
 *
 * To install a pack an AI has written for you:
 *   1. save it as js/content/packs/<name>.js
 *   2. add "<name>.js" to the list below
 *   3. reload
 *
 * A pack that fails validation is rejected with a readable report and the game
 * boots without it - see js/packs.js. Packs pasted through the in-game importer
 * do not appear here; they live in localStorage.
 */

window.ContentPackManifest = [
  // "my-quadrant.js",
];
