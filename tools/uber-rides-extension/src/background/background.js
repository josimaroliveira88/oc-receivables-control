/**
 * MV3 service worker (single self-contained file).
 *
 * Owns the two operations that cannot happen in the isolated content script:
 * the import POST (an extension-context fetch is covered by the host
 * permissions, so the backend never sees CORS from this call) and the
 * new-tab navigation (chrome.tabs lives in the extension context).
 *
 * The token and the server URL live in `chrome.storage.local`; this worker
 * reads them itself so the content script never handles credentials.
 */
(() => {
  'use strict';

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

  const sendToApp = async ({ json, windowStart, windowEnd }) => {
    const token = await getStored(STORAGE_KEYS.TOKEN);
    if (!token) return { ok: false, error: 'NO_TOKEN' };

    const base = normalizeBase(await getStored(STORAGE_KEYS.SERVER));

    let response;
    try {
      response = await fetch(`${base}/api/uber/rides/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          source: 'UBER_SESSION',
          json,
          windowStart,
          windowEnd,
        }),
      });
    } catch (_err) {
      return { ok: false, error: 'NETWORK' };
    }

    let body = null;
    try {
      body = await response.json();
    } catch (_err) {
      /* non-JSON error body */
    }

    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: 'AUTH', message: body?.error };
    }
    if (!response.ok) {
      return {
        ok: false,
        error: 'HTTP',
        status: response.status,
        message: body?.error,
      };
    }

    // The first tab of the app opens with the freshly imported rides already
    // listed (Finances loads the rides when it mounts).
    await chrome.tabs.create({ url: `${base}/finances` });
    return { ok: true, summary: body };
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== 'SEND_TO_APP') return false;

    sendToApp(message).then(sendResponse);
    // Keep the message channel open until the async sendResponse lands.
    return true;
  });
})();
