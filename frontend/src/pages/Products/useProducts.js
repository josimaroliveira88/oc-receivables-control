import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import { copyToClipboard } from '../../utils/clipboard';
import {
  PAGE_SIZE,
  emptyForm,
  isValidUrl,
  createProductPayload,
  updateProductPayload,
  filterAndSortProducts,
  formatProductRowForCopy,
  kitComponentsPayload,
} from './utils/productHelpers';

export function useProducts() {
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loyaltyTier, setLoyaltyTier] = useState('');
  const [showPointsColumn, setShowPointsColumn] = useState(false);
  const [sort, setSort] = useState('name:asc');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editProductId, setEditProductId] = useState(null);
  const [editProduct, setEditProduct] = useState(emptyForm());
  const [editStatus, setEditStatus] = useState('ATIVO');
  const [createForm, setCreateForm] = useState(emptyForm());
  const [confirmStatus, setConfirmStatus] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [createFormInitial, setCreateFormInitial] = useState(null);
  const [editProductInitial, setEditProductInitial] = useState(null);
  const { addToast } = useToast();

  const sentinelRef = useRef(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/products?pageSize=all');
      setAllProducts(response.data.data);
      setVisibleCount(PAGE_SIZE);
      setError('');
    } catch (err) {
      setError('Erro ao carregar produtos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filteredProducts = useMemo(
    () => filterAndSortProducts(allProducts, search, statusFilter, sort),
    [allProducts, search, statusFilter, sort],
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, statusFilter, sort]);

  const visibleProducts = filteredProducts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredProducts.length;

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const node = sentinelRef.current;
    if (!node || !hasMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0] && entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + PAGE_SIZE);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, visibleProducts.length, loading]);

  const setCreateField = (field, value) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const togglePointsColumn = () => {
    setShowPointsColumn((prev) => !prev);
  };

  const setEditField = (field, value) => {
    setEditProduct((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const openCreateModal = () => {
    setShowCreateModal(true);
    setCreateFormInitial(emptyForm());
    setError('');
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateForm(emptyForm());
    setCreateFormInitial(null);
    setError('');
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!createForm.code.trim()) {
      setError('Código é obrigatório');
      return;
    }
    if (!createForm.name.trim()) {
      setError('Nome é obrigatório');
      return;
    }
    if (!createForm.size.trim()) {
      setError('Tamanho é obrigatório');
      return;
    }
    if (
      createForm.productType === 'KIT' &&
      kitComponentsPayload(createForm.components).length === 0
    ) {
      setError('É obrigatório vincular ao menos um produto ao kit');
      return;
    }
    if (!isValidUrl(createForm.doterraUrl)) {
      setError('URL do produto inválida');
      return;
    }
    try {
      const { data } = await api.post(
        '/products',
        createProductPayload(createForm),
      );
      setAllProducts((prev) => [...prev, data]);
      setCreateForm(emptyForm());
      setShowCreateModal(false);
      setError('');
      addToast('Produto criado com sucesso!', 'success');
    } catch (err) {
      addToast(
        err.response?.data?.error || 'Erro ao criar produto. Tente novamente.',
        'error',
      );
    }
  };

  const validateEditProduct = () => {
    if (!editProduct.name.trim()) {
      setError('Nome é obrigatório');
      return false;
    }
    if (
      editProduct.productType === 'KIT' &&
      kitComponentsPayload(editProduct.components).length === 0
    ) {
      setError('É obrigatório vincular ao menos um produto ao kit');
      return false;
    }
    if (!isValidUrl(editProduct.doterraUrl)) {
      setError('URL do produto inválida');
      return false;
    }
    return true;
  };

  const persistEditProduct = async () => {
    const { data } = await api.put(
      `/products/${editProductId}`,
      updateProductPayload(editProduct, editStatus),
    );
    setAllProducts((prev) =>
      prev.map((p) => (p.id === editProductId ? data : p)),
    );
    return data;
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!validateEditProduct()) return;
    try {
      await persistEditProduct();
      setEditProductId(null);
      setEditProduct(emptyForm());
      setShowEditModal(false);
      setError('');
      addToast('Produto atualizado com sucesso!', 'success');
    } catch (err) {
      addToast(
        err.response?.data?.error ||
          'Erro ao atualizar produto. Tente novamente.',
        'error',
      );
    }
  };

  const handleUpdateAndEditNext = async (e) => {
    e.preventDefault();
    if (!validateEditProduct()) return;
    const idx = filteredProducts.findIndex((p) => p.id === editProductId);
    const nextProduct = idx >= 0 ? filteredProducts[idx + 1] : undefined;
    if (!nextProduct) return;
    try {
      await persistEditProduct();
      setVisibleCount((prev) => Math.max(prev, idx + 2));
      addToast('Produto atualizado.', 'success');
      openEditModal(nextProduct);
    } catch (err) {
      addToast(
        err.response?.data?.error ||
          'Erro ao atualizar produto. Tente novamente.',
        'error',
      );
    }
  };

  const handleStatusChange = (product, newStatus) => {
    setConfirmStatus({ product, newStatus });
  };

  const confirmChangeStatus = async () => {
    if (!confirmStatus) return;
    try {
      setUpdatingStatus(true);
      const { data } = await api.put(`/products/${confirmStatus.product.id}`, {
        status: confirmStatus.newStatus,
      });
      setAllProducts((prev) =>
        prev.map((p) => (p.id === confirmStatus.product.id ? data : p)),
      );
      addToast('Status do produto atualizado com sucesso!', 'success');
    } catch (err) {
      addToast(
        err.response?.data?.error ||
          'Erro ao atualizar produto. Tente novamente.',
        'error',
      );
    } finally {
      setUpdatingStatus(false);
      setConfirmStatus(null);
    }
  };

  const openEditModal = (product) => {
    const form = {
      code: product.code,
      name: product.name,
      size: product.size,
      regularPrice: String(parseFloat(product.regularPrice)),
      memberPrice: String(parseFloat(product.memberPrice)),
      pv: product.pv,
      doterraUrl: product.doterraUrl || '',
      productType: product.productType || 'SIMPLES',
      components: (product.components || []).map((c) => ({
        id: c.componentProductId,
        componentProductId: c.componentProductId,
        quantity: c.quantity,
      })),
    };
    const status = product.status || 'ATIVO';
    setEditProductId(product.id);
    setEditProduct(form);
    setEditProductInitial({ ...form, status });
    setEditStatus(status);
    setError('');
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditProductId(null);
    setEditProduct(emptyForm());
    setEditProductInitial(null);
    setError('');
  };

  const copyField = useCallback(
    async (product, field) => {
      const value = product[field];
      if (!value) return;
      const ok = await copyToClipboard(value);
      const labels = { code: 'Código copiado!', name: 'Nome copiado!' };
      addToast(
        ok ? labels[field] : 'Falha ao copiar. Tente novamente.',
        ok ? 'success' : 'error',
      );
    },
    [addToast],
  );

  const copyRow = useCallback(
    async (product) => {
      const ok = await copyToClipboard(formatProductRowForCopy(product));
      addToast(
        ok ? 'Linha copiada!' : 'Falha ao copiar. Tente novamente.',
        ok ? 'success' : 'error',
      );
    },
    [addToast],
  );

  const hasActiveFilters = search.trim() !== '' || statusFilter !== '';

  const editIndex = filteredProducts.findIndex((p) => p.id === editProductId);
  const hasNextProduct =
    showEditModal && editIndex >= 0 && editIndex < filteredProducts.length - 1;

  const createDirty = useDirtyForm(createForm, createFormInitial).isDirty;
  const editDirty = useDirtyForm(
    { ...editProduct, status: editStatus },
    editProductInitial,
  ).isDirty;

  return {
    visibleProducts,
    allProducts,
    totalCount: filteredProducts.length,
    hasMore,
    hasActiveFilters,
    loading,
    error,
    search,
    statusFilter,
    loyaltyTier,
    showPointsColumn,
    sort,
    sentinelRef,
    showCreateModal,
    showEditModal,
    createForm,
    editProduct,
    editStatus,
    createDirty,
    editDirty,
    confirmStatus,
    updatingStatus,
    setShowCreateModal,
    openCreateModal,
    setSearch,
    setStatusFilter,
    setLoyaltyTier,
    setShowPointsColumn,
    togglePointsColumn,
    setSort,
    setCreateField,
    setEditField,
    setEditStatus,
    setConfirmStatus,
    handleCreateProduct,
    handleUpdateProduct,
    handleUpdateAndEditNext,
    hasNextProduct,
    handleStatusChange,
    confirmChangeStatus,
    openEditModal,
    closeCreateModal,
    closeEditModal,
    copyField,
    copyRow,
  };
}
