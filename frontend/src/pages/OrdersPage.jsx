import React, { useState, useEffect } from 'react';
import api from '../services/api';

const emptyItem = () => ({ id: Date.now(), description: '', value: '', personId: '' });

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editOrderId, setEditOrderId] = useState(null);
  const [orderNumber, setOrderNumber] = useState('');
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
    return items.reduce((total, item) => total + (parseFloat(item.value) || 0), 0);
  };

  const resetForm = () => {
    setOrderNumber('');
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

  const statusBadge = (status) => {
    const styles = {
      PENDENTE: 'bg-yellow-100 text-yellow-800',
      PARCIAL: 'bg-blue-100 text-blue-800',
      QUITADO: 'bg-green-100 text-green-800',
    };
    const labels = { PENDENTE: 'Pendente', PARCIAL: 'Parcial', QUITADO: 'Quitado' };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || ''}`}>
        {labels[status] || status}
      </span>
    );
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800">
            Gestão de Pedidos
          </h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-3 sm:mt-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
          >
            Novo Pedido
          </button>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.orderNumber}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        R$ {parseFloat(order.totalValue).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{statusBadge(order.status)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => handleEditOrder(order)} className="text-indigo-600 hover:text-indigo-900 mr-3">Editar</button>
                        <button onClick={() => handleDeleteOrder(order.id)} className="text-red-600 hover:text-red-900">Excluir</button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                {showEditModal ? 'Editar Pedido' : 'Novo Pedido'}
              </h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <form onSubmit={showEditModal ? handleUpdateOrder : handleCreateOrder} className="px-6 py-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Número do Pedido</label>
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Digite o número do pedido"
                />
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-gray-700">Itens do Pedido</span>
                  <button
                    type="button"
                    onClick={addItem}
                    className="px-3 py-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-md"
                  >
                    Adicionar Item
                  </button>
                </div>

                {items.map((item, index) => (
                  <div key={item.id} className="border border-gray-200 rounded-md p-4 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">Item {index + 1}</span>
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(index)} className="text-red-600 hover:text-red-900 text-sm">
                          Remover
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Descrição</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItemField(index, 'description', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="Descrição do item"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Valor (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={item.value}
                          onChange={(e) => updateItemField(index, 'value', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Pessoa</label>
                        <select
                          value={item.personId}
                          onChange={(e) => updateItemField(index, 'personId', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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

                <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-lg font-medium text-gray-900">Valor Total:</span>
                  <span className="text-lg font-bold text-gray-900">R$ {calculateTotal().toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 mt-6">
                <button type="button" onClick={resetForm} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors">
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