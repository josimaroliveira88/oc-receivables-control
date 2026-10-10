import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import {
  emptyMovementForm,
  buildMovementPayload,
  validateMovement,
  filterAndSortStock,
} from './utils/stockHelpers';
import {
  emptyExchangeForm,
  emptyExchangeLine,
  validateExchange,
  buildExchangePayload,
} from './utils/stockExchangeHelpers';

export function useStock() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [submittingMovement, setSubmittingMovement] = useState(false);
  const [movementError, setMovementError] = useState('');
  const [movementProduct, setMovementProduct] = useState(null);
  const [undoing, setUndoing] = useState(false);

  const [products, setProducts] = useState([]);

  const [showMovementDialog, setShowMovementDialog] = useState(false);
  const [movementForm, setMovementForm] = useState(emptyMovementForm());
  const [movementFormInitial, setMovementFormInitial] = useState(null);

  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Stock-exchange (swap) state.
  const [showExchangeDialog, setShowExchangeDialog] = useState(false);
  const [exchangeForm, setExchangeForm] = useState(emptyExchangeForm());
  const [exchangeFormInitial, setExchangeFormInitial] = useState(null);
  const [exchangeError, setExchangeError] = useState('');
  const [submittingExchange, setSubmittingExchange] = useState(false);
  const [people, setPeople] = useState([]);
  const [exchangeProducts, setExchangeProducts] = useState([]);

  const { addToast } = useToast();

  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/stock');
      setInventory(Array.isArray(response.data) ? response.data : []);
      setError('');
    } catch (_err) {
      setError('Erro ao carregar estoque. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const visibleInventory = useMemo(
    () => filterAndSortStock(inventory, search, sortBy, sortDir),
    [inventory, search, sortBy, sortDir],
  );

  const handleSort = (field, dir) => {
    setSortBy(field);
    setSortDir(dir);
  };

  const loadProductsCatalog = useCallback(async () => {
    try {
      const response = await api.get('/products?pageSize=all');
      const list = response.data?.data;
      setProducts(Array.isArray(list) ? list : []);
    } catch (_err) {
      setProducts([]);
    }
  }, []);

  const availableProducts = useMemo(() => {
    const inventoryIds = new Set(
      (inventory || []).map((item) => item.productId),
    );
    return (products || []).filter((p) => !inventoryIds.has(p.id));
  }, [products, inventory]);

  const productPriceMap = useMemo(() => {
    const map = {};
    for (const product of exchangeProducts) {
      map[product.id] = product;
    }
    return map;
  }, [exchangeProducts]);

  const movementDirty = useDirtyForm(movementForm, movementFormInitial).isDirty;

  const openMovementDialog = (item, type) => {
    const form = emptyMovementForm(item.productId, type);
    setMovementForm(form);
    setMovementFormInitial(form);
    setMovementProduct(item);
    setMovementError('');
    setShowMovementDialog(true);
  };

  const openAddStockDialog = async () => {
    await loadProductsCatalog();
    const form = emptyMovementForm('', 'ENTRADA');
    setMovementForm(form);
    setMovementFormInitial(form);
    setMovementProduct(null);
    setMovementError('');
    setShowMovementDialog(true);
  };

  const closeMovementDialog = () => {
    setShowMovementDialog(false);
    setMovementForm(emptyMovementForm());
    setMovementFormInitial(null);
    setMovementError('');
    setMovementProduct(null);
  };

  const setMovementField = (field, value) => {
    setMovementForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmitMovement = async (e) => {
    e.preventDefault();
    const validationError = validateMovement(movementForm);
    if (validationError) {
      setMovementError(validationError);
      return;
    }
    setMovementError('');
    setSubmittingMovement(true);
    try {
      await api.post('/stock/movements', buildMovementPayload(movementForm));
      addToast('Movimentação registrada com sucesso!', 'success');
      closeMovementDialog();
      loadInventory();
    } catch (_err) {
      addToast('Erro ao registrar movimentação. Tente novamente.', 'error');
    } finally {
      setSubmittingMovement(false);
    }
  };

  const loadHistory = useCallback(async (productId) => {
    setHistoryLoading(true);
    try {
      const response = await api.get(`/stock/${productId}/history`);
      setHistory(Array.isArray(response.data) ? response.data : []);
    } catch (_err) {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const openHistoryDialog = async (item) => {
    setHistoryProduct(item);
    setHistory([]);
    setShowHistoryDialog(true);
    await loadHistory(item.productId);
  };

  const closeHistoryDialog = () => {
    setShowHistoryDialog(false);
    setHistoryProduct(null);
    setHistory([]);
  };

  const undoLastMovement = async () => {
    if (history.length === 0) return false;
    const lastId = history[0].id;
    const productId = historyProduct?.productId;
    setUndoing(true);
    try {
      await api.post(`/stock/movements/${lastId}/undo`);
      addToast('Última movimentação desfeita com sucesso!', 'success');
      if (productId) {
        await loadHistory(productId);
      } else {
        setHistory([]);
      }
      await loadInventory();
      return true;
    } catch (_err) {
      addToast('Erro ao desfazer movimentação. Tente novamente.', 'error');
      return false;
    } finally {
      setUndoing(false);
    }
  };

  // Stock-exchange helpers -------------------------------------------------

  const ensureExchangeLookups = useCallback(async () => {
    const tasks = [];
    if (people.length === 0) {
      tasks.push(
        api
          .get('/people')
          .then((res) => setPeople(Array.isArray(res.data) ? res.data : []))
          .catch(() => setPeople([])),
      );
    }
    if (exchangeProducts.length === 0) {
      tasks.push(
        api
          .get('/products?available=true&pageSize=all')
          .then((res) =>
            setExchangeProducts(
              Array.isArray(res.data?.data) ? res.data.data : [],
            ),
          )
          .catch(() => setExchangeProducts([])),
      );
    }
    await Promise.all(tasks);
  }, [people.length, exchangeProducts.length]);

  const openExchangeDialog = async () => {
    await ensureExchangeLookups();
    const form = emptyExchangeForm();
    setExchangeForm(form);
    setExchangeFormInitial(form);
    setExchangeError('');
    setShowExchangeDialog(true);
  };

  const closeExchangeDialog = () => {
    setShowExchangeDialog(false);
    setExchangeForm(emptyExchangeForm());
    setExchangeFormInitial(null);
    setExchangeError('');
  };

  const setExchangeField = (field, value) => {
    setExchangeForm((prev) => ({ ...prev, [field]: value }));
  };

  const setExchangeLine = (side, uid, fieldName, value) => {
    setExchangeForm((prev) => {
      const nextLines = prev[side].map((line) =>
        line.uid === uid ? { ...line, [fieldName]: value } : line,
      );
      return { ...prev, [side]: nextLines };
    });
  };

  const addExchangeLine = (side) => {
    setExchangeForm((prev) => ({
      ...prev,
      [side]: [...prev[side], emptyExchangeLine()],
    }));
  };

  const removeExchangeLine = (side, uid) => {
    setExchangeForm((prev) => ({
      ...prev,
      [side]: prev[side].filter((line) => line.uid !== uid),
    }));
  };

  const handleSubmitExchange = async (e) => {
    e.preventDefault();
    const validationError = validateExchange(exchangeForm);
    if (validationError) {
      setExchangeError(validationError);
      return;
    }
    setExchangeError('');
    setSubmittingExchange(true);
    try {
      await api.post('/stock/exchanges', buildExchangePayload(exchangeForm));
      addToast('Troca registrada com sucesso!', 'success');
      closeExchangeDialog();
      loadInventory();
    } catch (_err) {
      addToast('Erro ao registrar troca. Tente novamente.', 'error');
    } finally {
      setSubmittingExchange(false);
    }
  };

  const exchangeDirty = useDirtyForm(exchangeForm, exchangeFormInitial).isDirty;

  return {
    inventory: visibleInventory,
    totalCount: visibleInventory.length,
    hasActiveFilters: search.trim() !== '',
    search,
    sortBy,
    sortDir,
    setSearch,
    handleSort,
    loading,
    error,
    availableProducts,
    showMovementDialog,
    movementForm,
    movementError,
    movementProduct,
    movementDirty,
    submittingMovement,
    showHistoryDialog,
    historyProduct,
    history,
    historyLoading,
    canUndo: history.length > 0 && !history[0]?.order,
    lastMovementOrder: history[0]?.order ?? null,
    undoing,
    openMovementDialog,
    openAddStockDialog,
    closeMovementDialog,
    setMovementField,
    handleSubmitMovement,
    openHistoryDialog,
    closeHistoryDialog,
    undoLastMovement,
    handleRegisterEntry: (item) => openMovementDialog(item, 'ENTRADA'),
    handleRegisterExit: (item) => openMovementDialog(item, 'SAIDA'),
    // Stock exchange
    showExchangeDialog,
    exchangeForm,
    exchangeDirty,
    exchangeError,
    submittingExchange,
    exchangePeople: people,
    exchangeProducts,
    exchangeProductPriceMap: productPriceMap,
    openExchangeDialog,
    closeExchangeDialog,
    setExchangeField,
    setExchangeLine,
    addExchangeLine,
    removeExchangeLine,
    handleSubmitExchange,
  };
}
