import React from 'react';
import { Plus } from 'lucide-react';
import { formatBRL, fromCents } from '../../../utils/money';
import ProductCombobox from '../../../components/ProductCombobox';
import {
  SELF_PERSON_ID,
  findSelfPerson,
  personSelectLabel,
  isItemForSelf,
  isKitItem,
  memberLineTotal,
  lineValueCents,
} from '../utils/orderHelpers';

const OrderItemFields = ({
  item,
  index,
  error,
  people,
  products,
  canRemove,
  onUpdateField,
  onPersonSelect,
  onProductSelect,
  onRemove,
  isTeamOrder = false,
}) => {
  const selfPerson = findSelfPerson(people);
  const isSelfItem = isItemForSelf(item, people);
  const isKit = isKitItem(item, products);

  return (
    <div
      data-testid={`order-item-${index}`}
      className={`border rounded-md p-4 mb-3 ${
        error
          ? 'border-red-400 dark:border-red-500'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
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
      {error && (
        <div
          data-testid={`order-item-error-${item.id}`}
          className="mb-3 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md"
        >
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Pessoa
          </label>
          <select
            value={item.personId}
            onChange={(e) => onPersonSelect(index, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm"
          >
            <option value="">Selecione uma pessoa</option>
            <option value={selfPerson ? selfPerson.id : SELF_PERSON_ID}>
              {selfPerson ? personSelectLabel(selfPerson) : 'Eu (você)'}
            </option>
            {people
              .filter((person) => !person.isSelf)
              .map((person) => (
                <option key={person.id} value={person.id}>
                  {personSelectLabel(person)}
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
            Valor Membro (unidade)
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
            Quantidade
          </label>
          <input
            type="number"
            min="1"
            step="1"
            data-testid={`order-item-quantity-${index}`}
            value={item.quantity}
            onChange={(e) => onUpdateField('quantity', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm"
            placeholder="1"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Valor Cobrado (total)
          </label>
          <input
            type="text"
            value={formatBRL(fromCents(lineValueCents(item)))}
            readOnly
            tabIndex={-1}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md shadow-sm cursor-not-allowed text-sm"
            placeholder="—"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Valor Membro (total)
          </label>
          <input
            type="text"
            value={
              item.memberPrice !== '' ? formatBRL(memberLineTotal(item)) : ''
            }
            readOnly
            tabIndex={-1}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md shadow-sm cursor-not-allowed text-sm"
            placeholder="—"
          />
        </div>

        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            O valor cobrado é
          </label>
          <select
            data-testid={`order-item-price-mode-${index}`}
            value={item.chargedValueMode}
            onChange={(e) => onUpdateField('chargedValueMode', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm"
          >
            <option value="UNIT">Preço por unidade</option>
            <option value="TOTAL">Valor total da linha</option>
          </select>
        </div>

        {isSelfItem && !isTeamOrder && (
          <div className="md:col-span-3">
            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                data-testid={`order-item-stock-toggle-${index}`}
                checked={item.forStock}
                onChange={(e) => {
                  onUpdateField('forStock', e.target.checked);
                  if (!e.target.checked) onUpdateField('kitStockMode', '');
                }}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span>
                Este item é para meu estoque
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  Adiciona ao seu estoque; não gera cobrança pendente.
                </span>
              </span>
            </label>
          </div>
        )}

        {isSelfItem && !isTeamOrder && item.forStock && isKit && (
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Como enviar para o estoque?
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="radio"
                  name={`order-item-kit-mode-${index}`}
                  data-testid={`order-item-kit-mode-kit-${index}`}
                  checked={item.kitStockMode === 'KIT'}
                  onChange={() => onUpdateField('kitStockMode', 'KIT')}
                  className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Estocar o kit
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="radio"
                  name={`order-item-kit-mode-${index}`}
                  data-testid={`order-item-kit-mode-components-${index}`}
                  checked={item.kitStockMode === 'COMPONENTS'}
                  onChange={() => onUpdateField('kitStockMode', 'COMPONENTS')}
                  className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Estocar os componentes do kit
              </label>
            </div>
          </div>
        )}

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
