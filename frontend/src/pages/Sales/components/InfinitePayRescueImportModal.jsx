import React from 'react';
import { CheckCircle2, RotateCcw, Upload } from 'lucide-react';
import Modal from '../../../components/Modal';
import InfinitePayRescueRow from './InfinitePayRescueRow';
import { isRescueBalanced } from '../utils/infinitepayRescueHelpers';

const BUTTON_GHOST =
  'px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors';

const InfinitePayRescueImportModal = ({
  isOpen,
  rescues = [],
  candidateSales = [],
  assignments = {},
  expandedLine = null,
  error = '',
  submitting = false,
  committing = false,
  committedBatchId = null,
  committedCount = 0,
  onClose,
  onToggleRow,
  onAssignMatch,
  onAssignFromDeposit,
  onToggleSale,
  onSetAssignmentAmount,
  onRemoveAssignment,
  onCommit,
  onUndo,
  onRequestFile,
}) => {
  const readyCount = rescues.filter((rescue) =>
    isRescueBalanced(assignments[rescue.line], rescue.amountCents),
  ).length;

  return (
    <Modal
      isOpen={isOpen}
      title="Importação de resgates InfinitePay"
      onClose={onClose}
      submitting={submitting || committing}
      maxWidth="max-w-5xl"
      testId="infinitepay-rescue-import-modal"
      closeAriaLabel="Fechar importação de resgates"
    >
      {(requestClose) => (
        <div className="px-6 py-4">
          {error && (
            <div
              data-testid="infinitepay-rescue-import-error"
              className="mb-4 rounded-md border border-danger-soft bg-danger-soft p-3"
            >
              <p className="text-sm font-medium text-danger-fg">{error}</p>
            </div>
          )}

          {submitting && (
            <div className="flex items-center justify-center gap-2 py-8 text-ink-faint">
              <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-accent" />
              <span className="text-sm">Processando extrato...</span>
            </div>
          )}

          {!submitting && committedBatchId && (
            <div
              data-testid="infinitepay-rescue-import-success"
              className="flex flex-col items-start gap-3 rounded-md border border-success-soft bg-success-soft p-4"
            >
              <p className="inline-flex items-center gap-2 text-sm font-medium text-success-fg">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                {committedCount} resgate(s) registrado(s) com sucesso.
              </p>
              <button
                type="button"
                data-testid="infinitepay-rescue-undo"
                onClick={onUndo}
                disabled={committing}
                className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink hover:bg-elevated disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Desfazer importação
              </button>
            </div>
          )}

          {!submitting && !committedBatchId && (
            <>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink-soft">
                  <strong className="text-ink">{rescues.length}</strong>{' '}
                  resgate(s) encontrado(s)
                  {readyCount > 0 && (
                    <> · {readyCount} pronto(s) para confirmar</>
                  )}
                </p>
                {onRequestFile && (
                  <button
                    type="button"
                    onClick={onRequestFile}
                    className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-accent hover:text-accent-hover"
                  >
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    Selecionar outro arquivo
                  </button>
                )}
              </div>

              {rescues.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-faint">
                  Nenhum resgate encontrado no extrato.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-line">
                  <table className="min-w-full text-sm">
                    <thead className="bg-base">
                      <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
                        <th className="px-3 py-2 font-medium">Data</th>
                        <th className="px-3 py-2 font-medium">Valor</th>
                        <th className="px-3 py-2 font-medium">Depósitos</th>
                        <th className="px-3 py-2 font-medium">Vendas</th>
                        <th className="px-3 py-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {rescues.map((rescue) => (
                        <InfinitePayRescueRow
                          key={rescue.line}
                          rescue={rescue}
                          candidateSales={candidateSales}
                          assignments={assignments[rescue.line] ?? []}
                          expanded={expandedLine === rescue.line}
                          onToggle={onToggleRow}
                          onAssignMatch={onAssignMatch}
                          onAssignFromDeposit={onAssignFromDeposit}
                          onToggleSale={onToggleSale}
                          onSetAssignmentAmount={onSetAssignmentAmount}
                          onRemoveAssignment={onRemoveAssignment}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <div className="mt-6 flex items-center justify-end space-x-3">
            {!submitting && !committedBatchId && (
              <button
                type="button"
                data-testid="infinitepay-rescue-confirm"
                onClick={onCommit}
                disabled={committing || readyCount === 0}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-on shadow-sm transition-all hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirmar importação
              </button>
            )}
            <button
              type="button"
              onClick={requestClose}
              className={BUTTON_GHOST}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default InfinitePayRescueImportModal;
