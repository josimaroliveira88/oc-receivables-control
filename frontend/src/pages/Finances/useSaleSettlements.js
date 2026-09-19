import { useState } from 'react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import {
  buildSettlementPayload,
  emptySettlementForm,
  errorMessageFrom,
  todayString,
} from './utils/financeHelpers';

// Owns the InfinitePay redemption flow triggered from the Sales page: the
// target sale, the amount/date/notes form and the POST to /finances/settlements.
// The backend validates ownership, VENDA type, non-team and InfinitePay.
export function useSaleSettlements({ onSettled } = {}) {
  const [settlementSale, setSettlementSale] = useState(null);
  const [form, setForm] = useState(emptySettlementForm);
  const [formInitial, setFormInitial] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();

  const openSettlement = (sale) => {
    const next = { ...emptySettlementForm(), transactionDate: todayString() };
    setSettlementSale(sale);
    setForm(next);
    setFormInitial(next);
    setFormError('');
  };

  const closeSettlement = () => {
    setSettlementSale(null);
    setForm(emptySettlementForm());
    setFormInitial(null);
    setFormError('');
  };

  const setFormField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.amount || parseFloat(form.amount) <= 0) {
      setFormError('Informe o valor do resgate');
      return;
    }
    if (!form.transactionDate) {
      setFormError('Informe a data do resgate');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/finances/settlements', {
        orderId: settlementSale.id,
        ...buildSettlementPayload(form),
      });
      addToast('Resgate registrado com sucesso!', 'success');
      closeSettlement();
      if (onSettled) onSettled();
    } catch (err) {
      setFormError(
        errorMessageFrom(err, 'Erro ao registrar resgate. Tente novamente.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isDirty = useDirtyForm(form, formInitial).isDirty;

  return {
    settlementSale,
    form,
    formError,
    submitting,
    isDirty,
    openSettlement,
    closeSettlement,
    setFormField,
    handleSubmit,
  };
}
