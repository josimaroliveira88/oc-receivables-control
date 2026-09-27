// Parser for the Uber rider activity JSON. The Tampermonkey capture script
// (tools/uber-rides) emits an envelope with the requested window and one bundle
// per profile (PERSONAL / FAMILY), each carrying the reduced activity list:
//
//   {
//     "source": "UBER_SESSION",
//     "windowStart": "2026-08-05T00:00:00.000-03:00",
//     "windowEnd": "2026-09-10T23:59:59.999-03:00",
//     "profiles": {
//       "FAMILY": { "total": 31, "corridas": 29, "canceladas": 2,
//                   "atividades": [ { uuid, cardURL, description, subtitle, title } ] }
//     }
//   }
//
// It is pure (no I/O) and mirrors the style of the other parsers. A single bad
// activity never aborts the batch: it becomes a `warnings[]` entry. The whole
// file is rejected only when the shared window cannot be resolved, because the
// year of each `subtitle` (which has no year) is inferred from that window.
const MONTHS = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

const WINDOW_ERROR =
  'Janela de datas não informada. Gere o JSON novamente com o script do Uber.';

class UberActivityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UberActivityError';
    this.status = 400;
  }
}

const normalize = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const splitDescription = (raw) =>
  String(raw ?? '')
    .split('•')
    .map((segment) => segment.trim())
    .filter(Boolean);

const isMoneySegment = (segment) => /R\$/.test(segment);
const isStatusSegment = (segment) => /cancelad/i.test(segment);

// Amount in integer cents ("R$ 1.234,56" -> 123456). Never float arithmetic.
const parseAmountCents = (raw) => {
  const match = String(raw ?? '').match(/R\$\s*([\d.]+,\d{2})/);
  if (!match) return null;
  const [reais, cents] = match[1].replace(/\./g, '').split(',');
  const value = Number(reais) * 100 + Number(cents);
  return Number.isFinite(value) ? value : null;
};

