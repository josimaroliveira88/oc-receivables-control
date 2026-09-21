import React from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import Modal from '../../../components/Modal';
import { fromCents, formatBRL } from '../../../utils/money';
import { formatDateBR } from '../../../utils/dates';
import { reconcileMatchLabel } from '../utils/creditCardHelpers';

const CreditCardReconcileModal = ({
  isOpen,
  onClose,
  onImportFile,
  statementLines = [],
  selections = {},
  error = '',
  submitting = false,
  committing = false,
  committedBatchId = null,
  committedCount = 0,
  onSelectionChange,
  onCommit,
  onUndo,
}) => {
  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onImportFile?.(file);
  };

  const hasSelection = statementLines.some((line) => selections[line.fitid]);

  return (
    <>
      {!isOpen && committedBatchId && (
        <div
          data-testid="credit-card-reconcile-banner"
          className="mb-4 flex flex-col items-start gap-3 rounded-md border border-success-soft bg-success-soft p-4"
        >
          <p className="inline-flex items-center gap-2 text-sm font-medium text-success-fg">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            {committedCount} parcela(s) conciliada(s) com sucesso.
          </p>
          <button
            type="button"
            data-testid="credit-card-reconcile-undo"
            onClick={onUndo}
            disabled={committing}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink hover:bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Desfazer último batch
          </button>
        </div>
      )}

      <Modal
        isOpen={isOpen}
        title="Importar extrato OFX"
        onClose={onClose}
        submitting={submitting || committing}
        maxWidth="max-w-3xl"
        testId="credit-card-reconcile-modal"
        closeAriaLabel="Fechar importação"
      >
        {(requestClose) => (
          <div className="px-6 py-4">
            {error && (
              <div
                data-testid="credit-card-reconcile-error"
                className="mb-4 rounded-md border border-danger-soft bg-danger-soft p-3"
              >
                <p className="text-sm font-medium text-danger-fg">{error}</p>
              </div>
            )}

            {submitting ? (
              <div className="flex items-center justify-center gap-2 py-8 text-ink-faint">
                <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-accent" />
                <span className="text-sm">Lendo extrato...</span>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label
                    htmlFor="creditCardOfxFile"
                    className="block text-sm font-medium text-ink-soft mb-1"
                  >
                    Arquivo OFX
                  </label>
                  <input
                    id="creditCardOfxFile"
                    type="file"
                    accept=".ofx,text/plain"
                    data-testid="credit-card-reconcile-file-input"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-ink-faint file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-accent-soft file:text-accent-on-soft"
                  />
                </div>

                {statementLines.length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink-faint">
                    Selecione o arquivo OFX exportado do Ourocard.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-line">
                    <table className="min-w-full text-sm">
                      <thead className="bg-base">
                        <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
                          <th className="px-3 py-2 font-medium">Data</th>
                          <th className="px-3 py-2 font-medium">Descrição</th>
                          <th className="px-3 py-2 font-medium">Valor</th>
                          <th className="px-3 py-2 font-medium">Parcela</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {statementLines.map((line) => (
                          <tr
                            key={line.fitid}
                            data-testid={`reconcile-line-${line.fitid}`}
                          >
                            <td className="px-3 py-2 whitespace-nowrap text-ink-soft">
                              {formatDateBR(line.date)}
                            </td>
                            <td className="px-3 py-2 text-ink">{line.memo}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-ink">
                              {formatBRL(fromCents(line.amountCents))}
                            </td>
                            <td className="px-3 py-2">
                              {line.matches && line.matches.length > 0 ? (
                                <select
                                  data-testid={`reconcile-select-${line.fitid}`}
                                  aria-label={`Conciliar ${line.memo}`}
                                  value={selections[line.fitid] ?? ''}
                                  onChange={(e) =>
                                    onSelectionChange?.(
                                      line.fitid,
                                      e.target.value,
                                    )
                                  }
                                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
                                >
                                  <option value="">Ignorar</option>
                                  {line.matches.map((match) => (
                                    <option key={match.id} value={match.id}>
                                      {reconcileMatchLabel(match)}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-sm text-ink-faint">
                                  Nenhuma parcela sugerida
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              {!submitting && statementLines.length > 0 && (
                <button
                  type="button"
                  data-testid="credit-card-reconcile-confirm"
                  onClick={onCommit}
                  disabled={committing || !hasSelection}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-on shadow-sm transition-all hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {committing ? 'Confirmando...' : 'Confirmar conciliação'}
                </button>
              )}
              <button
                type="button"
                onClick={requestClose}
                className="px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default CreditCardReconcileModal;
