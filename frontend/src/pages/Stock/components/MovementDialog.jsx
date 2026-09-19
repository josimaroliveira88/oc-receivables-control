import React from 'react';
import NumericInput from '../../../components/NumericInput';
import ProductCombobox from '../../../components/ProductCombobox';
import Modal from '../../../components/Modal';
import { MOVEMENT_TYPE_OPTIONS } from '../utils/stockHelpers';

const inputClass =
  'w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors disabled:bg-base disabled:text-ink-faint disabled:cursor-not-allowed';

const MovementDialog = ({
  isOpen,
  title,
  form,
  error,
  submitting = false,
  isDirty = false,
  onChange,
  onSubmit,
  onClose,
  products = [],
  product = null,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      title={title}
      onClose={onClose}
      isDirty={isDirty}
      submitting={submitting}
      testId="movement-dialog"
      closeAriaLabel="Fechar"
    >
      {(requestClose) => (
        <form onSubmit={onSubmit} className="px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-danger-soft rounded-md">
              <p
                className="text-sm text-danger-fg"
                data-testid="movement-form-error"
              >
                {error}
              </p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-ink-soft mb-1">
              Produto
            </label>
            {product ? (
              <p
                className="px-3 py-2 text-sm text-ink bg-base border border-line rounded-md"
                data-testid="movement-product-info"
              >
                {product.name} ({product.code})
              </p>
            ) : (
              <ProductCombobox
                products={products}
                value={form.productId}
                onChange={(id) => onChange('productId', id)}
                subtitle={(p) => p.size || ''}
              />
            )}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-ink-soft mb-1">
              Tipo
            </label>
            <select
              value={form.type}
              onChange={(e) => onChange('type', e.target.value)}
              className={inputClass}
              aria-label="Tipo"
              disabled={submitting}
            >
              {MOVEMENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-ink-soft mb-1">
              Quantidade
            </label>
            <NumericInput
              value={form.quantity}
              onChange={(e) => onChange('quantity', e.target.value)}
              required
              className="w-full"
              placeholder="Digite a quantidade"
              aria-label="Quantidade"
              disabled={submitting}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-ink-soft mb-1">
              Data Efetiva
            </label>
            <input
              type="date"
              value={form.effectiveDate}
              onChange={(e) => onChange('effectiveDate', e.target.value)}
              required
              className={inputClass}
              aria-label="Data Efetiva"
              data-testid="movement-effective-date-input"
              disabled={submitting}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-ink-soft mb-1">
              Motivo
            </label>
            <textarea
              value={form.reason}
              onChange={(e) => onChange('reason', e.target.value)}
              rows={3}
              maxLength={255}
              className={inputClass}
              placeholder="Opcional"
              aria-label="Motivo"
              disabled={submitting}
            />
          </div>

          <div className="flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={requestClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Fechar
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
    </Modal>
  );
};

export default MovementDialog;
