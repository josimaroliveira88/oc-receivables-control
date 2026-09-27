// Pure helpers for the Uber rides page: labels, date formatting, the default
// ledger description and selection/launch payload building. No React here so the
// rules stay unit-testable.

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

export const makeSelection = (ride, defaultCategoryId = '') => ({
  selected: true,
  categoryId: defaultCategoryId,
  description: defaultRideDescription(ride),
});

export const buildExpenseItems = (rides, selections = {}) =>
  rides
    .filter((ride) => isRideSelectable(ride) && selections[ride.id]?.selected)
    .map((ride) => ({
      rideId: ride.id,
      categoryId: selections[ride.id].categoryId || null,
      description: selections[ride.id].description.trim() || null,
    }));

export const summarizeRides = (rides = []) => {
  const completed = rides.filter((ride) => ride.status === 'COMPLETED');
  return {
    total: rides.length,
    completed: completed.length,
    cancelled: rides.length - completed.length,
    launched: rides.filter((ride) => ride.launched).length,
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
