import React from 'react';
import { formatBRL, toCents } from '../../utils/money';
import { useOrders } from './useOrders';
import { useOrderPayments } from './useOrderPayments';
import OrdersTable from './components/OrdersTable';
import OrderModal from './components/OrderModal';
import OrderForm from './components/OrderForm';
import PaymentModal from './components/PaymentModal';
import DetailsModal from './components/DetailsModal';
import ConfirmDialog from '../../components/ConfirmDialog';

const OrdersPage = () => {
  const {
    orders,
    people,
    products,
    loading,
    error,
    refreshOrders,
    search,
    searchField,
    statusFilter,
    paymentTypeFilter,
    sortBy,
    sortDir,
    hasActiveFilters,
    setSearch,
    setSearchField,
    setStatusFilter,
    setPaymentTypeFilter,
    handleSearchSubmit,
    handleSort,
    showCreateModal,
    showEditModal,
    editOrderId,
    orderNumber,
    orderNumberBlurred,
    orderDate,
    accountOwner,
    paymentType,
    orderNotes,
    items,
    orderNumberError,
    itemErrors,
    addItemBtnRef,
    confirmDeleteId,
    deleting,
    setFormField,
    addItem,
    removeItem,
    updateItemField,
    onProductSelect,
    onPersonSelect,
    resetForm,
    handleCreateOrder,
    handleEditOrder,
    handleUpdateOrder,
    handleDeleteOrder,
    cancelDeleteOrder,
    confirmDeleteOrder,
    setShowCreateModal,
  } = useOrders();

  const {
    showPaymentModal,
    selectedOrder,
    balances,
    selectedPersonId,
    paymentAmount,
    paymentNotes,
    paymentDate,
    paymentError,
    submitting,
    showOverpayConfirm,
    orderPendingCents,
    selectedPendingCents,
    selectedIsZeroItem,
    selectedIsSelf,
    selectedPersonItems,
    showDetailsModal,
    detailOrder,
    detailBalances,
    detailLoading,
    expandedPersonId,
    openPaymentModal,
    closePaymentModal,
    handleChangePerson,
    handleChangeAmount,
    handleChangeNotes,
    handleChangeDate,
    handlePaymentSubmit,
    confirmOverpay,
    cancelOverpay,
    openDetailsModal,
    closeDetailsModal,
    toggleDetailPerson,
    getDetailPersonItems,
    getDetailPersonPayments,
  } = useOrderPayments({ refreshOrders });

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
            Gestão de Pedidos
          </h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-3 sm:mt-0 px-4 py-2 bg-gradient-to-r from-primary-700 to-primary-500 hover:from-primary-800 hover:to-primary-600 text-white font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Novo Pedido
          </button>
        </div>

        <div className="px-6 py-4">
          {error && !(showCreateModal || showEditModal) && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <OrdersTable
            orders={orders}
            search={search}
            searchField={searchField}
            statusFilter={statusFilter}
            paymentTypeFilter={paymentTypeFilter}
            sortBy={sortBy}
            sortDir={sortDir}
            hasActiveFilters={hasActiveFilters}
            onSearchChange={setSearch}
            onSearchFieldChange={setSearchField}
            onStatusFilterChange={setStatusFilter}
            onPaymentTypeFilterChange={setPaymentTypeFilter}
            onSearchSubmit={handleSearchSubmit}
            onSort={handleSort}
            onEdit={handleEditOrder}
            onDelete={handleDeleteOrder}
            onPayment={openPaymentModal}
            onDetails={openDetailsModal}
          />
        </div>
      </div>

      <OrderModal
        isOpen={showCreateModal || showEditModal}
        title={showEditModal ? 'Editar Pedido' : 'Novo Pedido'}
        onClose={resetForm}
      >
        <OrderForm
          orderNumber={orderNumber}
          orderNumberBlurred={orderNumberBlurred}
          orderDate={orderDate}
          accountOwner={accountOwner}
          paymentType={paymentType}
          orderNotes={orderNotes}
          items={items}
          people={people}
          products={products}
          isEdit={showEditModal}
          orderNumberError={orderNumberError}
          itemErrors={itemErrors}
          onChangeField={setFormField}
          onItemUpdate={updateItemField}
          onItemPersonSelect={onPersonSelect}
          onItemProductSelect={onProductSelect}
          onAddItem={addItem}
          onRemoveItem={removeItem}
          addItemBtnRef={addItemBtnRef}
          onSubmit={showEditModal ? handleUpdateOrder : handleCreateOrder}
          onCancel={resetForm}
        />
      </OrderModal>

      {showPaymentModal && selectedOrder && (
        <PaymentModal
          order={selectedOrder}
          balances={balances}
          selectedPersonId={selectedPersonId}
          paymentAmount={paymentAmount}
          paymentNotes={paymentNotes}
          paymentDate={paymentDate}
          paymentError={paymentError}
          submitting={submitting}
          orderPendingCents={orderPendingCents}
          selectedPendingCents={selectedPendingCents}
          selectedIsZeroItem={selectedIsZeroItem}
          selectedIsSelf={selectedIsSelf}
          selectedPersonItems={selectedPersonItems}
          onClose={closePaymentModal}
          onChangePerson={handleChangePerson}
          onChangeAmount={handleChangeAmount}
          onChangeNotes={handleChangeNotes}
          onChangeDate={handleChangeDate}
          onSubmit={handlePaymentSubmit}
        />
      )}

      {showDetailsModal && detailOrder && (
        <DetailsModal
          order={detailOrder}
          balances={detailBalances}
          loading={detailLoading}
          expandedPersonId={expandedPersonId}
          onClose={closeDetailsModal}
          onTogglePerson={toggleDetailPerson}
          personItems={getDetailPersonItems}
          personPayments={getDetailPersonPayments}
        />
      )}

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
        title="Excluir pedido"
        message="Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        loading={deleting}
        onConfirm={confirmDeleteOrder}
        onCancel={cancelDeleteOrder}
      />
    </>
  );
};

export default OrdersPage;
