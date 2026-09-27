/**
 * Toolbar popup controller (self-contained).
 *
 * Shows the session status of the active Uber tab and can trigger a capture
 * remotely through the isolated-world content script.
 */
(() => {
  'use strict';

  const VERSION = '0.3.0';
  const BUILD_LABEL = 'self-contained';
  const UBER_URL = 'https://riders.uber.com/';

  const statusEl = document.getElementById('status');
  const captureEl = document.getElementById('capture');
  const openEl = document.getElementById('open');
  const versionEl = document.getElementById('version');

  versionEl.textContent = `v${VERSION} · ${BUILD_LABEL}`;

  const setStatus = (message, kind = 'info') => {
    statusEl.textContent = message;
    statusEl.dataset.kind = kind;
  };

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

  refreshStatus();
})();
