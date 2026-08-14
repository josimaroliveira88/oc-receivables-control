import React from 'react';
import { useProducts } from './useProducts';
import ProductsTable from './components/ProductsTable';
import ProductModal from './components/ProductModal';
import ProductForm from './components/ProductForm';
import ConfirmDialog from '../../components/ConfirmDialog';
import { PRODUCT_STATUS } from './utils/productHelpers';

const ProductsPage = () => {
  const {
    visibleProducts,
    totalCount,
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
  } = useProducts();

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

        <div className="px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <ProductsTable
            products={visibleProducts}
            hasMore={hasMore}
            hasActiveFilters={hasActiveFilters}
            totalCount={totalCount}
            search={search}
            statusFilter={statusFilter}
            sort={sort}
            sentinelRef={sentinelRef}
            onSearchChange={setSearch}
            onStatusFilterChange={setStatusFilter}
            onSortChange={setSort}
            onStatusChange={handleStatusChange}
            onEdit={openEditModal}
          />
        </div>
      </div>

      <ProductModal
        isOpen={showCreateModal}
        title="Novo Produto"
        onClose={closeCreateModal}
      >
        <ProductForm
          values={createForm}
          isEdit={false}
          onChangeField={setCreateField}
          onSubmit={handleCreateProduct}
          onClose={closeCreateModal}
        />
      </ProductModal>

      <ProductModal
        isOpen={showEditModal}
        title="Editar Produto"
        onClose={closeEditModal}
      >
        <ProductForm
          values={editProduct}
          isEdit={true}
          status={editStatus}
          onChangeField={setEditField}
          onChangeStatus={setEditStatus}
          onSubmit={handleUpdateProduct}
          onClose={closeEditModal}
        />
      </ProductModal>

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
