import React, { useEffect } from 'react';
import ProductCombobox from '../../../components/ProductCombobox';
import { MOVEMENT_TYPE_OPTIONS } from '../utils/stockHelpers';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed';

const MovementDialog = ({
  isOpen,
  title,
  form,
  error,
  submitting = false,
  onChange,
  onSubmit,
  onClose,
  products = [],
  product = null,
}) => {
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none disabled:opacity-50"
            aria-label="Fechar"
          >
            &times;
          </button>
        </div>
        <form onSubmit={onSubmit} className="px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
              <p
                className="text-sm text-red-600 dark:text-red-400"
                data-testid="movement-form-error"
              >
                {error}
              </p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Produto
            </label>
            {product ? (
              <p
                className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-md"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Quantidade
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.quantity}
              onChange={(e) => onChange('quantity', e.target.value)}
              required
              className={inputClass}
              placeholder="Digite a quantidade"
              aria-label="Quantidade"
              disabled={submitting}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Fechar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-gradient-to-r from-primary-700 to-primary-500 hover:from-primary-800 hover:to-primary-600 text-white font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MovementDialog;
