import React from 'react';
import { usePeople } from './usePeople';
import PeopleTable from './components/PeopleTable';
import PersonModal from './components/PersonModal';
import PersonForm from './components/PersonForm';
import ConfirmDialog from '../../components/ConfirmDialog';

const PeoplePage = () => {
  const {
    people,
    loading,
    error,
    showCreateModal,
    showEditModal,
    createForm,
    editForm,
    confirmDeleteId,
    deleting,
    setShowCreateModal,
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
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-3 sm:mt-0 px-4 py-2 bg-gradient-to-r from-primary-700 to-primary-500 hover:from-primary-800 hover:to-primary-600 text-white font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Novo
          </button>
        </div>

        <div className="px-6 py-4">
          {error && !(showCreateModal || showEditModal) && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <PeopleTable
            people={people}
            onEdit={handleEditPerson}
            onDelete={handleDeletePerson}
          />
        </div>
      </div>

      <PersonModal
        isOpen={showCreateModal}
        title="Novo Cliente"
        onClose={closeCreateModal}
      >
        <PersonForm
          values={createForm}
          onChange={setCreateField}
          onSubmit={handleCreatePerson}
          onClose={closeCreateModal}
          error={error}
        />
      </PersonModal>

      <PersonModal
        isOpen={showEditModal}
        title="Editar Cliente"
        onClose={closeEditModal}
      >
        <PersonForm
          values={editForm}
          onChange={setEditField}
          onSubmit={handleUpdatePerson}
          onClose={closeEditModal}
          error={error}
        />
      </PersonModal>

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
    </>
  );
};

export default PeoplePage;
