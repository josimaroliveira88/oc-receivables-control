// ==UserScript==
// @name         Uber Rides Capture (Corridas Uber)
// @namespace    receivables-control/uber-rides
// @version      1.0.0
// @description  Captura a lista de corridas do Uber (perfis pessoal e família) e copia um JSON para colar no Controle de Recebíveis.
// @author       Receivables Control
// @match        https://riders.uber.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

/*
 * Como funciona
 * -------------
 * A API de atividades do Uber (POST https://riders.uber.com/graphql, operação
 * "Activities") exige um header `x-csrf-token` calculado dentro do bundle da
 * página — não está em cookie nem em URL. A única forma confiável é observar a
 * própria chamada da página e reaproveitar os headers que ela usou.
 *
 * `@grant none` é obrigatório: com qualquer `@grant`, o script sai do contexto
 * da página e o gancho em `window.fetch`/`XMLHttpRequest` deixa de ver as
 * chamadas feitas pelo site.
 *
 * O script NÃO faz parsing de valores: ele só busca o JSON reduzido
 * ({ uuid, cardURL, description, subtitle, title, imageURL } por corrida) e
 * copia o envelope. Todo o parsing, deduplicação e classificação acontecem no
 * backend.
 */

(() => {
  'use strict';

  const GRAPHQL_URL = 'https://riders.uber.com/graphql';
  const PROFILES = ['PERSONAL', 'FAMILY'];
  const MAX_PAGES = 50;

  const QUERY = `query Activities($cityID: Int, $endTimeMs: Float, $includePast: Boolean = true, $limit: Int = 5, $nextPageToken: String, $orderTypes: [RVWebCommonActivityOrderType!] = [RIDES, TRAVEL], $profileType: RVWebCommonActivityProfileType = PERSONAL, $startTimeMs: Float) {
  activities(cityID: $cityID) {
    cityID
    past(endTimeMs: $endTimeMs, limit: $limit, nextPageToken: $nextPageToken, orderTypes: $orderTypes, profileType: $profileType, startTimeMs: $startTimeMs) @include(if: $includePast) {
      activities { ...RVWebCommonActivityFragment __typename }
      nextPageToken
      __typename
    }
    __typename
  }
}

fragment RVWebCommonActivityFragment on RVWebCommonActivity {
  buttons { isDefault startEnhancerIcon text url __typename }
  cardURL
  description
  imageURL { light dark __typename }
  subtitle
  title
  uuid
  __typename
}`;

  // Headers that must not be replayed (bound to the original request/browser).
  const DROP_HEADERS = new Set([
    'content-length',
    'host',
    'connection',
    'accept-encoding',
    'cookie',
    'cookie2',
    'referer',
    'origin',
    'user-agent',
  ]);

  const cleanHeaders = (headers) => {
    const out = {};
    for (const [key, value] of Object.entries(headers)) {
      if (!DROP_HEADERS.has(key.toLowerCase())) out[key] = value;
    }
    return out;
  };

  const isGraphql = (url) =>
    typeof url === 'string' && url.includes('/graphql');

  let capturedHeaders = null;

  const captureFetch = () => {
    const originalFetch = window.fetch;
    window.fetch = function (input, init) {
      try {
        if (isGraphql(input?.url ?? input)) {
          const headers = new Headers(init?.headers ?? input?.headers);
          if (headers.get('x-csrf-token')) {
            capturedHeaders = cleanHeaders(
              Object.fromEntries(headers.entries()),
            );
            onHeadersCaptured();
          }
        }
      } catch (_err) {
        /* never break the page */
      }
      return originalFetch.apply(this, arguments);
    };
  };

  const captureXhr = () => {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (_method, url) {
      this.__uberRidesCapture = { url, headers: {} };
      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.setRequestHeader = function (key, value) {
      if (this.__uberRidesCapture) {
        this.__uberRidesCapture.headers[key] = value;
      }
      return originalSetHeader.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
      try {
        const capture = this.__uberRidesCapture;
        if (capture && isGraphql(capture.url)) {
          const token =
            capture.headers['X-Csrf-Token'] ?? capture.headers['x-csrf-token'];
          if (token) {
            capturedHeaders = cleanHeaders({
              ...capture.headers,
              'content-type': 'application/json',
            });
            onHeadersCaptured();
          }
        }
      } catch (_err) {
        /* never break the page */
      }

      return originalSend.apply(this, arguments);
    };
  };

  if (window.fetch) captureFetch();
  captureXhr();

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  let statusEl = null;
  let logEl = null;
  let captureButton = null;

  const setStatus = (message, kind = 'info') => {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.dataset.kind = kind;
    statusEl.style.color =
      kind === 'error' ? '#d6336c' : kind === 'success' ? '#2f9e44' : '#555';
  };

  const appendLog = (message) => {
    if (!logEl) return;
    const line = document.createElement('div');
    line.textContent = message;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  };

  const onHeadersCaptured = () => {
    if (captureButton) {
      captureButton.disabled = false;
      setStatus('Sessão do Uber detectada. Pronto para capturar.');
    }
  };

  const toDateInputValue = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };

  const parseLocalDateInput = (value, endOfDay = false) => {
    const [year, month, day] = value.split('-').map(Number);
    return endOfDay
      ? new Date(year, month - 1, day, 23, 59, 59, 999)
      : new Date(year, month - 1, day, 0, 0, 0, 0);
  };

  const collect = async (profileType, fromMs, toMs) => {
    const activities = [];
    let token = null;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        credentials: 'include',
        headers: capturedHeaders,
        body: JSON.stringify({
          operationName: 'Activities',
          query: QUERY,
          variables: {
            includePast: true,
            limit: 100,
            orderTypes: ['RIDES'],
            profileType,
            startTimeMs: fromMs,
            endTimeMs: toMs + 1,
            ...(token ? { nextPageToken: token } : {}),
          },
        }),
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      }

      const past = JSON.parse(text).data.activities.past;
      const batch = past.activities ?? [];
      activities.push(...batch);
      appendLog(`${profileType} • página ${page + 1}: +${batch.length}`);
      token = past.nextPageToken;
      if (!token) break;
    }

    return activities;
  };

  const isCancelledDescription = (description) =>
    String(description ?? '')
      .split('•')
      .some((segment) => /cancelad/i.test(segment));

  const reduceActivities = (activities) =>
    activities
      .filter((activity) => /\/trips\//.test(activity.cardURL ?? ''))
      .map((activity) => ({
        uuid: activity.uuid,
        cardURL: activity.cardURL,
        description: activity.description,
        subtitle: activity.subtitle,
        title: activity.title,
        // Vehicle asset (or route map) used by the backend to classify the ride
        // as passenger or delivery. Only the light URL is needed; the dark one
        // carries the same vehicle information and would double the payload.
        imageURL: activity.imageURL?.light ?? activity.imageURL?.dark ?? null,
      }));

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

  const handleCapture = async () => {
    if (!capturedHeaders) {
      setStatus(
        'Sessão não detectada. Recarregue a página de corridas do Uber e tente de novo.',
        'error',
      );
      return;
    }

    const startValue = document.getElementById('uber-rides-start').value;
    const endValue = document.getElementById('uber-rides-end').value;
    if (!startValue || !endValue) {
      setStatus('Informe a data inicial e a final.', 'error');
      return;
    }

    const fromMs = parseLocalDateInput(startValue).getTime();
    const toMs = parseLocalDateInput(endValue, true).getTime();
    if (toMs <= fromMs) {
      setStatus('A data final deve ser depois da inicial.', 'error');
      return;
    }

    captureButton.disabled = true;
    setStatus('Capturando corridas...');

    try {
      const profiles = {};
      for (const profileType of PROFILES) {
        const activities = await collect(profileType, fromMs, toMs);
        const rides = reduceActivities(activities);
        profiles[profileType] = {
          total: activities.length,
          corridas: rides.length,
          canceladas: rides.filter((ride) =>
            isCancelledDescription(ride.description),
          ).length,
          atividades: rides,
        };
        appendLog(`${profileType}: ${rides.length} corrida(s)`);
      }

      const envelope = {
        source: 'UBER_SESSION',
        utcOffsetMinutes: -new Date().getTimezoneOffset(),
        windowStart: new Date(fromMs).toISOString(),
        windowEnd: new Date(toMs).toISOString(),
        profiles,
      };
      const json = JSON.stringify(envelope);

      const copied = await copyToClipboard(json);
      const sizeKb = (json.length / 1024).toFixed(1);
      setStatus(
        copied
          ? `JSON copiado (${sizeKb} KB). Cole na tela Corridas do Controle de Recebíveis.`
          : `JSON gerado (${sizeKb} KB), mas a cópia falhou. Veja o console (F12).`,
        copied ? 'success' : 'error',
      );
      if (!copied) console.log(json);
    } catch (error) {
      setStatus(`Falha na captura: ${error.message}`, 'error');
    } finally {
      captureButton.disabled = false;
    }
  };

  const buildUi = () => {
    if (document.getElementById('uber-rides-capture-box')) return;

    const today = new Date();
    const start = new Date(today.getTime() - 35 * 86400000);

    const box = document.createElement('div');
    box.id = 'uber-rides-capture-box';
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
      <div style="font-weight:600;margin-bottom:8px">Corridas Uber</div>
      <label style="display:block;font-size:11px;color:#666;margin-bottom:2px">Início</label>
      <input id="uber-rides-start" type="date" value="${toDateInputValue(start)}" style="width:100%;box-sizing:border-box;margin-bottom:8px;padding:4px" />
      <label style="display:block;font-size:11px;color:#666;margin-bottom:2px">Fim</label>
      <input id="uber-rides-end" type="date" value="${toDateInputValue(today)}" style="width:100%;box-sizing:border-box;margin-bottom:8px;padding:4px" />
      <button id="uber-rides-capture" type="button" style="width:100%;padding:8px;border:0;border-radius:6px;background:#d6336c;color:#fff;font-weight:600;cursor:pointer">Capturar e copiar JSON</button>
      <div id="uber-rides-status" style="margin-top:8px;font-size:11px;color:#555"></div>
      <div id="uber-rides-log" style="margin-top:6px;max-height:90px;overflow:auto;font-size:10px;color:#888"></div>
    `;

    document.body.appendChild(box);

    statusEl = document.getElementById('uber-rides-status');
    logEl = document.getElementById('uber-rides-log');
    captureButton = document.getElementById('uber-rides-capture');

    captureButton.disabled = !capturedHeaders;
    setStatus(
      capturedHeaders
        ? 'Sessão do Uber detectada. Pronto para capturar.'
        : 'Aguardando uma chamada do Uber… Se demorar, recarregue a página.',
    );

    captureButton.addEventListener('click', handleCapture);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildUi);
  } else {
    buildUi();
  }
})();
