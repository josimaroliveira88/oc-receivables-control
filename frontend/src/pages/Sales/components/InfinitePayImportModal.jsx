import React from 'react';
import { Check, Upload } from 'lucide-react';
import Modal from '../../../components/Modal';
import { INFINITEPAY_MATCH_CLASSES } from '../../../utils/badgeStyles';
import {
  formatStatementCents,
  matchTypeLabel,
} from '../utils/infinitepayHelpers';

const BUTTON_GHOST =
  'px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors';

const InfinitePayImportModal = ({
  isOpen,
  rows = [],
  ignoredCount = 0,
  error = '',
  submitting = false,
  selecting = false,
  usedLines = new Set(),
  expandedLine = null,
  onClose,
  onToggleRow,
  onSelectSale,
  onRequestFile,
}) => (
  <Modal
    isOpen={isOpen}
    title="Importação InfinitePay"
    onClose={onClose}
    submitting={submitting}
    maxWidth="max-w-4xl"
    testId="infinitepay-import-modal"
    closeAriaLabel="Fechar importação"
  >
    {(requestClose) => (
      <div className="px-6 py-4">
        {error && (
          <div
            data-testid="infinitepay-import-error"
            className="mb-4 rounded-md border border-danger-soft bg-danger-soft p-3"
          >
            <p className="text-sm font-medium text-danger-fg">{error}</p>
            <p className="mt-1 text-xs text-danger-fg">
              O arquivo não foi importado. Verifique o extrato do InfinitePay e
              tente novamente com outro arquivo.
            </p>
          </div>
        )}

        {submitting && (
          <div className="flex items-center justify-center gap-2 py-8 text-ink-faint">
            <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-accent" />
            <span className="text-sm">Processando arquivo...</span>
          </div>
        )}

        {!submitting && !error && (
          <>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink-soft">
                <strong className="text-ink">{rows.length}</strong>{' '}
                lançamento(s) aprovado(s)
                {ignoredCount > 0 && (
                  <>
                    {' · '}
                    <span data-testid="infinitepay-import-ignored">
                      {ignoredCount} ignorado(s) por status Negada
                    </span>
                  </>
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

            {rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-faint">
                Nenhum lançamento aprovado encontrado no arquivo.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-line">
                <table className="min-w-full text-sm">
                  <thead className="bg-base">
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
                      <th className="px-3 py-2 font-medium">Data</th>
                      <th className="px-3 py-2 font-medium">Valor</th>
                      <th className="px-3 py-2 font-medium">Líquido</th>
                      <th className="px-3 py-2 font-medium">Taxa</th>
                      <th className="px-3 py-2 font-medium">Origem - Nome</th>
                      <th className="px-3 py-2 font-medium">
                        Vendas sugeridas
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((row) => {
                      const used = usedLines.has(row.line);
                      const expanded = expandedLine === row.line;
                      const matches = row.matches || [];

                      return (
                        <React.Fragment key={row.line}>
                          <tr
                            data-testid={`infinitepay-row-${row.line}`}
                            className={used ? 'opacity-60' : undefined}
                          >
                            <td className="whitespace-nowrap px-3 py-2 text-ink">
                              {row.date}
                              {row.time ? ` ${row.time}` : ''}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 font-medium text-ink">
                              {formatStatementCents(row.valorCents)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-ink-soft">
                              {formatStatementCents(row.liquidoCents)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-ink-soft">
                              {formatStatementCents(Math.abs(row.taxaCents))}
                            </td>
                            <td className="px-3 py-2 text-ink">
                              {row.origemNome || '—'}
                            </td>
                            <td className="px-3 py-2">
                              {used ? (
                                <span className="inline-flex items-center gap-1 text-sm font-medium text-success-fg">
                                  <Check
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  Usada
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onToggleRow(row.line)}
                                  disabled={matches.length === 0}
                                  className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {matches.length === 0
                                    ? 'Sem venda'
                                    : `${matches.length} venda(s)`}
                                </button>
                              )}
                            </td>
                          </tr>

                          {expanded && !used && (
                            <tr>
                              <td
                                colSpan={6}
                                className="bg-base px-3 py-3"
                                data-testid={`infinitepay-matches-${row.line}`}
                              >
                                {matches.length === 0 ? (
                                  <p className="text-sm text-ink-faint">
                                    Nenhuma venda com valor compatível.
                                  </p>
                                ) : (
                                  <ul className="space-y-2">
                                    {matches.map((match) => (
                                      <li
                                        key={match.saleId}
                                        className="flex flex-col gap-2 rounded-md border border-line bg-surface px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                                      >
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-medium text-ink">
                                            {match.orderNumber} ·{' '}
                                            {match.clientName || '—'}
                                          </p>
                                          <p className="text-xs text-ink-faint">
                                            Total{' '}
                                            {formatStatementCents(
                                              match.totalCents,
                                            )}{' '}
                                            · Pendente{' '}
                                            {formatStatementCents(
                                              match.pendingCents,
                                            )}
                                          </p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                          <span
                                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                              INFINITEPAY_MATCH_CLASSES[
                                                match.matchType
                                              ] ||
                                              INFINITEPAY_MATCH_CLASSES.gross
                                            }`}
                                          >
                                            {matchTypeLabel(match.matchType)}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              onSelectSale(row, match)
                                            }
                                            disabled={selecting}
                                            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-on shadow-sm transition-all hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                                          >
                                            Usar esta venda
                                          </button>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <div className="mt-6 flex items-center justify-end space-x-3">
          <button type="button" onClick={requestClose} className={BUTTON_GHOST}>
            Fechar
          </button>
        </div>
      </div>
    )}
  </Modal>
);

export default InfinitePayImportModal;
