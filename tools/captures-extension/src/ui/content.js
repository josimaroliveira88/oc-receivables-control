/**
 * ISOLATED-world content script (single self-contained file).
 *
 * Owns the floating UI, persistence (`chrome.storage.local`), the clipboard and
 * the toolbar-popup bridge. All Uber requests happen in the MAIN-world script;
 * this file talks to it exclusively through `postMessage`.
 *
 * A single file is intentional: it removes any dependency on script load order
 * or on a shared global namespace between content scripts.
 */
(() => {
  'use strict';

  const VERSION = '0.7.0';
  const BUILD_LABEL = 'rebrand';
  const BRIDGE_SOURCE = 'captures:bridge';
  const BOX_ID = 'captures-box';
  const DAY_MS = 86400000;
  const DEFAULT_WINDOW_DAYS = 35;

  const STATUS_COLORS = {
    error: '#d6336c',
    success: '#2f9e44',
    info: '#555',
  };

  const STORAGE_KEYS = {
    START: 'captures:start',
    END: 'captures:end',
  };
  const INTEGRATION_KEYS = {
    TOKEN: 'captures:api-token',
    SERVER: 'captures:server-url',
  };
  console.info(
    `[Captures] ISOLATED v${VERSION} (${BUILD_LABEL}) carregado em ${location.href}`,
  );

  // --- Dates ----------------------------------------------------------------

  const pad = (value) => String(value).padStart(2, '0');

  const toDateInputValue = (date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  const parseLocalDateInput = (value, endOfDay = false) => {
    const [year, month, day] = value.split('-').map(Number);
    return endOfDay
      ? new Date(year, month - 1, day, 23, 59, 59, 999)
      : new Date(year, month - 1, day, 0, 0, 0, 0);
  };

  const defaultWindow = () => {
    const today = new Date();
    const start = new Date(today.getTime() - DEFAULT_WINDOW_DAYS * DAY_MS);
    return {
      start: toDateInputValue(start),
      end: toDateInputValue(today),
    };
  };

  // --- Storage --------------------------------------------------------------

  const hasStorage = () =>
    typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

  const loadLastWindow = () =>
    new Promise((resolve) => {
      if (!hasStorage()) {
        resolve({ start: null, end: null });
        return;
      }
      try {
        chrome.storage.local.get(
          [STORAGE_KEYS.START, STORAGE_KEYS.END],
          (result) => {
            if (chrome.runtime.lastError) {
              resolve({ start: null, end: null });
              return;
            }
            resolve({
              start: result[STORAGE_KEYS.START] ?? null,
              end: result[STORAGE_KEYS.END] ?? null,
            });
          },
        );
      } catch (_err) {
        resolve({ start: null, end: null });
      }
    });

  const saveLastWindow = (start, end) => {
    if (!hasStorage()) return;
    try {
      chrome.storage.local.set({
        [STORAGE_KEYS.START]: start,
        [STORAGE_KEYS.END]: end,
      });
    } catch (_err) {
      /* persistence is best-effort */
    }
  };

  // Reads the stored integration token so the floating box can gate the
  // "send to app" button and show the token hint without opening the popup.
  const loadStoredToken = () =>
    new Promise((resolve) => {
      if (!hasStorage()) {
        resolve('');
        return;
      }
      try {
        chrome.storage.local.get([INTEGRATION_KEYS.TOKEN], (result) => {
          if (chrome.runtime.lastError) {
            resolve('');
            return;
          }
          resolve(result[INTEGRATION_KEYS.TOKEN] ?? '');
        });
      } catch (_err) {
        resolve('');
      }
    });

  // --- Clipboard ------------------------------------------------------------

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_err) {
      try {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(area);
        return ok;
      } catch (__err) {
        return false;
      }
    }
  };

  // --- Bridge to the MAIN world --------------------------------------------

  const pending = new Map();
  const logListeners = new Set();
  const statusListeners = new Set();
  let nextRequestId = 0;

  const emit = (listeners, payload) => {
    for (const listener of listeners) {
      try {
        listener(payload);
      } catch (_err) {
        /* ignore listener errors */
      }
    }
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== BRIDGE_SOURCE || data.dir !== 'page-to-ui') {
      return;
    }

    if (data.type === 'PAGE_READY') {
      emit(statusListeners, { hasSession: Boolean(data.hasSession) });
      return;
    }
    if (data.type === 'HEADERS_CAPTURED') {
      emit(statusListeners, { hasSession: true });
      return;
    }
    if (data.type === 'CAPTURE_LOG') {
      emit(logListeners, data.message);
      return;
    }
    if (data.type === 'STATUS' || data.type === 'CAPTURE_RESULT') {
      const entry = pending.get(data.requestId);
      if (entry) {
        pending.delete(data.requestId);
        entry.resolve(data);
      }
    }
  });

  const request = (message, timeoutMs) => {
    const requestId = `req-${(nextRequestId += 1)}`;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (pending.delete(requestId)) resolve({ timedOut: true });
      }, timeoutMs);
      pending.set(requestId, {
        resolve: (data) => {
          clearTimeout(timer);
          resolve(data);
        },
      });
      window.postMessage(
        { source: BRIDGE_SOURCE, dir: 'ui-to-page', ...message, requestId },
        '*',
      );
    });
  };

  const getStatus = () =>
    request({ type: 'GET_STATUS' }, 4000).then((data) => ({
      hasSession: Boolean(data.hasSession),
    }));

  const capture = (fromMs, toMs) =>
    request({ type: 'CAPTURE', fromMs, toMs }, 120000).then((data) => ({
      ok: Boolean(data.ok),
      json: data.json,
      error: data.error ?? (data.timedOut ? 'TIMEOUT' : undefined),
    }));

  // --- Bridge to the background service worker -----------------------------

  // The import POST cannot run here: an isolated-world fetch would carry the
  // page origin (riders.uber.com) and hit the backend CORS instead. The
  // background worker's fetch is covered by the host permissions.
  const sendToApp = (json, windowStart, windowEnd) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      return Promise.resolve({ ok: false, error: 'NO_BACKGROUND' });
    }
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          { type: 'SEND_TO_APP', json, windowStart, windowEnd },
          (data) => {
            if (chrome.runtime.lastError) {
              resolve({ ok: false, error: 'NO_BACKGROUND' });
              return;
            }
            resolve(data ?? { ok: false, error: 'NO_BACKGROUND' });
          },
        );
      } catch (_err) {
        resolve({ ok: false, error: 'NO_BACKGROUND' });
      }
    });
  };

  // --- Floating box ---------------------------------------------------------

  const createBox = ({ start, end, onCapture }) => {
    const box = document.createElement('div');
    box.id = BOX_ID;
    box.style.cssText = [
      'position:fixed',
      'right:16px',
      'bottom:16px',
      'z-index:2147483647',
      'width:300px',
      'background:#fff',
      'color:#111',
      'border:1px solid #ddd',
      'border-radius:10px',
      'box-shadow:0 6px 24px rgba(0,0,0,.25)',
      'font:13px/1.4 system-ui,sans-serif',
      'padding:12px',
    ].join(';');

    box.innerHTML = `
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px">
        <span style="font-weight:600">Corridas Uber</span>
        <span data-role="version" style="font-size:10px;color:#999"></span>
      </div>
      <label style="display:block;font-size:11px;color:#666;margin-bottom:2px">Início</label>
      <input data-role="start" type="date" style="width:100%;box-sizing:border-box;margin-bottom:8px;padding:4px" />
      <label style="display:block;font-size:11px;color:#666;margin-bottom:2px">Fim</label>
      <input data-role="end" type="date" style="width:100%;box-sizing:border-box;margin-bottom:8px;padding:4px" />
      <button data-role="capture" type="button" style="width:100%;padding:8px;border:0;border-radius:6px;background:#d6336c;color:#fff;font-weight:600;cursor:pointer">Capturar e copiar JSON</button>
      <button data-role="send" type="button" style="width:100%;padding:8px;border:0;border-radius:6px;background:#1c7ed6;color:#fff;font-weight:600;cursor:pointer;margin-top:6px">Enviar para o Controle de Recebíveis</button>
      <div data-role="token" style="margin-top:6px;font-size:10px;color:#999"></div>
      <div data-role="status" style="margin-top:8px;font-size:11px;color:#555"></div>
      <div data-role="log" style="margin-top:6px;max-height:90px;overflow:auto;font-size:10px;color:#888"></div>
    `;

    document.body.appendChild(box);

    const startEl = box.querySelector('[data-role="start"]');
    const endEl = box.querySelector('[data-role="end"]');
    const captureEl = box.querySelector('[data-role="capture"]');
    const sendEl = box.querySelector('[data-role="send"]');
    const tokenEl = box.querySelector('[data-role="token"]');
    const statusEl = box.querySelector('[data-role="status"]');
    const logEl = box.querySelector('[data-role="log"]');
    const versionEl = box.querySelector('[data-role="version"]');

    startEl.value = start;
    endEl.value = end;
    versionEl.textContent = `v${VERSION} · ${BUILD_LABEL}`;

    const setStatus = (message, kind = 'info') => {
      statusEl.textContent = message;
      statusEl.dataset.kind = kind;
      statusEl.style.color = STATUS_COLORS[kind] ?? STATUS_COLORS.info;
    };

    const appendLog = (message) => {
      const line = document.createElement('div');
      line.textContent = message;
      logEl.appendChild(line);
      logEl.scrollTop = logEl.scrollHeight;
    };

    // Keeps the send button disabled until a token is saved in the popup.
    const setTokenState = (token) => {
      const ready = Boolean(token);
      sendEl.disabled = !ready;
      tokenEl.textContent = ready
        ? `Token salvo (termina em ${token.slice(-4)}).`
        : 'Sem token. Abra o popup da extensão e salve o token gerado no app.';
    };

    const setBusy = (busy) => {
      captureEl.disabled = busy;
      captureEl.textContent = busy ? 'Capturando…' : 'Capturar e copiar JSON';
      sendEl.disabled = busy;
    };

    const setSendBusy = (busy, label) => {
      sendEl.disabled = busy;
      sendEl.textContent = label ?? (busy ? 'Enviando…' : SEND_BUTTON_LABEL);
    };

    const setSessionReady = (ready) => {
      captureEl.disabled = !ready;
      setStatus(
        ready
          ? 'Sessão do Uber detectada. Pronto para capturar.'
          : 'Aguardando uma chamada do Uber… Se demorar, recarregue a página.',
        'info',
      );
    };

    captureEl.addEventListener('click', () => onCapture('copy'));
    sendEl.addEventListener('click', () => onCapture('send'));

    setSessionReady(false);
    setTokenState('');

    return {
      setStatus,
      appendLog,
      setBusy,
      setSendBusy,
      setSessionReady,
      setTokenState,
      getWindowValues: () => ({
        startValue: startEl.value,
        endValue: endEl.value,
      }),
    };
  };

  // --- Orchestration --------------------------------------------------------

  const SEND_BUTTON_LABEL = 'Enviar para o Controle de Recebíveis';

  // datetime-local ISO instants for the import payload, derived from the same
  // wall-clock parse the capture window uses.
  const toIsoInstant = (value, endOfDay = false) =>
    parseLocalDateInput(value, endOfDay).toISOString();

  let controller = null;
  let capturing = false;
  let sessionReady = false;

  // Shared capture pipeline: `target` = 'copy' replicates the legacy flow
  // (clipboard, paste on the app); `target` = 'send' posts the captured JSON
  // straight to the backend and opens Finances in a new tab, falling back to
  // the clipboard when the send fails.
  const handleCapture = async (target = 'copy') => {
    if (!controller || capturing) return;

    const { startValue, endValue } = controller.getWindowValues();
    if (!startValue || !endValue) {
      controller.setStatus('Informe a data inicial e a final.', 'error');
      return;
    }

    const fromMs = parseLocalDateInput(startValue).getTime();
    const toMs = parseLocalDateInput(endValue, true).getTime();
    if (toMs <= fromMs) {
      controller.setStatus('A data final deve ser depois da inicial.', 'error');
      return;
    }

    const fromIso = toIsoInstant(startValue, false);
    const toIso = toIsoInstant(endValue, true);

    capturing = true;
    controller.setBusy(true);
    controller.setSendBusy(true, 'Capturando…');
    controller.setStatus('Capturando corridas...');

    try {
      const result = await capture(fromMs, toMs);

      if (!result.ok) {
        const message =
          result.error === 'NO_SESSION'
            ? 'Sessão não detectada. Recarregue a página de corridas do Uber e tente de novo.'
            : result.error === 'TIMEOUT'
              ? 'A captura demorou demais e foi interrompida. Recarregue a página e tente de novo.'
              : `Falha na captura: ${result.error}`;
        controller.setStatus(message, 'error');
        return;
      }

      saveLastWindow(startValue, endValue);
      const sizeKb = (result.json.length / 1024).toFixed(1);

      if (target === 'send') {
        const response = await sendToApp(result.json, fromIso, toIso);

        if (response.ok) {
          const parts = [
            `${response.summary?.total ?? 0} corrida(s) processada(s)`,
          ];
          if (response.summary?.cancelled > 0) {
            parts.push(`${response.summary.cancelled} cancelada(s)`);
          }
          controller.setStatus(
            `Importado: ${parts.join(', ')}. Abrindo o Controle de Recebíveis…`,
            'success',
          );
          return;
        }

        // Failure fallback: the capture is never lost.
        const reason =
          response.error === 'NO_TOKEN'
            ? 'sem token salvo no popup da extensão'
            : response.error === 'NETWORK'
              ? 'sem conexão com o servidor'
              : response.error === 'AUTH'
                ? response.message || 'token inválido ou expirado'
                : response.message ||
                  `erro ${response.status ?? 'desconhecido'}`;
        controller.setStatus(
          `Envio falhou (${reason}). JSON copiado: cole na tela de importação do app.`,
          'error',
        );
        await copyToClipboard(result.json);
        return;
      }

      const copied = await copyToClipboard(result.json);
      controller.setStatus(
        copied
          ? `JSON copiado (${sizeKb} KB). Cole na tela de importação do Controle de Recebíveis.`
          : `JSON gerado (${sizeKb} KB), mas a cópia falhou. Veja o console (F12).`,
        copied ? 'success' : 'error',
      );
      if (!copied) console.log(result.json);
    } finally {
      capturing = false;
      controller.setBusy(false);
      controller.setSendBusy(false, SEND_BUTTON_LABEL);
    }
  };

  // Register the popup listener synchronously so the toolbar popup can always
  // reach this tab, even before (or without) the floating box mounting.
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || typeof message.type !== 'string') return false;

      if (message.type === 'GET_STATUS') {
        sendResponse({
          hasSession: sessionReady,
          mounted: Boolean(controller),
          version: VERSION,
        });
        return false;
      }

      if (message.type === 'TRIGGER_CAPTURE') {
        handleCapture();
        sendResponse({ ok: Boolean(controller), mounted: Boolean(controller) });
        return false;
      }

      return false;
    });
  }

  logListeners.add((message) => controller?.appendLog(message));
  statusListeners.add(({ hasSession }) => {
    sessionReady = hasSession;
    if (hasSession) controller?.setSessionReady(true);
  });

  const mount = async () => {
    if (document.getElementById(BOX_ID)) return;

    const stored = await loadLastWindow();
    const fallback = defaultWindow();

    controller = createBox({
      start: stored.start || fallback.start,
      end: stored.end || fallback.end,
      onCapture: handleCapture,
    });

    const [status, token] = await Promise.all([getStatus(), loadStoredToken()]);
    sessionReady = status.hasSession;
    controller.setSessionReady(status.hasSession);
    controller.setTokenState(token);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
