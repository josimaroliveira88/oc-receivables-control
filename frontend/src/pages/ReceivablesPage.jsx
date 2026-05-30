import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../components/Toast';

const statusBadge = (status) => {
  const config = {
    PENDENTE: { label: '🔴 Pendente', className: 'bg-red-100 text-red-800' },
    PARCIAL: { label: '⚠️ Parcial', className: 'bg-yellow-100 text-yellow-800' },
    QUITADO: { label: '✅ Quitado', className: 'bg-green-100 text-green-800' },
  };
  const cfg = config[status] || { label: status, className: '' };
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${cfg.className}`}>
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
    setPaymentError('');
    setBalances([]);

    try {
      const response = await api.get(`/orders/${order.id}/balance`);
      const pendingBalances = response.data.balances.filter(
        (b) => parseFloat(b.pending) > 0
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
    setPaymentError('');
  };

  const getSelectedPending = () => {
    const balance = balances.find((b) => b.personId === selectedPersonId);
    return balance ? parseFloat(balance.pending) : 0;
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setPaymentError('');

    const amount = parseFloat(paymentAmount);

    if (!amount || amount <= 0) {
      setPaymentError('Valor deve ser maior que zero');
      return;
    }

    const pending = getSelectedPending();
    if (amount > pending) {
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
        amount,
        personId: selectedPersonId,
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-500">Carregando...</span>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800">
            Controle de Recebíveis
          </h2>
        </div>

        <div className="px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {orders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Nenhum pedido cadastrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Número</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor Total (R$)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.orderNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        R$ {parseFloat(order.totalValue).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {statusBadge(order.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {order.status !== 'QUITADO' && (
                          <button
                            onClick={() => openPaymentModal(order)}
                            className="text-green-600 hover:text-green-900"
                          >
                            Registrar Pagamento
                          </button>
                        )}
                        {order.status === 'QUITADO' && (
                          <span className="text-gray-400 text-sm">Pago</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Registrar Pagamento — {selectedOrder.orderNumber}
              </h3>
              <button
                onClick={closePaymentModal}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handlePaymentSubmit} className="px-6 py-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pessoa
                </label>
                {balances.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhuma pessoa com saldo pendente</p>
                ) : (
                  <select
                    value={selectedPersonId}
                    onChange={(e) => {
                      setSelectedPersonId(e.target.value);
                      setPaymentAmount('');
                      setPaymentError('');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {balances.map((b) => (
                      <option key={b.personId} value={b.personId}>
                        {b.personName} — Pendente: R$ {parseFloat(b.pending).toFixed(2)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedPersonId && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-700">
                    Saldo pendente: <strong>R$ {getSelectedPending().toFixed(2)}</strong>
                  </p>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas (opcional)
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Observações sobre o pagamento"
                />
              </div>

              {paymentError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{paymentError}</p>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={closePaymentModal}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || balances.length === 0}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
