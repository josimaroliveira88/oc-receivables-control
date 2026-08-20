import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import {
  emptyMovementForm,
  buildMovementPayload,
  validateMovement,
} from './utils/stockHelpers';

export function useStock() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submittingMovement, setSubmittingMovement] = useState(false);
  const [movementError, setMovementError] = useState('');
  const [movementProduct, setMovementProduct] = useState(null);
  const [undoing, setUndoing] = useState(false);

  const [products, setProducts] = useState([]);

  const [showMovementDialog, setShowMovementDialog] = useState(false);
  const [movementForm, setMovementForm] = useState(emptyMovementForm());

  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const { addToast } = useToast();

  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/stock');
      setInventory(Array.isArray(response.data) ? response.data : []);
      setError('');
    } catch (err) {
      setError('Erro ao carregar estoque. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const loadProductsCatalog = useCallback(async () => {
    try {
      const response = await api.get('/products?pageSize=all');
      const list = response.data?.data;
      setProducts(Array.isArray(list) ? list : []);
    } catch (err) {
      setProducts([]);
    }
  }, []);

  const availableProducts = useMemo(() => {
    const inventoryIds = new Set(
      (inventory || []).map((item) => item.productId),
    );
    return (products || []).filter((p) => !inventoryIds.has(p.id));
  }, [products, inventory]);

  const openMovementDialog = (item, type) => {
    setMovementForm(emptyMovementForm(item.productId, type));
    setMovementProduct(item);
    setMovementError('');
    setShowMovementDialog(true);
  };

  const openAddStockDialog = async () => {
    await loadProductsCatalog();
    setMovementForm(emptyMovementForm('', 'ENTRADA'));
    setMovementProduct(null);
    setMovementError('');
    setShowMovementDialog(true);
  };

  const closeMovementDialog = () => {
    setShowMovementDialog(false);
    setMovementForm(emptyMovementForm());
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
      addToast('Erro ao desfazer movimentação. Tente novamente.', 'error');
      return false;
    } finally {
      setUndoing(false);
    }
  };

  return {
    inventory,
    loading,
    error,
    availableProducts,
    showMovementDialog,
    movementForm,
    movementError,
    movementProduct,
    submittingMovement,
    showHistoryDialog,
    historyProduct,
    history,
    historyLoading,
    canUndo: history.length > 0,
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
  };
}
