import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import { toCents } from '../../utils/money';
import { hasNetAmount } from '../../utils/paymentFee';
import {
  getTodayString,
  toLocalDateInput,
  getSelectedBalance,
  getSelectedPendingCents,
  isSelectedZeroItem,
  getPersonItems,
  getPersonPayments,
  paymentPayload,
  editPaymentPayload,
} from '../Orders/utils/receivablesHelpers';
import { getSaleClientName, getSalePendingCents } from './utils/saleHelpers';

export function useSalePayments({ refreshSales, sales = [], loading = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const detailsDeepLinkRef = useRef(false);
  const paymentDoneRef = useRef(null);
  const editPaymentDoneRef = useRef(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [balances, setBalances] = useState([]);
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNetAmount, setPaymentNetAmount] = useState('');
  const [paymentPassesGatewayFeeToClient, setPaymentPassesGatewayFeeToClient] =
    useState(false);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(getTodayString());
  const [paymentType, setPaymentType] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showOverpayConfirm, setShowOverpayConfirm] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailSale, setDetailSale] = useState(null);
  const [detailBalances, setDetailBalances] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState('');
  const [editPaymentNetAmount, setEditPaymentNetAmount] = useState('');
  const [
    editPaymentPassesGatewayFeeToClient,
    setEditPaymentPassesGatewayFeeToClient,
  ] = useState(false);
  const [editPaymentNotes, setEditPaymentNotes] = useState('');
  const [editPaymentDate, setEditPaymentDate] = useState(getTodayString());
  const [editPaymentType, setEditPaymentType] = useState('');
  const [editPaymentError, setEditPaymentError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [showEditOverpayConfirm, setShowEditOverpayConfirm] = useState(false);
  const [paymentInitial, setPaymentInitial] = useState(null);
  const [editPaymentInitial, setEditPaymentInitial] = useState(null);
  const { addToast } = useToast();

  // A sale has a single fixed client; the first balance is auto-selected.
  // `prefill` (used by the InfinitePay import) overrides the payment fields and
  // registers `onDone(submitted)` to run when the payment form closes.
  const openPaymentModal = async (sale, prefill = {}) => {
    const resolvedDate = prefill.paymentDate ?? getTodayString();
    const hasAmountPrefill = prefill.paymentAmount !== undefined;

    setSelectedSale(sale);
    setSelectedPersonId('');
    setPaymentAmount(hasAmountPrefill ? prefill.paymentAmount : '');
    setPaymentNetAmount(prefill.paymentNetAmount ?? '');
    setPaymentPassesGatewayFeeToClient(
      prefill.passesGatewayFeeToClient ?? !!sale?.passesGatewayFeeToClient,
    );
    setPaymentNotes(prefill.paymentNotes ?? '');
    setPaymentDate(resolvedDate);
    setPaymentType(prefill.paymentType ?? '');
    setPaymentError('');
    setBalances([]);
    paymentDoneRef.current =
      typeof prefill.onDone === 'function' ? prefill.onDone : null;

    try {
      const response = await api.get(`/orders/${sale.id}/balance`);
      const responseBalances = response.data.balances;
      setBalances(responseBalances);
      let selectedPersonId = '';
      let paymentAmount = hasAmountPrefill ? prefill.paymentAmount : '';
      if (responseBalances.length > 0) {
        selectedPersonId = responseBalances[0].personId;
        if (!hasAmountPrefill) {
          paymentAmount =
            toCents(responseBalances[0].itemTotal) === 0 ? '0' : '';
        }
        setSelectedPersonId(selectedPersonId);
        setPaymentAmount(paymentAmount);
      }
      setPaymentInitial({
        selectedPersonId,
        paymentAmount,
        paymentNetAmount: prefill.paymentNetAmount ?? '',
        paymentPassesGatewayFeeToClient:
          prefill.passesGatewayFeeToClient ?? !!sale?.passesGatewayFeeToClient,
        paymentNotes: prefill.paymentNotes ?? '',
        paymentDate: resolvedDate,
        paymentType: prefill.paymentType ?? '',
      });
      setShowPaymentModal(true);
    } catch (_err) {
      paymentDoneRef.current = null;
      addToast('Erro ao carregar saldo da venda.', 'error');
      if (typeof prefill.onDone === 'function') prefill.onDone(false);
    }
  };

  const openPaymentModalPrefilled = (sale, prefill) =>
    openPaymentModal(sale, prefill);

  const closePaymentModal = () => {
    const done = paymentDoneRef.current;
    paymentDoneRef.current = null;
    setShowPaymentModal(false);
    setSelectedSale(null);
    setBalances([]);
    setSelectedPersonId('');
    setPaymentAmount('');
    setPaymentNetAmount('');
    setPaymentPassesGatewayFeeToClient(false);
    setPaymentNotes('');
    setPaymentDate(getTodayString());
    setPaymentType('');
    setPaymentError('');
    setPaymentInitial(null);
    if (done) done(false);
  };

  const handleChangeAmount = (value) => {
    setPaymentAmount(value);
    setPaymentError('');
  };

  const handleChangeNetAmount = (value) => {
    setPaymentNetAmount(value);
    setPaymentError('');
  };

  const handleChangePassesGatewayFeeToClient = (value) => {
    setPaymentPassesGatewayFeeToClient(value);
  };

  const handleChangeNotes = (value) => {
    setPaymentNotes(value);
  };

  const handleChangeDate = (value) => {
    setPaymentDate(value);
  };

  const handleChangePaymentType = (value) => {
    setPaymentType(value);
    // The net field is only meaningful for InfinitePay; clear it otherwise so
    // a previously typed value is not submitted with another payment type.
    if (value !== 'INFINITE_PAY') setPaymentNetAmount('');
  };

  const submitPayment = async () => {
    try {
      setSubmitting(true);
      await api.post(
        `/orders/${selectedSale.id}/payments`,
        paymentPayload({
          paymentAmount,
          paymentNetAmount,
          paymentPassesGatewayFeeToClient:
            paymentType === 'INFINITE_PAY'
              ? paymentPassesGatewayFeeToClient
              : undefined,
          selectedPersonId,
          paymentDate,
          paymentNotes,
          paymentType,
        }),
      );
      addToast('Pagamento registrado com sucesso!', 'success');
      const done = paymentDoneRef.current;
      paymentDoneRef.current = null;
      closePaymentModal();
      refreshSales();
      if (done) done(true);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        'Erro ao registrar pagamento. Tente novamente.';
      if (typeof msg === 'string' && msg.includes('greater than zero')) {
        addToast('Valor deve ser maior que zero', 'error');
      } else {
        addToast(msg, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setPaymentError('');

    const amountCents = toCents(parseFloat(paymentAmount || '0'));

    if (amountCents < 0) {
      setPaymentError('Valor não pode ser negativo');
      return;
    }

    // The net amount cannot exceed the charged amount (the fee cannot be
    // negative). When no net is informed there is no fee, so it equals amount.
    const netProvided = hasNetAmount(paymentNetAmount);
    const netCents = netProvided
      ? toCents(parseFloat(paymentNetAmount || '0'))
      : amountCents;
    if (netProvided && netCents > amountCents) {
      setPaymentError('Valor líquido não pode ser maior que o valor cobrado');
      return;
    }

    if (!selectedPersonId) {
      setPaymentError('Selecione uma pessoa');
      return;
    }

    const selectedBalance = getSelectedBalance(balances, selectedPersonId);

    if (selectedBalance && selectedBalance.isSelf) {
      return;
    }

    if (
      selectedBalance &&
      toCents(selectedBalance.itemTotal) > 0 &&
      amountCents === 0
    ) {
      setPaymentError('Valor deve ser maior que zero');
      return;
    }

    const pendingCents = getSelectedPendingCents(balances, selectedPersonId);

    // The overpayment guard compares what settles the debt (the net received)
    // against the pending balance, so an intentional gateway fee passed on to
    // the client (charged > pending, net == pending) does not warn.
    if (netCents > pendingCents) {
      setShowOverpayConfirm(true);
      return;
    }

    await submitPayment();
  };

  const confirmOverpay = () => {
    setShowOverpayConfirm(false);
    submitPayment();
  };

  const cancelOverpay = () => {
    setShowOverpayConfirm(false);
  };

  // Seeds the edit-payment form from a payment. `overrides` replaces the
  // statement-derived fields when the form is opened from the InfinitePay
  // import (see `openEditPaymentModalPrefilled`); `sale` supplies the
  // sale-level fee flag default without reading stale `detailSale` state.
  const applyEditPaymentForm = (payment, overrides = {}, sale = detailSale) => {
    const amount =
      overrides.paymentAmount !== undefined
        ? overrides.paymentAmount
        : String(parseFloat(payment.amount));
    const netAmount =
      overrides.paymentNetAmount !== undefined
        ? overrides.paymentNetAmount
        : payment.netAmount != null
          ? String(parseFloat(payment.netAmount))
          : '';
    const notes =
      overrides.paymentNotes !== undefined
        ? overrides.paymentNotes
        : payment.notes || '';
    const date =
      overrides.paymentDate !== undefined
        ? overrides.paymentDate
        : toLocalDateInput(payment.paidAt);
    const type =
      overrides.paymentType !== undefined
        ? overrides.paymentType
        : payment.paymentType || '';
    const passesGatewayFeeToClient =
      overrides.passesGatewayFeeToClient !== undefined
        ? overrides.passesGatewayFeeToClient
        : !!sale?.passesGatewayFeeToClient;

    setEditingPayment(payment);
    setEditPaymentAmount(amount);
    setEditPaymentNetAmount(netAmount);
    setEditPaymentPassesGatewayFeeToClient(passesGatewayFeeToClient);
    setEditPaymentNotes(notes);
    setEditPaymentDate(date);
    setEditPaymentType(type);
    setEditPaymentError('');
    setShowEditOverpayConfirm(false);
    setEditPaymentInitial({
      paymentAmount: amount,
      paymentNetAmount: netAmount,
      paymentPassesGatewayFeeToClient: passesGatewayFeeToClient,
      paymentNotes: notes,
      paymentDate: date,
      paymentType: type,
    });
    setShowEditPaymentModal(true);
  };

  const openEditPaymentModal = (payment) => applyEditPaymentForm(payment);

  // Opens the edit form for an InfinitePay payment already on a sale, using the
  // imported statement values (used when the pending balance is just the
  // gateway fee). Loads the balance so the modal shows the pending total, and
  // mirrors the creation callback through `prefill.onDone`.
  const openEditPaymentModalPrefilled = async (sale, payment, prefill = {}) => {
    editPaymentDoneRef.current =
      typeof prefill.onDone === 'function' ? prefill.onDone : null;
    setDetailSale(sale);
    setDetailBalances([]);

    try {
      const response = await api.get(`/orders/${sale.id}/balance`);
      setDetailBalances(response.data.balances || []);
      applyEditPaymentForm(payment, prefill, sale);
    } catch (_err) {
      editPaymentDoneRef.current = null;
      addToast('Erro ao carregar saldo da venda.', 'error');
      if (typeof prefill.onDone === 'function') prefill.onDone(false);
    }
  };

  const closeEditPaymentModal = () => {
    const done = editPaymentDoneRef.current;
    editPaymentDoneRef.current = null;
    setShowEditPaymentModal(false);
    setEditingPayment(null);
    setEditPaymentAmount('');
    setEditPaymentNetAmount('');
    setEditPaymentPassesGatewayFeeToClient(false);
    setEditPaymentNotes('');
    setEditPaymentDate(getTodayString());
    setEditPaymentType('');
    setEditPaymentError('');
    setShowEditOverpayConfirm(false);
    setEditPaymentInitial(null);
    if (done) done(false);
  };

  const handleChangeEditAmount = (value) => {
    setEditPaymentAmount(value);
    setEditPaymentError('');
  };

  const handleChangeEditNetAmount = (value) => {
    setEditPaymentNetAmount(value);
    setEditPaymentError('');
  };

  const handleChangeEditPassesGatewayFeeToClient = (value) => {
    setEditPaymentPassesGatewayFeeToClient(value);
  };

  const handleChangeEditNotes = (value) => {
    setEditPaymentNotes(value);
  };

  const handleChangeEditDate = (value) => {
    setEditPaymentDate(value);
  };

  const handleChangeEditPaymentType = (value) => {
    setEditPaymentType(value);
    if (value !== 'INFINITE_PAY') setEditPaymentNetAmount('');
  };

  const refreshDetailBalance = async () => {
    if (!detailSale) return;
    try {
      const response = await api.get(`/orders/${detailSale.id}/balance`);
      setDetailBalances(response.data.balances || []);
    } catch (_err) {
      addToast('Erro ao carregar detalhamento da venda.', 'error');
    }
  };

  const submitEditPayment = async () => {
    try {
      setEditSubmitting(true);
      const editedPayment = editingPayment;
      await api.put(
        `/orders/payments/${editedPayment.id}`,
        editPaymentPayload({
          paymentAmount: editPaymentAmount,
          paymentNetAmount: editPaymentNetAmount,
          paymentPassesGatewayFeeToClient:
            editPaymentType === 'INFINITE_PAY'
              ? editPaymentPassesGatewayFeeToClient
              : undefined,
          paymentDate: editPaymentDate,
          paymentNotes: editPaymentNotes,
          paymentType: editPaymentType,
        }),
      );
      addToast('Pagamento atualizado com sucesso!', 'success');
      const done = editPaymentDoneRef.current;
      editPaymentDoneRef.current = null;
      closeEditPaymentModal();
      if (detailSale) {
        setDetailSale({
          ...detailSale,
          passesGatewayFeeToClient:
            editPaymentType === 'INFINITE_PAY'
              ? editPaymentPassesGatewayFeeToClient
              : detailSale.passesGatewayFeeToClient,
          payments: (detailSale.payments || []).map((p) =>
            p.id === editedPayment.id
              ? {
                  ...p,
                  amount: editPaymentAmount,
                  netAmount: hasNetAmount(editPaymentNetAmount)
                    ? parseFloat(editPaymentNetAmount)
                    : null,
                  paidAt: editPaymentDate
                    ? new Date(`${editPaymentDate}T12:00:00`).toISOString()
                    : p.paidAt,
                  notes: editPaymentNotes.trim() || null,
                  paymentType: editPaymentType || null,
                }
              : p,
          ),
        });
        await refreshDetailBalance();
      }
      refreshSales();
      if (done) done(true);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        'Erro ao atualizar pagamento. Tente novamente.';
      if (typeof msg === 'string' && msg.includes('greater than zero')) {
        setEditPaymentError('Valor deve ser maior que zero');
      } else if (typeof msg === 'string' && msg.includes('Payment not found')) {
        setEditPaymentError('Pagamento não encontrado');
      } else {
        addToast(msg, 'error');
      }
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditPaymentError('');

    const amountCents = toCents(parseFloat(editPaymentAmount || '0'));

    if (amountCents < 0) {
      setEditPaymentError('Valor não pode ser negativo');
      return;
    }

    const netProvided = hasNetAmount(editPaymentNetAmount);
    const netCents = netProvided
      ? toCents(parseFloat(editPaymentNetAmount || '0'))
      : amountCents;
    if (netProvided && netCents > amountCents) {
      setEditPaymentError(
        'Valor líquido não pode ser maior que o valor cobrado',
      );
      return;
    }

    const isSelf = !!(editBalance && editBalance.isSelf);

    if (
      !isSelf &&
      editBalance &&
      toCents(editBalance.itemTotal) > 0 &&
      amountCents === 0
    ) {
      setEditPaymentError('Valor deve ser maior que zero');
      return;
    }

    if (!isSelf && netCents > editPendingCents) {
      setShowEditOverpayConfirm(true);
      return;
    }

    await submitEditPayment();
  };

  const confirmEditOverpay = () => {
    setShowEditOverpayConfirm(false);
    submitEditPayment();
  };

  const cancelEditOverpay = () => {
    setShowEditOverpayConfirm(false);
  };

  const openDetailsModal = async (sale) => {
    setDetailSale(sale);
    setDetailBalances([]);
    setDetailLoading(true);
    setShowDetailsModal(true);

    try {
      const response = await api.get(`/orders/${sale.id}/balance`);
      setDetailBalances(response.data.balances || []);
    } catch (_err) {
      addToast('Erro ao carregar detalhamento da venda.', 'error');
      closeDetailsModal();
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setDetailSale(null);
    setDetailBalances([]);
  };

  const getDetailPersonItems = (personId) =>
    getPersonItems(detailSale, personId);

  const getDetailPersonPayments = (personId) =>
    getPersonPayments(detailSale, personId);

  // Support deep-linking from the finances ledger and the client details via
  // ?detailsSale=. Opens the details modal for the referenced sale once data
  // loads.
  useEffect(() => {
    const detailsSaleParam = searchParams.get('detailsSale');
    if (!detailsSaleParam || detailsDeepLinkRef.current || loading) return;
    const sale = sales.find((s) => s.id === detailsSaleParam);
    if (!sale) return;
    detailsDeepLinkRef.current = true;
    setSearchParams({}, { replace: true });
    openDetailsModal(sale);
  }, [searchParams, loading, sales, openDetailsModal, setSearchParams]);

  const orderPendingCents = selectedSale
    ? getSalePendingCents(selectedSale)
    : 0;
  const selectedPendingCents = getSelectedPendingCents(
    balances,
    selectedPersonId,
  );
  const selectedIsZeroItem = isSelectedZeroItem(balances, selectedPersonId);
  const selectedPersonItems = getPersonItems(selectedSale, selectedPersonId);
  const clientName = selectedSale ? getSaleClientName(selectedSale) : '';

  const editBalance = editingPayment
    ? detailBalances.find((b) => b.personId === editingPayment.personId) || null
    : null;
  const editPendingCents = editBalance ? toCents(editBalance.pending) : 0;
  const editIsZeroItem = editBalance
    ? toCents(editBalance.itemTotal) === 0
    : false;
  const editPersonName = editBalance
    ? editBalance.personName
    : (editingPayment && editingPayment.person && editingPayment.person.name) ||
      '';

  const paymentDirty = useDirtyForm(
    {
      selectedPersonId,
      paymentAmount,
      paymentNetAmount,
      paymentPassesGatewayFeeToClient,
      paymentNotes,
      paymentDate,
      paymentType,
    },
    paymentInitial,
  ).isDirty;

  const editPaymentDirty = useDirtyForm(
    {
      paymentAmount: editPaymentAmount,
      paymentNetAmount: editPaymentNetAmount,
      paymentPassesGatewayFeeToClient: editPaymentPassesGatewayFeeToClient,
      paymentNotes: editPaymentNotes,
      paymentDate: editPaymentDate,
      paymentType: editPaymentType,
    },
    editPaymentInitial,
  ).isDirty;

  return {
    showPaymentModal,
    selectedSale,
    balances,
    selectedPersonId,
    paymentAmount,
    paymentNetAmount,
    paymentPassesGatewayFeeToClient,
    paymentNotes,
    paymentDate,
    paymentType,
    paymentError,
    submitting,
    showOverpayConfirm,
    orderPendingCents,
    selectedPendingCents,
    selectedIsZeroItem,
    selectedPersonItems,
    clientName,
    showDetailsModal,
    detailSale,
    detailLoading,
    openPaymentModal,
    openPaymentModalPrefilled,
    closePaymentModal,
    handleChangeAmount,
    handleChangeNetAmount,
    handleChangePassesGatewayFeeToClient,
    handleChangeNotes,
    handleChangeDate,
    handleChangePaymentType,
    handlePaymentSubmit,
    confirmOverpay,
    cancelOverpay,
    openDetailsModal,
    closeDetailsModal,
    getDetailPersonItems,
    getDetailPersonPayments,
    showEditPaymentModal,
    editingPayment,
    paymentDirty,
    editPaymentDirty,
    editPaymentAmount,
    editPaymentNetAmount,
    editPaymentPassesGatewayFeeToClient,
    editPaymentNotes,
    editPaymentDate,
    editPaymentType,
    editPaymentError,
    editSubmitting,
    showEditOverpayConfirm,
    editPendingCents,
    editIsZeroItem,
    editPersonName,
    openEditPaymentModal,
    openEditPaymentModalPrefilled,
    closeEditPaymentModal,
    handleChangeEditAmount,
    handleChangeEditNetAmount,
    handleChangeEditPassesGatewayFeeToClient,
    handleChangeEditNotes,
    handleChangeEditDate,
    handleChangeEditPaymentType,
    handleEditSubmit,
    confirmEditOverpay,
    cancelEditOverpay,
  };
}
