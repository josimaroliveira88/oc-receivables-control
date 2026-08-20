import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import {
  emptyItem,
  getTodayString,
  itemPayload,
  editItemFromApi,
} from './utils/orderHelpers';

export function useOrders() {
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
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { addToast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [ordersRes, peopleRes, productsRes] = await Promise.all([
        api.get('/orders'),
        api.get('/people'),
        api.get('/products?available=true&pageSize=all'),
      ]);
      setOrders(ordersRes.data);
      setPeople(peopleRes.data);
      setProducts(productsRes.data.data);
    } catch (err) {
      setError('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshOrders = useCallback(async () => {
    try {
      const response = await api.get('/orders');
      setOrders(response.data);
    } catch (err) {
      setError('Erro ao carregar pedidos. Tente novamente.');
    }
  }, []);

  const addItem = () => {
    setItems([...items, emptyItem()]);
    setTimeout(() => {
      if (
        addItemBtnRef.current &&
        typeof addItemBtnRef.current.scrollIntoView === 'function'
      ) {
        addItemBtnRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'end',
        });
      }
    }, 0);
  };

  const removeItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItemField = (index, field, value) => {
    setItems(
      items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const onProductSelect = (index, productId) => {
    const product = products.find((p) => p.id === productId);
    setItems(
      items.map((item, i) =>
        i === index
          ? {
              ...item,
              productId,
              productName: product ? product.name : '',
              productCode: product ? product.code : '',
              description: product ? product.name : '',
              memberPrice:
                product && product.memberPrice != null
                  ? parseFloat(product.memberPrice).toString()
                  : '',
              pv:
                product && product.pv != null
                  ? parseFloat(product.pv).toString()
                  : '',
            }
          : item,
      ),
    );
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

  const setFormField = (field, value) => {
    switch (field) {
      case 'orderNumber':
        setOrderNumber(value);
        break;
      case 'orderNumberBlurred':
        setOrderNumberBlurred(value);
        break;
      case 'orderDate':
        setOrderDate(value);
        break;
      case 'accountOwner':
        setAccountOwner(value);
        break;
      case 'paymentType':
        setPaymentType(value);
        break;
      case 'orderNotes':
        setOrderNotes(value);
        break;
      default:
        break;
    }
  };

  const validateForm = () => {
    if (!orderNumber.trim()) {
      setError('Número do pedido é obrigatório');
      return false;
    }
    const invalidItems = items.filter(
      (item) =>
        (item.chargedValue !== '' &&
          item.chargedValue != null &&
          parseFloat(item.chargedValue) < 0) ||
        !item.personId,
    );
    if (invalidItems.length > 0) {
      setError('Preencha todos os campos dos itens corretamente');
      return false;
    }
    return true;
  };

  const buildPayload = () => ({
    orderNumber: orderNumber.trim(),
    orderDate: orderDate || undefined,
    accountOwner: accountOwner.trim() || null,
    paymentType: paymentType || null,
    orderNotes: orderNotes.trim() || null,
    items: items.map(itemPayload),
  });

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      await api.post('/orders', buildPayload());
      resetForm();
      fetchData();
    } catch (err) {
      setError('Erro ao criar pedido. Tente novamente.');
    }
  };

  const handleEditOrder = (order) => {
    setEditOrderId(order.id);
    setOrderNumber(order.orderNumber);
    setOrderNumberBlurred(true);
    setOrderDate(
      order.orderDate ? order.orderDate.split('T')[0] : getTodayString(),
    );
    setAccountOwner(order.accountOwner || '');
    setPaymentType(order.paymentType || '');
    setOrderNotes(order.orderNotes || '');
    setItems(order.items.map(editItemFromApi));
    setShowEditModal(true);
  };

  const handleUpdateOrder = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      await api.put(`/orders/${editOrderId}`, buildPayload());
      resetForm();
      fetchData();
    } catch (err) {
      setError('Erro ao atualizar pedido. Tente novamente.');
    }
  };

  const handleDeleteOrder = (id) => {
    setConfirmDeleteId(id);
  };

  const cancelDeleteOrder = () => {
    setConfirmDeleteId(null);
  };

  const confirmDeleteOrder = async () => {
    try {
      setDeleting(true);
      await api.delete(`/orders/${confirmDeleteId}`);
      addToast('Pedido excluído com sucesso!', 'success');
      fetchData();
    } catch (err) {
      setError('Erro ao excluir pedido. Tente novamente.');
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    orders,
    people,
    products,
    loading,
    error,
    refreshOrders,
    showCreateModal,
    showEditModal,
    editOrderId,
    orderNumber,
    orderNumberBlurred,
    orderDate,
    accountOwner,
    paymentType,
    orderNotes,
    items,
    addItemBtnRef,
    confirmDeleteId,
    deleting,
    setFormField,
    addItem,
    removeItem,
    updateItemField,
    onProductSelect,
    resetForm,
    handleCreateOrder,
    handleEditOrder,
    handleUpdateOrder,
    handleDeleteOrder,
    cancelDeleteOrder,
    confirmDeleteOrder,
    setShowCreateModal,
  };
}
