// Pure helpers for the Uber rides page: labels, date formatting, the default
// ledger description and selection/launch payload building. No React here so the
// rules stay unit-testable.
import { formatSaleOptionLabel } from '../../../utils/saleOption';
import { formatDateBR } from '../../../utils/dates';

export { formatSaleOptionLabel };

export const RIDE_STATUS_LABELS = {
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
};

export const PROFILE_TYPE_LABELS = {
  PERSONAL: 'Pessoal',
  FAMILY: 'Família',
};

export const RIDE_TYPE_LABELS = {
  RIDE: 'Passageiro',
  DELIVERY: 'Entrega',
  UNKNOWN: 'Não identificado',
};

export const rideStatusLabel = (status) =>
  RIDE_STATUS_LABELS[status] ?? status ?? '—';

export const profileTypeLabel = (profileType) =>
  PROFILE_TYPE_LABELS[profileType] ?? profileType ?? '—';

export const rideTypeLabel = (rideType) => RIDE_TYPE_LABELS[rideType] ?? '—';

// Local `dd/mm/aaaa HH:MM` for a ride start. The value is the rider's local
// wall-clock captured by the script and stored timezone-free (encoded as UTC),
// so it must be rendered from the UTC components — local getters would shift it
// by the viewer's offset.
export const formatRideDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (number) => String(number).padStart(2, '0');
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
};

// Mirrors the backend default: "Uber — Destino (Familiar)".
export const defaultRideDescription = (ride) => {
  const parts = ['Uber'];
  if (ride?.destination) parts.push(`— ${ride.destination}`);
  if (ride?.riderName) parts.push(`(${ride.riderName})`);
  return parts.join(' ');
};

// Only completed rides that were not launched yet can generate an expense.
export const isRideSelectable = (ride) =>
  ride?.status === 'COMPLETED' && !ride?.launched;

// Human label for a suggested match (ledger row with the same value): the
// transaction date plus its existing description.
export const formatRideMatchLabel = (match) =>
  [formatDateBR(match?.transactionDate), match?.description]
    .filter(Boolean)
    .join(' — ');

export const MATCH_ORIGIN_LABELS = {
  MANUAL: 'Manual',
  VENDA_ADICIONAL: 'Venda adicional',
};

export const matchOriginLabel = (origin) =>
  MATCH_ORIGIN_LABELS[origin] ?? origin ?? '';

// Sale label of a matched row, shaped like the picker option so the matched
// row's existing sale can be shown read-only.
export const saleLabelFromMatch = (match) =>
  match?.orderNumber
    ? formatSaleOptionLabel({
        orderNumber: match.orderNumber,
        clientName: match.clientName,
        totalValue: match.saleTotalValue,
      })
    : '';

// `@db.Date` values arrive as an ISO instant at UTC midnight; a date input wants
// the plain calendar day.
export const matchDateValue = (match) =>
  match?.transactionDate?.slice(0, 10) ?? '';

// The ride's calendar day, read from the UTC parts (the captured wall clock is
// stored timezone-free), shaped for a date input. Used by the "use the ride
// date" shortcut when reconciling a manual entry whose date was mistyped.
export const rideDateValue = (ride) => {
  if (!ride?.requestedAt) return '';
  const date = new Date(ride.requestedAt);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )}`;
};

// Local `dd/mm/aaaa` of the ride date, for the shortcut label.
export const formatRideDate = (ride) => {
  const value = rideDateValue(ride);
  return value ? formatDateBR(value) : '';
};

// Per-row form state. A matched row starts with the most recent suggestion
// pre-selected (see `pickDefaultMatch`), so the user only confirms it; the date
// follows the matched row and can be corrected to the ride's date in the form.
export const makeSelection = (
  ride,
  {
    defaultCategoryId = '',
    defaultMatch = null,
    defaultCard = true,
    defaultEffectiveDate = '',
  } = {},
) => ({
  categoryId: defaultCategoryId,
  description: defaultRideDescription(ride),
  orderId: defaultMatch?.orderId ?? null,
  orderLabel: defaultMatch ? saleLabelFromMatch(defaultMatch) : '',
  matchTransactionId: defaultMatch?.transactionId ?? null,
  transactionDate: matchDateValue(defaultMatch),
  card: defaultCard,
  effectiveDate: defaultEffectiveDate,
});

// Matches arrive newest-first from the API; the first one is the pre-selection.
export const pickDefaultMatch = (ride) => ride?.matches?.[0] ?? null;

// Payload for one row: a single-item batch. Reconciling sends the matched
// transaction id, the (possibly corrected) date and no category/payment (the
// existing row keeps those); a plain launch sends the create fields.
export const buildRideLaunchItem = (
  ride,
  selection,
  { reconcile = false } = {},
) => ({
  rideId: ride.id,
  categoryId: reconcile ? null : selection.categoryId || null,
  description: selection.description.trim() || null,
  orderId: selection.orderId || null,
  ...(reconcile && selection.matchTransactionId
    ? { matchTransactionId: selection.matchTransactionId }
    : {}),
  ...(reconcile && selection.transactionDate
    ? { transactionDate: selection.transactionDate }
    : {}),
});

export const summarizeRides = (rides = []) => {
  const completed = rides.filter((ride) => ride.status === 'COMPLETED');
  return {
    total: rides.length,
    completed: completed.length,
    cancelled: rides.length - completed.length,
    launched: rides.filter((ride) => ride.launched).length,
    totalCents: rides.reduce((total, ride) => total + ride.amountCents, 0),
    pendingCents: completed
      .filter((ride) => !ride.launched)
      .reduce((total, ride) => total + ride.amountCents, 0),
  };
};

export const filterRides = (rides = [], filters = {}) => {
  const term = (filters.search ?? '').trim().toLowerCase();
  const onlyPending = filters.launched === 'no';

  return rides.filter((ride) => {
    if (filters.status && ride.status !== filters.status) return false;
    if (filters.profileType && ride.profileType !== filters.profileType) {
      return false;
    }
    if (filters.rideType && ride.rideType !== filters.rideType) return false;
    if (onlyPending && ride.launched) return false;
    if (term) {
      const haystack = `${ride.destination ?? ''} ${ride.riderName ?? ''}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const normalizedTerm = term
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      if (!haystack.includes(normalizedTerm)) return false;
    }
    return true;
  });
};

export const RIDE_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'COMPLETED', label: 'Concluídas' },
  { value: 'CANCELLED', label: 'Canceladas' },
];

export const PROFILE_FILTER_OPTIONS = [
  { value: '', label: 'Todos os perfis' },
  { value: 'PERSONAL', label: 'Pessoal' },
  { value: 'FAMILY', label: 'Família' },
];

export const RIDE_TYPE_FILTER_OPTIONS = [
  { value: '', label: 'Todos os tipos' },
  { value: 'RIDE', label: 'Passageiro' },
  { value: 'DELIVERY', label: 'Entrega' },
  { value: 'UNKNOWN', label: 'Não identificado' },
];