// "26 de set. • 13:02" -> { day, month, hour, minute }. Month accepts the
// abbreviated form (with an optional dot) and the full name, accent-tolerant.
const parseSubtitle = (raw) => {
  const match = String(raw ?? '').match(
    /(\d{1,2})\s+de\s+([a-zà-ÿ]+)\.?\D*(\d{1,2}):(\d{2})/i,
  );
  if (!match) return null;

  const month = MONTHS[normalize(match[2])];
  if (!month) return null;

  const day = Number(match[1]);
  const hour = Number(match[3]);
  const minute = Number(match[4]);
  if (day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  return { day, month, hour, minute };
};

// The subtitle has no year, so pick the candidate (window year, ±1) that falls
// inside [startMs, endMs). This also covers a window crossing December/January.
// The bounds are wall-clock timestamps (see `toWallClock`) and the ride is built
// with `Date.UTC`, so the stored value is the rider's local wall-clock encoded
// in UTC — independent of the server timezone.
const resolveDate = (parts, startMs, endMs) => {
  if (!parts) return null;
  const baseYear = new Date(startMs).getUTCFullYear();

  for (const year of [baseYear, baseYear + 1, baseYear - 1]) {
    const timestamp = Date.UTC(
      year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
    );
    if (timestamp >= startMs && timestamp < endMs) return new Date(timestamp);
  }
  return null;
};

const parseIso = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

// The capture script sends the offset of the rider's browser
// (`-getTimezoneOffset()`, minutes east of UTC). The window arrives as an
// absolute instant but the subtitle is local wall-clock, so the window is
// shifted into wall-clock space before matching. Defaults to America/Sao_Paulo
// (UTC-3) when the JSON does not carry the offset (older captures).
const DEFAULT_OFFSET_MINUTES = -180;

const resolveOffsetMinutes = (parsed, options) => {
  const raw = options.utcOffsetMinutes ?? parsed?.utcOffsetMinutes;
  const value = Number(raw);
  return Number.isFinite(value) ? value : DEFAULT_OFFSET_MINUTES;
};

// Absolute instant (ms) -> rider wall-clock (ms).
const toWallClock = (instantMs, offsetMinutes) =>
  instantMs + offsetMinutes * 60000;

// The activity image is either the route map (featured activity, no vehicle
// signal) or a vehicle asset. Courier/motorcycle assets mean a delivery;
// `car-types` assets mean a passenger ride.
const DELIVERY_ASSET = /courier|motorcycle|bicycle|moto/i;
const CAR_ASSET = /car-types\/haloProductImages/i;

const imageUrlOf = (imageURL) => {
  if (!imageURL) return null;
  if (typeof imageURL === 'string') return imageURL;
  return imageURL.light ?? imageURL.dark ?? null;
};

const classifyRideType = (imageURL) => {
  const url = imageUrlOf(imageURL);
  if (!url) return 'UNKNOWN';
  if (/static-maps\.uber\.com/i.test(url)) return 'UNKNOWN';
  if (DELIVERY_ASSET.test(url)) return 'DELIVERY';
  if (CAR_ASSET.test(url)) return 'RIDE';
  return 'UNKNOWN';
};

// Collects the per-profile activity bundles from the supported shapes: the
// script envelope (`profiles` or top-level profile keys) and the raw GraphQL
// response (`data.activities.past.activities`).
const collectBundles = (parsed) => {
  if (Array.isArray(parsed)) {
    return [{ profileType: null, activities: parsed }];
  }

  if (parsed && typeof parsed === 'object' && parsed.profiles) {
    return Object.entries(parsed.profiles).map(([profileType, bundle]) => ({
      profileType,
      activities: bundle?.atividades ?? [],
    }));
  }

  const rawActivities = parsed?.data?.activities?.past?.activities;
  if (Array.isArray(rawActivities)) {
    return [{ profileType: null, activities: rawActivities }];
  }

  if (parsed && typeof parsed === 'object') {
    const profileEntries = Object.entries(parsed).filter(
      ([key, value]) =>
        value &&
        typeof value === 'object' &&
        Array.isArray(value.atividades) &&
        (key === 'PERSONAL' || key === 'FAMILY'),
    );
    if (profileEntries.length > 0) {
      return profileEntries.map(([profileType, bundle]) => ({
        profileType,
        activities: bundle.atividades ?? [],
      }));
    }
  }

  return [];
};

// Parses the pasted JSON into a normalized ride list.
// `options.windowStart` / `options.windowEnd` override the envelope values when
// the caller wants to force the window.
function parseUberActivities(jsonText, options = {}) {
  let parsed;
  try {
    parsed = JSON.parse(String(jsonText ?? ''));
  } catch {
    throw new UberActivityError('JSON inválido.');
  }

  const startMs =
    parseIso(options.windowStart) ??
    parseIso(parsed?.windowStart) ??
    parseIso(parsed?.window?.start);
  const endMs =
    parseIso(options.windowEnd) ??
    parseIso(parsed?.windowEnd) ??
    parseIso(parsed?.window?.end);

  if (startMs === null || endMs === null || endMs <= startMs) {
    throw new UberActivityError(WINDOW_ERROR);
  }

  const offsetMinutes = resolveOffsetMinutes(parsed, options);
  const wallStartMs = toWallClock(startMs, offsetMinutes);
  const wallEndMs = toWallClock(endMs, offsetMinutes);

  const bundles = collectBundles(parsed);
  const warnings = [];
  const rides = [];
  const seen = new Set();

  for (const { profileType, activities } of bundles) {
    for (const activity of activities) {
      const uuid = activity?.uuid ? String(activity.uuid) : null;

      if (!/\/trips\//.test(String(activity?.cardURL ?? ''))) {
        warnings.push(
          `${uuid ?? activity?.subtitle ?? 'atividade'}: cardURL sem /trips/, ignorada`,
        );
        continue;
      }

      if (!uuid) {
        warnings.push(
          `${activity?.subtitle ?? 'atividade'}: sem uuid, ignorada`,
        );
        continue;
      }

      if (seen.has(uuid)) {
        warnings.push(`${uuid}: duplicada, ignorada`);
        continue;
      }

      const description = String(activity?.description ?? '');
      const amountCents = parseAmountCents(description);
      if (amountCents === null) {
        warnings.push(`${uuid}: valor inválido, ignorada`);
        continue;
      }

      const requestedAt = resolveDate(
        parseSubtitle(activity?.subtitle),
        wallStartMs,
        wallEndMs,
      );
      if (!requestedAt) {
        warnings.push(
          `${uuid}: data "${activity?.subtitle ?? ''}" fora da janela, ignorada`,
        );
        continue;
      }

      const segments = splitDescription(description);
      const riderName =
        segments
          .filter(
            (segment) => !isMoneySegment(segment) && !isStatusSegment(segment),
          )
          .pop() ?? null;

      seen.add(uuid);
      rides.push({
        externalId: uuid,
        profileType: profileType ?? options.profileType ?? null,
        riderName,
        requestedAt,
        destination: activity?.title ? String(activity.title) : null,
        amountCents,
        currency: 'BRL',
        status: segments.some(isStatusSegment) ? 'CANCELLED' : 'COMPLETED',
        rideType: classifyRideType(activity?.imageURL),
        rawDescription: description,
      });
    }
  }

  return {
    rides,
    warnings,
    windowStart: new Date(startMs),
    windowEnd: new Date(endMs),
  };
}

// Re-exported for the reconcile/currency helpers and for the service layer.
export {
  UberActivityError,
  parseUberActivities,
  parseAmountCents,
  classifyRideType,
};
