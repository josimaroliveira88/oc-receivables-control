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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        <span className="ml-2 text-ink-faint">Carregando...</span>
      </div>
    );
  }

  return (
    <>
      <div className="bg-surface border border-line rounded-lg shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-line px-6 py-4">
          <h2 className="text-xl font-semibold text-ink">
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
              className={`inline-flex items-center gap-2 px-4 py-2 font-medium rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface ${
                birthdayOnly
                  ? 'bg-accent hover:bg-accent-hover text-accent-on border border-transparent'
                  : 'bg-surface text-ink-soft border border-line hover:bg-accent-soft'
              }`}
            >
              <Cake className="w-4 h-4" aria-hidden="true" />
              <span>Aniversariantes do mês</span>
            </button>
            <button
              onClick={() => openCreateModal()}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
            >
              Novo
            </button>
          </div>
        </div>

        <div className="px-6 py-4">
          {error && !(showCreateModal || showEditModal) && (
            <div className="mb-4 p-3 bg-danger-soft rounded-md">
              <p className="text-sm text-danger-fg">{error}</p>
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
