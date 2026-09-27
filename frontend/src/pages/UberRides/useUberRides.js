import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import * as uberRidesApi from '../../services/uberRidesApi';
import { errorMessageFrom } from '../Finances/utils/financeHelpers';
import {
  buildExpenseItems,
  filterRides,
  makeSelection,
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

// Converts a `datetime-local` value (local time) into an ISO-8601 instant so the
// window never depends on the server timezone.
const toIsoInstant = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

// Owns the Uber rides page state: the ride list, client-side filters, the
// import modal form and the per-ride selection/category/description used to
// launch expenses.
export function useUberRides() {
  const { addToast } = useToast();

  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);

  const [filters, setFiltersState] = useState(emptyFilters);
  const [selections, setSelections] = useState({});
  const [launching, setLaunching] = useState(false);

  const [showImport, setShowImport] = useState(false);
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

  const setRideField = useCallback((rideId, patch) => {
    setSelections((previous) => ({
      ...previous,
      [rideId]: { ...previous[rideId], ...patch },
    }));
  }, []);

  const clearSelections = useCallback(() => setSelections({}), []);

  const toggleRide = useCallback(
    (ride) => {
      setSelections((previous) => {
        const current = previous[ride.id];
        if (current?.selected) {
          return { ...previous, [ride.id]: { ...current, selected: false } };
        }
        return {
          ...previous,
          [ride.id]: current ?? makeSelection(ride, defaultCategoryId),
        };
      });
    },
    [defaultCategoryId],
  );

  const selectedItems = useMemo(
    () => buildExpenseItems(rides, selections),
    [rides, selections],
  );

  const selectedTotalCents = useMemo(
    () =>
      rides
        .filter((ride) => selections[ride.id]?.selected)
        .reduce((total, ride) => total + ride.amountCents, 0),
    [rides, selections],
  );

  const openImport = () => {
    setImportForm(emptyImportForm());
    setImportSnapshot(emptyImportForm());
    setImportError('');
    setShowImport(true);
  };

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
      const parts = [`${data.total} corrida(s) processada(s)`];
      if (data.cancelled > 0) parts.push(`${data.cancelled} cancelada(s)`);
      addToast(`Importação concluída: ${parts.join(', ')}.`, 'success');
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

  const launchSelected = async () => {
    if (selectedItems.length === 0) {
      addToast('Selecione ao menos uma corrida para lançar.', 'error');
      return;
    }

    setLaunching(true);
    try {
      const response = await uberRidesApi.createRideExpenses(selectedItems);
      addToast(
        `${response.data.length} despesa(s) lançada(s) no financeiro.`,
        'success',
      );
      setSelections({});
      await loadRides();
    } catch (err) {
      addToast(
        errorMessageFrom(err, 'Não foi possível lançar as despesas.'),
        'error',
      );
    } finally {
      setLaunching(false);
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
    selections,
    selectedItems,
    selectedTotalCents,
    launching,
    toggleRide,
    setRideField,
    clearSelections,
    launchSelected,
    showImport,
    importForm,
    importError,
    importing,
    importDirty,
    openImport,
    closeImport,
    setImportField,
    submitImport,
  };
}
