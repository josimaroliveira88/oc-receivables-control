import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import { useSaleFilters } from './useSaleFilters';
import {
  emptySaleItem,
  getTodayString,
  saleItemPayload,
  editSaleItemFromApi,
  isKitItem,
} from './utils/saleHelpers';

export function useSales() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    search,
    searchField,
    statusFilter,
    deliveryFilter,
    sortBy,
    sortDir,
    setSearch,
    setSearchField,
    setStatusFilter,
    setDeliveryFilter,
    buildSaleParams,
    handleSort,
    hasActiveFilters,
  } = useSaleFilters();
  const [sales, setSales] = useState([]);
  const [people, setPeople] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSaleId, setEditSaleId] = useState(null);
  const [clientPersonId, setClientPersonId] = useState('');
  const [clientError, setClientError] = useState('');
  const [orderDate, setOrderDate] = useState(getTodayString());
  const [shippingValue, setShippingValue] = useState('');
  const [shippingValueError, setShippingValueError] = useState('');
  const [additionalValue, setAdditionalValue] = useState('');
  const [additionalValueError, setAdditionalValueError] = useState('');
  const [description, setDescription] = useState('');
  const [deliveredAt, setDeliveredAt] = useState('');
  const [items, setItems] = useState([emptySaleItem()]);
  const [itemErrors, setItemErrors] = useState({});
  const addItemBtnRef = useRef(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [saleFormInitial, setSaleFormInitial] = useState(null);
  const salesAbortRef = useRef(null);
  const deepLinkHandledRef = useRef(false);
  const { addToast } = useToast();

  const fetchSales = useCallback(
    async ({ showLoading = true } = {}) => {
      if (salesAbortRef.current) salesAbortRef.current.abort();
      const controller = new AbortController();
      salesAbortRef.current = controller;
      if (showLoading) setLoading(true);
      try {
        const response = await api.get('/sales', {
          params: buildSaleParams(),
          signal: controller.signal,
        });
        setSales(response.data);
        setError('');
      } catch (err) {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setError('Erro ao carregar vendas. Tente novamente.');
      } finally {
        if (!controller.signal.aborted && showLoading) setLoading(false);
      }
    },
    [buildSaleParams],
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [salesRes, peopleRes, productsRes] = await Promise.all([
        api.get('/sales', { params: buildSaleParams() }),
        api.get('/people'),
        api.get('/products?available=true&inStock=true&pageSize=all'),
      ]);
      setSales(salesRes.data);
      setPeople(peopleRes.data);
      setProducts(productsRes.data.data);
      setError('');
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      setError('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [buildSaleParams]);

  const refreshSales = useCallback(async () => {
    try {
      const response = await api.get('/sales', {
        params: buildSaleParams(),
      });
      setSales(response.data);
    } catch (err) {
      setError('Erro ao carregar vendas. Tente novamente.');
    }
  }, [buildSaleParams]);

  const handleSearchSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    fetchSales();
  };

  const addItem = () => {
    setItems([...items, emptySaleItem()]);
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
              kitStockMode: '',
            }
          : item,
      ),
    );
  };

  const resetForm = () => {
    setClientPersonId('');
    setClientError('');
    setOrderDate(getTodayString());
    setShippingValue('');
    setShippingValueError('');
    setAdditionalValue('');
    setAdditionalValueError('');
    setDescription('');
    setDeliveredAt('');
    setItems([emptySaleItem()]);
    setItemErrors({});
    setSaleFormInitial(null);
    setError('');
    setShowCreateModal(false);
    setShowEditModal(false);
    setEditSaleId(null);
  };

  const setFormField = (field, value) => {
    switch (field) {
      case 'clientPersonId':
        setClientPersonId(value);
        setClientError('');
        break;
      case 'orderDate':
        setOrderDate(value);
        break;
      case 'shippingValue':
        setShippingValue(value);
        setShippingValueError('');
        break;
      case 'additionalValue':
        setAdditionalValue(value);
        setAdditionalValueError('');
        break;
      case 'description':
        setDescription(value);
        break;
      case 'deliveredAt':
        setDeliveredAt(value);
        break;
      default:
        break;
    }
  };

  const validateForm = () => {
    const newClientError = clientPersonId ? '' : 'Cliente é obrigatório';
    setClientError(newClientError);

    const newShippingValueError =
      shippingValue !== '' &&
      shippingValue != null &&
      parseFloat(shippingValue) < 0
        ? 'Frete não pode ser negativo'
        : '';
    setShippingValueError(newShippingValueError);

    const newAdditionalValueError =
      additionalValue !== '' &&
      additionalValue != null &&
      parseFloat(additionalValue) < 0
        ? 'Valor adicional não pode ser negativo'
        : '';
    setAdditionalValueError(newAdditionalValueError);

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
      } else if (!item.productId) {
        newItemErrors[item.id] = 'Produto é obrigatório';
      } else if (isKitItem(item, products) && !item.kitStockMode) {
        newItemErrors[item.id] = 'Escolha como enviar o kit para o estoque';
      }
    });
    setItemErrors(newItemErrors);

    if (newClientError) return false;
    if (newShippingValueError) return false;
    if (newAdditionalValueError) return false;
    return Object.keys(newItemErrors).length === 0;
  };

  const buildPayload = () => ({
    clientPersonId,
    orderDate: orderDate || undefined,
    shippingValue:
      shippingValue === '' || shippingValue == null
        ? 0
        : parseFloat(shippingValue),
    additionalValue:
      additionalValue === '' || additionalValue == null
        ? 0
        : parseFloat(additionalValue),
    description: description.trim() || null,
    deliveredAt: deliveredAt || null,
    items: items.map(saleItemPayload),
  });

  const handleCreateSale = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      await api.post('/sales', buildPayload());
      addToast('Venda criada com sucesso!', 'success');
      resetForm();
      fetchData();
    } catch (err) {
      addToast(
        err.response?.data?.error || 'Erro ao criar venda. Tente novamente.',
        'error',
      );
    }
  };

  const handleEditSale = (sale) => {
    setEditSaleId(sale.id);
    setClientPersonId(sale.items?.[0]?.personId || '');
    setClientError('');
    setItemErrors({});
    setError('');
    const orderDate = sale.orderDate
      ? sale.orderDate.split('T')[0]
      : getTodayString();
    setOrderDate(orderDate);
    const shippingValue =
      sale.shippingValue != null ? String(parseFloat(sale.shippingValue)) : '';
    setShippingValue(shippingValue);
    setShippingValueError('');
    const additionalValue =
      sale.additionalValue != null
        ? String(parseFloat(sale.additionalValue))
        : '';
    setAdditionalValue(additionalValue);
    setAdditionalValueError('');
    setDescription(sale.orderNotes || '');
    setDeliveredAt(sale.deliveredAt ? sale.deliveredAt.split('T')[0] : '');
    const items = (sale.items || []).map(editSaleItemFromApi);
    setItems(items);
    setSaleFormInitial({
      clientPersonId: sale.items?.[0]?.personId || '',
      orderDate,
      shippingValue,
      additionalValue,
      description: sale.orderNotes || '',
      deliveredAt: sale.deliveredAt ? sale.deliveredAt.split('T')[0] : '',
      items,
    });
    setShowEditModal(true);
  };

  const handleUpdateSale = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      await api.put(`/sales/${editSaleId}`, buildPayload());
      addToast('Venda atualizada com sucesso!', 'success');
      resetForm();
      fetchData();
    } catch (err) {
      addToast(
        err.response?.data?.error ||
          'Erro ao atualizar venda. Tente novamente.',
        'error',
      );
    }
  };

  const toggleDelivery = async (sale) => {
    try {
      await api.put(`/sales/${sale.id}`, {
        deliveredAt: sale.deliveredAt ? null : getTodayString(),
      });
      addToast(
        sale.deliveredAt
          ? 'Entrega desmarcada com sucesso!'
          : 'Venda marcada como entregue!',
        'success',
      );
      refreshSales();
    } catch (err) {
      addToast('Erro ao atualizar a entrega. Tente novamente.', 'error');
    }
  };

  const handleDeleteSale = (id) => {
    setConfirmDeleteId(id);
  };

  const cancelDeleteSale = () => {
    setConfirmDeleteId(null);
  };

  const confirmDeleteSale = async () => {
    try {
      setDeleting(true);
      await api.delete(`/sales/${confirmDeleteId}`);
      addToast('Venda excluída com sucesso!', 'success');
      fetchData();
    } catch (err) {
      addToast('Erro ao excluir venda. Tente novamente.', 'error');
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  const loadSupportData = useCallback(async () => {
    try {
      const [peopleRes, productsRes] = await Promise.all([
        api.get('/people'),
        api.get('/products?available=true&inStock=true&pageSize=all'),
      ]);
      setPeople(peopleRes.data);
      setProducts(productsRes.data.data);
    } catch (err) {
      setError('Erro ao carregar dados. Tente novamente.');
    }
  }, []);

  useEffect(() => {
    loadSupportData();
  }, [loadSupportData]);

  const fetchSalesRef = useRef(fetchSales);
  fetchSalesRef.current = fetchSales;

  const saleFormValues = {
    clientPersonId,
    orderDate,
    shippingValue,
    additionalValue,
    description,
    deliveredAt,
    items,
  };
  const saleFormDirty = useDirtyForm(saleFormValues, saleFormInitial).isDirty;

  // Auto-refetch when a filter or the sort changes. Search text is excluded on
  // purpose: the search term is only committed when the user presses Enter or
  // clicks the search button (handleSearchSubmit).
  useEffect(() => {
    fetchSalesRef.current();
  }, [searchField, statusFilter, deliveryFilter, sortBy, sortDir]);

  // Support deep-linking from the Stock history ("Ver venda") via
  // ?editSale=. Opens the edit modal for the referenced sale once data loads.
  useEffect(() => {
    const editSaleParam = searchParams.get('editSale');
    if (!editSaleParam || deepLinkHandledRef.current || loading) return;
    const sale = sales.find((s) => s.id === editSaleParam);
    if (!sale) return;
    deepLinkHandledRef.current = true;
    setSearchParams({}, { replace: true });
    handleEditSale(sale);
  }, [searchParams, loading, sales, handleEditSale, setSearchParams]);

  return {
    sales,
    people,
    products,
    loading,
    error,
    refreshSales,
    search,
    searchField,
    statusFilter,
    deliveryFilter,
    sortBy,
    sortDir,
    hasActiveFilters,
    setSearch,
    setSearchField,
    setStatusFilter,
    setDeliveryFilter,
    handleSearchSubmit,
    handleSort,
    showCreateModal,
    showEditModal,
    editSaleId,
    clientPersonId,
    clientError,
    orderDate,
    shippingValue,
    shippingValueError,
    additionalValue,
    additionalValueError,
    description,
    deliveredAt,
    items,
    itemErrors,
    addItemBtnRef,
    confirmDeleteId,
    deleting,
    saleFormDirty,
    setFormField,
    addItem,
    removeItem,
    updateItemField,
    onProductSelect,
    resetForm,
    handleCreateSale,
    handleEditSale,
    handleUpdateSale,
    toggleDelivery,
    handleDeleteSale,
    cancelDeleteSale,
    confirmDeleteSale,
    setShowCreateModal,
  };
}
