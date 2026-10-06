import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import * as uberRidesApi from '../../services/uberRidesApi';
import { errorMessageFrom } from '../Finances/utils/financeHelpers';
import {
  buildRideLaunchItem,
  filterRides,
  makeSelection,
  pickDefaultMatch,
  saleLabelFromMatch,
  summarizeRides,
} from './utils/uberRideHelpers';

const emptyImportForm = () => ({ json: '', windowStart: '', windowEnd: '' });
const emptyFilters = () => ({
  status: '',
  profileType: '',
  rideType: '',
  launched: '',
  search: '',
});

// Persisted flag: once the user asks not to see the welcome orientation again,
// "Importar corridas" opens the import modal straight away.
const WELCOME_DISMISSED_KEY = 'uber-rides-welcome-dismissed';

const isWelcomeDismissed = () => {
  try {
    return localStorage.getItem(WELCOME_DISMISSED_KEY) === 'true';
  } catch (_err) {
    return false;
  }
};

// Converts a `datetime-local` value (local time) into an ISO-8601 instant so the
// window never depends on the server timezone.
const toIsoInstant = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

// Owns the Uber rides page state: the ride list, client-side filters, the
// import modal form and the per-ride selection/category/description used to
// launch expenses. Also owns the one-time welcome orientation (token + install
// steps): `openImport` routes through it until the user dismisses it.
// `initialView` ('welcome' | 'import' | null) opens that modal on mount, so the
// caller (Finances, when embedding the rides flow) decides where to land.
export function useUberRides({ initialView = null } = {}) {
  const { addToast } = useToast();

  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);

  const [filters, setFiltersState] = useState(emptyFilters);
  const [selections, setSelections] = useState({});
  const [expandedRideId, setExpandedRideId] = useState(null);
  const [launchingRideId, setLaunchingRideId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  // Rides are usually paid with a credit card, so a new row starts with the card
  // payment on. The invoice date is sticky in the session: the last used date
  // pre-fills the next row opened (same invoice = less typing).
  const [lastInvoiceDate, setLastInvoiceDate] = useState('');

  const [showImport, setShowImport] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [importForm, setImportForm] = useState(emptyImportForm);
  const [importSnapshot, setImportSnapshot] = useState(null);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);

  const loadRides = useCallback(async ({ showLoading = false } = {}) => {
    if (showLoading) setLoading(true);
    try {
      const response = await uberRidesApi.listRides();
      setRides(response.data);
      setError('');
    } catch (_err) {
      setError('Erro ao carregar as corridas. Tente novamente.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRides({ showLoading: true });
  }, [loadRides]);

  useEffect(() => {
    let active = true;
    api
      .get('/finances/categories')
      .then(({ data }) => {
        if (active) setCategories(data);
      })
      .catch(() => {
        if (active) setCategories([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const expenseCategories = useMemo(
    () =>
      categories.filter(
        (category) => category.type === 'DESPESA' && category.active,
      ),
    [categories],
  );

  const defaultCategoryId = useMemo(
    () =>
      expenseCategories.find((category) => category.name === 'Transporte')
        ?.id ?? '',
    [expenseCategories],
  );

  const setFilters = (patch) =>
    setFiltersState((previous) => ({ ...previous, ...patch }));

  const resetFilters = () => setFiltersState(emptyFilters());

  const visibleRides = useMemo(
    () => filterRides(rides, filters),
    [rides, filters],
  );

  const summary = useMemo(() => summarizeRides(rides), [rides]);

  // Totalizer for the currently applied filter: same shape as `summary`, but
  // derived from the visible (filtered) rides.
  const visibleSummary = useMemo(
    () => summarizeRides(visibleRides),
    [visibleRides],
  );

  const setRideField = useCallback((rideId, patch) => {
    setSelections((previous) => ({
      ...previous,
      [rideId]: { ...previous[rideId], ...patch },
    }));
  }, []);

  // Expands/collapses the inline form of one row (one at a time). Opening it
  // seeds the per-row state once; later edits survive a collapse.
  const openRideForm = useCallback(
    (ride) => {
      setExpandedRideId((current) => (current === ride.id ? null : ride.id));
      setSelections((previous) => {
        if (previous[ride.id]) return previous;
        return {
          ...previous,
          [ride.id]: makeSelection(ride, {
            defaultCategoryId,
            defaultMatch: pickDefaultMatch(ride),
            defaultEffectiveDate: lastInvoiceDate,
          }),
        };
      });
    },
    [defaultCategoryId, lastInvoiceDate],
  );

  // Switches the row between a suggested reconciliation and a plain launch.
  // Picking a match also mirrors its sale (read-only) into the form.
  const selectRideMatch = useCallback((ride, match) => {
    setSelections((previous) => ({
      ...previous,
      [ride.id]: {
        ...previous[ride.id],
        matchTransactionId: match?.transactionId ?? null,
        orderId: match?.orderId ?? null,
        orderLabel: saleLabelFromMatch(match),
      },
    }));
  }, []);

  const openImport = () => {
    // First visit (or after the user re-opens the orientation) routes through
    // the welcome modal so the extension/token setup is explained before the
    // JSON paste form.
    if (!isWelcomeDismissed()) {
      setShowWelcome(true);
      return;
    }
    openImportForm();
  };

  const openImportForm = () => {
    setImportForm(emptyImportForm());
    setImportSnapshot(emptyImportForm());
    setImportError('');
    setShowImport(true);
  };

  const openWelcome = () => setShowWelcome(true);

  const closeWelcome = () => setShowWelcome(false);

  // The caller can ask for a specific modal on mount (e.g. Finances opens the
  // rides flow straight into the welcome orientation on a first visit).
  useEffect(() => {
    if (initialView === 'welcome') {
      setShowWelcome(true);
    } else if (initialView === 'import') {
      openImportForm();
    }
    // Mount-only: `initialView` is a seed, not a controlled prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeImport = () => {
    setShowImport(false);
    setImportForm(emptyImportForm());
    setImportSnapshot(null);
    setImportError('');
  };

  const setImportField = (field, value) => {
    setImportForm((previous) => ({ ...previous, [field]: value }));
    setImportError('');
  };

  const importDirty = useDirtyForm(importForm, importSnapshot).isDirty;

  const submitImport = async () => {
    if (!importForm.json.trim()) {
      setImportError('Cole o JSON gerado pelo script do Uber.');
      return;
    }

    setImporting(true);
    setImportError('');
    try {
      const { data } = await uberRidesApi.importRides({
        source: 'UBER_SESSION',
        json: importForm.json,
        windowStart: toIsoInstant(importForm.windowStart),
        windowEnd: toIsoInstant(importForm.windowEnd),
      });
      const parts = [
        `${data.created} nova(s)`,
        `${data.updated} atualizada(s)`,
      ];
      if (data.cancelled > 0) parts.push(`${data.cancelled} cancelada(s)`);
      addToast(
        `Importação concluída: ${data.total} corrida(s) processada(s) (${parts.join(', ')}).`,
        'success',
      );
      closeImport();
      setSelections({});
      await loadRides();
    } catch (err) {
      setImportError(
        errorMessageFrom(err, 'Não foi possível importar as corridas.'),
      );
    } finally {
      setImporting(false);
    }
  };

  // Effectivates one row: reconciles the pre-selected match when requested,
  // otherwise launches a new expense (with the row's optional card payment).
  const submitRide = useCallback(
    async (ride, { reconcile = false } = {}) => {
      const selection = selections[ride.id];
      if (!selection) return;

      if (!reconcile && selection.card && !selection.effectiveDate) {
        addToast(
          'Informe a data da fatura do cartão de crédito para lançar.',
          'error',
        );
        return;
      }

      setLaunchingRideId(ride.id);
      try {
        const item = buildRideLaunchItem(ride, selection, { reconcile });
        const payment =
          !reconcile && selection.card
            ? { type: 'CARTAO_CREDITO', effectiveDate: selection.effectiveDate }
            : null;
        await uberRidesApi.createRideExpenses([item], payment);
        addToast(
          reconcile
            ? 'Lançamento conciliado no financeiro.'
            : 'Despesa lançada no financeiro.',
          'success',
        );
        if (!reconcile && selection.card && selection.effectiveDate) {
          setLastInvoiceDate(selection.effectiveDate);
        }
        setSelections((previous) => {
          const { [ride.id]: _removed, ...rest } = previous;
          return rest;
        });
        setExpandedRideId(null);
        await loadRides();
      } catch (err) {
        addToast(
          errorMessageFrom(
            err,
            reconcile
              ? 'Não foi possível conciliar o lançamento.'
              : 'Não foi possível lançar a despesa.',
          ),
          'error',
        );
      } finally {
        setLaunchingRideId(null);
      }
    },
    [selections, addToast, loadRides],
  );

  const launchRide = useCallback((ride) => submitRide(ride), [submitRide]);

  const reconcileRide = useCallback(
    (ride) => submitRide(ride, { reconcile: true }),
    [submitRide],
  );

  // Deletes a ride the user discarded from the import list. Persisted in the
  // backend, so the row is gone for good; the list is refetched to keep the
  // summary cards and totalizer in sync. The selection entry is pruned so no
  // orphan id lingers in the state.
  const removeRide = async (ride) => {
    setDeletingId(ride.id);
    try {
      await uberRidesApi.deleteRide(ride.id);
      addToast('Corrida removida.', 'success');
      setSelections((previous) => {
        const { [ride.id]: _removed, ...rest } = previous;
        return rest;
      });
      await loadRides();
    } catch (err) {
      addToast(
        errorMessageFrom(err, 'Não foi possível remover a corrida.'),
        'error',
      );
    } finally {
      setDeletingId(null);
    }
  };

  return {
    rides,
    visibleRides,
    loading,
    error,
    categories: expenseCategories,
    defaultCategoryId,
    filters,
    setFilters,
    resetFilters,
    summary,
    visibleSummary,
    selections,
    expandedRideId,
    launchingRideId,
    openRideForm,
    setRideField,
    selectRideMatch,
    launchRide,
    reconcileRide,
    removingRideId: deletingId,
    removeRide,
    showImport,
    importForm,
    importError,
    importing,
    importDirty,
    openImport,
    openImportForm,
    closeImport,
    setImportField,
    submitImport,
    showWelcome,
    openWelcome,
    closeWelcome,
  };
}
