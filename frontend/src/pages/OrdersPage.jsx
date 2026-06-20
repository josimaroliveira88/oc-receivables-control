import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { toCents, formatBRL } from '../utils/money';

const emptyItem = () => ({ id: Date.now(), description: '', value: '', personId: '' });

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateBR = (dateStr) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
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

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editOrderId, setEditOrderId] = useState(null);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderDate, setOrderDate] = useState(getTodayString());
  const [items, setItems] = useState([emptyItem()]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ordersRes, peopleRes] = await Promise.all([
        api.get('/orders'),
        api.get('/people'),
      ]);
      setOrders(ordersRes.data);
      setPeople(peopleRes.data);
    } catch (err) {
      setError('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setItems([...items, emptyItem()]);
  };

  const removeItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItemField = (index, field, value) => {
    setItems(items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const calculateTotal = () => {
    const totalCents = items.reduce((total, item) => total + (toCents(parseFloat(item.value)) || 0), 0);
    return totalCents / 100;
  };

  const resetForm = () => {
    setOrderNumber('');
    setOrderDate(getTodayString());
    setItems([emptyItem()]);
    setShowCreateModal(false);
    setShowEditModal(false);
    setEditOrderId(null);
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!orderNumber.trim()) {
      setError('Número do pedido é obrigatório');
      return;
    }
    const invalidItems = items.filter(item =>
      !item.description.trim() || !item.value || parseFloat(item.value) <= 0 || !item.personId
    );
    if (invalidItems.length > 0) {
      setError('Preencha todos os campos dos itens corretamente');
      return;
    }
    try {
      await api.post('/orders', {
        orderNumber: orderNumber.trim(),
        orderDate: orderDate || undefined,
        items: items.map(item => ({
          description: item.description.trim(),
          value: parseFloat(item.value),
          personId: item.personId,
        })),
      });
      resetForm();
      fetchData();
    } catch (err) {
      setError('Erro ao criar pedido. Tente novamente.');
    }
  };

  const handleEditOrder = async (order) => {
    setEditOrderId(order.id);
    setOrderNumber(order.orderNumber);
    setOrderDate(order.orderDate ? order.orderDate.split('T')[0] : getTodayString());
    setItems(order.items.map(item => ({
      id: item.id,
      description: item.description,
      value: parseFloat(item.value).toString(),
      personId: item.personId || '',
    })));
    setShowEditModal(true);
  };

  const handleUpdateOrder = async (e) => {
    e.preventDefault();
    if (!orderNumber.trim()) {
      setError('Número do pedido é obrigatório');
      return;
    }
    const invalidItems = items.filter(item =>
      !item.description.trim() || !item.value || parseFloat(item.value) <= 0 || !item.personId
    );
    if (invalidItems.length > 0) {
      setError('Preencha todos os campos dos itens corretamente');
      return;
    }
    try {
      await api.put(`/orders/${editOrderId}`, {
        orderNumber: orderNumber.trim(),
        orderDate: orderDate || undefined,
        items: items.map(item => ({
          description: item.description.trim(),
          value: parseFloat(item.value),
          personId: item.personId,
        })),
      });
      resetForm();
      fetchData();
    } catch (err) {
      setError('Erro ao atualizar pedido. Tente novamente.');
    }
  };

  const handleDeleteOrder = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este pedido?')) return;
    try {
      await api.delete(`/orders/${id}`);
      fetchData();
    } catch (err) {
      setError('Erro ao excluir pedido. Tente novamente.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            Gestão de Pedidos
          </h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-3 sm:mt-0 px-4 py-2 bg-gradient-to-r from-primary-700 to-primary-500 hover:from-primary-800 hover:to-primary-600 text-white font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Novo Pedido
          </button>
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
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Data</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Valor Total (R$)</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ações</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {orders.map((order) => (
            <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{order.orderNumber}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{formatDateBR(order.orderDate)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {formatBRL(parseFloat(order.totalValue))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{statusBadge(order.status)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => handleEditOrder(order)} className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 mr-3 transition-colors">Editar</button>
                        <button onClick={() => handleDeleteOrder(order.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors">Excluir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {showEditModal ? 'Editar Pedido' : 'Novo Pedido'}
              </h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none">&times;</button>
            </div>
            <form onSubmit={showEditModal ? handleUpdateOrder : handleCreateOrder} className="px-6 py-4">
              <div className="mb-4">
                <label htmlFor="orderNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Número do Pedido</label>
                <input
                  id="orderNumber"
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  placeholder="Digite o número do pedido"
                />
              </div>

              <div className="mb-4">
                <label htmlFor="orderDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data do Pedido</label>
                <input
                  id="orderDate"
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                />
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Itens do Pedido</span>
                  <button
                    type="button"
                    onClick={addItem}
                    className="px-3 py-1 text-sm font-medium text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 rounded-md transition-colors"
                  >
                    Adicionar Item
                  </button>
                </div>

                {items.map((item, index) => (
                  <div key={item.id} className="border border-gray-200 dark:border-gray-700 rounded-md p-4 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Item {index + 1}</span>
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(index)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 text-sm transition-colors">
                          Remover
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Descrição</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItemField(index, 'description', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm"
                          placeholder="Descrição do item"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Valor (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={item.value}
                          onChange={(e) => updateItemField(index, 'value', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Pessoa</label>
                        <select
                          value={item.personId}
                          onChange={(e) => updateItemField(index, 'personId', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm"
                        >
                          <option value="">Selecione uma pessoa</option>
                          {people.map(person => (
                            <option key={person.id} value={person.id}>
                              {person.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <span className="text-lg font-medium text-gray-900 dark:text-gray-100">Valor Total:</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatBRL(calculateTotal())}</span>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 mt-6">
                <button type="button" onClick={resetForm} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-gradient-to-r from-primary-700 to-primary-500 hover:from-primary-800 hover:to-primary-600 text-white font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800">
                  {showEditModal ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default OrdersPage;
