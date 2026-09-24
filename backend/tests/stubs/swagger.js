// Test-only stub for `src/docs/swagger.js` (wired via `vitest.config.js`).
//
// The real module builds the OpenAPI spec at import time with swagger-jsdoc,
// which globs and parses every route file on each import — roughly 170 ms paid
// by every test file that imports the app. No test exercises `/api/docs`, so
// this stub keeps the route mountable while skipping that cost.
export default {
  openapi: '3.0.3',
  info: { title: 'Receivables Control API (test stub)', version: '0.0.0' },
  paths: {},
};
