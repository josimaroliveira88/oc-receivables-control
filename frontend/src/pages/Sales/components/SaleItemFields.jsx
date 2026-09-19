import React from 'react';
import { formatBRL, fromCents } from '../../../utils/money';
import CurrencyInput from '../../../components/CurrencyInput';
import ProductCombobox from '../../../components/ProductCombobox';
import {
  memberLineTotal,
  memberCashbackLineTotal,
  lineValueCents,
} from '../utils/saleHelpers';

const SaleItemFields = ({
  item,
  index,
  error,
  products,
  canRemove,
  onUpdateField,
  onProductSelect,
  onRemove,
}) => {
  return (
    <div
      data-testid={`sale-item-${index}`}
      className={`border rounded-md p-4 mb-3 ${
        error ? 'border-danger-fg' : 'border-line'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-ink-soft">
          Item {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-danger-fg text-sm transition-colors"
          >
            Remover
          </button>
        )}
      </div>
      {error && (
        <div
          data-testid={`sale-item-error-${item.id}`}
          className="mb-3 p-2 bg-danger-soft rounded-md"
        >
          <p className="text-sm text-danger-fg">{error}</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-ink-faint mb-1">
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
          <label className="block text-xs font-medium text-ink-faint mb-1">
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
            className="w-full px-3 py-2 border border-line bg-base text-ink-soft rounded-md shadow-sm cursor-not-allowed text-sm"
            placeholder="—"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-faint mb-1">
            Valor Cobrado (R$)
          </label>
          <CurrencyInput
            value={item.chargedValue}
            onChange={(e) => onUpdateField('chargedValue', e.target.value)}
            className="text-sm"
            placeholder="0,00"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-faint mb-1">
            Quantidade
          </label>
          <input
            type="number"
            min="1"
            step="1"
            data-testid={`sale-item-quantity-${index}`}
            value={item.quantity}
            onChange={(e) => onUpdateField('quantity', e.target.value)}
            className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors text-sm"
            placeholder="1"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-faint mb-1">
            Valor Cobrado (total)
          </label>
          <input
            type="text"
            value={formatBRL(fromCents(lineValueCents(item)))}
            readOnly
            tabIndex={-1}
            className="w-full px-3 py-2 border border-line bg-base text-ink-soft rounded-md shadow-sm cursor-not-allowed text-sm"
            placeholder="—"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-faint mb-1">
            Valor Membro (total)
          </label>
          <input
            type="text"
            value={
              item.memberPrice !== '' ? formatBRL(memberLineTotal(item)) : ''
            }
            readOnly
            tabIndex={-1}
            className="w-full px-3 py-2 border border-line bg-base text-ink-soft rounded-md shadow-sm cursor-not-allowed text-sm"
            placeholder="—"
          />
        </div>

        {item.useCashback && (
          <div>
            <label className="block text-xs font-medium text-ink-faint mb-1">
              Valor 70%
            </label>
            <input
              type="text"
              data-testid={`sale-item-cashback-total-${index}`}
              value={
                item.memberPrice !== ''
                  ? formatBRL(memberCashbackLineTotal(item))
                  : ''
              }
              readOnly
              tabIndex={-1}
              className="w-full px-3 py-2 border border-line bg-base text-ink-soft rounded-md shadow-sm cursor-not-allowed text-sm"
              placeholder="—"
            />
          </div>
        )}

        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-ink-faint mb-1">
            O valor cobrado é
          </label>
          <select
            data-testid={`sale-item-price-mode-${index}`}
            value={item.chargedValueMode}
            onChange={(e) => onUpdateField('chargedValueMode', e.target.value)}
            className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors text-sm"
          >
            <option value="UNIT">Preço por unidade</option>
            <option value="TOTAL">Valor total da linha</option>
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="flex items-start gap-2 text-sm text-ink-soft cursor-pointer">
            <input
              type="checkbox"
              data-testid={`sale-item-cashback-${index}`}
              checked={item.useCashback}
              onChange={(e) => onUpdateField('useCashback', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-line text-accent focus:ring-accent"
            />
            <span>
              O produto teve origem no cashback de 70%
              <span className="block text-xs text-ink-faint">
                Marca: exibe o valor de membro com 70% de desconto. O valor
                cobrado continua editável.
              </span>
            </span>
          </label>
        </div>

        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-ink-faint mb-1">
            Detalhes do Item
          </label>
          <textarea
            value={item.details}
            onChange={(e) => onUpdateField('details', e.target.value)}
            maxLength={500}
            rows={2}
            className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors text-sm"
            placeholder="Adicione detalhes do item (até 500 caracteres)"
          />
          <div className="mt-1 text-right text-xs text-ink-faint">
            {item.details.length}/500
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaleItemFields;
