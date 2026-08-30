import { useState } from 'react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import { toCents } from '../../utils/money';
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

export function useSalePayments({ refreshSales }) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [balances, setBalances] = useState([]);
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
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
  const [expandedPersonId, setExpandedPersonId] = useState('');
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState('');
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
  const openPaymentModal = async (sale) => {
    setSelectedSale(sale);
    setSelectedPersonId('');
    setPaymentAmount('');
    setPaymentNotes('');
    setPaymentDate(getTodayString());
    setPaymentType('');
    setPaymentError('');
    setBalances([]);

    try {
      const response = await api.get(`/orders/${sale.id}/balance`);
      const responseBalances = response.data.balances;
      setBalances(responseBalances);
      let selectedPersonId = '';
      let paymentAmount = '';
      if (responseBalances.length > 0) {
        selectedPersonId = responseBalances[0].personId;
        const firstBalance = responseBalances[0];
        paymentAmount = toCents(firstBalance.itemTotal) === 0 ? '0' : '';
        setSelectedPersonId(selectedPersonId);
        setPaymentAmount(paymentAmount);
      }
      setPaymentInitial({
        selectedPersonId,
        paymentAmount,
        paymentNotes: '',
        paymentDate: getTodayString(),
        paymentType: '',
      });
      setShowPaymentModal(true);
    } catch (err) {
      addToast('Erro ao carregar saldo da venda.', 'error');
    }
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedSale(null);
    setBalances([]);
    setSelectedPersonId('');
    setPaymentAmount('');
    setPaymentNotes('');
    setPaymentDate(getTodayString());
    setPaymentType('');
    setPaymentError('');
    setPaymentInitial(null);
  };

  const handleChangeAmount = (value) => {
    setPaymentAmount(value);
    setPaymentError('');
  };

  const handleChangeNotes = (value) => {
    setPaymentNotes(value);
  };

  const handleChangeDate = (value) => {
    setPaymentDate(value);
  };

  const handleChangePaymentType = (value) => {
    setPaymentType(value);
  };

  const submitPayment = async () => {
    try {
      setSubmitting(true);
      await api.post(
        `/orders/${selectedSale.id}/payments`,
        paymentPayload({
          paymentAmount,
          selectedPersonId,
          paymentDate,
          paymentNotes,
          paymentType,
        }),
      );
      addToast('Pagamento registrado com sucesso!', 'success');
      closePaymentModal();
      refreshSales();
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        'Erro ao registrar pagamento. Tente novamente.';
      if (typeof msg === 'string' && msg.includes('pending balance')) {
        addToast('Valor excede o saldo pendente', 'error');
      } else if (typeof msg === 'string' && msg.includes('greater than zero')) {
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

    if (amountCents > pendingCents) {
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

  const openEditPaymentModal = (payment) => {
    const paymentAmount = String(parseFloat(payment.amount));
    const paymentNotes = payment.notes || '';
    const paymentDate = toLocalDateInput(payment.paidAt);
    const paymentType = payment.paymentType || '';
    setEditingPayment(payment);
    setEditPaymentAmount(paymentAmount);
    setEditPaymentNotes(paymentNotes);
    setEditPaymentDate(paymentDate);
    setEditPaymentType(paymentType);
    setEditPaymentError('');
    setShowEditOverpayConfirm(false);
    setEditPaymentInitial({
      paymentAmount,
      paymentNotes,
      paymentDate,
      paymentType,
    });
    setShowEditPaymentModal(true);
  };

  const closeEditPaymentModal = () => {
    setShowEditPaymentModal(false);
    setEditingPayment(null);
    setEditPaymentAmount('');
    setEditPaymentNotes('');
    setEditPaymentDate(getTodayString());
    setEditPaymentType('');
    setEditPaymentError('');
    setShowEditOverpayConfirm(false);
    setEditPaymentInitial(null);
  };

  const handleChangeEditAmount = (value) => {
    setEditPaymentAmount(value);
    setEditPaymentError('');
  };

  const handleChangeEditNotes = (value) => {
    setEditPaymentNotes(value);
  };

  const handleChangeEditDate = (value) => {
    setEditPaymentDate(value);
  };

  const handleChangeEditPaymentType = (value) => {
    setEditPaymentType(value);
  };

  const refreshDetailBalance = async () => {
    if (!detailSale) return;
    try {
      const response = await api.get(`/orders/${detailSale.id}/balance`);
      setDetailBalances(response.data.balances || []);
    } catch (err) {
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
          paymentDate: editPaymentDate,
          paymentNotes: editPaymentNotes,
          paymentType: editPaymentType,
        }),
      );
      addToast('Pagamento atualizado com sucesso!', 'success');
      closeEditPaymentModal();
      if (detailSale) {
        setDetailSale({
          ...detailSale,
          payments: (detailSale.payments || []).map((p) =>
            p.id === editedPayment.id
              ? {
                  ...p,
                  amount: editPaymentAmount,
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

    if (!isSelf && amountCents > editPendingCents) {
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
    setExpandedPersonId('');
    setDetailLoading(true);
    setShowDetailsModal(true);

    try {
      const response = await api.get(`/orders/${sale.id}/balance`);
      setDetailBalances(response.data.balances || []);
    } catch (err) {
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
    setExpandedPersonId('');
  };

  const toggleDetailPerson = (personId) => {
    setExpandedPersonId((prev) => (prev === personId ? '' : personId));
  };

  const getDetailPersonItems = (personId) =>
    getPersonItems(detailSale, personId);

  const getDetailPersonPayments = (personId) =>
    getPersonPayments(detailSale, personId);

  const orderPendingCents = selectedSale
    ? getSalePendingCents(selectedSale)
    : 0;
  const selectedPendingCents = getSelectedPendingCents(
    balances,
    selectedPersonId,
  );
  const selectedIsZeroItem = isSelectedZeroItem(balances, selectedPersonId);
  const selectedBalance = getSelectedBalance(balances, selectedPersonId);
  const selectedPersonItems = getPersonItems(selectedSale, selectedPersonId);
  const clientName = selectedSale ? getSaleClientName(selectedSale) : '';

  const editBalance = editingPayment
    ? detailBalances.find((b) => b.personId === editingPayment.personId) || null
    : null;
  const editPendingCents = editBalance ? toCents(editBalance.pending) : 0;
  const editIsZeroItem = editBalance
    ? toCents(editBalance.itemTotal) === 0
    : false;
  const editIsSelf = !!editBalance && !!editBalance.isSelf;
  const editPersonName = editBalance
    ? editBalance.personName
    : (editingPayment && editingPayment.person && editingPayment.person.name) ||
      '';

  const paymentDirty = useDirtyForm(
    {
      selectedPersonId,
      paymentAmount,
      paymentNotes,
      paymentDate,
      paymentType,
    },
    paymentInitial,
  ).isDirty;

  const editPaymentDirty = useDirtyForm(
    {
      paymentAmount: editPaymentAmount,
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
    detailBalances,
    detailLoading,
    expandedPersonId,
    openPaymentModal,
    closePaymentModal,
    handleChangeAmount,
    handleChangeNotes,
    handleChangeDate,
    handleChangePaymentType,
    handlePaymentSubmit,
    confirmOverpay,
    cancelOverpay,
    openDetailsModal,
    closeDetailsModal,
    toggleDetailPerson,
    getDetailPersonItems,
    getDetailPersonPayments,
    showEditPaymentModal,
    editingPayment,
    paymentDirty,
    editPaymentDirty,
    editPaymentAmount,
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
    closeEditPaymentModal,
    handleChangeEditAmount,
    handleChangeEditNotes,
    handleChangeEditDate,
    handleChangeEditPaymentType,
    handleEditSubmit,
    confirmEditOverpay,
    cancelEditOverpay,
  };
}
