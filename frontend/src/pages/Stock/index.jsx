import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStock } from './useStock';
import StockTable from './components/StockTable';
import MovementDialog from './components/MovementDialog';
import HistoryDialog from './components/HistoryDialog';
import ConfirmDialog from '../../components/ConfirmDialog';

const StockPage = () => {
  const {
    inventory,
    totalCount,
    hasActiveFilters,
    search,
    sortBy,
    sortDir,
    setSearch,
    handleSort,
    loading,
    error,
    availableProducts,
    showMovementDialog,
    movementForm,
    movementError,
    movementProduct,
    movementDirty,
    submittingMovement,
    showHistoryDialog,
    historyProduct,
    history,
    historyLoading,
    canUndo,
    lastMovementOrder,
    undoing,
    openAddStockDialog,
    closeMovementDialog,
    setMovementField,
    handleSubmitMovement,
    handleRegisterEntry,
    handleRegisterExit,
    openHistoryDialog,
    closeHistoryDialog,
    undoLastMovement,
  } = useStock();

  const [confirmUndo, setConfirmUndo] = useState(false);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        <span className="ml-2 text-ink-faint">Carregando...</span>
      </div>
    );
  }

  const handleConfirmUndo = async () => {
    await undoLastMovement();
    setConfirmUndo(false);
  };

  const handleGoToOrder = (order) => {
    if (!order) return;
    if (order.orderType === 'VENDA') {
      navigate(`/sales?editSale=${order.id}`);
    } else {
      navigate(`/orders?editOrder=${order.id}`);
    }
  };

  return (
    <>
      <div className="bg-surface border border-line rounded-lg shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-line px-6 py-4">
          <h2 className="text-xl font-semibold text-ink">
            Controle de Estoque
          </h2>
          <button
            type="button"
            onClick={openAddStockDialog}
            className="mt-3 sm:mt-0 px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
          >
            Adicionar Estoque
          </button>
        </div>

        <div className="px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-danger-soft rounded-md">
              <p className="text-sm text-danger-fg">{error}</p>
            </div>
          )}

          <StockTable
            inventory={inventory}
            totalCount={totalCount}
            hasActiveFilters={hasActiveFilters}
            search={search}
            sortBy={sortBy}
            sortDir={sortDir}
            onSearchChange={setSearch}
            onSort={handleSort}
            onRegisterEntry={handleRegisterEntry}
            onRegisterExit={handleRegisterExit}
            onViewHistory={openHistoryDialog}
          />
        </div>
      </div>

      <MovementDialog
        isOpen={showMovementDialog}
        title="Nova Movimentação"
        form={movementForm}
        error={movementError}
        submitting={submittingMovement}
        isDirty={movementDirty}
        products={availableProducts}
        product={movementProduct}
        onChange={setMovementField}
        onSubmit={handleSubmitMovement}
        onClose={closeMovementDialog}
      />

      <HistoryDialog
        isOpen={showHistoryDialog}
        product={historyProduct}
        movements={history}
        loading={historyLoading}
        canUndo={canUndo}
        lastMovementOrder={lastMovementOrder}
        undoing={undoing}
        onRequestUndo={() => setConfirmUndo(true)}
        onGoToOrder={handleGoToOrder}
        onClose={closeHistoryDialog}
      />

      <ConfirmDialog
        open={confirmUndo}
        title="Desfazer última movimentação"
        message={
          historyProduct
            ? `Tem certeza que deseja desfazer a última movimentação de ${historyProduct.name}? O estoque será revertido para o valor anterior.`
            : ''
        }
        confirmLabel="Desfazer"
        cancelLabel="Cancelar"
        loading={undoing}
        onConfirm={handleConfirmUndo}
        onCancel={() => setConfirmUndo(false)}
      />
    </>
  );
};

export default StockPage;
