import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../components/Toast';
import { toCents, formatBRL } from '../utils/money';

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const statusBadge = (status) => {
  const config = {
    PENDENTE: { label: 'Pendente', dot: 'bg-amber-500', className: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
    PARCIAL: { label: 'Parcial', dot: 'bg-blue-500', className: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
    QUITADO: { label: 'Quitado', dot: 'bg-emerald-500', className: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
  };
  const cfg = config[status] || { label: status, dot: 'bg-gray-500', className: 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full ${cfg.className}`}>
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
      const pendingBalances = response.data.balances.filter(
        (b) => toCents(b.pending) > 0
      );
      setBalances(pendingBalances);
      if (pendingBalances.length > 0) {
        setSelectedPersonId(pendingBalances[0].personId);
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

  const getSelectedPendingCents = () => {
    const balance = balances.find((b) => b.personId === selectedPersonId);
    return balance ? toCents(balance.pending) : 0;
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setPaymentError('');

    const amountCents = toCents(parseFloat(paymentAmount));

    if (!amountCents || amountCents <= 0) {
      setPaymentError('Valor deve ser maior que zero');
      return;
    }

    const pendingCents = getSelectedPendingCents();
    if (amountCents > pendingCents) {
      setPaymentError('Valor excede o saldo pendente');
      return;
    }

    if (!selectedPersonId) {
      setPaymentError('Selecione uma pessoa');
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/orders/${selectedOrder.id}/payments`, {
        amount: parseFloat(paymentAmount),
        personId: selectedPersonId,
        paidAt: paymentDate || undefined,
        notes: paymentNotes.trim() || undefined,
      });
      addToast('Pagamento registrado com sucesso!', 'success');
      closePaymentModal();
      fetchOrders();
    } catch (err) {
      const msg =
        err.response?.data?.error || 'Erro ao registrar pagamento. Tente novamente.';
      if (typeof msg === 'string' && msg.includes('pending balance')) {
        addToast('Valor excede o saldo pendente', 'error');
      } else {
        addToast(msg, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2 text-gray-500 dark:text-gray-400">Carregando...</span>
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
              <p className="text-gray-500 dark:text-gray-400">Nenhum pedido cadastrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Número</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Valor Total (R$)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {order.orderNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {formatBRL(parseFloat(order.totalValue))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {statusBadge(order.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {order.status !== 'QUITADO' && (
                          <button
                            onClick={() => openPaymentModal(order)}
                            className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
                          >
                            Registrar Pagamento
                          </button>
                        )}
                        {order.status === 'QUITADO' && (
                          <span className="text-gray-400 dark:text-gray-500 text-sm">Pago</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showPaymentModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
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
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Pessoa
                </label>
                {balances.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma pessoa com saldo pendente</p>
                ) : (
                  <select
                    value={selectedPersonId}
                    onChange={(e) => {
                      setSelectedPersonId(e.target.value);
                      setPaymentAmount('');
                      setPaymentError('');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  >
                    {balances.map((b) => (
                      <option key={b.personId} value={b.personId}>
                        {b.personName} — Pendente: {formatBRL(b.pending)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

            {selectedPersonId && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md">
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  Saldo pendente: <strong>{formatBRL(getSelectedPendingCents() / 100)}</strong>
                </p>
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="paymentDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                  min="0.01"
                  value={paymentAmount}
                  onChange={(e) => {
                    setPaymentAmount(e.target.value);
                    setPaymentError('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
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
                  <p className="text-sm text-red-600 dark:text-red-400">{paymentError}</p>
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
                  {submitting ? 'Registrando...' : 'Registrar Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default ReceivablesPage;
