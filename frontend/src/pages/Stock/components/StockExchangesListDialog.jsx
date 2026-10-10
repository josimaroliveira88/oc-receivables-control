import React, { useState } from 'react';
import { ArrowLeftRight, Trash2 } from 'lucide-react';
import Modal from '../../../components/Modal';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { formatBRL, fromCents } from '../../../utils/money';
import { formatDateBR } from '../../../utils/dates';
import { formatExchangeRow } from '../utils/stockExchangeHelpers';

// One side of a row: "<n> un. · R$ x,xx" (or a dash when the side is empty).
const sideSummary = (summary) => {
  if (summary.itemCount === 0) return '—';
  return `${summary.itemCount} un. · ${formatBRL(fromCents(summary.totalCents))}`;
};

// Read-only list of the user's product swaps. Each row opens the detail; the
// trash icon deletes straight from the list, always behind a confirmation.
const StockExchangesListDialog = ({
  isOpen,
  exchanges = [],
  loading = false,
  deleting = false,
  onOpenDetail,
  onDelete,
  onCreateNew,
  onClose,
}) => {
  const [confirmId, setConfirmId] = useState(null);
  const confirmRow = exchanges.find((exchange) => exchange.id === confirmId);

  const handleConfirm = async () => {
    if (!confirmId) return;
    await onDelete(confirmId);
    setConfirmId(null);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        title="Trocas de produtos"
        onClose={onClose}
        maxWidth="max-w-3xl"
        testId="stock-exchanges-list-dialog"
        closeAriaLabel="Fechar"
      >
        <div className="px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
              <span className="ml-2 text-ink-faint">Carregando trocas...</span>
            </div>
          ) : exchanges.length === 0 ? (
            <div className="text-center py-12">
              <ArrowLeftRight
                className="w-10 h-10 mx-auto text-ink-faint"
                aria-hidden="true"
              />
              <p className="mt-3 text-ink-faint">
                Nenhuma troca registrada ainda.
              </p>
              <button
                type="button"
                onClick={onCreateNew}
                className="mt-4 px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
              >
                Registrar troca
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-line border border-line rounded-md">
              {exchanges.map((exchange) => {
                const row = formatExchangeRow(exchange);
                return (
                  <li key={exchange.id} className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => onOpenDetail(exchange.id)}
                      data-testid={`stock-exchange-row-${exchange.id}`}
                      className="flex-1 min-w-0 text-left px-4 py-3 hover:bg-elevated transition-colors rounded-l-md"
                    >
                      <p className="text-sm font-medium text-ink">
                        {row.personName}
                      </p>
                      <p className="text-xs text-ink-faint">
                        {formatDateBR(row.effectiveDate)} · Sai:{' '}
                        {sideSummary(row.outgoingSummary)} · Entra:{' '}
                        {sideSummary(row.incomingSummary)}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(exchange.id)}
                      aria-label={`Excluir troca de ${row.personName}`}
                      data-testid={`stock-exchange-delete-${exchange.id}`}
                      className="px-4 text-danger-fg hover:bg-danger-soft transition-colors rounded-r-md"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-6 py-4 border-t border-line flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors"
          >
            Fechar
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmId)}
        title="Excluir troca"
        message={
          confirmRow
            ? `Excluir a troca com ${
                formatExchangeRow(confirmRow).personName
              }? O estoque dos produtos envolvidos será revertido automaticamente.`
            : 'O estoque dos produtos envolvidos será revertido automaticamente.'
        }
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        loading={deleting}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmId(null)}
      />
    </>
  );
};

export default StockExchangesListDialog;
