import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import {
  PAGE_SIZE,
  emptyForm,
  isValidUrl,
  createProductPayload,
  updateProductPayload,
  filterAndSortProducts,
} from './utils/productHelpers';

export function useProducts() {
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
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

  const setEditField = (field, value) => {
    setEditProduct((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const openCreateModal = () => {
    setShowCreateModal(true);
    setError('');
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateForm(emptyForm());
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
    if (!isValidUrl(createForm.doterraUrl)) {
      setError('URL do produto inválida');
      return;
    }
    try {
      await api.post('/products', createProductPayload(createForm));
      setCreateForm(emptyForm());
      setShowCreateModal(false);
      setError('');
      loadProducts();
    } catch (err) {
      addToast(
        err.response?.data?.error || 'Erro ao criar produto. Tente novamente.',
        'error',
      );
    }
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!editProduct.name.trim()) {
      setError('Nome é obrigatório');
      return;
    }
    if (!isValidUrl(editProduct.doterraUrl)) {
      setError('URL do produto inválida');
      return;
    }
    try {
      await api.put(
        `/products/${editProductId}`,
        updateProductPayload(editProduct, editStatus),
      );
      setEditProductId(null);
      setEditProduct(emptyForm());
      setShowEditModal(false);
      setError('');
      loadProducts();
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
      await api.put(`/products/${confirmStatus.product.id}`, {
        status: confirmStatus.newStatus,
      });
      addToast('Status do produto atualizado com sucesso!', 'success');
      loadProducts();
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
    setEditProductId(product.id);
    setEditProduct({
      code: product.code,
      name: product.name,
      size: product.size,
      regularPrice: product.regularPrice,
      memberPrice: product.memberPrice,
      pv: product.pv,
      doterraUrl: product.doterraUrl || '',
    });
    setEditStatus(product.status || 'ATIVO');
    setError('');
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditProductId(null);
    setEditProduct(emptyForm());
    setError('');
  };

  const hasActiveFilters = search.trim() !== '' || statusFilter !== '';

  return {
    visibleProducts,
    totalCount: filteredProducts.length,
    hasMore,
    hasActiveFilters,
    loading,
    error,
    search,
    statusFilter,
    sort,
    sentinelRef,
    showCreateModal,
    showEditModal,
    createForm,
    editProduct,
    editStatus,
    confirmStatus,
    updatingStatus,
    setShowCreateModal,
    openCreateModal,
    setSearch,
    setStatusFilter,
    setSort,
    setCreateField,
    setEditField,
    setEditStatus,
    setConfirmStatus,
    handleCreateProduct,
    handleUpdateProduct,
    handleStatusChange,
    confirmChangeStatus,
    openEditModal,
    closeCreateModal,
    closeEditModal,
  };
}
