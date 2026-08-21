import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import { emptyForm, buildPayload } from './utils/peopleHelpers';

export function usePeople() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  const closeCreateModal = () => {
    setShowCreateModal(false);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditPersonId(null);
    setEditForm(emptyForm());
  };

  const setCreateField = (field, value) => {
    setCreateForm((f) => ({ ...f, [field]: value }));
  };

  const setEditField = (field, value) => {
    setEditForm((f) => ({ ...f, [field]: value }));
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
      fetchPeople();
    } catch (err) {
      setError('Erro ao criar cliente. Tente novamente.');
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
      fetchPeople();
    } catch (err) {
      setError('Erro ao atualizar cliente. Tente novamente.');
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
      isVip: person.isVip || false,
      isDoterraMember: person.isDoterraMember || false,
      isSelf: person.isSelf || false,
    });
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
      setError('Erro ao excluir cliente. Tente novamente.');
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  return {
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
  };
}
