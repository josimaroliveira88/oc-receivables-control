import React from 'react';
import { formatBRL, toCents } from '../../utils/money';
import { useReceivables } from './useReceivables';
import ReceivablesTable from './components/ReceivablesTable';
import PaymentModal from './components/PaymentModal';
import DetailsModal from './components/DetailsModal';
import ConfirmDialog from '../../components/ConfirmDialog';

const ReceivablesPage = () => {
  const {
    orders,
    loading,
    error,
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
  } = useReceivables();

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
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            Controle de Recebíveis
          </h2>
        </div>

        <div className="px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <ReceivablesTable
            orders={orders}
            onPayment={openPaymentModal}
            onDetails={openDetailsModal}
          />
        </div>
      </div>

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
    </>
  );
};

export default ReceivablesPage;
