import React from 'react';
import { Cake } from 'lucide-react';
import { usePeople } from './usePeople';
import PeopleTable from './components/PeopleTable';
import Modal from '../../components/Modal';
import PersonForm from './components/PersonForm';
import ConfirmDialog from '../../components/ConfirmDialog';
import ClientDetailsModal from './components/ClientDetailsModal';

const PeoplePage = () => {
  const {
    people,
    totalCount,
    hasActiveFilters,
    search,
    classification,
    birthdayOnly,
    sortBy,
    sortDir,
    setSearch,
    setClassification,
    handleSort,
    toggleBirthdayOnly,
    loading,
    error,
    hasSelfPerson,
    showCreateModal,
    showEditModal,
    createForm,
    editForm,
    createDirty,
    editDirty,
    confirmDeleteId,
    deleting,
    detailsPerson,
    setShowCreateModal,
    openCreateModal,
    openDetails,
    closeDetails,
    setCreateField,
    setEditField,
    handleCreatePerson,
    handleUpdatePerson,
    handleEditPerson,
    handleDeletePerson,
    cancelDeletePerson,
    confirmDeletePerson,
    closeCreateModal,
    closeEditModal,
  } = usePeople();

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
            Cadastro de Clientes
          </h2>
          <div className="mt-3 sm:mt-0 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleBirthdayOnly}
              aria-pressed={birthdayOnly}
              aria-label={
                birthdayOnly
                  ? 'Mostrar todos os clientes'
                  : 'Mostrar apenas aniversariantes do mês'
              }
              title={
                birthdayOnly
                  ? 'Mostrar todos os clientes'
                  : 'Mostrar apenas aniversariantes do mês'
              }
              data-testid="toggle-birthday-month"
              className={`inline-flex items-center gap-2 px-4 py-2 font-medium rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                birthdayOnly
                  ? 'bg-primary-600 hover:bg-primary-700 text-white border border-transparent'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              <Cake className="w-4 h-4" aria-hidden="true" />
              <span>Aniversariantes do mês</span>
            </button>
            <button
              onClick={() => openCreateModal()}
              className="px-4 py-2 bg-gradient-to-r from-primary-700 to-primary-500 hover:from-primary-800 hover:to-primary-600 text-white font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              Novo
            </button>
          </div>
        </div>

        <div className="px-6 py-4">
          {error && !(showCreateModal || showEditModal) && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <PeopleTable
            people={people}
            totalCount={totalCount}
            hasActiveFilters={hasActiveFilters}
            search={search}
            classification={classification}
            sortBy={sortBy}
            sortDir={sortDir}
            onSearchChange={setSearch}
            onClassificationChange={setClassification}
            onSort={handleSort}
            onDetails={openDetails}
            onEdit={handleEditPerson}
            onDelete={handleDeletePerson}
          />
        </div>
      </div>

      <Modal
        isOpen={showCreateModal}
        title="Novo Cliente"
        onClose={closeCreateModal}
        isDirty={createDirty}
        maxWidth="max-w-md"
        closeAriaLabel="Fechar novo cliente"
      >
        {(requestClose) => (
          <PersonForm
            values={createForm}
            onChange={setCreateField}
            onSubmit={handleCreatePerson}
            onClose={requestClose}
            error={error}
            showSelfCheckbox={!hasSelfPerson}
          />
        )}
      </Modal>

      <Modal
        isOpen={showEditModal}
        title="Editar Cliente"
        onClose={closeEditModal}
        isDirty={editDirty}
        maxWidth="max-w-md"
        closeAriaLabel="Fechar edição de cliente"
      >
        {(requestClose) => (
          <PersonForm
            values={editForm}
            onChange={setEditField}
            onSubmit={handleUpdatePerson}
            onClose={requestClose}
            error={error}
            showSelfCheckbox={!hasSelfPerson || editForm.isSelf}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Excluir cliente"
        message="Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        loading={deleting}
        onConfirm={confirmDeletePerson}
        onCancel={cancelDeletePerson}
      />

      <ClientDetailsModal person={detailsPerson} onClose={closeDetails} />
    </>
  );
};

export default PeoplePage;
