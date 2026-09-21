import React from 'react';
import Modal from '../../../components/Modal';
import CurrencyInput from '../../../components/CurrencyInput';

const inputClass =
  'w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors';

const CreditCardBillModal = ({
  isOpen = true,
  embedded = false,
  onClose,
  onCancel,
  form,
  formError = '',
  submitting = false,
  isDirty = false,
  onChangeField,
  onSubmit,
}) => {
  const isEditing = Boolean(form.id);

  const renderForm = (requestClose) => (
    <form onSubmit={onSubmit} className="px-6 py-4">
      {formError && (
        <div
          data-testid="bill-form-error"
          className="mb-4 p-3 bg-danger-soft rounded-md"
        >
          <p className="text-sm text-danger-fg">{formError}</p>
        </div>
      )}

      <div className="mb-4">
        <label
          htmlFor="billDescription"
          className="block text-sm font-medium text-ink-soft mb-1"
        >
          Descrição
        </label>
        <input
          id="billDescription"
          type="text"
          value={form.description}
          onChange={(e) => onChangeField('description', e.target.value)}
          placeholder="Ex.: Compra dōTERRA"
          className={inputClass}
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label
            htmlFor="billTotalAmount"
            className="block text-sm font-medium text-ink-soft mb-1"
          >
            Valor total (R$)
          </label>
          <CurrencyInput
            id="billTotalAmount"
            data-testid="bill-total-amount"
            value={form.totalAmount}
            onChange={(e) => onChangeField('totalAmount', e.target.value)}
            placeholder="0,00"
          />
        </div>
        <div>
          <label
            htmlFor="billInstallments"
            className="block text-sm font-medium text-ink-soft mb-1"
          >
            Parcelas
          </label>
          <input
            id="billInstallments"
            type="number"
            min={1}
            max={24}
            value={form.installments}
            onChange={(e) => onChangeField('installments', e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="mb-4">
        <label
          htmlFor="billFirstInstallmentAt"
          className="block text-sm font-medium text-ink-soft mb-1"
        >
          Primeira parcela
        </label>
        <input
          id="billFirstInstallmentAt"
          type="date"
          value={form.firstInstallmentAt}
          onChange={(e) => onChangeField('firstInstallmentAt', e.target.value)}
          className={inputClass}
          required
        />
      </div>

      <div className="mb-4">
        <label
          htmlFor="billBrand"
          className="block text-sm font-medium text-ink-soft mb-1"
        >
          Bandeira (opcional)
        </label>
        <input
          id="billBrand"
          type="text"
          value={form.brand}
          onChange={(e) => onChangeField('brand', e.target.value)}
          placeholder="Ex.: Visa"
          className={inputClass}
        />
      </div>

      <div className="mb-4">
        <label
          htmlFor="billNotes"
          className="block text-sm font-medium text-ink-soft mb-1"
        >
          Observações (opcional)
        </label>
        <textarea
          id="billNotes"
          value={form.notes}
          onChange={(e) => onChangeField('notes', e.target.value)}
          rows={2}
          className={inputClass}
        />
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={requestClose}
          className="px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  );

  if (embedded) {
    return renderForm(onCancel || onClose);
  }

  return (
    <Modal
      isOpen={isOpen}
      title={isEditing ? 'Editar fatura' : 'Nova fatura'}
      onClose={onClose}
      isDirty={isDirty}
      submitting={submitting}
      testId="bill-form-modal"
      closeAriaLabel="Fechar"
    >
      {renderForm}
    </Modal>
  );
};

export default CreditCardBillModal;
