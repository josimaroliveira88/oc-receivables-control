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

  const VERSION = '0.8.1';
  const BUILD_LABEL = 'conta-id';
  const BRIDGE_SOURCE = 'captures:bridge';
  const BOX_ID = 'captures-box';
  const DAY_MS = 86400000;
  const DEFAULT_WINDOW_DAYS = 35;

  const STATUS_COLORS = {
    error: '#d6336c',
    success: '#2f9e44',
    warning: '#e8590c',
    info: '#555',
  };

  // Palette of the post-import feedback panel, shown in place of the app tab
  // the worker used to open.
  const RESULT_COLORS = {
    success: { border: '#b7e4c7', background: '#f0fbf4' },
    warning: { border: '#ffe1a3', background: '#fff9e6' },
    error: { border: '#f3c2ce', background: '#fff1f4' },
  };

  const MAX_LISTED = 3;

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

  // --- Import feedback -------------------------------------------------------

  // The send flow no longer opens the app in a new tab: the box closes with a
  // summary of what the backend did instead. `buildRideSummary` is pure so the
  // wording stays unit-testable (see `tests/uberUiSummary.test.js`).

  const toCount = (value) => Number(value) || 0;

  const formatBrDate = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
    return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
  };

  const buildRideSummary = (summary, { period } = {}) => {
    const data = summary ?? {};
    const total = toCount(data.total);
    const created = toCount(data.created);
    const updated = toCount(data.updated);
    const cancelled = toCount(data.cancelled);
    const warnings = Array.isArray(data.warnings) ? data.warnings : [];

    if (total === 0) {
      return {
        kind: 'warning',
        title: 'Nenhuma corrida importada.',
        lines: [
          `O período selecionado não retornou corrida válida${
            period ? ` (${period})` : ''
          }.`,
          ...(warnings.length
            ? [`${warnings.length} atividade(s) ignorada(s) na captura.`]
            : []),
        ],
        hint: 'Amplie o período no box ou confira se as corridas já foram importadas.',
      };
    }

    const lines = [
      `${total} corrida(s) importada(s) para o app${
        period ? ` (${period})` : ''
      }.`,
      `${created} nova(s) e ${updated} atualizada(s).`,
    ];

    if (cancelled > 0) {
      lines.push(`${cancelled} cancelada(s), marcada(s) como tal no app.`);
    }

    if (warnings.length > 0) {
      lines.push(`${warnings.length} atividade(s) ignorada(s) na captura.`);
      warnings.slice(0, MAX_LISTED).forEach((warning) => {
        lines.push(`• ${warning}`);
      });
    }

    return {
      kind: warnings.length > 0 ? 'warning' : 'success',
      title: 'Corridas importadas.',
      lines,
      hint: 'Consulte as corridas em Finanças › Corridas.',
    };
  };

  // Maps the stable error codes returned by the service worker into the reason
  // shown in the feedback panel.
  const describeSendError = (response) => {
    if (response?.error === 'NO_TOKEN') {
      return 'sem token salvo no popup da extensão';
    }
    if (response?.error === 'NETWORK') {
      return 'sem conexão com o servidor';
    }
    if (response?.error === 'AUTH') {
      return response.message || 'token inválido ou expirado';
    }
    return response?.message || `erro ${response?.status ?? 'desconhecido'}`;
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
      <div data-role="result" style="display:none;margin-top:8px;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:11px">
        <ul data-role="result-list" style="margin:0;padding-left:16px"></ul>
        <div data-role="result-hint" style="margin-top:6px;font-size:10px;color:#666"></div>
      </div>
      <div data-role="log" style="margin-top:6px;max-height:90px;overflow:auto;font-size:10px;color:#888"></div>
    `;

    document.body.appendChild(box);

    const startEl = box.querySelector('[data-role="start"]');
    const endEl = box.querySelector('[data-role="end"]');
    const captureEl = box.querySelector('[data-role="capture"]');
    const sendEl = box.querySelector('[data-role="send"]');
    const tokenEl = box.querySelector('[data-role="token"]');
    const statusEl = box.querySelector('[data-role="status"]');
    const resultEl = box.querySelector('[data-role="result"]');
    const resultListEl = box.querySelector('[data-role="result-list"]');
    const resultHintEl = box.querySelector('[data-role="result-hint"]');
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

    // Terminal feedback of a capture/import run: the one-line status carries the
    // headline and the panel below spells out what the backend did.
    const showResult = ({ kind = 'success', title, lines = [], hint = '' }) => {
      const palette = RESULT_COLORS[kind] ?? RESULT_COLORS.success;

      resultListEl.textContent = '';
      lines.forEach((text) => {
        const item = document.createElement('li');
        item.textContent = text;
        resultListEl.appendChild(item);
      });
      resultHintEl.textContent = hint;
      resultHintEl.style.display = hint ? 'block' : 'none';
      resultEl.style.display = 'block';
      resultEl.style.borderColor = palette.border;
      resultEl.style.background = palette.background;

      setStatus(title, kind);
    };

    const clearResult = () => {
      resultEl.style.display = 'none';
      resultListEl.textContent = '';
      resultHintEl.textContent = '';
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
      showResult,
      clearResult,
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
  // straight to the backend and closes with the import summary, falling back to
  // the clipboard when the send fails. Neither target opens the app: the
  // feedback panel points at the screen where the data landed.
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
    const period = [formatBrDate(startValue), formatBrDate(endValue)]
      .filter(Boolean)
      .join(' a ');

    capturing = true;
    controller.clearResult();
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
          const warnings = Array.isArray(response.summary?.warnings)
            ? response.summary.warnings
            : [];
          warnings.forEach((warning) =>
            controller.appendLog(`Aviso: ${warning}`),
          );
          controller.showResult(buildRideSummary(response.summary, { period }));
          return;
        }

        // Failure fallback: the capture is never lost.
        const reason = describeSendError(response);
        const copied = await copyToClipboard(result.json);
        controller.showResult({
          kind: 'error',
          title: 'Envio falhou.',
          lines: [
            `Motivo: ${reason}.`,
            copied
              ? 'JSON copiado: cole na tela de importação do app.'
              : 'Não foi possível copiar o JSON — refaça a captura.',
          ],
          hint: 'Nenhuma corrida foi importada.',
        });
        return;
      }

      const copied = await copyToClipboard(result.json);
      const scope = period ? ` (${period})` : '';
      controller.showResult({
        kind: copied ? 'success' : 'error',
        title: copied ? 'JSON copiado.' : 'Cópia falhou.',
        lines: [
          copied
            ? `${sizeKb} KB de corridas${scope}.`
            : `${sizeKb} KB de corridas${scope}, mas a cópia falhou.`,
          'Cole na tela de importação do Controle de Recebíveis.',
        ],
        hint: 'Nada foi enviado para o app.',
      });
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

  // --- Test escape hatch -----------------------------------------------------
  //
  // This file is intentionally self-contained (no imports, no shared namespace
  // with the MAIN-world script); the trade-off is that the summary wording
  // would be locked inside the IIFE and untestable from Vitest. When
  // `globalThis.__UBER_UI__` is set (only by `tests/setup.js`, before this file
  // loads) the pure feedback helpers are handed to the test runner. In
  // production the sentinel is missing and nothing is exposed — same contract
  // as the dōTERRA content script's `__DOTERRA_PARSERS__` hatch. Only pure
  // helpers are exported; the box stays bound to the live DOM.
  if (typeof globalThis !== 'undefined' && globalThis.__UBER_UI__) {
    globalThis.__UBER_UI__ = {
      buildRideSummary,
      describeSendError,
      formatBrDate,
    };
  }
})();
