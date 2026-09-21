import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import { useCreditCardBillForm } from '../../hooks/useCreditCardBillForm';
import * as creditCardsApi from '../../services/creditCardsApi';
import { todayString } from '../Finances/utils/financeHelpers';
import { useCreditCardReconcile } from './useCreditCardReconcile';
import { formatBillStatus, summarizeBills } from './utils/creditCardHelpers';

export function useCreditCards() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToast } = useToast();

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [statusFilter, setStatusFilter] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');
  const [search, setSearch] = useState('');

  const [selectedBillId, setSelectedBillId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const deepLinkRef = useRef(false);

  const loadBills = useCallback(async ({ showLoading = false } = {}) => {
    if (showLoading) setLoading(true);
    try {
      const response = await creditCardsApi.listBills();
      setBills(response.data);
      setError('');
    } catch (_err) {
      setError('Erro ao carregar compras. Tente novamente.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBills({ showLoading: true });
  }, [loadBills]);

  const billForm = useCreditCardBillForm({ onSaved: () => loadBills() });

  const reconcile = useCreditCardReconcile({
    onCommitted: () => loadBills(),
    onUndone: () => loadBills(),
  });

  useEffect(() => {
    const deepLinkedId = searchParams.get('bill');
    if (!deepLinkedId || deepLinkRef.current || loading) return;
    deepLinkRef.current = true;
    const found = bills.find((bill) => bill.id === deepLinkedId);
    if (found) {
      setSelectedBillId(found.id);
      setSearchParams({}, { replace: true });
      return;
    }
    addToast('Compra não encontrada.', 'error');
    navigate('/credit-cards', { replace: true });
  }, [searchParams, bills, loading, setSearchParams, navigate, addToast]);

  const filters = useMemo(
    () => ({ status: statusFilter, from: fromFilter, to: toFilter, q: search }),
    [statusFilter, fromFilter, toFilter, search],
  );

  const setFilters = (patch) => {
    if ('status' in patch) setStatusFilter(patch.status);
    if ('from' in patch) setFromFilter(patch.from);
    if ('to' in patch) setToFilter(patch.to);
    if ('q' in patch) setSearch(patch.q);
  };

  const resetFilters = () => {
    setStatusFilter('');
    setFromFilter('');
    setToFilter('');
    setSearch('');
  };

  const visibleBills = useMemo(() => {
    const term = search.trim().toLowerCase();
    return bills.filter((bill) => {
      if (statusFilter && formatBillStatus(bill) !== statusFilter) return false;
      const first = (bill.firstInstallmentAt || '').split('T')[0];
      if (fromFilter && first && first < fromFilter) return false;
      if (toFilter && first && first > toFilter) return false;
      if (term && !bill.description.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [bills, statusFilter, fromFilter, toFilter, search]);

  const summary = useMemo(() => summarizeBills(bills), [bills]);

  const selectedBill = useMemo(
    () => bills.find((bill) => bill.id === selectedBillId) || null,
    [bills, selectedBillId],
  );

  const openBill = (bill) => setSelectedBillId(bill.id);

  const closeBill = () => setSelectedBillId(null);

  const patchInstallment = (billId, installmentId, patch) => {
    setBills((prev) =>
      prev.map((bill) =>
        bill.id !== billId
          ? bill
          : {
              ...bill,
              transactions: bill.transactions.map((transaction) =>
                transaction.id === installmentId
                  ? { ...transaction, ...patch }
                  : transaction,
              ),
            },
      ),
    );
  };

  const handlePayInstallment = async (installment) => {
    const billId = installment.creditCardBillId;
    patchInstallment(billId, installment.id, { isEffective: true });
    try {
      const response = await creditCardsApi.payInstallment(installment.id, {
        paidAt: todayString(),
      });
      patchInstallment(billId, installment.id, response.data);
    } catch (_err) {
      addToast('Erro ao marcar parcela como paga. Tente novamente.', 'error');
      loadBills();
    }
  };

  const handleUnpayInstallment = async (installment) => {
    const billId = installment.creditCardBillId;
    patchInstallment(billId, installment.id, {
      isEffective: false,
      effectiveDate: null,
    });
    try {
      const response = await creditCardsApi.unpayInstallment(installment.id);
      patchInstallment(billId, installment.id, response.data);
    } catch (_err) {
      addToast('Erro ao desfazer a baixa. Tente novamente.', 'error');
      loadBills();
    }
  };

  const handleUndoBatch = async (batchId) => {
    try {
      await creditCardsApi.undoReconcileBatch(batchId);
      addToast('Conciliação desfeita com sucesso!', 'success');
      loadBills();
    } catch (_err) {
      addToast('Erro ao desfazer a conciliação. Tente novamente.', 'error');
    }
  };

  const openBillEdit = (bill) => {
    billForm.openEdit(bill);
    setSelectedBillId(null);
  };

  const requestDelete = (id) => setConfirmDeleteId(id);

  const cancelDelete = () => setConfirmDeleteId(null);

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      await creditCardsApi.deleteBill(confirmDeleteId);
      addToast('Compra excluída com sucesso!', 'success');
      setSelectedBillId(null);
      loadBills();
    } catch (_err) {
      addToast('Erro ao excluir compra. Tente novamente.', 'error');
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  return {
    bills,
    visibleBills,
    loading,
    error,
    filters,
    setFilters,
    resetFilters,
    summary,
    selectedBill,
    openBill,
    closeBill,
    handlePayInstallment,
    handleUnpayInstallment,
    handleUndoBatch,
    showBillForm: billForm.isOpen,
    billForm: billForm.form,
    billFormError: billForm.formError,
    billSubmitting: billForm.submitting,
    billFormDirty: billForm.isDirty,
    openBillCreate: billForm.openCreate,
    openBillEdit,
    closeBillForm: billForm.close,
    setBillField: billForm.setField,
    handleBillSubmit: billForm.handleSubmit,
    confirmDeleteId,
    deleting,
    requestDelete,
    cancelDelete,
    confirmDelete,
    reconcile,
  };
}
