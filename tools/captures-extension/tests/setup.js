// Both content scripts are self-contained IIFEs (no module exports), so tests
// load them into the jsdom environment via `require` and reach their pure
// helpers through the escape hatches installed at the bottom of each file:
// `globalThis.__DOTERRA_PARSERS__` (`src/doterra/content.js`) and
// `globalThis.__UBER_UI__` (`src/ui/content.js`). The sentinels must be set
// BEFORE the scripts run so each IIFE picks them up.

globalThis.__DOTERRA_PARSERS__ = {};
globalThis.__UBER_UI__ = {};

if (typeof window !== 'undefined' && window.navigator) {
  // jsdom ships without a clipboard implementation; the content script only
  // touches it inside `copyFlow`/`copyToClipboard`, which the parsers under
  // test never reach. Leaving the default error-throwing `clipboard` keeps
  // test failures loud if the helpers ever call it.
}
