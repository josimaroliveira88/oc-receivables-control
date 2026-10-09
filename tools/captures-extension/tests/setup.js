// The content script is a self-contained IIFE (no module exports), so tests
// load it into the jsdom environment via `require` and reach the parsers
// through the `globalThis.__DOTERRA_PARSERS__` escape hatch installed at the
// bottom of `src/doterra/content.js`. The sentinel must be set BEFORE the
// script runs so the IIFE picks it up.

globalThis.__DOTERRA_PARSERS__ = {};

if (typeof window !== 'undefined' && window.navigator) {
  // jsdom ships without a clipboard implementation; the content script only
  // touches it inside `copyFlow`/`copyToClipboard`, which the parsers under
  // test never reach. Leaving the default error-throwing `clipboard` keeps
  // test failures loud if the helpers ever call it.
}
