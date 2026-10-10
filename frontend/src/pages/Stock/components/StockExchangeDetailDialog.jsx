import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import Modal from '../../../components/Modal';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { formatBRL, fromCents } from '../../../utils/money';
import { formatDateBR } from '../../../utils/dates';
import { summarizeExchangeLines } from '../utils/stockExchangeHelpers';

const LineTable = ({ title, lines, emptyLabel }) => {
  const summary = summarizeExchangeLines(lines);
  return (
    <section>
      <h4 className="text-sm font-semibold text-ink mb-2">{title}</h4>
      {lines.length === 0 ? (
        <p className="text-sm text-ink-faint px-3 py-2 border border-dashed border-line rounded-md">
          {emptyLabel}
        </p>
      ) : (
        <table className="w-full text-sm text-left">
          <thead className="bg-base text-xs text-ink-faint">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Produto
              </th>
              <th scope="col" className="px-3 py-2 font-medium text-right">
                Qtd
              </th>
              <th scope="col" className="px-3 py-2 font-medium text-right">
                Valor
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lines.map((line) => (
              <tr key={line.id}>
                <td className="px-3 py-2">
                  <p className="text-ink">
                    {line.product?.name || line.product?.code || '—'}
                  </p>
                  <p className="text-xs text-ink-faint">
                    {line.product?.code}
                    {line.product?.size ? ` · ${line.product.size}` : ''}
                  </p>
                </td>
                <td className="px-3 py-2 text-right text-ink">
                  {line.quantity}
                </td>
                <td className="px-3 py-2 text-right text-ink">
                  {line.unitValueCents !== null &&
                  line.unitValueCents !== undefined
                    ? formatBRL(fromCents(line.unitValueCents))
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-xs text-ink-faint mt-1">
        {summary.itemCount} un. · {formatBRL(fromCents(summary.totalCents))}
      </p>
    </section>
  );
};

// Read-only view of one swap, with both sides and a destructive delete that
// routes through a confirmation.
const StockExchangeDetailDialog = ({
  isOpen,
  exchange,
  loading = false,
  deleting = false,
  onDelete,
  onClose,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleConfirmDelete = async () => {
    if (!exchange) return;
    await onDelete(exchange.id);
    setConfirmDelete(false);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        title="Detalhe da troca"
        onClose={onClose}
        maxWidth="max-w-3xl"
        testId="stock-exchange-detail-dialog"
        closeAriaLabel="Fechar"
      >
        <div className="px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
              <span className="ml-2 text-ink-faint">Carregando troca...</span>
            </div>
          ) : exchange ? (
            <>
              <div className="mb-5">
                <p className="text-sm font-medium text-ink">
                  {exchange.person?.name}
                </p>
                <p className="text-xs text-ink-faint">
                  {formatDateBR(exchange.effectiveDate)}
                </p>
                {exchange.observation && (
                  <p className="text-sm text-ink-soft mt-2">
                    {exchange.observation}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <LineTable
                  title="Produtos que saíram"
                  lines={exchange.outgoingLines || []}
                  emptyLabel="Nenhum produto saiu."
                />
                <LineTable
                  title="Produtos que entraram"
                  lines={exchange.incomingLines || []}
                  emptyLabel="Nenhum produto entrou."
                />
              </div>
            </>
          ) : null}
        </div>

        {!loading && exchange && (
          <div className="px-6 py-4 border-t border-line flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              data-testid="stock-exchange-detail-delete"
              className="inline-flex items-center gap-2 px-4 py-2 bg-danger-soft text-danger-fg font-medium rounded-md transition-colors"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              Excluir troca
            </button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir troca"
        message="Excluir esta troca? O estoque dos produtos envolvidos será revertido automaticamente."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
};

export default StockExchangeDetailDialog;
