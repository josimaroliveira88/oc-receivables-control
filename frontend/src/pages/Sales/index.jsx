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
    openCreateSale,
  } = useSales();

  const {
    showPaymentModal,
    selectedSale,
    balances,
    selectedPersonId,
    paymentAmount,
    paymentNetAmount,
    paymentPassesGatewayFeeToClient,
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
    detailLoading,
    openPaymentModal,
    closePaymentModal,
    handleChangeAmount,
    handleChangeNetAmount,
    handleChangePassesGatewayFeeToClient,
    handleChangeNotes,
    handleChangeDate,
    handleChangePaymentType,
    handlePaymentSubmit,
    confirmOverpay,
    cancelOverpay,
    openDetailsModal,
    closeDetailsModal,
    getDetailPersonItems,
    getDetailPersonPayments,
    showEditPaymentModal,
    editingPayment,
    paymentDirty,
    editPaymentDirty,
    editPaymentAmount,
    editPaymentNetAmount,
    editPaymentPassesGatewayFeeToClient,
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
    handleChangeEditNetAmount,
    handleChangeEditPassesGatewayFeeToClient,
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        <span className="ml-2 text-ink-faint">Carregando...</span>
      </div>
    );
  }

  return (
    <>
      <div className="bg-surface border border-line rounded-lg shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-line px-6 py-4">
          <h2 className="text-xl font-semibold text-ink">Gestão de Vendas</h2>
          <button
            onClick={() => openCreateSale()}
            className="mt-3 sm:mt-0 px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
          >
            Nova Venda
          </button>
        </div>

        <div className="px-6 py-4">
          {error && !(showCreateModal || showEditModal) && (
            <div className="mb-4 p-3 bg-danger-soft rounded-md">
              <p className="text-sm text-danger-fg">{error}</p>
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
          paymentNetAmount={paymentNetAmount}
          paymentNotes={paymentNotes}
          paymentDate={paymentDate}
          paymentType={paymentType}
          paymentError={paymentError}
          submitting={submitting}
          orderPendingCents={orderPendingCents}
          selectedPendingCents={selectedPendingCents}
          selectedIsZeroItem={selectedIsZeroItem}
          selectedPersonItems={selectedPersonItems}
          passesGatewayFeeToClient={paymentPassesGatewayFeeToClient}
          isDirty={paymentDirty}
          onClose={closePaymentModal}
          onChangeAmount={handleChangeAmount}
          onChangeNetAmount={handleChangeNetAmount}
          onChangePassesGatewayFeeToClient={
            handleChangePassesGatewayFeeToClient
          }
          onChangeNotes={handleChangeNotes}
          onChangeDate={handleChangeDate}
          onChangePaymentType={handleChangePaymentType}
          onSubmit={handlePaymentSubmit}
        />
      )}

      {showDetailsModal && detailSale && (
        <SaleDetailsModal
          sale={detailSale}
          loading={detailLoading}
          onClose={closeDetailsModal}
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
          paymentNetAmount={editPaymentNetAmount}
          paymentNotes={editPaymentNotes}
          paymentDate={editPaymentDate}
          paymentType={editPaymentType}
          passesGatewayFeeToClient={editPaymentPassesGatewayFeeToClient}
          paymentError={editPaymentError}
          submitting={editSubmitting}
          isDirty={editPaymentDirty}
          onClose={closeEditPaymentModal}
          onChangeAmount={handleChangeEditAmount}
          onChangeNetAmount={handleChangeEditNetAmount}
          onChangePassesGatewayFeeToClient={
            handleChangeEditPassesGatewayFeeToClient
          }
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
