import React from 'react';
import { useProducts } from './useProducts';
import ProductsTable from './components/ProductsTable';
import Modal from '../../components/Modal';
import ProductForm from './components/ProductForm';
import ConfirmDialog from '../../components/ConfirmDialog';
import { PRODUCT_STATUS } from './utils/productHelpers';

const ProductsPage = () => {
  const {
    visibleProducts,
    allProducts,
    totalCount,
    hasMore,
    hasActiveFilters,
    loading,
    error,
    search,
    statusFilter,
    sortBy,
    sortDir,
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
    handleSort,
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
  } = useProducts();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        <span className="ml-2 text-ink-faint">Carregando...</span>
      </div>
    );
  }

  return (
    <>
      <div className="bg-surface border border-line rounded-lg shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-line px-6 py-4">
          <h2 className="text-xl font-semibold text-ink">
            Cadastro de Produtos
          </h2>
          <button
            onClick={() => openCreateModal()}
            className="mt-3 sm:mt-0 px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
          >
            Novo
          </button>
        </div>

        <div className="px-6 py-4">
          {error && !(showCreateModal || showEditModal) && (
            <div className="mb-4 p-3 bg-danger-soft rounded-md">
              <p className="text-sm text-danger-fg">{error}</p>
            </div>
          )}

          <ProductsTable
            products={visibleProducts}
            hasMore={hasMore}
            hasActiveFilters={hasActiveFilters}
            totalCount={totalCount}
            search={search}
            statusFilter={statusFilter}
            sortBy={sortBy}
            sortDir={sortDir}
            sentinelRef={sentinelRef}
            onSearchChange={setSearch}
            onStatusFilterChange={setStatusFilter}
            onSort={handleSort}
            onStatusChange={handleStatusChange}
            onEdit={openEditModal}
            onCopyField={copyField}
            onCopyRow={copyRow}
          />
        </div>
      </div>

      <Modal
        isOpen={showCreateModal}
        title="Novo Produto"
        onClose={closeCreateModal}
        isDirty={createDirty}
        maxWidth="max-w-2xl"
        closeAriaLabel="Fechar novo produto"
      >
        {(requestClose) => (
          <ProductForm
            values={createForm}
            isEdit={false}
            error={error}
            products={allProducts}
            onChangeField={setCreateField}
            onSubmit={handleCreateProduct}
            onClose={requestClose}
          />
        )}
      </Modal>

      <Modal
        isOpen={showEditModal}
        title="Editar Produto"
        onClose={closeEditModal}
        isDirty={editDirty}
        maxWidth="max-w-2xl"
        closeAriaLabel="Fechar edição de produto"
      >
        {(requestClose) => (
          <ProductForm
            values={editProduct}
            isEdit={true}
            status={editStatus}
            error={error}
            products={allProducts}
            onChangeField={setEditField}
            onChangeStatus={setEditStatus}
            onSubmit={handleUpdateProduct}
            onSaveAndEditNext={handleUpdateAndEditNext}
            hasNextProduct={hasNextProduct}
            onClose={requestClose}
          />
        )}
      </Modal>

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
