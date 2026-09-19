import React, { useState } from 'react';
import { formatBRL, toCents } from '../../utils/money';
import { useOrders } from './useOrders';
import { useOrderPayments } from './useOrderPayments';
import OrdersTable from './components/OrdersTable';
import Modal from '../../components/Modal';
import OrderForm from './components/OrderForm';
import PaymentModal from './components/PaymentModal';
import DetailsModal from './components/DetailsModal';
import EditPaymentModal from './components/EditPaymentModal';
import AttachmentPreviewModal from './components/AttachmentPreviewModal';
import OrderSimulatorModal from './components/OrderSimulatorModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useOrderSimulator } from './useOrderSimulator';

const OrdersPage = () => {
  const [viewAttachmentOrder, setViewAttachmentOrder] = useState(null);
  const {
    orders,
    people,
    products,
    loading,
    error,
    refreshOrders,
    search,
    searchField,
    sortBy,
    sortDir,
    hasActiveFilters,
    setSearch,
    setSearchField,
    handleSearchSubmit,
    handleSort,
    showCreateModal,
    showEditModal,
    editOrderId,
    orderNumber,
    orderNumberBlurred,
    orderDate,
    isTeamOrder,
    teamPersonId,
    usesOrderLevelClient,
    teamPersonIdError,
    showTeamPersonConfirm,
    accountOwner,
    paymentType,
    orderNotes,
    doterraPv,
    doterraPvError,
    attachmentFile,
    attachmentRemoved,
    shippingValue,
    shippingValueError,
    items,
    orderNumberError,
    itemErrors,
    addItemBtnRef,
    confirmDeleteId,
    deleting,
    orderFormDirty,
    setFormField,
    addItem,
    removeItem,
    updateItemField,
    onProductSelect,
    onCashbackToggle,
    onPersonSelect,
    onTeamPersonSelect,
    confirmTeamPersonChange,
    cancelTeamPersonChange,
    resetForm,
    handleCreateOrder,
    handleEditOrder,
    handleUpdateOrder,
    handleDeleteOrder,
    cancelDeleteOrder,
    confirmDeleteOrder,
    openCreateOrder,
  } = useOrders();

  const {
    showPaymentModal,
    selectedOrder,
    balances,
    selectedPersonId,
    paymentAmount,
    paymentNotes,
    paymentDate,
    paymentFormType,
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
    editIsSelf,
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
  } = useOrderPayments({ refreshOrders, orders, loading });

  const {
    isOpen: simulatorOpen,
    rows: simulatorRows,
    openSimulator,
    closeSimulator,
    addRow: addSimulatorRow,
    removeRow: removeSimulatorRow,
    updateRowField: updateSimulatorRowField,
    clearAll: clearSimulator,
  } = useOrderSimulator();

  const editOrder = orders.find((o) => o.id === editOrderId);

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
          <h2 className="text-xl font-semibold text-ink">Pedidos dōTERRA</h2>
          <div className="mt-3 sm:mt-0 flex items-center gap-2">
            <button
              onClick={openSimulator}
              data-testid="simulator-open"
              className="px-4 py-2 text-sm font-medium text-accent-on-soft bg-accent-soft hover:bg-accent-soft/80 rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
            >
              Simulador
            </button>
            <button
              onClick={() => openCreateOrder()}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
            >
              Novo Pedido
            </button>
          </div>
        </div>

        <div className="px-6 py-4">
          {error && !(showCreateModal || showEditModal) && (
            <div className="mb-4 p-3 bg-danger-soft rounded-md">
              <p className="text-sm text-danger-fg">{error}</p>
            </div>
          )}

          <OrdersTable
            orders={orders}
            search={search}
            searchField={searchField}
            sortBy={sortBy}
            sortDir={sortDir}
            hasActiveFilters={hasActiveFilters}
            onSearchChange={setSearch}
            onSearchFieldChange={setSearchField}
            onSearchSubmit={handleSearchSubmit}
            onSort={handleSort}
            onEdit={handleEditOrder}
            onDelete={handleDeleteOrder}
            onPayment={openPaymentModal}
            onDetails={openDetailsModal}
            onViewAttachment={setViewAttachmentOrder}
          />
        </div>
      </div>

      <OrderSimulatorModal
        isOpen={simulatorOpen}
        rows={simulatorRows}
        products={products}
        onClose={closeSimulator}
        onAddRow={addSimulatorRow}
        onUpdateField={updateSimulatorRowField}
        onRemoveRow={removeSimulatorRow}
        onClearAll={clearSimulator}
      />

      <Modal
        isOpen={showCreateModal || showEditModal}
        title={showEditModal ? 'Editar Pedido' : 'Novo Pedido'}
        onClose={resetForm}
        isDirty={orderFormDirty}
        maxWidth="max-w-2xl"
        closeAriaLabel="Fechar pedido"
      >
        {(requestClose) => (
          <OrderForm
            orderNumber={orderNumber}
            orderNumberBlurred={orderNumberBlurred}
            orderDate={orderDate}
            isTeamOrder={isTeamOrder}
            teamPersonId={teamPersonId}
            teamPersonIdError={teamPersonIdError}
            usesOrderLevelClient={usesOrderLevelClient}
            accountOwner={accountOwner}
            paymentType={paymentType}
            orderNotes={orderNotes}
            doterraPv={doterraPv}
            doterraPvError={doterraPvError}
            attachmentFile={attachmentFile}
            attachmentRemoved={attachmentRemoved}
            hasExistingAttachment={!!editOrder?.attachmentFilename}
            shippingValue={shippingValue}
            shippingValueError={shippingValueError}
            items={items}
            people={people}
            products={products}
            isEdit={showEditModal}
            orderNumberError={orderNumberError}
            itemErrors={itemErrors}
            onChangeField={setFormField}
            onItemUpdate={updateItemField}
            onItemPersonSelect={onPersonSelect}
            onTeamPersonSelect={onTeamPersonSelect}
            onItemProductSelect={onProductSelect}
            onItemCashbackToggle={onCashbackToggle}
            onAddItem={addItem}
            onRemoveItem={removeItem}
            addItemBtnRef={addItemBtnRef}
            onSubmit={showEditModal ? handleUpdateOrder : handleCreateOrder}
            onCancel={requestClose}
          />
        )}
      </Modal>

      {showPaymentModal && selectedOrder && (
        <PaymentModal
          order={selectedOrder}
          balances={balances}
          selectedPersonId={selectedPersonId}
          paymentAmount={paymentAmount}
          paymentNotes={paymentNotes}
          paymentDate={paymentDate}
          paymentFormType={paymentFormType}
          paymentError={paymentError}
          submitting={submitting}
          orderPendingCents={orderPendingCents}
          selectedPendingCents={selectedPendingCents}
          selectedIsZeroItem={selectedIsZeroItem}
          selectedIsSelf={selectedIsSelf}
          selectedPersonItems={selectedPersonItems}
          isDirty={paymentDirty}
          onClose={closePaymentModal}
          onChangePerson={handleChangePerson}
          onChangeAmount={handleChangeAmount}
          onChangeNotes={handleChangeNotes}
          onChangeDate={handleChangeDate}
          onChangePaymentType={handleChangePaymentType}
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
          onEditPayment={openEditPaymentModal}
        />
      )}

      {showEditPaymentModal && detailOrder && editingPayment && (
        <EditPaymentModal
          order={detailOrder}
          payment={editingPayment}
          personName={editPersonName}
          isSelf={editIsSelf}
          isZeroItem={editIsZeroItem}
          pendingCents={editPendingCents}
          paymentAmount={editPaymentAmount}
          paymentNotes={editPaymentNotes}
          paymentDate={editPaymentDate}
          paymentFormType={editPaymentType}
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

      {viewAttachmentOrder && (
        <AttachmentPreviewModal
          order={viewAttachmentOrder}
          onClose={() => setViewAttachmentOrder(null)}
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
        title="Excluir pedido"
        message="Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        loading={deleting}
        onConfirm={confirmDeleteOrder}
        onCancel={cancelDeleteOrder}
      />

      <ConfirmDialog
        open={showTeamPersonConfirm}
        title="Vincular cliente ao pedido"
        message="Ao escolher um cliente para todo o pedido, todos os itens serão vinculados a essa pessoa. Deseja continuar?"
        confirmLabel="Continuar"
        cancelLabel="Cancelar"
        onConfirm={confirmTeamPersonChange}
        onCancel={cancelTeamPersonChange}
      />
    </>
  );
};

export default OrdersPage;
