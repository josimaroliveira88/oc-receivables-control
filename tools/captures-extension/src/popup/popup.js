/**
 * Toolbar popup controller (self-contained).
 *
 * Shows the session status of the active Uber tab and can trigger a capture
 * remotely through the isolated-world content script. Also stores the app
 * integration settings (API token + server URL) used by the "send to app"
 * flow; the background service worker reads them itself when posting.
 */
(() => {
  'use strict';

  const VERSION = '0.7.0';
  const BUILD_LABEL = 'rebrand';
  const UBER_URL = 'https://riders.uber.com/';
  const DOTERRA_ORDERS_URL =
    'https://office.doterra.com/index.cfm?Fuseaction=evo_Modules.OrderHistoryFull';
  const DEFAULT_SERVER = 'http://localhost:3000';

  const STORAGE_KEYS = {
    TOKEN: 'captures:api-token',
    SERVER: 'captures:server-url',
  };

  const statusEl = document.getElementById('status');
  const captureEl = document.getElementById('capture');
  const openEl = document.getElementById('open');
  const tokenEl = document.getElementById('token');
  const tokenStatusEl = document.getElementById('token-status');
  const serverEl = document.getElementById('server');
  const saveEl = document.getElementById('save');
  const versionEl = document.getElementById('version');

  versionEl.textContent = `v${VERSION} · ${BUILD_LABEL}`;

  const setStatus = (message, kind = 'info') => {
    statusEl.textContent = message;
    statusEl.dataset.kind = kind;
  };

  const setTokenStatus = (message, kind = 'info') => {
    tokenStatusEl.textContent = message;
    tokenStatusEl.dataset.kind = kind;
  };

  const getStored = async (key) => {
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

  const normalizeServer = (value) => {
    const trimmed = (value ?? '').trim().replace(/\/+$/, '');
    return trimmed;
  };

  // Light format check only: the backend owns the real validation, so a
  // mistyped token is never rejected here by accident.
  const describeToken = (token) => {
    if (!token) return 'Nenhum token salvo.';
    if (!token.startsWith('cr_') || token.length < 10) {
      return 'Token salvo, mas o formato não parece correto (esperado cr_…).';
    }
    return `Token salvo (termina em ${token.slice(-4)}).`;
  };

  const refreshTokenSettings = async () => {
    const [storedToken, storedServer] = await Promise.all([
      getStored(STORAGE_KEYS.TOKEN),
      getStored(STORAGE_KEYS.SERVER),
    ]);
    serverEl.value = storedServer ?? DEFAULT_SERVER;
    tokenEl.value = storedToken ?? '';
    const hasToken = Boolean(storedToken);
    setTokenStatus(
      describeToken(storedToken),
      hasToken && storedToken.startsWith('cr_') ? 'ok' : 'info',
    );
    return hasToken;
  };

  saveEl.addEventListener('click', async () => {
    const token = tokenEl.value.trim();
    const server = normalizeServer(serverEl.value);

    if (!token) {
      setTokenStatus('Informe o token gerado no app.', 'warn');
      return;
    }
    // Guard against the classic mix-up: the login JWT (`eyJ…`, session-scoped
    // and short-lived) is NOT the extension token (`cr_…`, created by
    // POST /api/api-tokens). Saving the wrong one would produce a confusing
    // 403/401 at import time, so reject it right here.
    if (!token.startsWith('cr_')) {
      setTokenStatus(
        'Este não parece ser o token da extensão (esperado cr_…). No app, use o botão de gerar token (ou POST /api/api-tokens) — não o JWT de login.',
        'warn',
      );
      return;
    }
    if (server && !/^https?:\/\/.+/.test(server)) {
      setTokenStatus('Servidor inválido (use http(s)://…).', 'warn');
      return;
    }

    try {
      await new Promise((resolve) => {
        chrome.storage.local.set(
          {
            [STORAGE_KEYS.TOKEN]: token,
            [STORAGE_KEYS.SERVER]: server || DEFAULT_SERVER,
          },
          resolve,
        );
      });
      tokenEl.value = token;
      setTokenStatus(`Token salvo (termina em ${token.slice(-4)}).`, 'ok');
    } catch (_err) {
      setTokenStatus('Não foi possível salvar.', 'warn');
    }
  });

  const getActiveTab = async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab;
  };

  const isUberTab = (tab) => Boolean(tab?.url && tab.url.startsWith(UBER_URL));

  const refreshStatus = async (attempt = 0) => {
    const tab = await getActiveTab();
    if (!isUberTab(tab)) {
      setStatus('Abra riders.uber.com e faça login.', 'warn');
      captureEl.disabled = true;
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'GET_STATUS',
      });
      if (response?.hasSession) {
        setStatus('Sessão do Uber detectada. Pronto para capturar.', 'ok');
      } else {
        setStatus(
          'Aguardando uma chamada do Uber… Recarregue a página se demorar.',
          'info',
        );
      }
      captureEl.disabled = false;
    } catch (_err) {
      // The content script may not be injected yet right after a reload; retry
      // once before giving up.
      if (attempt < 1) {
        setTimeout(() => refreshStatus(attempt + 1), 500);
        return;
      }
      setStatus(
        `A extensão não está ativa nesta aba (build ${BUILD_LABEL}). Recarregue a página (F5). Se persistir, remova e re-adicione a extensão em chrome://extensions.`,
        'warn',
      );
      captureEl.disabled = true;
    }
  };

  captureEl.addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (!isUberTab(tab)) return;

    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_CAPTURE' });
      setStatus('Captura iniciada na aba do Uber.', 'ok');
      window.close();
    } catch (_err) {
      setStatus('Não foi possível iniciar a captura.', 'warn');
    }
  });

  openEl.addEventListener('click', () => {
    chrome.tabs.create({ url: UBER_URL });
    window.close();
  });

  const openDoterraEl = document.getElementById('open-doterra');
  openDoterraEl.addEventListener('click', () => {
    chrome.tabs.create({ url: DOTERRA_ORDERS_URL });
    window.close();
  });

  const openAppEl = document.getElementById('open-app');
  openAppEl.addEventListener('click', async () => {
    const server = normalizeServer(serverEl.value) || DEFAULT_SERVER;
    chrome.tabs.create({ url: `${server}/finances?openUberImport=1` });
    window.close();
  });

  refreshTokenSettings();
  refreshStatus();
})();
