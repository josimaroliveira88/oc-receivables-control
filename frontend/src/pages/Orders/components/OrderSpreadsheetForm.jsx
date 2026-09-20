import React from 'react';
import { Plus } from 'lucide-react';
import OrderDetailsFields from './OrderDetailsFields';
import OrderEntryModeSelector from './OrderEntryModeSelector';
import OrderSpreadsheetRow from './OrderSpreadsheetRow';
import OrderTotals from './OrderTotals';
import { formatMemberCents, formatPv } from '../utils/simulatorHelpers';
import { spreadsheetTotals } from '../utils/orderSpreadsheetHelpers';

const headerCellClass =
  'px-3 py-2 text-xs font-semibold text-ink-soft uppercase tracking-wide whitespace-nowrap text-left';

// Spreadsheet entry mode: the same order-level fields as the detailed form,
// followed by a simulator-style table. Rows are the order items; the charged
// value is derived from the catalog member price after the promotion.
const OrderSpreadsheetForm = ({
  orderNumber,
  orderNumberBlurred,
  orderNumberError,
  accountOwner,
  isTeamOrder,
  teamPersonId,
  teamPersonIdError,
  usesOrderLevelClient,
  people,
  orderDate,
  paymentType,
  doterraPv,
  doterraPvError,
  attachmentFile,
  attachmentRemoved,
  hasExistingAttachment,
  orderNotes,
  isEdit,
  products,
  rows,
  rowErrors,
  rowsError,
  shippingValue,
  shippingValueError,
  entryMode,
  onEntryModeChange,
  onChangeField,
  onTeamPersonSelect,
  onAddRow,
  onRemoveRow,
  onUpdateRow,
  onClearRows,
  onSubmit,
  onCancel,
}) => {
  const totals = spreadsheetTotals(rows, products);
  const hasRows = rows.length > 0;

  return (
    <form onSubmit={onSubmit} className="px-6 py-4">
      <OrderEntryModeSelector
        value={entryMode}
        onChange={onEntryModeChange}
        isEdit={isEdit}
      />

      <OrderDetailsFields
        orderNumber={orderNumber}
        orderNumberBlurred={orderNumberBlurred}
        orderNumberError={orderNumberError}
        accountOwner={accountOwner}
        isTeamOrder={isTeamOrder}
        teamPersonId={teamPersonId}
        teamPersonIdError={teamPersonIdError}
        usesOrderLevelClient={usesOrderLevelClient}
        people={people}
        orderDate={orderDate}
        paymentType={paymentType}
        doterraPv={doterraPv}
        doterraPvError={doterraPvError}
        attachmentFile={attachmentFile}
        attachmentRemoved={attachmentRemoved}
        hasExistingAttachment={hasExistingAttachment}
        orderNotes={orderNotes}
        isEdit={isEdit}
        onChangeField={onChangeField}
        onTeamPersonSelect={onTeamPersonSelect}
      />

      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium text-ink-soft">Itens do Pedido</span>
          <button
            type="button"
            onClick={onClearRows}
            disabled={!hasRows}
            data-testid="order-spreadsheet-clear"
            className="text-sm font-medium text-ink-soft hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Limpar
          </button>
        </div>

        {rowsError && (
          <div
            data-testid="order-spreadsheet-error"
            className="mb-3 p-2 bg-danger-soft rounded-md"
          >
            <p className="text-sm text-danger-fg">{rowsError}</p>
          </div>
        )}

        {!hasRows ? (
          <div
            data-testid="order-spreadsheet-empty"
            className="border border-dashed border-line rounded-md py-8 text-center text-sm text-ink-faint"
          >
            Nenhuma linha adicionada. Clique em “Adicionar linha” para começar.
          </div>
        ) : (
          <div className="border border-line rounded-md overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead className="bg-base border-b border-line">
                <tr>
                  <th className={headerCellClass}>Produto</th>
                  <th className={headerCellClass}>Qtd</th>
                  <th className={headerCellClass}>% Promo</th>
                  <th className={headerCellClass}>Valor Pago</th>
                  <th className={headerCellClass}>V. Pago total</th>
                  <th className={headerCellClass}>V. Membro unit.</th>
                  <th className={headerCellClass}>V. Membro total</th>
                  <th className={headerCellClass}>PV total</th>
                  <th className={headerCellClass}>Estoque</th>
                  <th className={headerCellClass}>Detalhes</th>
                  <th className={headerCellClass} aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <OrderSpreadsheetRow
                    key={row.id}
                    row={row}
                    index={index}
                    products={products}
                    error={rowErrors[row.id]}
                    isTeamOrder={isTeamOrder}
                    onUpdateField={onUpdateRow}
                    onRemove={onRemoveRow}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button
          type="button"
          onClick={onAddRow}
          data-testid="order-spreadsheet-add-row"
          className="w-full px-3 py-2 mt-3 text-sm font-medium text-accent-on-soft hover:text-accent-on-soft bg-accent-soft hover:bg-accent-soft rounded-md transition-colors flex items-center justify-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Adicionar linha
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="bg-base rounded-md p-3">
          <div className="text-xs text-ink-faint">Soma dos PV</div>
          <div
            data-testid="order-spreadsheet-total-pv"
            className="text-lg font-medium text-ink"
          >
            {formatPv(totals.totalPv)}
          </div>
        </div>
        <div className="bg-base rounded-md p-3">
          <div className="text-xs text-ink-faint">Soma do Valor Membro</div>
          <div
            data-testid="order-spreadsheet-total-member"
            className="text-lg font-medium text-ink"
          >
            {formatMemberCents(totals.totalMemberCents)}
          </div>
        </div>
      </div>

      <OrderTotals
        totalChargedCents={totals.totalChargedCents}
        shippingValue={shippingValue}
        shippingValueError={shippingValueError}
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

export default OrderSpreadsheetForm;
