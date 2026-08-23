import { useState } from 'react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import { toCents } from '../../utils/money';
import {
  getTodayString,
  toLocalDateInput,
  getSelectedBalance,
  getSelectedPendingCents,
  isSelectedZeroItem,
  getOrderPendingCents,
  getPersonItems,
  getPersonPayments,
  paymentPayload,
  editPaymentPayload,
} from './utils/receivablesHelpers';

export function useOrderPayments({ refreshOrders }) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [balances, setBalances] = useState([]);
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(getTodayString());
  const [paymentError, setPaymentError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showOverpayConfirm, setShowOverpayConfirm] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailBalances, setDetailBalances] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedPersonId, setExpandedPersonId] = useState('');
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState('');
  const [editPaymentNotes, setEditPaymentNotes] = useState('');
  const [editPaymentDate, setEditPaymentDate] = useState(getTodayString());
  const [editPaymentError, setEditPaymentError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [showEditOverpayConfirm, setShowEditOverpayConfirm] = useState(false);
  const { addToast } = useToast();

  const openPaymentModal = async (order) => {
    setSelectedOrder(order);
    setSelectedPersonId('');
    setPaymentAmount('');
    setPaymentNotes('');
    setPaymentDate(getTodayString());
    setPaymentError('');
    setBalances([]);

    try {
      const response = await api.get(`/orders/${order.id}/balance`);
      const responseBalances = response.data.balances;
      setBalances(responseBalances);
      if (responseBalances.length > 0) {
        setSelectedPersonId(responseBalances[0].personId);
        const firstBalance = responseBalances[0];
        setPaymentAmount(toCents(firstBalance.itemTotal) === 0 ? '0' : '');
      }
      setShowPaymentModal(true);
    } catch (err) {
      addToast('Erro ao carregar saldo do pedido.', 'error');
    }
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedOrder(null);
    setBalances([]);
    setSelectedPersonId('');
    setPaymentAmount('');
    setPaymentNotes('');
    setPaymentDate(getTodayString());
    setPaymentError('');
  };

  const handleChangePerson = (personId) => {
    const nextBalance = balances.find((b) => b.personId === personId);
    setSelectedPersonId(personId);
    setPaymentAmount(
      nextBalance && toCents(nextBalance.itemTotal) === 0 ? '0' : '',
    );
    setPaymentError('');
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

  const submitPayment = async () => {
    try {
      setSubmitting(true);
      await api.post(
        `/orders/${selectedOrder.id}/payments`,
        paymentPayload({
          paymentAmount,
          selectedPersonId,
          paymentDate,
          paymentNotes,
        }),
      );
      addToast('Pagamento registrado com sucesso!', 'success');
      closePaymentModal();
      refreshOrders();
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
    setEditingPayment(payment);
    setEditPaymentAmount(payment.amount);
    setEditPaymentNotes(payment.notes || '');
    setEditPaymentDate(toLocalDateInput(payment.paidAt));
    setEditPaymentError('');
    setShowEditOverpayConfirm(false);
    setShowEditPaymentModal(true);
  };

  const closeEditPaymentModal = () => {
    setShowEditPaymentModal(false);
    setEditingPayment(null);
    setEditPaymentAmount('');
    setEditPaymentNotes('');
    setEditPaymentDate(getTodayString());
    setEditPaymentError('');
    setShowEditOverpayConfirm(false);
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

  const refreshDetailBalance = async () => {
    if (!detailOrder) return;
    try {
      const response = await api.get(`/orders/${detailOrder.id}/balance`);
      setDetailBalances(response.data.balances || []);
    } catch (err) {
      addToast('Erro ao carregar detalhamento do pedido.', 'error');
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
        }),
      );
      addToast('Pagamento atualizado com sucesso!', 'success');
      closeEditPaymentModal();
      if (detailOrder) {
        setDetailOrder({
          ...detailOrder,
          payments: (detailOrder.payments || []).map((p) =>
            p.id === editedPayment.id
              ? {
                  ...p,
                  amount: editPaymentAmount,
                  paidAt: editPaymentDate
                    ? new Date(`${editPaymentDate}T12:00:00`).toISOString()
                    : p.paidAt,
                  notes: editPaymentNotes.trim() || null,
                }
              : p,
          ),
        });
        await refreshDetailBalance();
      }
      refreshOrders();
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

  const openDetailsModal = async (order) => {
    setDetailOrder(order);
    setDetailBalances([]);
    setExpandedPersonId('');
    setDetailLoading(true);
    setShowDetailsModal(true);

    try {
      const response = await api.get(`/orders/${order.id}/balance`);
      setDetailBalances(response.data.balances || []);
    } catch (err) {
      addToast('Erro ao carregar detalhamento do pedido.', 'error');
      closeDetailsModal();
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setDetailOrder(null);
    setDetailBalances([]);
    setExpandedPersonId('');
  };

  const toggleDetailPerson = (personId) => {
    setExpandedPersonId((prev) => (prev === personId ? '' : personId));
  };

  const getDetailPersonItems = (personId) =>
    getPersonItems(detailOrder, personId);

  const getDetailPersonPayments = (personId) =>
    getPersonPayments(detailOrder, personId);

  const orderPendingCents = getOrderPendingCents(selectedOrder);
  const selectedPendingCents = getSelectedPendingCents(
    balances,
    selectedPersonId,
  );
  const selectedIsZeroItem = isSelectedZeroItem(balances, selectedPersonId);
  const selectedBalance = getSelectedBalance(balances, selectedPersonId);
  const selectedIsSelf = !!selectedBalance && !!selectedBalance.isSelf;
  const selectedPersonItems = getPersonItems(selectedOrder, selectedPersonId);

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

  return {
    showPaymentModal,
    selectedOrder,
    balances,
    selectedPersonId,
    paymentAmount,
    paymentNotes,
    paymentDate,
    paymentError,
    submitting,
    showOverpayConfirm,
    orderPendingCents,
    selectedPendingCents,
    selectedIsZeroItem,
    selectedIsSelf,
    selectedPersonItems,
    showDetailsModal,
    detailOrder,
    detailBalances,
    detailLoading,
    expandedPersonId,
    openPaymentModal,
    closePaymentModal,
    handleChangePerson,
    handleChangeAmount,
    handleChangeNotes,
    handleChangeDate,
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
    editPaymentAmount,
    editPaymentNotes,
    editPaymentDate,
    editPaymentError,
    editSubmitting,
    showEditOverpayConfirm,
    editPendingCents,
    editIsZeroItem,
    editIsSelf,
    editPersonName,
    openEditPaymentModal,
    closeEditPaymentModal,
    handleChangeEditAmount,
    handleChangeEditNotes,
    handleChangeEditDate,
    handleEditSubmit,
    confirmEditOverpay,
    cancelEditOverpay,
  };
}
