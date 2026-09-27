/**
 * MAIN-world content script (single self-contained file).
 *
 * Runs in the page context (the equivalent of `@grant none` in the
 * Tampermonkey userscript): installs the fetch/XHR hooks that capture the
 * `x-csrf-token` used by Uber's private GraphQL endpoint, and performs the
 * paginated collection on request.
 *
 * It must NOT be split across files: a single file guarantees the hooks are
 * installed before the page bundle runs and avoids any load-order dependency.
 *
 * The captured headers and the collected payload stay inside the page; the
 * isolated-world UI talks to this script only through `postMessage`.
 */
(() => {
  'use strict';

  const BRIDGE_SOURCE = 'uber-rides-capture';
  const GRAPHQL_URL = 'https://riders.uber.com/graphql';
  const PROFILES = ['PERSONAL', 'FAMILY'];
  const MAX_PAGES = 50;
  const VERSION = '0.3.0';
  const BUILD_LABEL = 'self-contained';

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

  console.info(
    `[Uber Rides Capture] MAIN v${VERSION} (${BUILD_LABEL}) carregado em ${location.href}`,
  );

  const cleanHeaders = (headers) => {
    const out = {};
    for (const [key, value] of Object.entries(headers)) {
      if (!DROP_HEADERS.has(key.toLowerCase())) out[key] = value;
    }
    return out;
  };

  const isGraphql = (url) =>
    typeof url === 'string' && url.includes('/graphql');

  const post = (message) => {
    window.postMessage(
      { source: BRIDGE_SOURCE, dir: 'page-to-ui', ...message },
      '*',
    );
  };

  let capturedHeaders = null;
  const listeners = new Set();

  const setCapturedHeaders = (headers) => {
    capturedHeaders = headers;
    for (const listener of listeners) {
      try {
        listener();
      } catch (_err) {
        /* never break the page */
      }
    }
  };

  const captureFetch = () => {
    const originalFetch = window.fetch;
    window.fetch = function (input, init) {
      try {
        if (isGraphql(input?.url ?? input)) {
          const headers = new Headers(init?.headers ?? input?.headers);
          if (headers.get('x-csrf-token')) {
            setCapturedHeaders(
              cleanHeaders(Object.fromEntries(headers.entries())),
            );
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
            setCapturedHeaders(
              cleanHeaders({
                ...capture.headers,
                'content-type': 'application/json',
              }),
            );
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

  listeners.add(() => post({ type: 'HEADERS_CAPTURED' }));

  // --- Collection -----------------------------------------------------------

  const collect = async (profileType, fromMs, toMs, headers, onPage) => {
    const activities = [];
    let token = null;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        credentials: 'include',
        headers,
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
      if (onPage)
        onPage(`${profileType} • página ${page + 1}: +${batch.length}`);
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
        imageURL: activity.imageURL?.light ?? activity.imageURL?.dark ?? null,
      }));

  const runCapture = async ({ requestId, fromMs, toMs }) => {
    if (!capturedHeaders) {
      post({
        type: 'CAPTURE_RESULT',
        requestId,
        ok: false,
        error: 'NO_SESSION',
      });
      return;
    }

    try {
      const profiles = {};
      for (const profileType of PROFILES) {
        const activities = await collect(
          profileType,
          fromMs,
          toMs,
          capturedHeaders,
          (message) => post({ type: 'CAPTURE_LOG', requestId, message }),
        );
        const rides = reduceActivities(activities);
        profiles[profileType] = {
          total: activities.length,
          corridas: rides.length,
          canceladas: rides.filter((ride) =>
            isCancelledDescription(ride.description),
          ).length,
          atividades: rides,
        };
        post({
          type: 'CAPTURE_LOG',
          requestId,
          message: `${profileType}: ${rides.length} corrida(s)`,
        });
      }

      const envelope = {
        source: 'UBER_SESSION',
        utcOffsetMinutes: -new Date().getTimezoneOffset(),
        windowStart: new Date(fromMs).toISOString(),
        windowEnd: new Date(toMs).toISOString(),
        profiles,
      };

      post({
        type: 'CAPTURE_RESULT',
        requestId,
        ok: true,
        json: JSON.stringify(envelope),
      });
    } catch (error) {
      post({
        type: 'CAPTURE_RESULT',
        requestId,
        ok: false,
        error: error.message,
      });
    }
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== BRIDGE_SOURCE || data.dir !== 'ui-to-page') {
      return;
    }

    if (data.type === 'GET_STATUS') {
      post({
        type: 'STATUS',
        requestId: data.requestId,
        hasSession: Boolean(capturedHeaders),
      });
    } else if (data.type === 'CAPTURE') {
      runCapture(data);
    }
  });

  // Announce readiness so the UI can query the status even if its own initial
  // GET_STATUS raced ahead of this listener.
  post({ type: 'PAGE_READY', hasSession: Boolean(capturedHeaders) });
})();
