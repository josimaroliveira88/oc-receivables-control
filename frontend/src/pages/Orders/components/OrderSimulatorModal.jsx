import React from 'react';
import { Plus } from 'lucide-react';
import Modal from '../../../components/Modal';
import CurrencyInput from '../../../components/CurrencyInput';
import { formatBRL, fromCents } from '../../../utils/money';
import OrderSimulatorRow from './OrderSimulatorRow';
import {
  formatMemberCents,
  formatPv,
  shippingCentsFromValue,
  totalsFor,
} from '../utils/simulatorHelpers';

const headerCellClass =
  'px-3 py-2 text-xs font-semibold text-ink-soft uppercase tracking-wide whitespace-nowrap text-left';

// Read-only spreadsheet used to estimate PV and member value for a hypothetical
// order. It receives the already-loaded product catalog and keeps every value in
// local state — nothing is sent to the API.
const OrderSimulatorModal = ({
  isOpen,
  rows,
  products,
  shippingValue,
  onClose,
  onAddRow,
  onUpdateField,
  onRemoveRow,
  onChangeShipping,
  onClearAll,
}) => {
  const totals = totalsFor(rows, products);
  const orderTotalCents =
    totals.totalMemberCents + shippingCentsFromValue(shippingValue);

  return (
    <Modal
      isOpen={isOpen}
      title="Simulador de Pedido"
      onClose={onClose}
      maxWidth="max-w-5xl"
      testId="simulator-modal"
      closeAriaLabel="Fechar simulador"
    >
      {(requestClose) => (
        <div className="px-6 py-4">
          <p className="mb-4 text-sm text-ink-faint">
            Adicione produtos e quantidades para simular o PV e o Valor Membro.
            Esta simulação não é salva.
          </p>

          <div className="mb-3">
            <button
              type="button"
              onClick={onAddRow}
              data-testid="simulator-add-row"
              className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-accent-on-soft bg-accent-soft hover:bg-accent-soft/80 rounded-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar linha
            </button>
          </div>

          {rows.length === 0 ? (
            <div
              data-testid="simulator-empty"
              className="border border-dashed border-line rounded-md py-8 text-center text-sm text-ink-faint"
            >
              Nenhuma linha adicionada. Clique em “Adicionar linha” para
              começar.
            </div>
          ) : (
            <div className="border border-line rounded-md">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-base border-b border-line">
                  <tr>
                    <th className={headerCellClass}>Produto</th>
                    <th className={headerCellClass}>Qtd</th>
                    <th className={headerCellClass}>% Promo</th>
                    <th className={headerCellClass}>PV unit.</th>
                    <th className={headerCellClass}>PV total</th>
                    <th className={headerCellClass}>V. Membro unit.</th>
                    <th className={headerCellClass}>V. Membro total</th>
                    <th className={headerCellClass} aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <OrderSimulatorRow
                      key={row.id}
                      row={row}
                      index={index}
                      products={products}
                      onUpdateField={onUpdateField}
                      onRemove={onRemoveRow}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <div className="bg-base rounded-md p-3">
              <div className="text-xs text-ink-faint">Soma dos PV</div>
              <div
                data-testid="simulator-total-pv"
                className="text-lg font-medium text-ink"
              >
                {formatPv(totals.totalPv)}
              </div>
            </div>
            <div className="bg-base rounded-md p-3">
              <div className="text-xs text-ink-faint">Soma do Valor Membro</div>
              <div
                data-testid="simulator-total-member"
                className="text-lg font-medium text-ink"
              >
                {formatMemberCents(totals.totalMemberCents)}
              </div>
            </div>
            <div className="bg-base rounded-md p-3">
              <label
                htmlFor="simulator-shipping"
                className="block text-xs text-ink-faint"
              >
                Frete (R$)
              </label>
              <CurrencyInput
                id="simulator-shipping"
                data-testid="simulator-shipping"
                value={shippingValue}
                onChange={(e) => onChangeShipping(e.target.value)}
                className="mt-1 text-sm"
              />
            </div>
            <div className="bg-base rounded-md p-3">
              <div className="text-xs text-ink-faint">
                Valor Total do Pedido
              </div>
              <div
                data-testid="simulator-order-total"
                className="text-lg font-medium text-ink"
              >
                {formatBRL(fromCents(orderTotalCents))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6">
            <button
              type="button"
              onClick={onClearAll}
              disabled={rows.length === 0}
              data-testid="simulator-clear"
              className="px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={requestClose}
              data-testid="simulator-close"
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default OrderSimulatorModal;
