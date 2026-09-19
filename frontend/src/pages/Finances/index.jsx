import React from 'react';
import { Settings } from 'lucide-react';
import { useFinances } from './useFinances';
import { useFinanceCategories } from './useFinanceCategories';
import FinancesSummary from './components/FinancesSummary';
import FinancesToolbar from './components/FinancesToolbar';
import FinancesTable from './components/FinancesTable';
import FinancialTransactionModal from './components/FinancialTransactionModal';
import FinancialCategoryModal from './components/FinancialCategoryModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { hasActiveTransactionFilters } from './utils/financeHelpers';

const FinancesPage = () => {
  const {
    transactions,
    summary,
    loading,
    error,
    filters,
    setFilters,
    resetFilters,
    commitSearch,
    showFormModal,
    form,
    formError,
    submitting,
    formDirty,
    openCreate,
    openEdit,
    closeForm,
    setFormField,
    handleSubmit,
    confirmDeleteId,
    deleting,
    requestDelete,
    cancelDelete,
    confirmDelete,
  } = useFinances();

  const categories = useFinanceCategories();

  const hasActiveFilters = hasActiveTransactionFilters(filters);

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
          <h2 className="text-xl font-semibold text-ink">Finanças</h2>
          <div className="mt-3 sm:mt-0 flex items-center gap-2">
            <button
              type="button"
              onClick={categories.openModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors"
            >
              <Settings className="w-4 h-4" aria-hidden="true" />
              Categorias
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
            >
              Novo lançamento
            </button>
          </div>
        </div>

        <div className="px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-danger-soft rounded-md">
              <p className="text-sm text-danger-fg">{error}</p>
            </div>
          )}

          <FinancesSummary summary={summary} />

          <div className="mt-4">
            <FinancesToolbar
              filters={filters}
              categories={categories.categories}
              onChange={setFilters}
              onSearchSubmit={commitSearch}
              onReset={resetFilters}
              hasActiveFilters={hasActiveFilters}
            />
          </div>

          <FinancesTable
            transactions={transactions}
            hasActiveFilters={hasActiveFilters}
            onEdit={openEdit}
            onDelete={requestDelete}
          />
        </div>
      </div>

      <FinancialTransactionModal
        isOpen={showFormModal}
        onClose={closeForm}
        form={form}
        categories={categories.categories}
        formError={formError}
        submitting={submitting}
        isDirty={formDirty}
        onChangeField={setFormField}
        onSubmit={handleSubmit}
      />

      <FinancialCategoryModal
        isOpen={categories.showModal}
        onClose={categories.closeModal}
        categories={categories.categories}
        loading={categories.loading}
        loadError={categories.loadError}
        form={categories.form}
        formError={categories.formError}
        submitting={categories.submitting}
        isDirty={categories.isDirty}
        onChangeField={categories.setFormField}
        onSubmit={categories.handleSubmit}
        onStartEdit={categories.startEdit}
        onCancelEdit={categories.cancelEdit}
        onToggleActive={categories.toggleActive}
      />

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Excluir lançamento"
        message="Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </>
  );
};

export default FinancesPage;
