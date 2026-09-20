import React from 'react';
import { Trash2 } from 'lucide-react';
import CurrencyInput from '../../../components/CurrencyInput';
import NumericInput from '../../../components/NumericInput';
import ProductCombobox from '../../../components/ProductCombobox';
import { formatBRL, fromCents } from '../../../utils/money';
import { isKitItem } from '../utils/orderHelpers';
import { formatMemberCents, formatPv } from '../utils/simulatorHelpers';
import { spreadsheetRowTotals } from '../utils/orderSpreadsheetHelpers';

const readOnlyCellClass = 'px-3 py-2 text-sm text-ink-soft whitespace-nowrap';
const compactSelectClass =
  'w-full px-2 py-1.5 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors text-sm';

// One line of the order-entry spreadsheet. It carries every field of the
// detailed item card: product, quantity, paid value (with its UNIT/TOTAL
// mode), cashback, member/PV columns, the stock flag (plus the KIT mode) and
// the item details.
const OrderSpreadsheetRow = ({
  row,
  index,
  products,
  error,
  isTeamOrder,
  onUpdateField,
  onRemove,
}) => {
  const totals = spreadsheetRowTotals(row, products);
  const isKit = isKitItem({ productId: row.productId }, products);

  return (
    <tr
      data-testid={`order-spreadsheet-row-${index}`}
      className="border-b border-line last:border-b-0 hover:bg-accent-soft transition-colors"
    >
      <td className="px-3 py-2 align-top min-w-[220px]">
        <ProductCombobox
          products={products}
          value={row.productId}
          onChange={(productId) =>
            onUpdateField(row.id, 'productId', productId)
          }
        />
        {error && (
          <p
            data-testid={`order-spreadsheet-error-${row.id}`}
            className="mt-1 text-xs text-danger-fg"
          >
            {error}
          </p>
        )}
      </td>
      <td className="px-3 py-2 align-top w-20">
        <NumericInput
          data-testid={`order-spreadsheet-quantity-${index}`}
          value={row.quantity}
          onChange={(e) => onUpdateField(row.id, 'quantity', e.target.value)}
          className="w-16 text-sm"
          placeholder="1"
        />
      </td>
      <td className="px-3 py-2 align-top w-20">
        <NumericInput
          data-testid={`order-spreadsheet-discount-${index}`}
          value={row.discountPercent}
          max={100}
          onChange={(e) =>
            onUpdateField(row.id, 'discountPercent', e.target.value)
          }
          className="w-16 text-sm"
          placeholder="0"
        />
      </td>
      <td className="px-3 py-2 align-top w-32">
        <CurrencyInput
          data-testid={`order-spreadsheet-charged-${index}`}
          value={row.chargedValue}
          onChange={(e) =>
            onUpdateField(row.id, 'chargedValue', e.target.value)
          }
          className="text-sm"
          placeholder="0,00"
        />
        <select
          data-testid={`order-spreadsheet-mode-${index}`}
          value={row.chargedValueMode}
          onChange={(e) =>
            onUpdateField(row.id, 'chargedValueMode', e.target.value)
          }
          aria-label={`Como o valor é cobrado na linha ${index + 1}`}
          className={`${compactSelectClass} mt-1`}
        >
          <option value="UNIT">Por unidade</option>
          <option value="TOTAL">Valor total</option>
        </select>
      </td>
      <td
        data-testid={`order-spreadsheet-charged-total-${index}`}
        className={`${readOnlyCellClass} font-medium text-ink`}
      >
        {formatBRL(fromCents(totals.chargedLineCents))}
      </td>
      <td className="px-3 py-2 align-top text-center">
        <input
          type="checkbox"
          data-testid={`order-spreadsheet-cashback-${index}`}
          checked={row.useCashback}
          onChange={(e) =>
            onUpdateField(row.id, 'useCashback', e.target.checked)
          }
          aria-label={`Usar cashback na linha ${index + 1}`}
          className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
        />
      </td>
      <td
        data-testid={`order-spreadsheet-member-unit-${index}`}
        className={readOnlyCellClass}
      >
        {formatMemberCents(totals.memberUnitCents)}
      </td>
      <td
        data-testid={`order-spreadsheet-member-total-${index}`}
        className={`${readOnlyCellClass} font-medium text-ink`}
      >
        {totals.memberUnitCents === null
          ? '—'
          : formatMemberCents(totals.memberTotalCents)}
      </td>
      <td
        data-testid={`order-spreadsheet-pv-total-${index}`}
        className={`${readOnlyCellClass} font-medium text-ink`}
      >
        {totals.hasProduct ? formatPv(totals.pvTotal) : '—'}
      </td>
      <td className="px-3 py-2 align-top w-40">
        {isTeamOrder ? (
          <span className="text-sm text-ink-faint">—</span>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-xs text-ink-soft cursor-pointer">
              <input
                type="checkbox"
                data-testid={`order-spreadsheet-stock-${index}`}
                checked={row.forStock}
                onChange={(e) =>
                  onUpdateField(row.id, 'forStock', e.target.checked)
                }
                className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
              />
              Estocar
            </label>
            {isKit && row.forStock && (
              <select
                data-testid={`order-spreadsheet-kit-mode-${index}`}
                value={row.kitStockMode}
                onChange={(e) =>
                  onUpdateField(row.id, 'kitStockMode', e.target.value)
                }
                aria-label={`Como enviar o kit para o estoque na linha ${index + 1}`}
                className={compactSelectClass}
              >
                <option value="">Selecione</option>
                <option value="KIT">Estocar o kit</option>
                <option value="COMPONENTS">Estocar componentes</option>
              </select>
            )}
          </div>
        )}
      </td>
      <td className="px-3 py-2 align-top min-w-[150px]">
        <input
          type="text"
          data-testid={`order-spreadsheet-details-${index}`}
          value={row.details}
          maxLength={500}
          onChange={(e) => onUpdateField(row.id, 'details', e.target.value)}
          placeholder="Detalhes do item"
          className="w-full px-2 py-1.5 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors text-sm"
        />
      </td>
      <td className="px-3 py-2 align-top text-right">
        <button
          type="button"
          onClick={() => onRemove(row.id)}
          data-testid={`order-spreadsheet-remove-${index}`}
          aria-label={`Remover linha ${index + 1}`}
          className="inline-flex items-center justify-center p-1.5 text-danger-fg hover:bg-danger-soft rounded-md transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
};

export default OrderSpreadsheetRow;
