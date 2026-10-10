import { useCallback, useState } from 'react';
import api from '../../../services/api';
import { useToast } from '../../../components/Toast';

// Owns the "where is this product used" panel: loads the usage snapshot, lets
// the user remove a reference and finally hard-delete the product. UI state for
// the confirm dialogs stays in the modal component; this hook only does I/O and
// keeps the snapshot fresh.
export function useProductUsage({ onChanged } = {}) {
  const [usageProduct, setUsageProduct] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { addToast } = useToast();

  const loadUsage = useCallback(async (product) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/products/${product.id}/usage`);
      setSnapshot(data);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Erro ao carregar os locais de uso. Tente novamente.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const openUsageModal = useCallback(
    (product) => {
      setUsageProduct(product);
      setSnapshot(null);
      setError('');
      loadUsage(product);
    },
    [loadUsage],
  );

  const closeUsageModal = useCallback(() => {
    setUsageProduct(null);
    setSnapshot(null);
    setError('');
  }, []);

  const refreshUsage = useCallback(() => {
    if (usageProduct) loadUsage(usageProduct);
  }, [usageProduct, loadUsage]);

  const removeReference = useCallback(
    async (kind) => {
      if (!usageProduct) return { ok: false };
      try {
        await api.delete(`/products/${usageProduct.id}/references/${kind}`);
        addToast('Referência removida.', 'success');
        await loadUsage(usageProduct);
        return { ok: true };
      } catch (err) {
        addToast(
          err.response?.data?.error || 'Erro ao remover a referência.',
          'error',
        );
        return { ok: false };
      }
    },
    [usageProduct, loadUsage, addToast],
  );

  // One-shot deletion: clears every reference (including the blocking ones)
  // and removes the product. Item references in orders/sales are unlinked by
  // the backend, so the user never has to edit them.
  const purgeProduct = useCallback(async () => {
    if (!usageProduct) return { ok: false };
    try {
      await api.post(`/products/${usageProduct.id}/purge`);
      addToast('Produto excluído com sucesso!', 'success');
      closeUsageModal();
      onChanged?.();
      return { ok: true };
    } catch (err) {
      addToast(
        err.response?.data?.error ||
          'Erro ao excluir produto. Tente novamente.',
        'error',
      );
      return { ok: false };
    }
  }, [usageProduct, closeUsageModal, onChanged, addToast]);

  return {
    usageProduct,
    snapshot,
    loading,
    error,
    openUsageModal,
    closeUsageModal,
    refreshUsage,
    removeReference,
    purgeProduct,
  };
}
