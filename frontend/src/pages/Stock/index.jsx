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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2 text-gray-500 dark:text-gray-400">
          Carregando...
        </span>
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border-t-4 border-primary-600 dark:border-primary-400">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            Controle de Estoque
          </h2>
          <button
            type="button"
            onClick={openAddStockDialog}
            className="mt-3 sm:mt-0 px-4 py-2 bg-gradient-to-r from-primary-700 to-primary-500 hover:from-primary-800 hover:to-primary-600 text-white font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Adicionar Estoque
          </button>
        </div>

        <div className="px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
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
