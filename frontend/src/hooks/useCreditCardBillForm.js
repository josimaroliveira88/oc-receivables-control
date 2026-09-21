import { useState } from 'react';
import { useToast } from '../components/Toast';
import { useDirtyForm } from './useDirtyForm';
import * as creditCardsApi from '../services/creditCardsApi';
import { errorMessageFrom } from '../pages/Finances/utils/financeHelpers';
import {
  billToForm,
  buildBillPayload,
  emptyBillForm,
} from '../pages/CreditCards/utils/creditCardHelpers';

export function useCreditCardBillForm({ onSaved } = {}) {
  const { addToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(emptyBillForm);
  const [initial, setInitial] = useState(emptyBillForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setForm(emptyBillForm());
    setInitial(emptyBillForm());
    setFormError('');
  };

  const openCreate = () => {
    reset();
    setIsOpen(true);
  };

  const openEdit = (bill) => {
    const next = billToForm(bill);
    setForm(next);
    setInitial(next);
    setFormError('');
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    reset();
  };

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.description.trim()) {
      setFormError('Informe a descrição');
      return;
    }
    const totalAmount = parseFloat(form.totalAmount);
    if (!totalAmount || totalAmount <= 0) {
      setFormError('Informe um valor maior que zero');
      return;
    }
    const installments = Number(form.installments);
    if (
      !Number.isInteger(installments) ||
      installments < 1 ||
      installments > 24
    ) {
      setFormError('Informe um número de parcelas entre 1 e 24');
      return;
    }
    if (!form.firstInstallmentAt) {
      setFormError('Informe a data da primeira parcela');
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildBillPayload(form);
      if (form.id) {
        await creditCardsApi.updateBill(form.id, payload);
        addToast('Compra atualizada com sucesso!', 'success');
      } else {
        await creditCardsApi.createBill(payload);
        addToast('Compra criada com sucesso!', 'success');
      }
      close();
      onSaved?.();
    } catch (err) {
      setFormError(
        errorMessageFrom(err, 'Erro ao salvar compra. Tente novamente.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isDirty = useDirtyForm(form, initial).isDirty;

  return {
    isOpen,
    form,
    formError,
    submitting,
    isDirty,
    openCreate,
    openEdit,
    close,
    setField,
    handleSubmit,
  };
}
