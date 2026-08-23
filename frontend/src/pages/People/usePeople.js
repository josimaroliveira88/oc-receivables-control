import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import {
  emptyForm,
  buildPayload,
  filterAndSortPeople,
} from './utils/peopleHelpers';

export function usePeople() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [classification, setClassification] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPersonId, setEditPersonId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm());
  const [editForm, setEditForm] = useState(emptyForm());
  const { addToast } = useToast();

  const fetchPeople = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/people');
      setPeople(response.data);
    } catch (err) {
      setError('Erro ao carregar clientes. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  const visiblePeople = useMemo(
    () => filterAndSortPeople(people, search, classification, sortBy, sortDir),
    [people, search, classification, sortBy, sortDir],
  );

  const handleSort = (field, dir) => {
    setSortBy(field);
    setSortDir(dir);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setError('');
  };

  const openCreateModal = () => {
    setShowCreateModal(true);
    setError('');
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditPersonId(null);
    setEditForm(emptyForm());
    setError('');
  };

  const setCreateField = (field, value) => {
    setCreateForm((f) => ({ ...f, [field]: value }));
    setError('');
  };

  const setEditField = (field, value) => {
    setEditForm((f) => ({ ...f, [field]: value }));
    setError('');
  };

  const handleCreatePerson = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      setError('Nome é obrigatório');
      return;
    }
    try {
      await api.post('/people', buildPayload(createForm));
      setCreateForm(emptyForm());
      setShowCreateModal(false);
      setError('');
      fetchPeople();
    } catch (err) {
      addToast(
        err.response?.data?.error || 'Erro ao criar cliente. Tente novamente.',
        'error',
      );
    }
  };

  const handleUpdatePerson = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      setError('Nome é obrigatório');
      return;
    }
    try {
      await api.put(`/people/${editPersonId}`, buildPayload(editForm));
      setEditPersonId(null);
      setEditForm(emptyForm());
      setShowEditModal(false);
      setError('');
      fetchPeople();
    } catch (err) {
      addToast(
        err.response?.data?.error ||
          'Erro ao atualizar cliente. Tente novamente.',
        'error',
      );
    }
  };

  const handleEditPerson = (person) => {
    setEditPersonId(person.id);
    setEditForm({
      name: person.name || '',
      commonGroups: person.commonGroups || '',
      whatsapp: person.whatsapp || '',
      instagram: person.instagram || '',
      address: person.address || '',
      observacao: person.observacao || '',
      isVip: person.isVip || false,
      isDoterraMember: person.isDoterraMember || false,
      isSelf: person.isSelf || false,
    });
    setError('');
    setShowEditModal(true);
  };

  const handleDeletePerson = (id) => {
    setConfirmDeleteId(id);
  };

  const cancelDeletePerson = () => {
    setConfirmDeleteId(null);
  };

  const confirmDeletePerson = async () => {
    try {
      setDeleting(true);
      await api.delete(`/people/${confirmDeleteId}`);
      addToast('Cliente excluído com sucesso!', 'success');
      fetchPeople();
    } catch (err) {
      addToast('Erro ao excluir cliente. Tente novamente.', 'error');
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  return {
    people: visiblePeople,
    totalCount: visiblePeople.length,
    hasActiveFilters: search.trim() !== '' || classification !== '',
    search,
    classification,
    sortBy,
    sortDir,
    setSearch,
    setClassification,
    handleSort,
    loading,
    error,
    showCreateModal,
    showEditModal,
    createForm,
    editForm,
    confirmDeleteId,
    deleting,
    setShowCreateModal,
    openCreateModal,
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
  };
}
