import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import {
  buildTransactionPayload,
  buildTransactionParams,
  emptyTransactionForm,
  errorMessageFrom,
} from './utils/financeHelpers';

// Owns all ledger state and I/O for the finances page: the filtered list, the
// period summary, the manual create/edit form and the delete confirmation.
// Categories live in useFinanceCategories; automatic rows are read-only here.
export function useFinances() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [typeFilter, setTypeFilter] = useState('');
  const [originFilter, setOriginFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');
  const [search, setSearch] = useState('');

  const filters = useMemo(
    () => ({
      type: typeFilter,
      origin: originFilter,
      categoryId: categoryFilter,
      from: fromFilter,
      to: toFilter,
      search,
    }),
    [typeFilter, originFilter, categoryFilter, fromFilter, toFilter, search],
  );

  // The filters that refetch automatically: everything except the free-text
  // term, which is committed only on submit (commitSearch).
  const autoFilters = useMemo(
    () => ({
      type: typeFilter,
      origin: originFilter,
      categoryId: categoryFilter,
      from: fromFilter,
      to: toFilter,
    }),
    [typeFilter, originFilter, categoryFilter, fromFilter, toFilter],
  );

  const [showFormModal, setShowFormModal] = useState(false);
  const [form, setForm] = useState(emptyTransactionForm);
  const [formInitial, setFormInitial] = useState(emptyTransactionForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { addToast } = useToast();

  const loadTransactions = useCallback(
    async (activeFilters = {}, { showLoading = false } = {}) => {
      if (showLoading) setLoading(true);
      else setRefreshing(true);
      try {
        const params = buildTransactionParams(activeFilters);
        const [listRes, summaryRes] = await Promise.all([
          api.get('/finances/transactions', { params }),
          api.get('/finances/summary', { params }),
        ]);
        setTransactions(listRes.data);
        setSummary(summaryRes.data);
        setError('');
      } catch (_err) {
        setError('Erro ao carregar lançamentos. Tente novamente.');
      } finally {
        if (showLoading) setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  // Initial load: this is the only one that shows the full-page spinner.
  useEffect(() => {
    loadTransactions({}, { showLoading: true });
  }, [loadTransactions]);

  // The selects and the period inputs refetch in place (no page-level spinner)
  // so the filters and totals always reflect the current set. The first run is
  // skipped because the initial effect above already loaded the unfiltered set.
  // The guard ref is only read/written inside effects.
  const filtersInitializedRef = useRef(false);
  useEffect(() => {
    if (!filtersInitializedRef.current) {
      filtersInitializedRef.current = true;
      return;
    }
    loadTransactions(autoFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFilters]);

  const setFilters = (patch) => {
    if ('type' in patch) setTypeFilter(patch.type);
    if ('origin' in patch) setOriginFilter(patch.origin);
    if ('categoryId' in patch) setCategoryFilter(patch.categoryId);
    if ('from' in patch) setFromFilter(patch.from);
    if ('to' in patch) setToFilter(patch.to);
    if ('search' in patch) setSearch(patch.search);
  };

  const resetFilters = () => {
    setFilters({
      type: '',
      origin: '',
      categoryId: '',
      from: '',
      to: '',
      search: '',
    });
  };

  const commitSearch = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    loadTransactions(filters);
  };

  const resetForm = () => {
    setForm(emptyTransactionForm());
    setFormInitial(emptyTransactionForm());
    setFormError('');
  };

  const openCreate = () => {
    resetForm();
    setShowFormModal(true);
  };

  const closeForm = () => {
    setShowFormModal(false);
    resetForm();
  };

  const setFormField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormError('');
  };

  const openEdit = (transaction) => {
    const next = {
      id: transaction.id,
      type: transaction.type,
      amount: String(parseFloat(transaction.amount)),
      description: transaction.description,
      transactionDate: transaction.transactionDate.split('T')[0],
      categoryId: transaction.categoryId || '',
      notes: transaction.notes || '',
    };
    setForm(next);
    setFormInitial(next);
    setFormError('');
    setShowFormModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.description.trim()) {
      setFormError('Informe a descrição');
      return;
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setFormError('Informe um valor maior que zero');
      return;
    }
    if (!form.transactionDate) {
      setFormError('Informe a data');
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildTransactionPayload(form);
      if (form.id) {
        await api.put(`/finances/transactions/${form.id}`, payload);
        addToast('Lançamento atualizado com sucesso!', 'success');
      } else {
        await api.post('/finances/transactions', payload);
        addToast('Lançamento criado com sucesso!', 'success');
      }
      closeForm();
      loadTransactions(filters);
    } catch (err) {
      setFormError(
        errorMessageFrom(err, 'Erro ao salvar lançamento. Tente novamente.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const requestDelete = (id) => {
    setConfirmDeleteId(id);
  };

  const cancelDelete = () => {
    setConfirmDeleteId(null);
  };

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      await api.delete(`/finances/transactions/${confirmDeleteId}`);
      addToast('Lançamento excluído com sucesso!', 'success');
      loadTransactions(filters);
    } catch (_err) {
      addToast('Erro ao excluir lançamento. Tente novamente.', 'error');
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  const formDirty = useDirtyForm(form, formInitial).isDirty;

  return {
    transactions,
    summary,
    loading,
    refreshing,
    error,
    filters,
    setFilters,
    resetFilters,
    commitSearch,
    showFormModal,
    form,
    formError,
    submitting,
    formDirty,
    openCreate,
    openEdit,
    closeForm,
    setFormField,
    handleSubmit,
    confirmDeleteId,
    deleting,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}
