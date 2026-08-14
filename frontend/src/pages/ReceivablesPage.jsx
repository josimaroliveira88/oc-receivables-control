import React, { useState, useEffect } from 'react';
import { DollarSign, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import ActionMenu from '../components/ActionMenu';
import { toCents, formatBRL } from '../utils/money';
import { formatDateBR } from '../utils/dates';

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const statusBadge = (status) => {
  const config = {
    PENDENTE: {
      label: 'Pendente',
      dot: 'bg-amber-500',
      className:
        'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    },
    PARCIAL: {
      label: 'Parcial',
      dot: 'bg-blue-500',
      className:
        'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    },
    QUITADO: {
      label: 'Quitado',
      dot: 'bg-emerald-500',
      className:
        'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    },
  };
  const cfg = config[status] || {
    label: status,
    dot: 'bg-gray-500',
    className: 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full ${cfg.className}`}
    >
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

const ReceivablesPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/orders');
      setOrders(response.data);
    } catch (err) {
      setError('Erro ao carregar pedidos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

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
      const balances = response.data.balances;
      setBalances(balances);
      if (balances.length > 0) {
        setSelectedPersonId(balances[0].personId);
        const firstBalance = balances[0];
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

  const getSelectedBalance = () => {
    return balances.find((b) => b.personId === selectedPersonId) || null;
  };

  const getSelectedPendingCents = () => {
    const balance = getSelectedBalance();
    return balance ? toCents(balance.pending) : 0;
  };

  const isSelectedZeroItem = () => {
    const balance = getSelectedBalance();
    return !!balance && toCents(balance.itemTotal) === 0;
  };

  const getOrderPaidCents = () => {
    if (!selectedOrder) return 0;
    return (selectedOrder.payments || []).reduce(
      (sum, p) => sum + toCents(parseFloat(p.amount)),
      0,
    );
  };

  const getOrderPendingCents = () => {
    if (!selectedOrder) return 0;
    return Math.max(
      0,
      toCents(parseFloat(selectedOrder.totalValue)) - getOrderPaidCents(),
    );
  };

  const getSelectedPersonItems = () => {
    if (!selectedOrder || !selectedOrder.items) return [];
    return selectedOrder.items.filter(
      (item) => item.personId === selectedPersonId,
    );
  };

  const submitPayment = async () => {
    try {
      setSubmitting(true);
      await api.post(`/orders/${selectedOrder.id}/payments`, {
        amount: parseFloat(paymentAmount || '0'),
        personId: selectedPersonId,
        paidAt: paymentDate || undefined,
        notes: paymentNotes.trim() || undefined,
      });
      addToast('Pagamento registrado com sucesso!', 'success');
      closePaymentModal();
      fetchOrders();
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

  const getDetailPersonItems = (personId) => {
    if (!detailOrder) return [];
    return (detailOrder.items || []).filter(
      (item) => item.personId === personId,
    );
  };

  const getDetailPersonPayments = (personId) => {
    if (!detailOrder) return [];
    return (detailOrder.payments || []).filter(
      (payment) => payment.personId === personId,
    );
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

    const selectedBalance = getSelectedBalance();

    if (
      selectedBalance &&
      toCents(selectedBalance.itemTotal) > 0 &&
      amountCents === 0
    ) {
      setPaymentError('Valor deve ser maior que zero');
      return;
    }

    const pendingCents = getSelectedPendingCents();

    if (amountCents > pendingCents) {
      setShowOverpayConfirm(true);
      return;
    }

    await submitPayment();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2 text-gray-500 dark:text-gray-400">
          Carregando...
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border-t-4 border-primary-600 dark:border-primary-400">
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            Controle de Recebíveis
          </h2>
        </div>

        <div className="px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {orders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                Nenhum pedido cadastrado
              </p>
            </div>
          ) : (
            <div>
              <table className="w-full text-sm text-left block lg:table lg:table-fixed">
                <thead className="hidden lg:table-header-group bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="w-[9%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Número
                    </th>
                    <th className="w-[9%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Data
                    </th>
                    <th className="w-[13%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Responsável
                    </th>
                    <th className="w-[10%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Valor (R$)
                    </th>
                    <th className="w-[12%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Valor Pendente
                    </th>
                    <th className="w-[8%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      PV Total
                    </th>
                    <th className="w-[11%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Descrição
                    </th>
                    <th className="w-[10%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Status
                    </th>
                    <th className="w-[18%] px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="block lg:table-row-group bg-white dark:bg-gray-800 lg:divide-y divide-gray-200 dark:divide-gray-700">
                  {orders.map((order) => {
                    const totalPV = (order.items || []).reduce(
                      (sum, item) => sum + (parseFloat(item.pv) || 0),
                      0,
                    );
                    const paidCents = (order.payments || []).reduce(
                      (sum, payment) =>
                        sum + toCents(parseFloat(payment.amount)),
                      0,
                    );
                    const totalCents = toCents(parseFloat(order.totalValue));
                    const pendingCents = Math.max(0, totalCents - paidCents);
                    const showPaymentAction =
                      pendingCents > 0 ||
                      (totalCents === 0 && order.status !== 'QUITADO');
                    const paymentActionLabel =
                      totalCents === 0 ? 'Dar baixa' : 'Registrar Pagamento';
                    return (
                      <tr
                        key={order.id}
                        className="block lg:table-row border border-gray-200 dark:border-gray-700 lg:border-0 rounded-lg lg:rounded-none shadow-sm lg:shadow-none mb-3 lg:mb-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <td
                          data-label="Número"
                          className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                        >
                          {order.orderNumber}
                        </td>
                        <td
                          data-label="Data"
                          className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                        >
                          {formatDateBR(order.orderDate)}
                        </td>
                        <td
                          data-label="Responsável"
                          className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 break-words text-sm text-gray-900 dark:text-gray-100 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                        >
                          {order.accountOwner || '—'}
                        </td>
                        <td
                          data-label="Valor (R$)"
                          className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                        >
                          {formatBRL(parseFloat(order.totalValue))}
                        </td>
                        <td
                          data-label="Valor Pendente"
                          className={`block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm ${pendingCents === 0 ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'} before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden`}
                        >
                          {formatBRL(pendingCents / 100)}
                        </td>
                        <td
                          data-label="PV Total"
                          className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                        >
                          {totalPV.toFixed(2)}
                        </td>
                        <td
                          data-label="Descrição"
                          className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                        >
                          {order.orderNotes ? (
                            <span
                              title={order.orderNotes}
                              className="block truncate text-sm text-gray-900 dark:text-gray-100"
                            >
                              {order.orderNotes}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400 dark:text-gray-500">
                              —
                            </span>
                          )}
                        </td>
                        <td
                          data-label="Status"
                          className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                        >
                          {statusBadge(order.status)}
                        </td>
                        <td
                          data-label="Ações"
                          className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 text-left lg:text-right text-sm font-medium before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden relative"
                        >
                          <div className="flex items-center justify-end gap-2">
                            <ActionMenu
                              actions={[
                                ...(showPaymentAction
                                  ? [
                                      {
                                        label: paymentActionLabel,
                                        icon: DollarSign,
                                        variant: 'primary',
                                        onClick: () => openPaymentModal(order),
                                      },
                                    ]
                                  : []),
                                {
                                  label: 'Detalhar',
                                  icon: Eye,
                                  onClick: () => openDetailsModal(order),
                                },
                              ]}
                              ariaLabel="Ações do pedido"
                              testIdPrefix={`receivable-actions-${order.id}`}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showPaymentModal && selectedOrder && (
        <div
          data-testid="payment-modal"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Registrar Pagamento — {selectedOrder.orderNumber}
              </h3>
              <button
                onClick={closePaymentModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handlePaymentSubmit} className="px-6 py-4">
              <div className="mb-4 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">
                      Número
                    </dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {selectedOrder.orderNumber}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">
                      Data
                    </dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatDateBR(selectedOrder.orderDate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">
                      Responsável
                    </dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {selectedOrder.accountOwner || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">
                      Valor Total
                    </dt>
                    <dd
                      data-testid="order-summary-total"
                      className="text-sm font-medium text-gray-900 dark:text-gray-100"
                    >
                      {formatBRL(parseFloat(selectedOrder.totalValue))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">
                      Valor Pendente
                    </dt>
                    <dd
                      data-testid="order-summary-pending"
                      className="text-sm font-medium text-gray-900 dark:text-gray-100"
                    >
                      {formatBRL(getOrderPendingCents() / 100)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">
                      Descrição
                    </dt>
                    <dd
                      data-testid="order-summary-description"
                      className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate"
                      title={selectedOrder.orderNotes || undefined}
                    >
                      {selectedOrder.orderNotes || '—'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Pessoa
                </label>
                {balances.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Nenhuma pessoa neste pedido
                  </p>
                ) : (
                  <select
                    value={selectedPersonId}
                    onChange={(e) => {
                      const nextBalance = balances.find(
                        (b) => b.personId === e.target.value,
                      );
                      setSelectedPersonId(e.target.value);
                      setPaymentAmount(
                        nextBalance && toCents(nextBalance.itemTotal) === 0
                          ? '0'
                          : '',
                      );
                      setPaymentError('');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  >
                    {balances.map((b) => (
                      <option key={b.personId} value={b.personId}>
                        {toCents(b.itemTotal) === 0
                          ? `${b.personName} — Nada a receber`
                          : `${b.personName} — Pendente: ${formatBRL(b.pending)}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedPersonId && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md">
                  {isSelectedZeroItem() ? (
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      Nada a receber — baixa sem valor
                    </p>
                  ) : (
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      Saldo pendente:{' '}
                      <strong>
                        {formatBRL(getSelectedPendingCents() / 100)}
                      </strong>
                    </p>
                  )}
                </div>
              )}

              {selectedPersonId && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Itens desta pessoa
                  </h4>
                  {getSelectedPersonItems().length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Nenhum item registrado para esta pessoa
                    </p>
                  ) : (
                    <div className="rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden">
                      {getSelectedPersonItems().map((item) => (
                        <div
                          key={item.id}
                          className="px-3 py-2 bg-white dark:bg-gray-800"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {item.description || '—'}
                            </span>
                            <span className="text-sm font-semibold text-primary-700 dark:text-primary-400 whitespace-nowrap">
                              {formatBRL(parseFloat(item.chargedValue))}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {`Detalhes: ${item.details || '—'}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="mb-4">
                <label
                  htmlFor="paymentDate"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Data do Pagamento
                </label>
                <input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentAmount}
                  onChange={(e) => {
                    setPaymentAmount(e.target.value);
                    setPaymentError('');
                  }}
                  disabled={isSelectedZeroItem()}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="0.00"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notas (opcional)
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  placeholder="Observações sobre o pagamento"
                />
              </div>

              {paymentError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {paymentError}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={closePaymentModal}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || balances.length === 0}
                  className="px-4 py-2 bg-gradient-to-r from-primary-700 to-primary-500 hover:from-primary-800 hover:to-primary-600 disabled:from-primary-400 disabled:to-primary-300 text-white font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? 'Registrando...'
                    : isSelectedZeroItem()
                      ? 'Dar baixa'
                      : 'Registrar Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailsModal && detailOrder && (
        <div
          data-testid="details-modal"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Detalhamento — {detailOrder.orderNumber}
              </h3>
              <button
                type="button"
                aria-label="Fechar detalhamento"
                onClick={closeDetailsModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="px-6 py-4">
              <div className="mb-4 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">
                      Número
                    </dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {detailOrder.orderNumber}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">
                      Data
                    </dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatDateBR(detailOrder.orderDate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">
                      Responsável
                    </dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {detailOrder.accountOwner || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">
                      Valor Total
                    </dt>
                    <dd
                      data-testid="details-summary-total"
                      className="text-sm font-medium text-gray-900 dark:text-gray-100"
                    >
                      {formatBRL(parseFloat(detailOrder.totalValue))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">
                      Valor Pendente
                    </dt>
                    <dd
                      data-testid="details-summary-pending"
                      className="text-sm font-medium text-gray-900 dark:text-gray-100"
                    >
                      {formatBRL(
                        Math.max(
                          0,
                          toCents(parseFloat(detailOrder.totalValue)) -
                            (detailOrder.payments || []).reduce(
                              (sum, payment) =>
                                sum + toCents(parseFloat(payment.amount)),
                              0,
                            ),
                        ) / 100,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">
                      Descrição
                    </dt>
                    <dd
                      data-testid="details-summary-description"
                      className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate"
                      title={detailOrder.orderNotes || undefined}
                    >
                      {detailOrder.orderNotes || '—'}
                    </dd>
                  </div>
                </dl>
              </div>

              {detailLoading ? (
                <div className="flex items-center justify-center py-8 text-sm text-gray-500 dark:text-gray-400">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600 mr-2" />
                  Carregando detalhamento...
                </div>
              ) : detailBalances.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Nenhuma pessoa neste pedido
                </p>
              ) : (
                <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {detailBalances.map((balance) => {
                    const expanded = expandedPersonId === balance.personId;
                    const personItems = getDetailPersonItems(balance.personId);
                    const personPayments = getDetailPersonPayments(
                      balance.personId,
                    );
                    return (
                      <div
                        key={balance.personId}
                        className="border-b last:border-b-0 border-gray-200 dark:border-gray-700"
                      >
                        <button
                          type="button"
                          data-testid={`detail-person-${balance.personId}`}
                          aria-expanded={expanded}
                          onClick={() =>
                            setExpandedPersonId(
                              expanded ? '' : balance.personId,
                            )
                          }
                          className="w-full px-3 py-3 flex items-center justify-between gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {balance.personName}
                          </span>
                          <span className="flex items-center gap-3 text-sm whitespace-nowrap">
                            <span className="text-gray-600 dark:text-gray-300">
                              Total: {formatBRL(balance.itemTotal)}
                            </span>
                            <span
                              className={
                                toCents(balance.pending) === 0
                                  ? 'text-gray-400 dark:text-gray-500'
                                  : 'text-primary-700 dark:text-primary-400'
                              }
                            >
                              Pendente: {formatBRL(balance.pending)}
                            </span>
                            {expanded ? (
                              <ChevronUp size={18} aria-hidden="true" />
                            ) : (
                              <ChevronDown size={18} aria-hidden="true" />
                            )}
                          </span>
                        </button>

                        {expanded && (
                          <div
                            data-testid={`detail-panel-${balance.personId}`}
                            className="px-3 pb-4 bg-gray-50 dark:bg-gray-900/30"
                          >
                            <h4 className="pt-3 mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                              Itens desta pessoa
                            </h4>
                            {personItems.length === 0 ? (
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Nenhum item registrado para esta pessoa
                              </p>
                            ) : (
                              <div className="rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden">
                                {personItems.map((item) => (
                                  <div
                                    key={item.id}
                                    className="px-3 py-2 bg-white dark:bg-gray-800"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {item.product?.name ||
                                          item.description ||
                                          '—'}
                                      </span>
                                      <span className="text-sm font-semibold text-primary-700 dark:text-primary-400 whitespace-nowrap">
                                        {formatBRL(
                                          parseFloat(item.chargedValue),
                                        )}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                      Detalhes: {item.details || '—'}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            <h4 className="mt-4 mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                              Pagamentos recebidos
                            </h4>
                            {personPayments.length === 0 ? (
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Nenhum pagamento recebido
                              </p>
                            ) : (
                              <div className="rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden">
                                {personPayments.map((payment) => (
                                  <div
                                    key={payment.id}
                                    className="px-3 py-2 bg-white dark:bg-gray-800"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <span className="text-sm text-gray-900 dark:text-gray-100">
                                        {formatDateBR(payment.paidAt)}
                                      </span>
                                      <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                                        {formatBRL(parseFloat(payment.amount))}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                      Observação: {payment.notes || '—'}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={closeDetailsModal}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showOverpayConfirm}
        title="Confirmar recebimento"
        message={
          <>
            Valor de{' '}
            <strong>
              {formatBRL(toCents(parseFloat(paymentAmount || '0')) / 100)}
            </strong>{' '}
            é maior que o saldo pendente (
            <strong>{formatBRL(getSelectedPendingCents() / 100)}</strong>).
            Deseja mesmo confirmar este recebimento?
          </>
        }
        confirmLabel="Confirmar recebimento"
        cancelLabel="Cancelar"
        loading={submitting}
        onConfirm={() => {
          setShowOverpayConfirm(false);
          submitPayment();
        }}
        onCancel={() => setShowOverpayConfirm(false)}
      />
    </>
  );
};

export default ReceivablesPage;
