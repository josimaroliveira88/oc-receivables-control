import React, { useEffect } from 'react';
import { Plus } from 'lucide-react';
import { lineValueCents } from '../utils/saleHelpers';
import SaleItemFields from './SaleItemFields';
import SaleTotals from './SaleTotals';

const SaleForm = ({
  clientPersonId,
  clientError,
  orderDate,
  shippingValue,
  shippingValueError,
  additionalValue,
  additionalValueError,
  description,
  deliveredAt,
  items,
  people,
  products,
  isEdit,
  itemErrors,
  onChangeField,
  onItemUpdate,
  onItemProductSelect,
  onAddItem,
  onRemoveItem,
  addItemBtnRef,
  onSubmit,
  onCancel,
}) => {
  useEffect(() => {
    const firstError = document.querySelector(
      '[data-testid^="sale-item-error-"]',
    );
    if (firstError && typeof firstError.scrollIntoView === 'function') {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [itemErrors]);

  const totalChargedCents = items.reduce(
    (total, item) => total + lineValueCents(item),
    0,
  );

  return (
    <form onSubmit={onSubmit} className="px-6 py-4">
      <div className="mb-4">
        <label
          htmlFor="saleClient"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Cliente
        </label>
        <select
          id="saleClient"
          value={clientPersonId}
          onChange={(e) => onChangeField('clientPersonId', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
        >
          <option value="">Selecione um cliente</option>
          {people
            .filter((person) => !person.isSelf)
            .map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
        </select>
        {clientError && (
          <div
            data-testid="sale-client-error"
            className="mt-1 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md"
          >
            <p className="text-sm text-red-600 dark:text-red-400">
              {clientError}
            </p>
          </div>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="saleOrderDate"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Data do Pedido
          </label>
          <input
            id="saleOrderDate"
            type="date"
            value={orderDate}
            onChange={(e) => onChangeField('orderDate', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
          />
        </div>
        <div>
          <label
            htmlFor="saleDeliveredAt"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Data de entrega
          </label>
          <input
            id="saleDeliveredAt"
            type="date"
            value={deliveredAt}
            onChange={(e) => onChangeField('deliveredAt', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
          />
        </div>
      </div>

      <div className="mb-4">
        <label
          htmlFor="saleDescription"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Descrição da Venda
        </label>
        <textarea
          id="saleDescription"
          value={description}
          onChange={(e) => onChangeField('description', e.target.value)}
          maxLength={500}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
          placeholder="Acrescente informações adicionais — forma de cobrança, prazos, etc."
        />
        <div className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
          {description.length}/500
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            Itens da Venda
          </span>
        </div>

        {items.map((item, index) => (
          <SaleItemFields
            key={item.id}
            item={item}
            index={index}
            error={itemErrors[item.id]}
            products={products}
            canRemove={items.length > 1}
            onUpdateField={(field, value) => onItemUpdate(index, field, value)}
            onProductSelect={(productId) =>
              onItemProductSelect(index, productId)
            }
            onRemove={() => onRemoveItem(index)}
          />
        ))}

        <button
          type="button"
          onClick={onAddItem}
          ref={addItemBtnRef}
          className="w-full px-3 py-2 mt-1 text-sm font-medium text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 rounded-md transition-colors flex items-center justify-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Adicionar Item
        </button>
      </div>

      <SaleTotals
        totalChargedCents={totalChargedCents}
        shippingValue={shippingValue}
        shippingValueError={shippingValueError}
        additionalValue={additionalValue}
        additionalValueError={additionalValueError}
        onChangeField={onChangeField}
      />

      <div className="flex items-center justify-end space-x-3 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-gradient-to-r from-primary-700 to-primary-500 hover:from-primary-800 hover:to-primary-600 text-white font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
        >
          {isEdit ? 'Atualizar' : 'Salvar'}
        </button>
      </div>
    </form>
  );
};

export default SaleForm;
