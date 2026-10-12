/**
 * Integration test for the Uber floating box (`src/ui/content.js`): pressing
 * "Enviar para o Controle de Recebíveis" must close with the feedback panel
 * showing what the backend did, and must not ask for a new tab.
 *
 * The pure wording is covered by `uberUiSummary.test.js`; this file guards the
 * wiring the summary needs to be visible at all — the panel markup, the
 * `data-role` lookups and the button flow. A typo there would leave the user
 * with a silent import, so the assertions go through the real DOM.
 */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BOX_ID = 'captures-box';

// --- Extension API stub ------------------------------------------------------

const storageData = {
  'captures:api-token': 'cr_abcdef012345',
  'captures:server-url': 'http://localhost:4000',
};

let sendMessageHandler = null;

globalThis.chrome = {
  runtime: {
    lastError: null,
    onMessage: { addListener: () => {} },
    sendMessage: (message, callback) => {
      callback(sendMessageHandler(message));
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
      set: (values, callback) => {
        Object.assign(storageData, values);
        callback?.();
      },
    },
  },
};

// --- MAIN-world bridge stub --------------------------------------------------

// jsdom's `window.postMessage` delivers `event.source === null`, while the
// content script only accepts events whose source is the page window. The stub
// therefore dispatches a real `MessageEvent` instead of postMessage.
const answerPage = (data) => {
  window.dispatchEvent(new MessageEvent('message', { data, source: window }));
};

window.addEventListener('message', (event) => {
  const data = event.data;
  if (data?.source !== 'captures:bridge' || data.dir !== 'ui-to-page') return;

  if (data.type === 'GET_STATUS') {
    answerPage({
      source: 'captures:bridge',
      dir: 'page-to-ui',
      type: 'STATUS',
      requestId: data.requestId,
      hasSession: true,
    });
    return;
  }

  if (data.type === 'CAPTURE') {
    answerPage({
      source: 'captures:bridge',
      dir: 'page-to-ui',
      type: 'CAPTURE_RESULT',
      requestId: data.requestId,
      ok: true,
      json: '{"activities":[]}',
    });
  }
});

const scriptUrl = pathToFileURL(
  path.resolve(__dirname, '../src/ui/content.js'),
).href;
await import(scriptUrl);

// --- Helpers -----------------------------------------------------------------

const waitFor = async (predicate, label, timeoutMs = 3000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timeout waiting for ${label}`);
};

const box = () => document.getElementById(BOX_ID);

const resultPanel = () => box().querySelector('[data-role="result"]');

const panelLines = () =>
  [...resultPanel().querySelectorAll('[data-role="result-list"] li')].map(
    (item) => item.textContent,
  );

const pressSend = async () => {
  const sendButton = box().querySelector('[data-role="send"]');
  await waitFor(
    () => sendButton.disabled === false,
    'the send button to be enabled',
  );
  sendButton.click();
};

describe('Uber box · import feedback', () => {
  beforeEach(() => {
    sendMessageHandler = () => ({ ok: true, summary: {} });
  });

  it('mounts the box with a hidden feedback panel', async () => {
    await waitFor(() => box(), 'the floating box');

    expect(box()).not.toBeNull();
    expect(resultPanel().style.display).toBe('none');
    expect(resultPanel().querySelector('[data-role="result-list"]')).not.toBe(
      null,
    );
  });

  it('shows the import summary instead of opening the app', async () => {
    await waitFor(() => box(), 'the floating box');

    sendMessageHandler = () => ({
      ok: true,
      summary: {
        total: 12,
        created: 8,
        updated: 4,
        cancelled: 1,
        warnings: [],
      },
    });

    await pressSend();

    await waitFor(
      () => resultPanel().style.display === 'block',
      'the feedback panel to appear',
    );

    const statusEl = box().querySelector('[data-role="status"]');
    expect(statusEl.textContent).toBe('Corridas importadas.');
    expect(statusEl.dataset.kind).toBe('success');

    expect(panelLines()).toEqual([
      expect.stringContaining('12 corrida(s) importada(s)'),
      '8 nova(s) e 4 atualizada(s).',
      '1 cancelada(s), marcada(s) como tal no app.',
    ]);
    expect(
      resultPanel().querySelector('[data-role="result-hint"]').textContent,
    ).toBe('Consulte as corridas em Finanças › Corridas.');
    expect([statusEl.textContent, ...panelLines()].join(' ')).not.toMatch(
      /abrin|nova aba/i,
    );

    // The button returns to its idle label so the next run can start.
    const sendButton = box().querySelector('[data-role="send"]');
    await waitFor(
      () => sendButton.disabled === false,
      'the send button to be re-enabled',
    );
    expect(sendButton.textContent).toBe('Enviar para o Controle de Recebíveis');
  });

  it('reports an empty period and clears the previous result on the next run', async () => {
    await waitFor(() => box(), 'the floating box');

    sendMessageHandler = () => ({
      ok: true,
      summary: { total: 1, created: 1, updated: 0, cancelled: 0, warnings: [] },
    });
    await pressSend();
    await waitFor(
      () => resultPanel().style.display === 'block',
      'the first feedback panel',
    );

    sendMessageHandler = () => ({
      ok: true,
      summary: { total: 0, created: 0, updated: 0, cancelled: 0, warnings: [] },
    });
    await pressSend();
    await waitFor(
      () =>
        box().querySelector('[data-role="status"]').textContent ===
        'Nenhuma corrida importada.',
      'the empty-period feedback',
    );

    expect(box().querySelector('[data-role="status"]').dataset.kind).toBe(
      'warning',
    );
    expect(panelLines()).toEqual([
      expect.stringContaining('não retornou corrida válida'),
    ]);
  });
});
