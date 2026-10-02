import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { formatSignedBRL, originLabel } from '../utils/financeHelpers';
import { formatDateBR } from '../../../utils/dates';

// Ledger rows derived from one order (purchase or sale), rendered inside the
// order/sale details modal as a read-only cross-reference. A single row links
// straight to its read-only detail; several rows link to the filtered ledger.
const OrderLedgerSection = ({
  orderId,
  transactions = [],
  loading = false,
  error = '',
}) => {
  const count = transactions.length;
  const only = count === 1 ? transactions[0] : null;
  const linkTo = only
    ? `/finances?orderId=${orderId}&transactionId=${only.id}`
    : `/finances?orderId=${orderId}`;

  return (
    <div data-testid="details-ledger" className="mt-4">
      <h4 className="mb-2 text-sm font-medium text-ink-soft">
        Lançamentos no financeiro
      </h4>

      {loading ? (
        <div className="flex items-center justify-center py-4 text-sm text-ink-faint">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent mr-2" />
          Carregando lançamentos...
        </div>
      ) : error ? (
        <p
          data-testid="details-ledger-error"
          className="text-sm text-danger-fg"
        >
          Não foi possível carregar os lançamentos.
        </p>
      ) : count === 0 ? (
        <p
          data-testid="details-ledger-empty"
          className="text-sm text-ink-faint"
        >
          Nenhum lançamento no financeiro
        </p>
      ) : (
        <>
          <div className="rounded-md border border-line divide-y divide-line overflow-hidden">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                data-testid={`details-ledger-row-${transaction.id}`}
                className="px-3 py-2 bg-surface"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-ink">
                    {transaction.description}
                  </span>
                  <span
                    className={`text-sm font-semibold whitespace-nowrap ${
                      transaction.type === 'DESPESA'
                        ? 'text-danger-fg'
                        : 'text-success-fg'
                    }`}
                  >
                    {formatSignedBRL(transaction.amount, transaction.type)}
                  </span>
                </div>
                <p className="text-xs text-ink-faint mt-0.5">
                  {formatDateBR(transaction.transactionDate)} ·{' '}
                  {originLabel(transaction.origin)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-3 flex justify-end">
            <Link
              to={linkTo}
              data-testid="details-ledger-action"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-accent hover:text-accent-hover transition-colors"
            >
              {only
                ? 'Ver lançamento no financeiro'
                : `Ver ${count} lançamentos no financeiro`}
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
};

export default OrderLedgerSection;
