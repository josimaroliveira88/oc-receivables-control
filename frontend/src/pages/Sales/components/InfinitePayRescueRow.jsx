import React from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import CurrencyInput from '../../../components/CurrencyInput';
import { fromCents, toCents } from '../../../utils/money';
import {
  RESCUE_BALANCE_CLASSES,
  RESCUE_MATCH_CLASSES,
} from '../../../utils/badgeStyles';
import {
  assignmentTotalCents,
  formatRescueCents,
  isRescueBalanced,
  rescueMatchLabel,
} from '../utils/infinitepayRescueHelpers';

const balanceClass = (assignments, amountCents) => {
  if (!assignments || assignments.length === 0) {
    return RESCUE_BALANCE_CLASSES.empty;
  }
  return isRescueBalanced(assignments, amountCents)
    ? RESCUE_BALANCE_CLASSES.balanced
    : RESCUE_BALANCE_CLASSES.unbalanced;
};

const MatchButton = ({ match, testId, onAssignMatch }) => (
  <button
    type="button"
    data-testid={testId}
    onClick={() => onAssignMatch(match)}
    className="flex w-full flex-col gap-1 rounded-md border border-line bg-surface px-3 py-2 text-left transition-colors hover:bg-accent-soft sm:flex-row sm:items-center sm:justify-between"
  >
    <span className="min-w-0">
      <span className="block truncate text-sm font-medium text-ink">
        {match.orderNumber} · {match.clientName || '—'}
      </span>
      <span className="block text-xs text-ink-faint">
        {formatRescueCents(match.matchedCents)}
      </span>
    </span>
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
        RESCUE_MATCH_CLASSES[match.matchType] || RESCUE_MATCH_CLASSES.rescuable
      }`}
    >
      {rescueMatchLabel(match.matchType)}
    </span>
  </button>
);

const InfinitePayRescueRow = ({
  rescue,
  candidateSales = [],
  assignments = [],
  expanded = false,
  onToggle,
  onAssignMatch,
  onAssignFromDeposit,
  onToggleSale,
  onSetAssignmentAmount,
  onRemoveAssignment,
}) => {
  const totalCents = assignmentTotalCents(assignments);
  const balanced = isRescueBalanced(assignments, rescue.amountCents);
  const selectedIds = new Set(assignments.map((a) => a.orderId));

  return (
    <React.Fragment>
      <tr data-testid={`rescue-row-${rescue.line}`}>
        <td className="whitespace-nowrap px-3 py-2 text-ink">
          {rescue.date}
          {rescue.time ? ` ${rescue.time}` : ''}
        </td>
        <td className="whitespace-nowrap px-3 py-2 font-medium text-ink">
          {formatRescueCents(rescue.amountCents)}
        </td>
        <td className="px-3 py-2 text-ink-soft">
          {rescue.sourceDeposits?.length > 0
            ? `${rescue.sourceDeposits.length} depósito(s)`
            : rescue.paired
              ? 'Pareado'
              : 'Sem depósito'}
        </td>
        <td className="px-3 py-2">
          <span
            data-testid={`rescue-balance-${rescue.line}`}
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${balanceClass(
              assignments,
              rescue.amountCents,
            )}`}
          >
            {balanced
              ? `${assignments.length} venda(s) · conciliado`
              : `${assignments.length} venda(s) · ${formatRescueCents(totalCents)}`}
          </span>
        </td>
        <td className="px-3 py-2 text-right">
          <button
            type="button"
            data-testid={`rescue-expand-${rescue.line}`}
            onClick={() => onToggle(rescue.line)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-accent-soft"
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Vendas
          </button>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td
            colSpan={5}
            data-testid={`rescue-details-${rescue.line}`}
            className="bg-base px-3 py-4"
          >
            {rescue.matches?.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  Vendas sugeridas pelo valor
                </p>
                <ul className="space-y-2">
                  {rescue.matches.map((match) => (
                    <li key={match.saleId}>
                      <MatchButton
                        match={match}
                        testId={`rescue-match-${rescue.line}-${match.saleId}`}
                        onAssignMatch={(chosen) =>
                          onAssignMatch(rescue.line, chosen)
                        }
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {rescue.sourceDeposits?.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  Depósitos de origem
                </p>
                <ul className="space-y-3">
                  {rescue.sourceDeposits.map((deposit, index) => (
                    <li key={`${rescue.line}-deposit-${index}`}>
                      <p className="mb-1 text-sm text-ink-soft">
                        {formatRescueCents(deposit.amountCents)}
                        {deposit.name ? ` · ${deposit.name}` : ''}
                      </p>
                      {deposit.matches?.length > 0 ? (
                        <ul className="space-y-2">
                          {deposit.matches.map((match) => (
                            <li key={match.saleId}>
                              <MatchButton
                                match={match}
                                testId={`rescue-deposit-${rescue.line}-${index}-${match.saleId}`}
                                onAssignMatch={(chosen) =>
                                  onAssignFromDeposit(rescue.line, {
                                    depositKey: `${rescue.line}-${index}`,
                                    orderId: chosen.saleId,
                                    amountCents: deposit.amountCents,
                                  })
                                }
                              />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-ink-faint">
                          Nenhuma venda com valor compatível.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mb-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Selecionar vendas
              </p>
              {candidateSales.length === 0 ? (
                <p className="text-sm text-ink-faint">
                  Nenhuma venda com pagamento InfinitePay disponível.
                </p>
              ) : (
                <ul className="max-h-60 space-y-2 overflow-y-auto">
                  {candidateSales.map((sale) => {
                    const selected = selectedIds.has(sale.saleId);
                    return (
                      <li
                        key={sale.saleId}
                        className="flex flex-col gap-2 rounded-md border border-line bg-surface px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <label className="flex min-w-0 items-center gap-2 text-sm text-ink">
                          <input
                            type="checkbox"
                            data-testid={`rescue-sale-${rescue.line}-${sale.saleId}`}
                            checked={selected}
                            onChange={() => onToggleSale(rescue.line, sale)}
                            className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {sale.orderNumber} · {sale.clientName || '—'}
                            </span>
                            <span className="block text-xs text-ink-faint">
                              Disponível{' '}
                              {formatRescueCents(sale.rescuableCents)}
                            </span>
                          </span>
                        </label>
                        {selected && (
                          <div className="w-full sm:w-32">
                            <CurrencyInput
                              value={fromCents(
                                assignments.find(
                                  (a) => a.orderId === sale.saleId,
                                )?.amountCents ?? 0,
                              ).toFixed(2)}
                              data-testid={`rescue-amount-${rescue.line}-${sale.saleId}`}
                              onChange={(event) =>
                                onSetAssignmentAmount(
                                  rescue.line,
                                  sale.saleId,
                                  toCents(
                                    parseFloat(event.target.value || '0'),
                                  ),
                                )
                              }
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div
                data-testid={`rescue-total-${rescue.line}`}
                className="text-sm text-ink-soft"
              >
                Selecionado: <strong>{formatRescueCents(totalCents)}</strong> de{' '}
                <strong>{formatRescueCents(rescue.amountCents)}</strong>
                {balanced && (
                  <span className="ml-2 inline-flex items-center gap-1 font-medium text-success-fg">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Conciliado
                  </span>
                )}
              </div>
              {assignments.length > 0 && (
                <button
                  type="button"
                  data-testid={`rescue-clear-${rescue.line}`}
                  onClick={() =>
                    assignments.forEach((assignment) =>
                      onRemoveAssignment(rescue.line, assignment.orderId),
                    )
                  }
                  className="self-start text-sm font-medium text-ink-soft hover:text-ink"
                >
                  Limpar seleção
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
};

export default InfinitePayRescueRow;
