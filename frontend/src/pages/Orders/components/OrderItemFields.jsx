import React from 'react';
import { Plus } from 'lucide-react';
import { formatBRL } from '../../../utils/money';
import ProductCombobox from '../../../components/ProductCombobox';

const OrderItemFields = ({
  item,
  index,
  people,
  products,
  canRemove,
  onUpdateField,
  onProductSelect,
  onRemove,
}) => {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-md p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
          Item {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 text-sm transition-colors"
          >
            Remover
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Pessoa
          </label>
          <select
            value={item.personId}
            onChange={(e) => onUpdateField('personId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm"
          >
            <option value="">Selecione uma pessoa</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Produto
          </label>
          <ProductCombobox
            products={products}
            value={item.productId}
            selectedName={item.productName}
            selectedCode={item.productCode}
            onChange={onProductSelect}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Valor Membro (R$)
          </label>
          <input
            type="text"
            value={
              item.memberPrice !== ''
                ? formatBRL(parseFloat(item.memberPrice) || 0)
                : ''
            }
            readOnly
            tabIndex={-1}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md shadow-sm cursor-not-allowed text-sm"
            placeholder="—"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Valor Cobrado (R$)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={item.chargedValue}
            onChange={(e) => onUpdateField('chargedValue', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            PV
          </label>
          <input
            type="text"
            value={item.pv !== '' ? parseFloat(item.pv) : ''}
            readOnly
            tabIndex={-1}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md shadow-sm cursor-not-allowed text-sm"
            placeholder="—"
          />
        </div>

        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Detalhes do Item
          </label>
          <textarea
            value={item.details}
            onChange={(e) => onUpdateField('details', e.target.value)}
            maxLength={500}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm"
            placeholder="Adicione detalhes do item (até 500 caracteres)"
          />
          <div className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
            {item.details.length}/500
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderItemFields;
