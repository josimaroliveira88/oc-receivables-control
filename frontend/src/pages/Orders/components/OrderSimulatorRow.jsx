import React from 'react';
import { Trash2 } from 'lucide-react';
import ProductCombobox from '../../../components/ProductCombobox';
import {
  formatMemberCents,
  formatPv,
  rowTotals,
} from '../utils/simulatorHelpers';

const readOnlyCellClass = 'px-3 py-2 text-sm text-ink-soft whitespace-nowrap';

// One spreadsheet-like line of the order simulator: product, quantity and the
// derived PV/member columns. The values are never edited directly, so the row
// simply receives the current row object and reports field changes upward.
const OrderSimulatorRow = ({
  row,
  index,
  products,
  onUpdateField,
  onRemove,
}) => {
  const totals = rowTotals(row, products);

  return (
    <tr
      data-testid={`simulator-row-${index}`}
      className="border-b border-line last:border-b-0 hover:bg-accent-soft transition-colors"
    >
      <td className="px-3 py-2 align-middle min-w-[260px]">
        <ProductCombobox
          products={products}
          value={row.productId}
          onChange={(productId) =>
            onUpdateField(row.id, 'productId', productId)
          }
        />
      </td>
      <td className="px-3 py-2 align-middle w-24">
        <input
          type="number"
          min="1"
          step="1"
          data-testid={`simulator-quantity-${index}`}
          value={row.quantity}
          onChange={(e) => onUpdateField(row.id, 'quantity', e.target.value)}
          className="w-20 px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors text-sm"
          placeholder="1"
        />
      </td>
      <td
        data-testid={`simulator-pv-unit-${index}`}
        className={readOnlyCellClass}
      >
        {totals.hasProduct ? formatPv(totals.pvUnit) : '—'}
      </td>
      <td
        data-testid={`simulator-pv-total-${index}`}
        className={`${readOnlyCellClass} font-medium text-ink`}
      >
        {totals.hasProduct ? formatPv(totals.pvTotal) : '—'}
      </td>
      <td
        data-testid={`simulator-member-unit-${index}`}
        className={readOnlyCellClass}
      >
        {formatMemberCents(totals.memberUnitCents)}
      </td>
      <td
        data-testid={`simulator-member-total-${index}`}
        className={`${readOnlyCellClass} font-medium text-ink`}
      >
        {totals.memberUnitCents === null
          ? '—'
          : formatMemberCents(totals.memberTotalCents)}
      </td>
      <td className="px-3 py-2 align-middle text-right">
        <button
          type="button"
          onClick={() => onRemove(row.id)}
          data-testid={`simulator-remove-${index}`}
          aria-label={`Remover linha ${index + 1}`}
          className="inline-flex items-center justify-center p-1.5 text-danger-fg hover:bg-danger-soft rounded-md transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
};

export default OrderSimulatorRow;
