import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import { errorMessageFrom } from './utils/financeHelpers';

// The empty create form doubles as the edit-mode reset target. `id: null`
// means "create"; a non-null id switches the single form into rename mode.
const emptyForm = () => ({ id: null, name: '', type: 'DESPESA' });

// Owns all finance-category state and I/O for the finances page: the list, the
// create/rename form, soft activation toggles, and the management modal.
export function useFinanceCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formInitial, setFormInitial] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/finances/categories');
      setCategories(data);
      setLoadError('');
    } catch (_err) {
      setLoadError('Erro ao carregar categorias. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const resetForm = () => {
    setForm(emptyForm());
    setFormInitial(emptyForm());
    setFormError('');
  };

  const openModal = () => {
    resetForm();
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const setFormField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormError('');
  };

  const startEdit = (category) => {
    const next = { id: category.id, name: category.name, type: category.type };
    setForm(next);
    setFormInitial(next);
    setFormError('');
  };

  const cancelEdit = () => {
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = form.name.trim();

    if (!name) {
      setFormError('Informe o nome da categoria');
      return;
    }

    setSubmitting(true);
    try {
      if (form.id) {
        const { data } = await api.put(`/finances/categories/${form.id}`, {
          name,
        });
        setCategories((prev) =>
          prev.map((category) => (category.id === form.id ? data : category)),
        );
        addToast('Categoria atualizada com sucesso!', 'success');
      } else {
        const { data } = await api.post('/finances/categories', {
          name,
          type: form.type,
        });
        setCategories((prev) => [...prev, data]);
        addToast('Categoria criada com sucesso!', 'success');
      }
      resetForm();
    } catch (err) {
      setFormError(
        errorMessageFrom(err, 'Erro ao salvar categoria. Tente novamente.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (category) => {
    try {
      const { data } = await api.put(`/finances/categories/${category.id}`, {
        active: !category.active,
      });
      setCategories((prev) =>
        prev.map((item) => (item.id === category.id ? data : item)),
      );
      addToast(
        data.active ? 'Categoria reativada.' : 'Categoria desativada.',
        'success',
      );
    } catch (err) {
      addToast(
        errorMessageFrom(err, 'Erro ao atualizar categoria. Tente novamente.'),
        'error',
      );
    }
  };

  const isDirty = useDirtyForm(form, formInitial).isDirty;

  return {
    categories,
    loading,
    loadError,
    showModal,
    form,
    formError,
    submitting,
    isDirty,
    openModal,
    closeModal,
    setFormField,
    startEdit,
    cancelEdit,
    handleSubmit,
    toggleActive,
    reload: loadCategories,
  };
}
