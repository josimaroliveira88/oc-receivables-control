import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { Search, ExternalLink, AlertCircle, Pencil } from 'lucide-react';
import api from '../services/api';
import ActionMenu from '../components/ActionMenu';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { formatBRL } from '../utils/money';

const PAGE_SIZE = 20;

const SORT_OPTIONS = [
  { value: 'name:asc', label: 'Nome (A-Z)' },
  { value: 'name:desc', label: 'Nome (Z-A)' },
  { value: 'code:asc', label: 'Código (A-Z)' },
  { value: 'regularPrice:asc', label: 'Preço Regular (menor)' },
  { value: 'regularPrice:desc', label: 'Preço Regular (maior)' },
  { value: 'memberPrice:asc', label: 'Preço Membro (menor)' },
  { value: 'memberPrice:desc', label: 'Preço Membro (maior)' },
  { value: 'pv:asc', label: 'PV (menor)' },
  { value: 'pv:desc', label: 'PV (maior)' },
];

const PRODUCT_STATUS = {
  ATIVO: {
    label: 'Ativo',
    className:
      'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  },
  INDISPONIVEL: {
    label: 'Indisponível',
    className:
      'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  },
  INATIVO: {
    label: 'Inativo',
    className: 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300',
  },
};

const statusBadge = (status) => {
  const cfg = PRODUCT_STATUS[status] || PRODUCT_STATUS.INATIVO;
  return (
    <span
      data-testid={`product-status-${status || 'INATIVO'}`}
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}
    >
      {status === 'INDISPONIVEL' && <AlertCircle className="w-3.5 h-3.5" />}
      {cfg.label}
    </span>
  );
};

const isValidUrl = (value) => {
  const trimmed = (value || '').trim();
  if (trimmed === '') return true;
  try {
    // eslint-disable-next-line no-new
    new URL(trimmed);
    return true;
  } catch {
    return false;
  }
};

const emptyForm = {
  code: '',
  name: '',
  size: '',
  regularPrice: '',
  memberPrice: '',
  pv: '',
  doterraUrl: '',
};

const ProductsPage = () => {
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
  const [editProduct, setEditProduct] = useState(emptyForm);
  const [editStatus, setEditStatus] = useState('ATIVO');
  const [createForm, setCreateForm] = useState(emptyForm);
  const [confirmStatus, setConfirmStatus] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const { addToast } = useToast();

  const sentinelRef = useRef(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/products?pageSize=all');
      setAllProducts(response.data.data);
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

  const filteredProducts = useMemo(() => {
    const [sortBy, sortDir] = sort.split(':');
    const direction = sortDir === 'desc' ? -1 : 1;
    const query = search.trim().toLowerCase();

    let result = allProducts.filter((product) => {
      if (
        query &&
        !product.name.toLowerCase().includes(query) &&
        !product.code.toLowerCase().includes(query)
      ) {
        return false;
      }
      if (statusFilter !== '' && product.status !== statusFilter) {
        return false;
      }
      return true;
    });

    return [...result].sort((a, b) => {
      const numericFields = ['regularPrice', 'memberPrice', 'pv'];
      if (numericFields.includes(sortBy)) {
        const aValue = parseFloat(a[sortBy]) || 0;
        const bValue = parseFloat(b[sortBy]) || 0;
        return (aValue - bValue) * direction;
      }
      return (
        String(a[sortBy] ?? '').localeCompare(
          String(b[sortBy] ?? ''),
          'pt-BR',
        ) * direction
      );
    });
  }, [allProducts, search, statusFilter, sort]);

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
  }, [hasMore, visibleProducts.length]);

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
      await api.post('/products', {
        code: createForm.code.trim(),
        name: createForm.name.trim(),
        size: createForm.size.trim(),
        regularPrice: parseFloat(createForm.regularPrice),
        memberPrice: parseFloat(createForm.memberPrice),
        pv: parseFloat(createForm.pv),
        doterraUrl: createForm.doterraUrl.trim() || null,
      });
      setCreateForm(emptyForm);
      setShowCreateModal(false);
      loadProducts();
    } catch (err) {
      setError('Erro ao criar produto. Tente novamente.');
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
      await api.put(`/products/${editProductId}`, {
        name: editProduct.name.trim(),
        size: editProduct.size.trim(),
        status: editStatus,
        doterraUrl: editProduct.doterraUrl.trim() || null,
      });
      setEditProductId(null);
      setEditProduct(emptyForm);
      setShowEditModal(false);
      loadProducts();
    } catch (err) {
      setError('Erro ao atualizar produto. Tente novamente.');
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
      setError('Erro ao atualizar produto. Tente novamente.');
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
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditProductId(null);
    setEditProduct(emptyForm);
  };

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed';

  const hasActiveFilters = search.trim() !== '' || statusFilter !== '';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2 text-gray-500 dark:text-gray-400">
          Carregando...
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border-t-4 border-primary-600 dark:border-primary-400">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            Cadastro de Produtos
          </h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-3 sm:mt-0 px-4 py-2 bg-gradient-to-r from-primary-700 to-primary-500 hover:from-primary-800 hover:to-primary-600 text-white font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Novo
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                placeholder="Buscar por nome ou código..."
                aria-label="Buscar produtos"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                <span className="sr-only">Ordenar por</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  aria-label="Ordenar por"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                <span className="sr-only">Status</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  aria-label="Status"
                >
                  <option value="">Todos os status</option>
                  <option value="ATIVO">Somente ativos</option>
                  <option value="INDISPONIVEL">Somente indisponíveis</option>
                  <option value="INATIVO">Somente inativos</option>
                </select>
              </label>
            </div>
          </div>
          {filteredProducts.length > 0 && (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              {filteredProducts.length === 1
                ? '1 produto'
                : `${filteredProducts.length} produtos`}
            </p>
          )}
        </div>

        <div className="px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {visibleProducts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                {hasActiveFilters
                  ? 'Nenhum produto encontrado para os filtros aplicados.'
                  : 'Nenhum produto cadastrado'}
              </p>
            </div>
          ) : (
            <div>
              <table className="w-full text-sm text-left block lg:table lg:table-fixed">
                <thead className="hidden lg:table-header-group bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th
                      scope="col"
                      className="w-[8%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      Código
                    </th>
                    <th
                      scope="col"
                      className="w-[26%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      Produto
                    </th>
                    <th
                      scope="col"
                      className="w-[7%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      Tamanho
                    </th>
                    <th
                      scope="col"
                      className="w-[10%] px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      Preço Regular
                    </th>
                    <th
                      scope="col"
                      className="w-[10%] px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      Preço Membro
                    </th>
                    <th
                      scope="col"
                      className="w-[6%] px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      PV
                    </th>
                    <th
                      scope="col"
                      className="w-[5%] px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      Site
                    </th>
                    <th
                      scope="col"
                      className="w-[12%] px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="w-[16%] px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="block lg:table-row-group bg-white dark:bg-gray-800 lg:divide-y divide-gray-200 dark:divide-gray-700">
                  {visibleProducts.map((product) => (
                    <tr
                      key={product.id}
                      className="block lg:table-row border border-gray-200 dark:border-gray-700 lg:border-0 rounded-lg lg:rounded-none shadow-sm lg:shadow-none mb-3 lg:mb-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td
                        data-label="Código"
                        className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                      >
                        {product.code}
                      </td>
                      <td
                        data-label="Produto"
                        className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 break-words text-sm text-gray-900 dark:text-gray-100 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                      >
                        {product.name}
                      </td>
                      <td
                        data-label="Tamanho"
                        className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                      >
                        {product.size || '-'}
                      </td>
                      <td
                        data-label="Preço Regular"
                        className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-left lg:text-right text-sm text-gray-700 dark:text-gray-200 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                      >
                        {formatBRL(product.regularPrice)}
                      </td>
                      <td
                        data-label="Preço Membro"
                        className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-left lg:text-right text-sm text-gray-700 dark:text-gray-200 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                      >
                        {formatBRL(product.memberPrice)}
                      </td>
                      <td
                        data-label="PV"
                        className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-left lg:text-right text-sm text-gray-700 dark:text-gray-200 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                      >
                        {product.pv}
                      </td>
                      <td
                        data-label="Site"
                        className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-left lg:text-center before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                      >
                        {product.doterraUrl ? (
                          <a
                            href={product.doterraUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
                            title="Ver produto no site da dōTERRA"
                            aria-label="Ver produto no site"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">
                            —
                          </span>
                        )}
                      </td>
                      <td
                        data-label="Status"
                        className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 text-left lg:text-center before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                      >
                        {statusBadge(product.status)}
                      </td>
                      <td
                        data-label="Ações"
                        className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 text-left lg:text-right text-sm font-medium before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden relative"
                      >
                        <div className="flex items-center justify-end gap-2">
                          <select
                            value={product.status}
                            onChange={(e) =>
                              handleStatusChange(product, e.target.value)
                            }
                            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                            aria-label="Alterar status"
                          >
                            <option value="ATIVO">Ativo</option>
                            <option value="INDISPONIVEL">Indisponível</option>
                            <option value="INATIVO">Inativo</option>
                          </select>
                          <ActionMenu
                            actions={[
                              {
                                label: 'Editar',
                                icon: Pencil,
                                onClick: () => openEditModal(product),
                              },
                            ]}
                            ariaLabel="Ações do produto"
                            testIdPrefix={`product-actions-${product.id}`}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div
                ref={sentinelRef}
                className="py-4 flex items-center justify-center"
              >
                {hasMore && (
                  <span className="text-gray-400 dark:text-gray-500 text-sm">
                    Rolando para carregar mais...
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Novo Produto
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateForm(emptyForm);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateProduct} className="px-6 py-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Código
                </label>
                <input
                  type="text"
                  value={createForm.code}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, code: e.target.value }))
                  }
                  required
                  className={inputClass}
                  placeholder="Digite o código"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Produto
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                  className={inputClass}
                  placeholder="Digite o nome do produto"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tamanho
                </label>
                <input
                  type="text"
                  value={createForm.size}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, size: e.target.value }))
                  }
                  required
                  className={inputClass}
                  placeholder="Digite o tamanho"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Preço Regular (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={createForm.regularPrice}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      regularPrice: e.target.value,
                    }))
                  }
                  required
                  className={inputClass}
                  placeholder="Digite o preço regular"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Preço de Membro (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={createForm.memberPrice}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      memberPrice: e.target.value,
                    }))
                  }
                  required
                  className={inputClass}
                  placeholder="Digite o preço de membro"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  PV
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={createForm.pv}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, pv: e.target.value }))
                  }
                  required
                  className={inputClass}
                  placeholder="Digite o PV"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  URL do produto no site da dōTERRA
                </label>
                <input
                  type="url"
                  value={createForm.doterraUrl}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      doterraUrl: e.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="https://www.doterra.com/BR/pt_BR/..."
                />
              </div>
              <div className="flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateForm(emptyForm);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-primary-700 to-primary-500 hover:from-primary-800 hover:to-primary-600 text-white font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Editar Produto
              </h3>
              <button
                onClick={closeEditModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleUpdateProduct} className="px-6 py-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Código
                </label>
                <input
                  type="text"
                  value={editProduct.code}
                  disabled
                  title="O código não pode ser alterado"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  O código não pode ser alterado.
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Produto
                </label>
                <input
                  type="text"
                  value={editProduct.name}
                  onChange={(e) =>
                    setEditProduct((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  required
                  className={inputClass}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tamanho
                </label>
                <input
                  type="text"
                  value={editProduct.size}
                  onChange={(e) =>
                    setEditProduct((prev) => ({
                      ...prev,
                      size: e.target.value,
                    }))
                  }
                  required
                  className={inputClass}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  URL do produto no site da dōTERRA
                </label>
                <input
                  type="url"
                  value={editProduct.doterraUrl}
                  onChange={(e) =>
                    setEditProduct((prev) => ({
                      ...prev,
                      doterraUrl: e.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="https://www.doterra.com/BR/pt_BR/..."
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  data-testid="edit-status-select"
                  className={inputClass}
                >
                  <option value="ATIVO">Ativo</option>
                  <option value="INDISPONIVEL">Indisponível</option>
                  <option value="INATIVO">Inativo</option>
                </select>
              </div>
              <div className="flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-primary-700 to-primary-500 hover:from-primary-800 hover:to-primary-600 text-white font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmStatus}
        title="Alterar status do produto"
        message={
          <>
            Tem certeza que deseja alterar o status deste produto para "
            <strong>
              {confirmStatus
                ? PRODUCT_STATUS[confirmStatus.newStatus]?.label ||
                  confirmStatus.newStatus
                : ''}
            </strong>
            "?
          </>
        }
        confirmLabel="Confirmar alteração"
        cancelLabel="Cancelar"
        loading={updatingStatus}
        onConfirm={confirmChangeStatus}
        onCancel={() => setConfirmStatus(null)}
      />
    </>
  );
};

export default ProductsPage;
