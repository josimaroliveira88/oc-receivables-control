import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import { hasFormChanges } from '../../utils/formChanges';
import { useOrderFilters } from './useOrderFilters';
import { useOrderEntryMode, ENTRY_MODES } from './useOrderEntryMode';
import {
  emptyItem,
  getTodayString,
  itemPayload,
  editItemFromApi,
  isKitItem,
  prefilledChargedValue,
  SELF_PERSON_ID,
  findSelfPerson,
  deriveTeamClientFromItems,
} from './utils/orderHelpers';
import {
  createEmptySpreadsheetRow,
  spreadsheetRowsFromItems,
  itemsFromSpreadsheetRows,
  derivedChargedValueString,
  kitStockModeMissing,
} from './utils/orderSpreadsheetHelpers';

export function useOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    search,
    searchField,
    sortBy,
    sortDir,
    setSearch,
    setSearchField,
    buildOrderParams,
    handleSort,
    hasActiveFilters,
  } = useOrderFilters();
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
  const [isTeamOrder, setIsTeamOrder] = useState(false);
  const [accountOwner, setAccountOwner] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [doterraPv, setDoterraPv] = useState('');
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentRemoved, setAttachmentRemoved] = useState(false);
  const [shippingValue, setShippingValue] = useState('');
  const [shippingValueError, setShippingValueError] = useState('');
  const [doterraPvError, setDoterraPvError] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const [teamPersonId, setTeamPersonId] = useState('');
  const [usesOrderLevelClient, setUsesOrderLevelClient] = useState(true);
  const [teamPersonIdError, setTeamPersonIdError] = useState('');
  const [pendingTeamPersonId, setPendingTeamPersonId] = useState('');
  const [showTeamPersonConfirm, setShowTeamPersonConfirm] = useState(false);
  const [orderNumberError, setOrderNumberError] = useState('');
  const [itemErrors, setItemErrors] = useState({});
  const addItemBtnRef = useRef(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [orderFormInitial, setOrderFormInitial] = useState(null);
  const ordersAbortRef = useRef(null);
  const { addToast } = useToast();

  const {
    entryMode,
    defaultEntryMode,
    applyEntryMode,
    saveEntryModeAsDefault,
  } = useOrderEntryMode();
  const [spreadsheetRows, setSpreadsheetRows] = useState([]);
  const [spreadsheetInitial, setSpreadsheetInitial] = useState(null);
  const [rowErrors, setRowErrors] = useState({});
  const [rowsError, setRowsError] = useState('');
  const [pendingEntryMode, setPendingEntryMode] = useState(null);
  const [showEntryModeConfirm, setShowEntryModeConfirm] = useState(false);
  const [showEntryModeDefaultPrompt, setShowEntryModeDefaultPrompt] =
    useState(false);

  const fetchOrders = useCallback(
    async ({ showLoading = true } = {}) => {
      if (ordersAbortRef.current) ordersAbortRef.current.abort();
      const controller = new AbortController();
      ordersAbortRef.current = controller;
      if (showLoading) setLoading(true);
      try {
        const response = await api.get('/orders', {
          params: buildOrderParams(),
          signal: controller.signal,
        });
        setOrders(response.data);
        setError('');
      } catch (err) {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setError('Erro ao carregar pedidos. Tente novamente.');
      } finally {
        if (!controller.signal.aborted && showLoading) setLoading(false);
      }
    },
    [buildOrderParams],
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [ordersRes, peopleRes, productsRes] = await Promise.all([
        api.get('/orders', { params: buildOrderParams() }),
        api.get('/people'),
        api.get('/products?available=true&pageSize=all'),
      ]);
      setOrders(ordersRes.data);
      setPeople(peopleRes.data);
      setProducts(productsRes.data.data);
      setError('');
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      setError('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [buildOrderParams]);

  const refreshOrders = useCallback(async () => {
    try {
      const response = await api.get('/orders', {
        params: buildOrderParams(),
      });
      setOrders(response.data);
    } catch (_err) {
      setError('Erro ao carregar pedidos. Tente novamente.');
    }
  }, [buildOrderParams]);

  const handleSearchSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    fetchOrders();
  };

  const addItem = () => {
    setItems((prev) => {
      const newItem = emptyItem();
      if (isTeamOrder && usesOrderLevelClient && teamPersonId) {
        newItem.personId = teamPersonId;
      }
      return [...prev, newItem];
    });
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
      items.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, [field]: value };
        // Changing the promotion recomputes the paid value from the member
        // price, mirroring the spreadsheet behavior.
        if (field === 'discountPercent') {
          next.chargedValue = prefilledChargedValue(next);
        }
        return next;
      }),
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
    const memberPrice =
      product && product.memberPrice != null
        ? parseFloat(product.memberPrice).toString()
        : '';
    setItems(
      items.map((item, i) => {
        if (i !== index) return item;
        const next = {
          ...item,
          productId,
          productName: product ? product.name : '',
          productCode: product ? product.code : '',
          description: product ? product.name : '',
          memberPrice,
          kitStockMode: '',
        };
        // Clearing the product means there is nothing to stock.
        if (!productId) next.forStock = false;
        else next.forStock = true;
        // Prefill "Valor Pago" from the member price, honoring the current
        // promotion percentage. The user can still edit it afterwards.
        next.chargedValue = prefilledChargedValue(next);
        return next;
      }),
    );
  };

  const selfPersonRequestRef = useRef(null);
  const deepLinkHandledRef = useRef(false);

  // Resolves the logged-in user's Person record, creating it through the API
  // when it does not exist yet. Shared by the per-item and order-level selects.
  const ensureSelfPersonId = async () => {
    const existingSelf = findSelfPerson(people);
    if (existingSelf) return existingSelf.id;

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
    return person.id;
  };

  const onPersonSelect = async (index, value) => {
    if (value === SELF_PERSON_ID) {
      try {
        const selfPersonId = await ensureSelfPersonId();
        updateItemField(index, 'personId', selfPersonId);
      } catch (_err) {
        addToast('Não foi possível vincular você a este item.', 'error');
      }
      return;
    }

    // When leaving the self person, the "for stock" toggle no longer applies.
    // Apply both changes (personId + forStock reset) in a single state update
    // so that React doesn't lose the personId change to a stale closure.
    const target = items[index];
    setItems(
      items.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, personId: value };
        if (updated.forStock) updated.forStock = false;
        if (updated.kitStockMode) updated.kitStockMode = '';
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
  };

  // Applies an order-level client to every item, switching the order to the
  // new order-level client mode. Team orders never affect stock.
  const applyTeamPerson = (personId) => {
    setTeamPersonId(personId);
    setUsesOrderLevelClient(true);
    setTeamPersonIdError('');
    setItemErrors({});
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        personId,
        forStock: false,
        kitStockMode: '',
      })),
    );
  };

  const onTeamPersonSelect = async (value) => {
    let personId = value;
    if (value === SELF_PERSON_ID) {
      try {
        personId = await ensureSelfPersonId();
      } catch (_err) {
        addToast('Não foi possível vincular você a este pedido.', 'error');
        return;
      }
    }

    // Legacy team orders (items with divergent persons) require confirmation
    // before unifying every item under the chosen client.
    if (isTeamOrder && !usesOrderLevelClient) {
      setPendingTeamPersonId(personId);
      setShowTeamPersonConfirm(true);
      return;
    }

    applyTeamPerson(personId);
  };

  const confirmTeamPersonChange = () => {
    applyTeamPerson(pendingTeamPersonId);
    setPendingTeamPersonId('');
    setShowTeamPersonConfirm(false);
  };

  const cancelTeamPersonChange = () => {
    setPendingTeamPersonId('');
    setShowTeamPersonConfirm(false);
  };

  // --- Spreadsheet (planilha) entry mode ---------------------------------

  const addSpreadsheetRow = () => {
    setSpreadsheetRows((prev) => [...prev, createEmptySpreadsheetRow()]);
    setRowsError('');
  };

  const removeSpreadsheetRow = (id) => {
    setSpreadsheetRows((prev) => prev.filter((row) => row.id !== id));
    setRowErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const updateSpreadsheetRow = (id, field, value) => {
    setSpreadsheetRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, [field]: value };
        if (field === 'productId') {
          const product = products.find((p) => p.id === value) || null;
          next.forStock = !isTeamOrder && !!product;
          if (!product) next.kitStockMode = '';
          next.chargedValue = derivedChargedValueString(next, products);
        } else if (field === 'discountPercent') {
          next.chargedValue = derivedChargedValueString(next, products);
        }
        return next;
      }),
    );
    setRowErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setRowsError('');
  };

  const clearSpreadsheetRows = () => {
    setSpreadsheetRows([]);
    setRowErrors({});
    setRowsError('');
  };

  // Switching mode discards the source mode's unsaved item edits (order-level
  // fields are shared and are kept). The user always confirms whether the new
  // mode becomes the default for future orders.
  const proceedEntryModeChange = (mode) => {
    if (entryMode === ENTRY_MODES.DETAILED) {
      setItems(orderFormInitial?.items ?? [emptyItem()]);
      setItemErrors({});
    } else {
      setSpreadsheetRows(spreadsheetInitial ?? []);
      setRowErrors({});
      setRowsError('');
    }
    applyEntryMode(mode);
    setPendingEntryMode(mode);
    setShowEntryModeDefaultPrompt(true);
  };

  const resetForm = () => {
    setOrderNumber('');
    setOrderNumberBlurred(false);
    setOrderDate(getTodayString());
    setIsTeamOrder(false);
    setAccountOwner('');
    setPaymentType('');
    setOrderNotes('');
    setDoterraPv('');
    setAttachmentFile(null);
    setAttachmentRemoved(false);
    setShippingValue('');
    setShippingValueError('');
    setDoterraPvError('');
    setItems([emptyItem()]);
    setTeamPersonId('');
    setUsesOrderLevelClient(true);
    setTeamPersonIdError('');
    setPendingTeamPersonId('');
    setShowTeamPersonConfirm(false);
    setOrderNumberError('');
    setItemErrors({});
    setOrderFormInitial(null);
    setSpreadsheetRows([]);
    setSpreadsheetInitial(null);
    setRowErrors({});
    setRowsError('');
    setPendingEntryMode(null);
    setShowEntryModeConfirm(false);
    setShowEntryModeDefaultPrompt(false);
    setError('');
    setShowCreateModal(false);
    setShowEditModal(false);
    setEditOrderId(null);
  };

  const openCreateOrder = () => {
    setShowCreateModal(true);
    setUsesOrderLevelClient(true);
    applyEntryMode(defaultEntryMode);
    const initialRows = [createEmptySpreadsheetRow()];
    setSpreadsheetRows(initialRows);
    setSpreadsheetInitial(initialRows);
    setRowErrors({});
    setRowsError('');
    setOrderFormInitial({
      orderNumber,
      orderDate,
      isTeamOrder,
      accountOwner,
      paymentType,
      orderNotes,
      doterraPv,
      shippingValue,
      teamPersonId,
      items,
    });
    setError('');
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
      case 'isTeamOrder':
        setIsTeamOrder(value);
        setTeamPersonIdError('');
        if (value) {
          setUsesOrderLevelClient(true);
        } else {
          setTeamPersonId('');
        }
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
      case 'doterraPv':
        setDoterraPv(value);
        break;
      case 'attachmentFile':
        setAttachmentFile(value);
        setAttachmentRemoved(false);
        break;
      case 'attachmentRemoved':
        setAttachmentRemoved(value);
        if (value) setAttachmentFile(null);
        break;
      case 'shippingValue':
        setShippingValue(value);
        setShippingValueError('');
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

    const newShippingValueError =
      shippingValue !== '' &&
      shippingValue != null &&
      parseFloat(shippingValue) < 0
        ? 'Frete não pode ser negativo'
        : '';
    setShippingValueError(newShippingValueError);

    const newDoterraPvError =
      doterraPv !== '' && doterraPv != null && parseFloat(doterraPv) < 0
        ? 'PV doTERRA não pode ser negativo'
        : '';
    setDoterraPvError(newDoterraPvError);

    const newTeamPersonIdError =
      isTeamOrder &&
      (entryMode === ENTRY_MODES.SPREADSHEET || usesOrderLevelClient) &&
      !teamPersonId
        ? 'Cliente é obrigatório'
        : '';
    setTeamPersonIdError(newTeamPersonIdError);

    const hasOrderLevelError =
      !!newOrderNumberError ||
      !!newShippingValueError ||
      !!newDoterraPvError ||
      !!newTeamPersonIdError;

    if (entryMode === ENTRY_MODES.SPREADSHEET) {
      const newRowErrors = {};
      spreadsheetRows.forEach((row) => {
        if (!row.productId) return;
        if (
          row.chargedValue !== '' &&
          row.chargedValue != null &&
          parseFloat(row.chargedValue) < 0
        ) {
          newRowErrors[row.id] = 'Valor não pode ser negativo';
        } else if (
          row.quantity !== '' &&
          row.quantity != null &&
          (!Number.isInteger(Number(row.quantity)) || Number(row.quantity) < 1)
        ) {
          newRowErrors[row.id] = 'Quantidade deve ser maior ou igual a 1';
        } else if (kitStockModeMissing(row, products)) {
          newRowErrors[row.id] = 'Escolha como enviar o kit para o estoque';
        }
      });
      setRowErrors(newRowErrors);
      setItemErrors({});
      const hasProduct = spreadsheetRows.some((row) => row.productId);
      setRowsError(hasProduct ? '' : 'Adicione ao menos um produto ao pedido');
      if (hasOrderLevelError) return false;
      if (!hasProduct) return false;
      return Object.keys(newRowErrors).length === 0;
    }

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
      } else if (isTeamOrder && !usesOrderLevelClient && !item.personId) {
        newItemErrors[item.id] = 'Pessoa é obrigatória';
      } else if (
        item.forStock &&
        isKitItem(item, products) &&
        !item.kitStockMode
      ) {
        newItemErrors[item.id] = 'Escolha como enviar o kit para o estoque';
      }
    });
    setItemErrors(newItemErrors);
    setRowErrors({});
    setRowsError('');

    if (hasOrderLevelError) return false;
    return Object.keys(newItemErrors).length === 0;
  };

  const buildPayload = () => {
    const payloadItems =
      entryMode === ENTRY_MODES.SPREADSHEET
        ? itemsFromSpreadsheetRows(spreadsheetRows, products, {
            isTeamOrder,
            teamPersonId,
          })
        : items;
    return {
      orderNumber: orderNumber.trim(),
      orderDate: orderDate || undefined,
      isTeamOrder,
      accountOwner: accountOwner.trim() || null,
      paymentType: paymentType || null,
      orderNotes: orderNotes.trim() || null,
      doterraPv:
        doterraPv === '' || doterraPv == null ? null : parseFloat(doterraPv),
      shippingValue:
        shippingValue === '' || shippingValue == null
          ? 0
          : parseFloat(shippingValue),
      items: payloadItems.map(itemPayload),
    };
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      const created = await api.post('/orders', buildPayload());
      if (attachmentFile) {
        const formData = new FormData();
        formData.append('file', attachmentFile);
        await api.post(`/orders/${created.data.id}/attachment`, formData);
      }
      addToast('Pedido criado com sucesso!', 'success');
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
    const orderDate = order.orderDate
      ? order.orderDate.split('T')[0]
      : getTodayString();
    setOrderDate(orderDate);
    setIsTeamOrder(Boolean(order.isTeamOrder));
    setAccountOwner(order.accountOwner || '');
    setPaymentType(order.paymentType || '');
    setOrderNotes(order.orderNotes || '');
    setDoterraPv(
      order.doterraPv != null ? String(parseFloat(order.doterraPv)) : '',
    );
    setAttachmentFile(null);
    setAttachmentRemoved(false);
    const shippingValue =
      order.shippingValue != null
        ? String(parseFloat(order.shippingValue))
        : '';
    setShippingValue(shippingValue);
    setShippingValueError('');
    const items = order.items.map(editItemFromApi);
    setItems(items);
    const rows = spreadsheetRowsFromItems(items);
    setSpreadsheetRows(rows);
    setSpreadsheetInitial(rows);
    setRowErrors({});
    setRowsError('');
    applyEntryMode(defaultEntryMode);
    // Team orders created before the order-level client existed keep their
    // per-item persons when those differ; when every item shares the same
    // person (or none), the form adopts the new order-level client mode.
    const {
      usesOrderLevelClient: orderLevelClient,
      teamPersonId: orderClientId,
    } = order.isTeamOrder
      ? deriveTeamClientFromItems(order.items)
      : { usesOrderLevelClient: true, teamPersonId: '' };
    setUsesOrderLevelClient(orderLevelClient);
    setTeamPersonId(orderClientId);
    setTeamPersonIdError('');
    setOrderFormInitial({
      orderNumber: order.orderNumber,
      orderDate,
      isTeamOrder: Boolean(order.isTeamOrder),
      accountOwner: order.accountOwner || '',
      paymentType: order.paymentType || '',
      orderNotes: order.orderNotes || '',
      doterraPv:
        order.doterraPv != null ? String(parseFloat(order.doterraPv)) : '',
      shippingValue,
      teamPersonId: orderClientId,
      items,
    });
    setShowEditModal(true);
  };

  const handleUpdateOrder = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      await api.put(`/orders/${editOrderId}`, buildPayload());
      if (attachmentFile) {
        const formData = new FormData();
        formData.append('file', attachmentFile);
        await api.post(`/orders/${editOrderId}/attachment`, formData);
      } else if (attachmentRemoved) {
        await api.delete(`/orders/${editOrderId}/attachment`);
      }
      addToast('Pedido atualizado com sucesso!', 'success');
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
    } catch (_err) {
      addToast('Erro ao excluir pedido. Tente novamente.', 'error');
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  const loadSupportData = useCallback(async () => {
    try {
      const [peopleRes, productsRes] = await Promise.all([
        api.get('/people'),
        api.get('/products?available=true&pageSize=all'),
      ]);
      setPeople(peopleRes.data);
      setProducts(productsRes.data.data);
    } catch (_err) {
      setError('Erro ao carregar dados. Tente novamente.');
    }
  }, []);

  useEffect(() => {
    loadSupportData();
  }, [loadSupportData]);

  const fetchOrdersRef = useRef(fetchOrders);
  fetchOrdersRef.current = fetchOrders;

  const orderFormValues = {
    orderNumber,
    orderDate,
    isTeamOrder,
    accountOwner,
    paymentType,
    orderNotes,
    doterraPv,
    shippingValue,
    teamPersonId,
    items,
  };
  const detailsDirty = useDirtyForm(orderFormValues, orderFormInitial).isDirty;
  const spreadsheetDirty = hasFormChanges(spreadsheetRows, spreadsheetInitial);
  const formDirty = detailsDirty || spreadsheetDirty;
  // Order-level fields are shared and survive a mode switch, so only the
  // active mode's items decide whether there is data to warn about.
  const detailedItemsDirty = hasFormChanges(
    items,
    orderFormInitial?.items ?? null,
  );

  const onChangeEntryMode = (mode) => {
    if (mode === entryMode) return;
    const hasUnsavedItems =
      entryMode === ENTRY_MODES.SPREADSHEET
        ? spreadsheetDirty
        : detailedItemsDirty;
    if (hasUnsavedItems) {
      setPendingEntryMode(mode);
      setShowEntryModeConfirm(true);
      return;
    }
    proceedEntryModeChange(mode);
  };

  const cancelEntryModeChange = () => {
    setShowEntryModeConfirm(false);
    setPendingEntryMode(null);
  };

  const confirmEntryModeChange = () => {
    const mode = pendingEntryMode;
    setShowEntryModeConfirm(false);
    setPendingEntryMode(null);
    if (mode) proceedEntryModeChange(mode);
  };

  const confirmDefaultEntryMode = () => {
    if (pendingEntryMode) saveEntryModeAsDefault(pendingEntryMode);
    setShowEntryModeDefaultPrompt(false);
    setPendingEntryMode(null);
  };

  const declineDefaultEntryMode = () => {
    setShowEntryModeDefaultPrompt(false);
    setPendingEntryMode(null);
  };

  // Auto-refetch when a filter or the sort changes. Search text is excluded on
  // purpose: the search term is only committed when the user presses Enter or
  // clicks the search button (handleSearchSubmit).
  useEffect(() => {
    fetchOrdersRef.current();
  }, [searchField, sortBy, sortDir]);

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
    search,
    searchField,
    sortBy,
    sortDir,
    hasActiveFilters,
    setSearch,
    setSearchField,
    handleSearchSubmit,
    handleSort,
    showCreateModal,
    showEditModal,
    editOrderId,
    orderNumber,
    orderNumberBlurred,
    orderDate,
    isTeamOrder,
    teamPersonId,
    usesOrderLevelClient,
    teamPersonIdError,
    showTeamPersonConfirm,
    accountOwner,
    paymentType,
    orderNotes,
    doterraPv,
    doterraPvError,
    attachmentFile,
    attachmentRemoved,
    shippingValue,
    shippingValueError,
    items,
    orderNumberError,
    itemErrors,
    addItemBtnRef,
    confirmDeleteId,
    deleting,
    orderFormDirty: formDirty,
    entryMode,
    spreadsheetRows,
    rowErrors,
    rowsError,
    showEntryModeConfirm,
    showEntryModeDefaultPrompt,
    setFormField,
    addItem,
    removeItem,
    updateItemField,
    onProductSelect,
    onPersonSelect,
    onTeamPersonSelect,
    confirmTeamPersonChange,
    cancelTeamPersonChange,
    addSpreadsheetRow,
    removeSpreadsheetRow,
    updateSpreadsheetRow,
    clearSpreadsheetRows,
    onChangeEntryMode,
    confirmEntryModeChange,
    cancelEntryModeChange,
    confirmDefaultEntryMode,
    declineDefaultEntryMode,
    resetForm,
    handleCreateOrder,
    handleEditOrder,
    handleUpdateOrder,
    handleDeleteOrder,
    cancelDeleteOrder,
    confirmDeleteOrder,
    openCreateOrder,
  };
}
