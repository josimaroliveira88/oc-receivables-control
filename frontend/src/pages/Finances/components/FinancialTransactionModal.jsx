import React, { useEffect, useState } from 'react';
import Modal from '../../../components/Modal';
import CurrencyInput from '../../../components/CurrencyInput';
import CreditCardBillModal from '../../CreditCards/components/CreditCardBillModal';
import { CATEGORY_TYPE_OPTIONS } from '../utils/financeHelpers';

const inputClass =
  'w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors disabled:bg-base disabled:text-ink-faint disabled:cursor-not-allowed';

const FinancialTransactionModal = ({
  isOpen = true,
  onClose,
  form,
  mode = 'manual',
  categories = [],
  formError = '',
  submitting = false,
  isDirty = false,
  onChangeField,
  onSubmit,
  creditCard = null,
}) => {
  const isEditing = Boolean(form.id);
  const isDescriptionOnly = mode === 'description';
  const [localMode, setLocalMode] = useState('simple');

  useEffect(() => {
    if (!isOpen) setLocalMode('simple');
  }, [isOpen]);

  const creditCardMode = localMode === 'credit-card' && Boolean(creditCard);
  const modalIsDirty = creditCardMode ? creditCard.isDirty : isDirty;
  const modalSubmitting = creditCardMode ? creditCard.submitting : submitting;

  const categoryOptions = categories
    .filter((category) => category.type === form.type && category.active)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const modalTitle = isDescriptionOnly
    ? 'Editar descrição'
    : isEditing
      ? 'Editar lançamento'
      : 'Novo lançamento';

  return (
    <Modal
      isOpen={isOpen}
      title={modalTitle}
      onClose={onClose}
      isDirty={modalIsDirty}
      submitting={modalSubmitting}
      testId="transaction-form-modal"
      closeAriaLabel="Fechar"
    >
      {(requestClose) => (
        <>
          {creditCard && (
            <div className="flex gap-2 px-6 pt-4">
              <button
                type="button"
                onClick={() => setLocalMode('simple')}
                aria-pressed={!creditCardMode}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  creditCardMode
                    ? 'text-ink-soft hover:text-ink bg-base hover:bg-elevated'
                    : 'bg-accent-soft text-accent-on-soft'
                }`}
              >
                Lançamento simples
              </button>
              <button
                type="button"
                onClick={() => setLocalMode('credit-card')}
                aria-pressed={creditCardMode}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  creditCardMode
                    ? 'bg-accent-soft text-accent-on-soft'
                    : 'text-ink-soft hover:text-ink bg-base hover:bg-elevated'
                }`}
              >
                Cartão de crédito
              </button>
            </div>
          )}

          {creditCardMode ? (
            <CreditCardBillModal
              embedded
              form={creditCard.form}
              formError={creditCard.formError}
              submitting={creditCard.submitting}
              onChangeField={creditCard.onChangeField}
              onSubmit={creditCard.onSubmit}
              onCancel={requestClose}
            />
          ) : (
            <form onSubmit={onSubmit} className="px-6 py-4">
              {formError && (
                <div
                  data-testid="transaction-form-error"
                  className="mb-4 p-3 bg-danger-soft rounded-md"
                >
                  <p className="text-sm text-danger-fg">{formError}</p>
                </div>
              )}

              {mode === 'manual' && (
                <div className="mb-4">
                  <label
                    htmlFor="transactionType"
                    className="block text-sm font-medium text-ink-soft mb-1"
                  >
                    Tipo
                  </label>
                  <select
                    id="transactionType"
                    value={form.type}
                    onChange={(e) => {
                      onChangeField('type', e.target.value);
                      onChangeField('categoryId', '');
                    }}
                    className={inputClass}
                  >
                    {CATEGORY_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mb-4">
                <label
                  htmlFor="transactionDescription"
                  className="block text-sm font-medium text-ink-soft mb-1"
                >
                  Descrição
                </label>
                <input
                  id="transactionDescription"
                  type="text"
                  value={form.description}
                  onChange={(e) => onChangeField('description', e.target.value)}
                  placeholder="Ex.: Bônus dōTERRA"
                  className={inputClass}
                />
              </div>

              {!isDescriptionOnly && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label
                      htmlFor="transactionAmount"
                      className="block text-sm font-medium text-ink-soft mb-1"
                    >
                      Valor (R$)
                    </label>
                    <CurrencyInput
                      id="transactionAmount"
                      data-testid="transaction-amount"
                      value={form.amount}
                      onChange={(e) => onChangeField('amount', e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="transactionDate"
                      className="block text-sm font-medium text-ink-soft mb-1"
                    >
                      Data
                    </label>
                    <input
                      id="transactionDate"
                      type="date"
                      value={form.transactionDate}
                      onChange={(e) =>
                        onChangeField('transactionDate', e.target.value)
                      }
                      className={inputClass}
                    />
                  </div>
                </div>
              )}

              {!isDescriptionOnly && (
                <div className="mb-4">
                  <label
                    htmlFor="transactionCategory"
                    className="block text-sm font-medium text-ink-soft mb-1"
                  >
                    Categoria
                  </label>
                  <select
                    id="transactionCategory"
                    value={form.categoryId}
                    onChange={(e) =>
                      onChangeField('categoryId', e.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">Sem categoria</option>
                    {categoryOptions.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!isDescriptionOnly && (
                <div className="mb-4">
                  <label
                    htmlFor="transactionNotes"
                    className="block text-sm font-medium text-ink-soft mb-1"
                  >
                    Observações (opcional)
                  </label>
                  <textarea
                    id="transactionNotes"
                    value={form.notes}
                    onChange={(e) => onChangeField('notes', e.target.value)}
                    rows={2}
                    className={inputClass}
                  />
                </div>
              )}

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
          )}
        </>
      )}
    </Modal>
  );
};

export default FinancialTransactionModal;
