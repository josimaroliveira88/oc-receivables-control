import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // The OpenAPI spec is built at import time by swagger-jsdoc, which globs
      // and parses every route file — roughly 170 ms paid by each test file
      // that imports the app. No test exercises /api/docs, so swap it for a
      // stub and skip that cost.
      {
        find: /^\.\/docs\/swagger\.js$/,
        replacement: path.resolve(__dirname, 'tests/stubs/swagger.js'),
      },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    fileParallelism: false,
  },
});
