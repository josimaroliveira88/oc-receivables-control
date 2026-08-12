import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, Plus } from 'lucide-react';
import api from '../services/api';
import { toCents, formatBRL } from '../utils/money';
import { formatDateBR } from '../utils/dates';

const emptyItem = () => ({
  id: Date.now(),
  description: '',
  chargedValue: '',
  personId: '',
  productId: '',
  memberPrice: '',
  pv: '',
  details: '',
});

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

const paymentTypeLabel = (type) => {
  const map = {
    PIX: 'PIX',
    BOLETO: 'Boleto',
    CARTAO_CREDITO: 'Cartão de Crédito',
  };
  return map[type] || type;
};

const paymentTypeBadge = (type) => {
  if (!type) return <span className="text-gray-400 dark:text-gray-500">—</span>;
  const config = {
    PIX: { className: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
    BOLETO: { className: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
    CARTAO_CREDITO: { className: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  };
  const cfg = config[type] || { className: 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300' };
  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${cfg.className}`}>
      {paymentTypeLabel(type)}
    </span>
  );
};

const trackingUrl = (orderNumber) =>
    `https://status.ondeestameupedido.com/tracking/22747/${encodeURIComponent(orderNumber)}/`;

const ProductCombobox = ({ products, value, onChange }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selected = products.find((p) => p.id === value) || null;

  const filtered = products
    .filter((p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.code.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 100);

  const handleSelect = (id) => {
    onChange(id);
    setQuery('');
    setOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setQuery('');
    setOpen(false);
  };

  const handleType = (e) => {
    setQuery(e.target.value);
    setOpen(true);
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={selected ? `${selected.name} (${selected.code})` : query}
            onChange={handleType}
            onFocus={() => setOpen(true)}
            placeholder="Busque um produto..."
            className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm"
          />
          {open && (
            <>
              <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
              <ul className="absolute z-[70] mt-1 max-h-60 w-full overflow-auto bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
                {filtered.length === 0 && (
                  <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Nenhum produto encontrado</li>
                )}
                {filtered.map((p) => (
                  <li
                    key={p.id}
                    onMouseDown={() => handleSelect(p.id)}
                    className="cursor-pointer px-3 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-primary-50 dark:hover:bg-primary-900/40 transition-colors"
                  >
                    <span className="font-medium">{p.name}</span> ({p.code}) — {formatBRL(parseFloat(p.memberPrice) || 0)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        {selected && (
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-2 text-xs font-medium text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md transition-colors whitespace-nowrap"
          >
            Limpar produto
          </button>
        )}
      </div>
    </div>
  );
};

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [people, setPeople] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editOrderId, setEditOrderId] = useState(null);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderNumberBlurred, setOrderNumberBlurred] = useState(false);
  const [orderDate, setOrderDate] = useState(getTodayString());
  const [accountOwner, setAccountOwner] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const addItemBtnRef = useRef(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ordersRes, peopleRes, productsRes] = await Promise.all([
        api.get('/orders'),
        api.get('/people'),
        api.get('/products?active=true&pageSize=all'),
      ]);
      setOrders(ordersRes.data);
      setPeople(peopleRes.data);
      setProducts(productsRes.data.data);
    } catch (err) {
      setError('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setItems([...items, emptyItem()]);
    setTimeout(() => {
      if (addItemBtnRef.current && typeof addItemBtnRef.current.scrollIntoView === 'function') {
        addItemBtnRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, 0);
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

  const onProductSelect = (index, productId) => {
    const product = products.find((p) => p.id === productId);
    setItems(items.map((item, i) =>
      i === index
        ? {
            ...item,
            productId,
            description: product ? product.name : '',
            memberPrice: product && product.memberPrice != null ? parseFloat(product.memberPrice).toString() : '',
            pv: product && product.pv != null ? parseFloat(product.pv).toString() : '',
          }
        : item
    ));
  };

  const calculateTotal = () => {
    const totalCents = items.reduce((total, item) => total + (toCents(parseFloat(item.chargedValue)) || 0), 0);
    return totalCents / 100;
  };

  const calculateTotalPV = () => {
    return items.reduce((total, item) => total + (parseFloat(item.pv) || 0), 0);
  };

  const resetForm = () => {
    setOrderNumber('');
    setOrderNumberBlurred(false);
    setOrderDate(getTodayString());
    setAccountOwner('');
    setPaymentType('');
    setOrderNotes('');
    setItems([emptyItem()]);
    setShowCreateModal(false);
    setShowEditModal(false);
    setEditOrderId(null);
  };

  const itemPayload = (item) => ({
    description: item.description.trim() || null,
    chargedValue: item.chargedValue === '' || item.chargedValue == null ? 0 : parseFloat(item.chargedValue),
    personId: item.personId,
    productId: item.productId || null,
    memberPrice: item.memberPrice !== '' && item.memberPrice != null ? parseFloat(item.memberPrice) : null,
    pv: item.pv !== '' && item.pv != null ? parseFloat(item.pv) : null,
    details: item.details.trim() || null,
  });

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!orderNumber.trim()) {
      setError('Número do pedido é obrigatório');
      return;
    }
    const invalidItems = items.filter(item =>
      (item.chargedValue !== '' && item.chargedValue != null && parseFloat(item.chargedValue) < 0) || !item.personId
    );
    if (invalidItems.length > 0) {
      setError('Preencha todos os campos dos itens corretamente');
      return;
    }
    try {
      await api.post('/orders', {
        orderNumber: orderNumber.trim(),
        orderDate: orderDate || undefined,
        accountOwner: accountOwner.trim() || null,
        paymentType: paymentType || null,
        orderNotes: orderNotes.trim() || null,
        items: items.map(itemPayload),
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
    setOrderNumberBlurred(true);
    setOrderDate(order.orderDate ? order.orderDate.split('T')[0] : getTodayString());
    setAccountOwner(order.accountOwner || '');
    setPaymentType(order.paymentType || '');
    setOrderNotes(order.orderNotes || '');
    setItems(order.items.map(item => ({
      id: item.id,
      description: item.description || '',
      chargedValue: item.chargedValue != null ? parseFloat(item.chargedValue).toString() : '',
      personId: item.personId || '',
      productId: item.productId || '',
      memberPrice: item.memberPrice != null ? parseFloat(item.memberPrice).toString() : '',
      pv: item.pv != null ? parseFloat(item.pv).toString() : '',
      details: item.details || '',
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
      (item.chargedValue !== '' && item.chargedValue != null && parseFloat(item.chargedValue) < 0) || !item.personId
    );
    if (invalidItems.length > 0) {
      setError('Preencha todos os campos dos itens corretamente');
      return;
    }
    try {
      await api.put(`/orders/${editOrderId}`, {
        orderNumber: orderNumber.trim(),
        orderDate: orderDate || undefined,
        accountOwner: accountOwner.trim() || null,
        paymentType: paymentType || null,
        orderNotes: orderNotes.trim() || null,
        items: items.map(itemPayload),
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
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Responsável</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Tipo Pgto</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Valor (R$)</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">PV Total</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Descrição</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Rastreio</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ações</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {orders.map((order) => {
            const totalPV = (order.items || []).reduce(
              (sum, item) => sum + (parseFloat(item.pv) || 0),
              0
            );
            return (
            <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{order.orderNumber}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{formatDateBR(order.orderDate)}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{order.accountOwner || '—'}</td>
              <td className="px-6 py-4 whitespace-nowrap">{paymentTypeBadge(order.paymentType)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {formatBRL(parseFloat(order.totalValue))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {totalPV.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 max-w-[160px]">
                        {order.orderNotes ? (
                          <span title={order.orderNotes} className="block truncate text-sm text-gray-900 dark:text-gray-100">
                            {order.orderNotes}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <a
                          href={trackingUrl(order.orderNumber)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
                          title="Ver pedido no site"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Ver
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{statusBadge(order.status)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => handleEditOrder(order)} className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 mr-3 transition-colors">Editar</button>
                        <button onClick={() => handleDeleteOrder(order.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors">Excluir</button>
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
                  onBlur={() => setOrderNumberBlurred(true)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  placeholder="Informe o número do pedido da dōTERRA"
                />
                {orderNumberBlurred && orderNumber.trim() && (
                  <div className="mt-1">
                    <a
                      href={trackingUrl(orderNumber.trim())}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ver pedido no site
                    </a>
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label htmlFor="accountOwner" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Responsável pela conta (ID dōTERRA ou nome)</label>
                <input
                  id="accountOwner"
                  type="text"
                  value={accountOwner}
                  onChange={(e) => setAccountOwner(e.target.value)}
                  maxLength={120}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  placeholder="Ex.: 6254862 ou Ana Silva"
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
                <label htmlFor="paymentType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de Pagamento</label>
                <select
                  id="paymentType"
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                >
                  <option value="">Selecione...</option>
                  <option value="PIX">PIX</option>
                  <option value="BOLETO">Boleto</option>
                  <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                </select>
              </div>

              <div className="mb-4">
                <label htmlFor="orderNotes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição do Pedido</label>
                <textarea
                  id="orderNotes"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  placeholder="Acrescente informações adicionais — motivo do pedido, promoções, encomendas, etc."
                />
                <div className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
                  {orderNotes.length}/500
                </div>
              </div>

              <div className="mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Soma dos Produtos (Valor Cobrado)</div>
                    <div className="text-lg font-medium text-gray-900 dark:text-gray-100">{formatBRL(calculateTotal())}</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Soma dos PV</div>
                    <div className="text-lg font-medium text-gray-900 dark:text-gray-100">{calculateTotalPV().toFixed(2)}</div>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Itens do Pedido</span>
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
                      <div className="md:col-span-3">
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

                      <div className="md:col-span-3">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Produto</label>
                        <ProductCombobox
                          products={products}
                          value={item.productId}
                          onChange={(productId) => onProductSelect(index, productId)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Valor Membro (R$)</label>
                        <input
                          type="text"
                          value={item.memberPrice !== '' ? formatBRL(parseFloat(item.memberPrice) || 0) : ''}
                          readOnly
                          tabIndex={-1}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md shadow-sm cursor-not-allowed text-sm"
                          placeholder="—"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Valor Cobrado (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.chargedValue}
                          onChange={(e) => updateItemField(index, 'chargedValue', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">PV</label>
                        <input
                          type="text"
                          value={item.pv !== '' ? parseFloat(item.pv) : ''}
                          readOnly
                          tabIndex={-1}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md shadow-sm cursor-not-allowed text-sm"
                          placeholder="—"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Detalhes do Item</label>
                        <textarea
                          value={item.details}
                          onChange={(e) => updateItemField(index, 'details', e.target.value)}
                          maxLength={500}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm"
                          placeholder="Adicione detalhes do item (até 500 caracteres)"
                        />
                        <div className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
                          {item.details.length}/500
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addItem}
                  ref={addItemBtnRef}
                  className="w-full px-3 py-2 mt-1 text-sm font-medium text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 rounded-md transition-colors flex items-center justify-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Item
                </button>
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
