/**
 * Tests for the MV3 service worker (`src/background/background.js`).
 *
 * The worker is a self-contained script with no module exports, so the tests
 * stub the `chrome` APIs it touches, load the file for its side effects and
 * then drive the `chrome.runtime.onMessage` listener it registered.
 *
 * The behaviour guarded here: **no import flow opens the app in a new tab**.
 * The worker used to call `chrome.tabs.create` on `SEND_TO_APP` and
 * `DOTERRA_SEND_TO_APP`; the floating boxes now render their own feedback from
 * the server summary, so a stray tab creation would be a visible regression
 * (a window popping up in the middle of a capture). These tests also pin the
 * request contract the content scripts depend on: the stored token/server are
 * read by the worker and the parsed server payload is returned untouched.
 */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Minimal `chrome` stub ----------------------------------------------------

const listeners = [];
const createdTabs = [];

const storageData = {
  'captures:api-token': 'cr_abcdef012345',
  'captures:server-url': 'http://localhost:4000',
};

globalThis.chrome = {
  runtime: {
    lastError: null,
    onMessage: {
      addListener: (listener) => listeners.push(listener),
    },
  },
  storage: {
    local: {
      get: (keys, callback) => {
        const result = {};
        keys.forEach((key) => {
          result[key] = storageData[key] ?? null;
        });
        callback(result);
      },
    },
  },
  tabs: {
    create: (options) => {
      createdTabs.push(options);
      return Promise.resolve({ id: createdTabs.length });
    },
  },
};

// --- Minimal `fetch` stub ----------------------------------------------------

const requests = [];
let nextResponse = null;

globalThis.fetch = async (url, options) => {
  requests.push({
    url,
    headers: options.headers,
    method: options.method,
    body: JSON.parse(options.body),
  });
  return nextResponse;
};

const jsonResponse = (status, payload) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
});

// --- Load the worker ---------------------------------------------------------

const scriptUrl = pathToFileURL(
  path.resolve(__dirname, '../src/background/background.js'),
).href;
await import(scriptUrl);

const listener = listeners[0];

if (!listener) {
  throw new Error(
    'background.js did not register a chrome.runtime.onMessage listener.',
  );
}

const sendMessage = (message) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`no response for ${message.type}`)),
      2000,
    );
    const handled = listener(message, { id: 1 }, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
    if (handled !== true) {
      clearTimeout(timer);
      reject(new Error(`${message.type} was not handled asynchronously`));
    }
  });

// --- Tests -------------------------------------------------------------------

beforeEach(() => {
  createdTabs.length = 0;
  requests.length = 0;
  nextResponse = jsonResponse(200, {});
  storageData['captures:api-token'] = 'cr_abcdef012345';
});

describe('background · Uber import', () => {
  it('posts the capture and returns the server summary without opening a tab', async () => {
    const summary = {
      batchId: 'batch-1',
      total: 3,
      created: 2,
      updated: 1,
      cancelled: 0,
      warnings: [],
    };
    nextResponse = jsonResponse(200, summary);

    const response = await sendMessage({
      type: 'SEND_TO_APP',
      json: '{"activities":[]}',
      windowStart: '2026-09-01T03:00:00.000Z',
      windowEnd: '2026-09-30T02:59:59.999Z',
    });

    expect(response.ok).toBe(true);
    expect(response.summary).toEqual(summary);
    expect(createdTabs).toEqual([]);

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe('http://localhost:4000/api/uber/rides/import');
    expect(requests[0].method).toBe('POST');
    expect(requests[0].headers.Authorization).toBe('Bearer cr_abcdef012345');
    expect(requests[0].body).toEqual({
      source: 'UBER_SESSION',
      json: '{"activities":[]}',
      windowStart: '2026-09-01T03:00:00.000Z',
      windowEnd: '2026-09-30T02:59:59.999Z',
    });
  });

  it('reports a missing token without opening a tab', async () => {
    delete storageData['captures:api-token'];

    const response = await sendMessage({ type: 'SEND_TO_APP', json: '{}' });

    expect(response).toMatchObject({ ok: false, error: 'NO_TOKEN' });
    expect(createdTabs).toEqual([]);
    expect(requests).toEqual([]);
  });
});

describe('background · dōTERRA import', () => {
  it('returns the import summary without opening a tab', async () => {
    const summary = {
      created: [{ orderNumber: '1234', id: 'o1', warnings: [] }],
      existing: ['1200'],
      failed: [],
      createdProducts: [{ code: '12345678', name: 'Óleo essential' }],
    };
    nextResponse = jsonResponse(200, summary);

    const response = await sendMessage({
      type: 'DOTERRA_SEND_TO_APP',
      payload: { orders: [{ orderNumber: '1234' }] },
    });

    expect(response.ok).toBe(true);
    expect(response.summary).toEqual(summary);
    expect(createdTabs).toEqual([]);

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(
      'http://localhost:4000/api/doterra/orders/import',
    );
    expect(requests[0].body).toEqual({ orders: [{ orderNumber: '1234' }] });
  });

  it('surfaces an expired token as AUTH without opening a tab', async () => {
    nextResponse = jsonResponse(401, { error: 'Token expirado' });

    const response = await sendMessage({
      type: 'DOTERRA_SEND_TO_APP',
      payload: { orders: [] },
    });

    expect(response).toMatchObject({ ok: false, error: 'AUTH' });
    expect(createdTabs).toEqual([]);
  });
});

describe('background · dōTERRA lookup', () => {
  it('returns the missing/existing split without opening a tab', async () => {
    nextResponse = jsonResponse(200, { missing: ['1234'], existing: ['1200'] });

    const response = await sendMessage({
      type: 'DOTERRA_LOOKUP',
      numbers: ['1234', '1200'],
    });

    expect(response).toEqual({
      ok: true,
      data: { missing: ['1234'], existing: ['1200'] },
    });
    expect(createdTabs).toEqual([]);
    expect(requests[0].url).toBe(
      'http://localhost:4000/api/doterra/orders/lookup',
    );
    expect(requests[0].body).toEqual({ numbers: ['1234', '1200'] });
  });
});

describe('background · dōTERRA account owner fill', () => {
  it('posts the updates and returns the summary without opening a tab', async () => {
    nextResponse = jsonResponse(200, {
      updated: [{ orderNumber: '1234', accountOwner: '15837743' }],
      unchanged: ['1200'],
      notFound: [],
      failed: [],
    });

    const response = await sendMessage({
      type: 'DOTERRA_FILL_ACCOUNT_OWNER',
      updates: [{ orderNumber: '1234', accountOwner: '15837743' }],
    });

    expect(response).toEqual({
      ok: true,
      summary: {
        updated: [{ orderNumber: '1234', accountOwner: '15837743' }],
        unchanged: ['1200'],
        notFound: [],
        failed: [],
      },
    });
    expect(createdTabs).toEqual([]);
    expect(requests[0].url).toBe(
      'http://localhost:4000/api/doterra/orders/fill-account-owner',
    );
    expect(requests[0].body).toEqual({
      updates: [{ orderNumber: '1234', accountOwner: '15837743' }],
    });
  });

  it('surfaces an expired token as AUTH without opening a tab', async () => {
    nextResponse = jsonResponse(401, { error: 'Token inválido ou expirado' });

    const response = await sendMessage({
      type: 'DOTERRA_FILL_ACCOUNT_OWNER',
      updates: [{ orderNumber: '1234', accountOwner: '15837743' }],
    });

    expect(response).toMatchObject({ ok: false, error: 'AUTH' });
    expect(createdTabs).toEqual([]);
  });
});
