import React from 'react';
import { formatBRL, toCents } from '../../utils/money';
import { useSales } from './useSales';
import { useSalePayments } from './useSalePayments';
import SalesTable from './components/SalesTable';
import Modal from '../../components/Modal';
import SaleForm from './components/SaleForm';
import SalePaymentModal from './components/SalePaymentModal';
import SaleDetailsModal from './components/SaleDetailsModal';
import SaleEditPaymentModal from './components/SaleEditPaymentModal';
import ConfirmDialog from '../../components/ConfirmDialog';

const SalesPage = () => {
  const {
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
  } = useSales();

  const {
    showPaymentModal,
    selectedSale,
    balances,
    selectedPersonId,
    paymentAmount,
    paymentNotes,
    paymentDate,
    paymentType,
    paymentError,
    submitting,
    showOverpayConfirm,
    orderPendingCents,
    selectedPendingCents,
    selectedIsZeroItem,
    selectedPersonItems,
    clientName,
    showDetailsModal,
    detailSale,
    detailBalances,
    detailLoading,
    expandedPersonId,
    openPaymentModal,
    closePaymentModal,
    handleChangeAmount,
    handleChangeNotes,
    handleChangeDate,
    handleChangePaymentType,
    handlePaymentSubmit,
    confirmOverpay,
    cancelOverpay,
    openDetailsModal,
    closeDetailsModal,
    toggleDetailPerson,
    getDetailPersonItems,
    getDetailPersonPayments,
    showEditPaymentModal,
    editingPayment,
    paymentDirty,
    editPaymentDirty,
    editPaymentAmount,
    editPaymentNotes,
    editPaymentDate,
    editPaymentType,
    editPaymentError,
    editSubmitting,
    showEditOverpayConfirm,
    editPendingCents,
    editIsZeroItem,
    editPersonName,
    openEditPaymentModal,
    closeEditPaymentModal,
    handleChangeEditAmount,
    handleChangeEditNotes,
    handleChangeEditDate,
    handleChangeEditPaymentType,
    handleEditSubmit,
    confirmEditOverpay,
    cancelEditOverpay,
  } = useSalePayments({ refreshSales });

  const editSale = sales.find((s) => s.id === editSaleId);

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
            Gestão de Vendas
          </h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-3 sm:mt-0 px-4 py-2 bg-gradient-to-r from-primary-700 to-primary-500 hover:from-primary-800 hover:to-primary-600 text-white font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Nova Venda
          </button>
        </div>

        <div className="px-6 py-4">
          {error && !(showCreateModal || showEditModal) && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <SalesTable
            sales={sales}
            search={search}
            searchField={searchField}
            statusFilter={statusFilter}
            deliveryFilter={deliveryFilter}
            sortBy={sortBy}
            sortDir={sortDir}
            hasActiveFilters={hasActiveFilters}
            onSearchChange={setSearch}
            onSearchFieldChange={setSearchField}
            onStatusFilterChange={setStatusFilter}
            onDeliveryFilterChange={setDeliveryFilter}
            onSearchSubmit={handleSearchSubmit}
            onSort={handleSort}
            onEdit={handleEditSale}
            onDelete={handleDeleteSale}
            onPayment={openPaymentModal}
            onDetails={openDetailsModal}
            onToggleDelivery={toggleDelivery}
          />
        </div>
      </div>

      <Modal
        isOpen={showCreateModal || showEditModal}
        title={showEditModal ? 'Editar Venda' : 'Nova Venda'}
        onClose={resetForm}
        isDirty={saleFormDirty}
        maxWidth="max-w-2xl"
        closeAriaLabel="Fechar venda"
      >
        {(requestClose) => (
          <SaleForm
            clientPersonId={clientPersonId}
            clientError={clientError}
            orderDate={orderDate}
            shippingValue={shippingValue}
            shippingValueError={shippingValueError}
            additionalValue={additionalValue}
            additionalValueError={additionalValueError}
            description={description}
            deliveredAt={deliveredAt}
            items={items}
            people={people}
            products={products}
            isEdit={showEditModal}
            itemErrors={itemErrors}
            onChangeField={setFormField}
            onItemUpdate={updateItemField}
            onItemProductSelect={onProductSelect}
            onAddItem={addItem}
            onRemoveItem={removeItem}
            addItemBtnRef={addItemBtnRef}
            onSubmit={showEditModal ? handleUpdateSale : handleCreateSale}
            onCancel={requestClose}
          />
        )}
      </Modal>

      {showPaymentModal && selectedSale && (
        <SalePaymentModal
          sale={selectedSale}
          balances={balances}
          clientName={clientName}
          paymentAmount={paymentAmount}
          paymentNotes={paymentNotes}
          paymentDate={paymentDate}
          paymentType={paymentType}
          paymentError={paymentError}
          submitting={submitting}
          orderPendingCents={orderPendingCents}
          selectedPendingCents={selectedPendingCents}
          selectedIsZeroItem={selectedIsZeroItem}
          selectedPersonItems={selectedPersonItems}
          isDirty={paymentDirty}
          onClose={closePaymentModal}
          onChangeAmount={handleChangeAmount}
          onChangeNotes={handleChangeNotes}
          onChangeDate={handleChangeDate}
          onChangePaymentType={handleChangePaymentType}
          onSubmit={handlePaymentSubmit}
        />
      )}

      {showDetailsModal && detailSale && (
        <SaleDetailsModal
          sale={detailSale}
          balances={detailBalances}
          loading={detailLoading}
          expandedPersonId={expandedPersonId}
          onClose={closeDetailsModal}
          onTogglePerson={toggleDetailPerson}
          personItems={getDetailPersonItems}
          personPayments={getDetailPersonPayments}
          onEditPayment={openEditPaymentModal}
        />
      )}

      {showEditPaymentModal && detailSale && editingPayment && (
        <SaleEditPaymentModal
          sale={detailSale}
          payment={editingPayment}
          personName={editPersonName}
          isSelf={false}
          isZeroItem={editIsZeroItem}
          pendingCents={editPendingCents}
          paymentAmount={editPaymentAmount}
          paymentNotes={editPaymentNotes}
          paymentDate={editPaymentDate}
          paymentType={editPaymentType}
          paymentError={editPaymentError}
          submitting={editSubmitting}
          isDirty={editPaymentDirty}
          onClose={closeEditPaymentModal}
          onChangeAmount={handleChangeEditAmount}
          onChangeNotes={handleChangeEditNotes}
          onChangeDate={handleChangeEditDate}
          onChangePaymentType={handleChangeEditPaymentType}
          onSubmit={handleEditSubmit}
        />
      )}

      <ConfirmDialog
        open={showEditOverpayConfirm}
        title="Confirmar atualização"
        message={
          <>
            Valor de{' '}
            <strong>
              {formatBRL(toCents(parseFloat(editPaymentAmount || '0')) / 100)}
            </strong>{' '}
            é maior que o saldo pendente (
            <strong>{formatBRL(editPendingCents / 100)}</strong>). Deseja mesmo
            confirmar esta atualização?
          </>
        }
        confirmLabel="Confirmar atualização"
        cancelLabel="Cancelar"
        loading={editSubmitting}
        onConfirm={confirmEditOverpay}
        onCancel={cancelEditOverpay}
      />

      <ConfirmDialog
        open={showOverpayConfirm}
        title="Confirmar recebimento"
        message={
          <>
            Valor de{' '}
            <strong>
              {formatBRL(toCents(parseFloat(paymentAmount || '0')) / 100)}
            </strong>{' '}
            é maior que o saldo pendente (
            <strong>{formatBRL(selectedPendingCents / 100)}</strong>). Deseja
            mesmo confirmar este recebimento?
          </>
        }
        confirmLabel="Confirmar recebimento"
        cancelLabel="Cancelar"
        loading={submitting}
        onConfirm={confirmOverpay}
        onCancel={cancelOverpay}
      />

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Excluir venda"
        message="Tem certeza que deseja excluir esta venda? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        loading={deleting}
        onConfirm={confirmDeleteSale}
        onCancel={cancelDeleteSale}
      />
    </>
  );
};

export default SalesPage;
