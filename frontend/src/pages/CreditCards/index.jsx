import React from 'react';
import { Plus, Upload } from 'lucide-react';
import { useCreditCards } from './useCreditCards';
import CreditCardsTable from './components/CreditCardsTable';
import CreditCardBillModal from './components/CreditCardBillModal';
import CreditCardBillDetail from './components/CreditCardBillDetail';
import CreditCardReconcileModal from './components/CreditCardReconcileModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { fromCents, formatBRL } from '../../utils/money';
import { BILL_STATUS_LABELS } from './utils/creditCardHelpers';

const SummaryCard = ({ label, cents, valueClass, testId }) => (
  <div className="rounded-lg border border-line bg-surface px-4 py-3">
    <p className="text-xs font-medium text-ink-faint">{label}</p>
    <p
      data-testid={testId}
      className={`mt-1 text-lg font-semibold ${valueClass}`}
    >
      {formatBRL(fromCents(cents))}
    </p>
  </div>
);

const selectClass =
  'w-full sm:w-auto px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors';

const inputClass =
  'w-full sm:w-auto px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors';

const CreditCards = () => {
  const {
    visibleBills,
    loading,
    error,
    filters,
    setFilters,
    resetFilters,
    summary,
    selectedBill,
    openBill,
    closeBill,
    handlePayInstallment,
    handleUnpayInstallment,
    handleUndoBatch,
    showBillForm,
    billForm,
    billFormError,
    billSubmitting,
    billFormDirty,
    openBillCreate,
    openBillEdit,
    closeBillForm,
    setBillField,
    handleBillSubmit,
    confirmDeleteId,
    deleting,
    requestDelete,
    cancelDelete,
    confirmDelete,
    reconcile,
  } = useCreditCards();

  const hasActiveFilters = Boolean(
    filters.status || filters.from || filters.to || filters.q.trim(),
  );

  const handleDeleteFromDetail = (id) => {
    closeBill();
    requestDelete(id);
  };

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
          <h2 className="text-xl font-semibold text-ink">Cartões de crédito</h2>
          <div className="mt-3 sm:mt-0 flex items-center gap-2">
            <button
              type="button"
              onClick={reconcile.open}
              data-testid="credit-card-reconcile-open"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-line text-ink-soft hover:text-ink hover:bg-elevated font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <Upload className="w-4 h-4" aria-hidden="true" />
              Conciliar fatura
            </button>
            <button
              type="button"
              onClick={openBillCreate}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Nova compra
            </button>
          </div>
        </div>

        <div className="px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-danger-soft rounded-md">
              <p className="text-sm text-danger-fg">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SummaryCard
              label="Total em compras"
              cents={summary.totalCents}
              valueClass="text-ink"
              testId="credit-cards-summary-total"
            />
            <SummaryCard
              label="Pendentes"
              cents={summary.pendingCents}
              valueClass="text-warning-fg"
              testId="credit-cards-summary-pending"
            />
            <SummaryCard
              label="Pagas no mês"
              cents={summary.paidThisMonthCents}
              valueClass="text-success-fg"
              testId="credit-cards-summary-paid"
            />
          </div>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
            <label className="block text-sm font-medium text-ink-soft">
              <span className="sr-only">Status</span>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ status: e.target.value })}
                className={selectClass}
                aria-label="Status"
              >
                <option value="">Todos os status</option>
                {BILL_STATUS_LABELS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-ink-soft">
              <span className="sr-only">De</span>
              <input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters({ from: e.target.value })}
                className={inputClass}
                aria-label="De"
              />
            </label>
            <label className="block text-sm font-medium text-ink-soft">
              <span className="sr-only">Até</span>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters({ to: e.target.value })}
                className={inputClass}
                aria-label="Até"
              />
            </label>
            <input
              type="text"
              value={filters.q}
              onChange={(e) => setFilters({ q: e.target.value })}
              className={`${inputClass} flex-1`}
              placeholder="Buscar compras..."
              aria-label="Buscar compras"
            />
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors"
              >
                Limpar
              </button>
            )}
          </div>

          <CreditCardReconcileModal
            isOpen={reconcile.isOpen}
            onClose={reconcile.close}
            onImportFile={reconcile.importFile}
            statementLines={reconcile.statementLines}
            selections={reconcile.selections}
            error={reconcile.error}
            submitting={reconcile.submitting}
            committing={reconcile.committing}
            committedBatchId={reconcile.committedBatchId}
            committedCount={reconcile.committedCount}
            onSelectionChange={reconcile.setSelection}
            onCommit={reconcile.commit}
            onUndo={reconcile.undoCommitted}
          />

          <CreditCardsTable
            bills={visibleBills}
            hasActiveFilters={hasActiveFilters}
            onOpen={openBill}
            onEdit={openBillEdit}
            onDelete={requestDelete}
          />
        </div>
      </div>

      <CreditCardBillModal
        isOpen={showBillForm}
        onClose={closeBillForm}
        form={billForm}
        formError={billFormError}
        submitting={billSubmitting}
        isDirty={billFormDirty}
        onChangeField={setBillField}
        onSubmit={handleBillSubmit}
      />

      {selectedBill && (
        <CreditCardBillDetail
          bill={selectedBill}
          onClose={closeBill}
          onPay={(_bill, installment) => handlePayInstallment(installment)}
          onUnpay={(_bill, installment) => handleUnpayInstallment(installment)}
          onUndoBatch={handleUndoBatch}
          onEdit={openBillEdit}
          onDelete={handleDeleteFromDetail}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        title="Excluir compra"
        message="Tem certeza que deseja excluir esta compra? As parcelas pendentes também serão removidas."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </>
  );
};

export default CreditCards;
