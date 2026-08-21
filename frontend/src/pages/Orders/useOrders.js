import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import {
  emptyItem,
  getTodayString,
  itemPayload,
  editItemFromApi,
  SELF_PERSON_ID,
  findSelfPerson,
} from './utils/orderHelpers';

export function useOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [orderNumberError, setOrderNumberError] = useState('');
  const [itemErrors, setItemErrors] = useState({});
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
    setItemErrors({});
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
    setItemErrors({});
  };

  const updateItemField = (index, field, value) => {
    const target = items[index];
    if (target && itemErrors[target.id]) {
      setItemErrors((prev) => {
        const next = { ...prev };
        delete next[target.id];
        return next;
      });
    }
    setItems(
      items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const onProductSelect = (index, productId) => {
    const product = products.find((p) => p.id === productId);
    const target = items[index];
    if (target && itemErrors[target.id]) {
      setItemErrors((prev) => {
        const next = { ...prev };
        delete next[target.id];
        return next;
      });
    }
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

  const selfPersonRequestRef = useRef(null);
  const deepLinkHandledRef = useRef(false);

  const onPersonSelect = async (index, value) => {
    if (value !== SELF_PERSON_ID) {
      // When leaving the self person, the "for stock" toggle no longer applies.
      // Apply both changes (personId + forStock reset) in a single state update
      // so that React doesn't lose the personId change to a stale closure.
      const target = items[index];
      setItems(
        items.map((item, i) => {
          if (i !== index) return item;
          const updated = { ...item, personId: value };
          if (updated.forStock) updated.forStock = false;
          return updated;
        }),
      );
      if (target && itemErrors[target.id]) {
        setItemErrors((prev) => {
          const next = { ...prev };
          delete next[target.id];
          return next;
        });
      }
      return;
    }

    try {
      const existingSelf = findSelfPerson(people);
      if (existingSelf) {
        updateItemField(index, 'personId', existingSelf.id);
        return;
      }

      if (!selfPersonRequestRef.current) {
        selfPersonRequestRef.current = api
          .post('/people/self')
          .then((res) => {
            const person = res.data;
            setPeople((prev) =>
              prev.some((p) => p.id === person.id) ? prev : [...prev, person],
            );
            return person;
          })
          .finally(() => {
            selfPersonRequestRef.current = null;
          });
      }

      const person = await selfPersonRequestRef.current;
      updateItemField(index, 'personId', person.id);
    } catch (err) {
      addToast('Não foi possível vincular você a este item.', 'error');
    }
  };

  const resetForm = () => {
    setOrderNumber('');
    setOrderNumberBlurred(false);
    setOrderDate(getTodayString());
    setAccountOwner('');
    setPaymentType('');
    setOrderNotes('');
    setItems([emptyItem()]);
    setOrderNumberError('');
    setItemErrors({});
    setError('');
    setShowCreateModal(false);
    setShowEditModal(false);
    setEditOrderId(null);
  };

  const setFormField = (field, value) => {
    switch (field) {
      case 'orderNumber':
        setOrderNumber(value);
        setOrderNumberError('');
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
    const newOrderNumberError = orderNumber.trim()
      ? ''
      : 'Número do pedido é obrigatório';
    setOrderNumberError(newOrderNumberError);

    const newItemErrors = {};
    items.forEach((item) => {
      if (
        item.chargedValue !== '' &&
        item.chargedValue != null &&
        parseFloat(item.chargedValue) < 0
      ) {
        newItemErrors[item.id] = 'Valor não pode ser negativo';
      } else if (
        item.quantity !== '' &&
        item.quantity != null &&
        (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1)
      ) {
        newItemErrors[item.id] = 'Quantidade deve ser maior ou igual a 1';
      } else if (!item.personId) {
        newItemErrors[item.id] = 'Pessoa é obrigatória';
      }
    });
    setItemErrors(newItemErrors);

    if (newOrderNumberError) return false;
    return Object.keys(newItemErrors).length === 0;
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
      addToast(
        err.response?.data?.error || 'Erro ao criar pedido. Tente novamente.',
        'error',
      );
    }
  };

  const handleEditOrder = (order) => {
    setEditOrderId(order.id);
    setOrderNumber(order.orderNumber);
    setOrderNumberBlurred(true);
    setOrderNumberError('');
    setItemErrors({});
    setError('');
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
      addToast(
        err.response?.data?.error ||
          'Erro ao atualizar pedido. Tente novamente.',
        'error',
      );
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
      addToast('Erro ao excluir pedido. Tente novamente.', 'error');
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Support deep-linking from the Stock history ("Ver pedido") via ?editOrder=.
  // Opens the edit modal for the referenced order once data is loaded.
  useEffect(() => {
    const editOrderParam = searchParams.get('editOrder');
    if (!editOrderParam || deepLinkHandledRef.current || loading) return;
    const order = orders.find((o) => o.id === editOrderParam);
    if (!order) return;
    deepLinkHandledRef.current = true;
    setSearchParams({}, { replace: true });
    handleEditOrder(order);
  }, [searchParams, loading, orders, handleEditOrder, setSearchParams]);

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
    orderNumberError,
    itemErrors,
    addItemBtnRef,
    confirmDeleteId,
    deleting,
    setFormField,
    addItem,
    removeItem,
    updateItemField,
    onProductSelect,
    onPersonSelect,
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
