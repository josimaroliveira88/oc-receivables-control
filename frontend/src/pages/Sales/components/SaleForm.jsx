import React, { useEffect, useRef } from 'react';
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
  additionalExpenseCategoryId,
  additionalExpenseCategoryError,
  additionalExpenseDescription,
  additionalExpenseDescriptionError,
  expenseCategories,
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
  const formRef = useRef(null);

  // Bring the first invalid field into view on a failed submit. Covers every
  // error box in the form, including the additional-value expense fields, so
  // the user is never left at the bottom without seeing what must be filled.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const firstError = form.querySelector('[data-testid*="-error"]');
    if (firstError && typeof firstError.scrollIntoView === 'function') {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [
    clientError,
    shippingValueError,
    additionalValueError,
    additionalExpenseCategoryError,
    additionalExpenseDescriptionError,
    itemErrors,
  ]);

  const totalChargedCents = items.reduce(
    (total, item) => total + lineValueCents(item),
    0,
  );

  return (
    <form ref={formRef} onSubmit={onSubmit} className="px-6 py-4">
      <div className="mb-4">
        <label
          htmlFor="saleClient"
          className="block text-sm font-medium text-ink-soft mb-1"
        >
          Cliente
        </label>
        <select
          id="saleClient"
          value={clientPersonId}
          onChange={(e) => onChangeField('clientPersonId', e.target.value)}
          className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
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
            className="mt-1 p-2 bg-danger-soft rounded-md"
          >
            <p className="text-sm text-danger-fg">{clientError}</p>
          </div>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="saleOrderDate"
            className="block text-sm font-medium text-ink-soft mb-1"
          >
            Data do Pedido
          </label>
          <input
            id="saleOrderDate"
            type="date"
            value={orderDate}
            onChange={(e) => onChangeField('orderDate', e.target.value)}
            className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
          />
        </div>
        <div>
          <label
            htmlFor="saleDeliveredAt"
            className="block text-sm font-medium text-ink-soft mb-1"
          >
            Data de entrega
          </label>
          <input
            id="saleDeliveredAt"
            type="date"
            value={deliveredAt}
            onChange={(e) => onChangeField('deliveredAt', e.target.value)}
            className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
          />
        </div>
      </div>

      <div className="mb-4">
        <label
          htmlFor="saleDescription"
          className="block text-sm font-medium text-ink-soft mb-1"
        >
          Descrição da Venda
        </label>
        <textarea
          id="saleDescription"
          value={description}
          onChange={(e) => onChangeField('description', e.target.value)}
          maxLength={2000}
          rows={3}
          className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
          placeholder="Acrescente informações adicionais — forma de cobrança, prazos, etc."
        />
        <div className="mt-1 text-right text-xs text-ink-faint">
          {description.length}/2000
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium text-ink-soft">Itens da Venda</span>
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
          className="w-full px-3 py-2 mt-1 text-sm font-medium text-accent-on-soft hover:text-accent-on-soft bg-accent-soft hover:bg-accent-soft rounded-md transition-colors flex items-center justify-center gap-1"
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
        additionalExpenseCategoryId={additionalExpenseCategoryId}
        additionalExpenseCategoryError={additionalExpenseCategoryError}
        additionalExpenseDescription={additionalExpenseDescription}
        additionalExpenseDescriptionError={additionalExpenseDescriptionError}
        expenseCategories={expenseCategories}
        onChangeField={onChangeField}
      />

      <div className="flex items-center justify-end space-x-3 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
        >
          {isEdit ? 'Atualizar' : 'Salvar'}
        </button>
      </div>
    </form>
  );
};

export default SaleForm;
