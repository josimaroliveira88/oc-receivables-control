/**
 * MV3 service worker (single self-contained file).
 *
 * Owns the operations that cannot happen in the isolated content scripts:
 * the Uber import POST, the dōTERRA lookup/import POSTs (an extension-context
 * fetch is covered by the host permissions, so the backend never sees CORS)
 * and the new-tab navigation (chrome.tabs lives in the extension context).
 *
 * The token and the server URL live in `chrome.storage.local`; this worker
 * reads them itself so the content scripts never handle credentials.
 */
(() => {
  'use strict';

  const VERSION = '0.6.0';
  const BUILD_LABEL = 'doterra-orders';

  console.info(`[Captures background] v${VERSION} (${BUILD_LABEL}) carregado`);

  const STORAGE_KEYS = {
    TOKEN: 'uber-rides:api-token',
    SERVER: 'uber-rides:server-url',
  };
  const DEFAULT_SERVER = 'http://localhost:3000';

  const getStored = async (key) => {
    if (!chrome?.storage?.local) return null;
    try {
      return await new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(result[key] ?? null);
        });
      });
    } catch (_err) {
      return null;
    }
  };

  const normalizeBase = (value) =>
    (value ?? '').replace(/\/+$/, '') || DEFAULT_SERVER;

  // Shared POST helper: reads the token/server, maps auth and HTTP failures
  // into stable error codes for the content scripts.
  const postWithToken = async (path, body) => {
    const token = await getStored(STORAGE_KEYS.TOKEN);
    if (!token) return { ok: false, error: 'NO_TOKEN' };

    const base = normalizeBase(await getStored(STORAGE_KEYS.SERVER));

    let response;
    try {
      response = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
    } catch (_err) {
      return { ok: false, error: 'NETWORK' };
    }

    let parsed = null;
    try {
      parsed = await response.json();
    } catch (_err) {
      /* non-JSON error body */
    }

    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: 'AUTH', message: parsed?.error };
    }
    if (!response.ok) {
      return {
        ok: false,
        error: 'HTTP',
        status: response.status,
        message: parsed?.error,
      };
    }

    return { ok: true, data: parsed, base };
  };

  const sendToApp = async ({ json, windowStart, windowEnd }) => {
    const result = await postWithToken('/api/uber/rides/import', {
      source: 'UBER_SESSION',
      json,
      windowStart,
      windowEnd,
    });
    if (!result.ok) return result;

    // The first tab of the app opens with the freshly imported rides already
    // listed (Finances loads the rides when it mounts).
    await chrome.tabs.create({ url: `${result.base}/finances` });
    return { ok: true, summary: result.data };
  };

  const lookupDoterra = async ({ numbers }) => {
    const result = await postWithToken('/api/doterra/orders/lookup', {
      numbers,
    });
    if (!result.ok) return result;
    return { ok: true, data: result.data };
  };

  const sendDoterra = async ({ payload }) => {
    const result = await postWithToken('/api/doterra/orders/import', payload);
    if (!result.ok) return result;

    // The orders list opens with the newly imported pending-review orders.
    await chrome.tabs.create({ url: `${result.base}/orders` });
    return { ok: true, summary: result.data };
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message.type !== 'string') return false;

    if (message.type === 'SEND_TO_APP') {
      sendToApp(message).then(sendResponse);
      return true;
    }
    if (message.type === 'DOTERRA_LOOKUP') {
      lookupDoterra(message).then(sendResponse);
      return true;
    }
    if (message.type === 'DOTERRA_SEND_TO_APP') {
      sendDoterra(message).then(sendResponse);
      return true;
    }

    return false;
  });
})();
