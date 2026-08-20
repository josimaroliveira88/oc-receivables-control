import { useState } from 'react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import { toCents } from '../../utils/money';
import {
  getTodayString,
  getSelectedBalance,
  getSelectedPendingCents,
  isSelectedZeroItem,
  getOrderPendingCents,
  getPersonItems,
  getPersonPayments,
  paymentPayload,
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
  const selectedPersonItems = getPersonItems(selectedOrder, selectedPersonId);

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
  };
}
