import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Pencil, Trash } from 'lucide-react';
import { formatBRL, toCents } from '../../../utils/money';
import { formatDateBR } from '../../../utils/dates';
import ActionMenu from '../../../components/ActionMenu';
import {
  TYPE_BADGE_CLASSES,
  formatSignedBRL,
  originLabel,
  transactionTypeLabel,
} from '../utils/financeHelpers';

// Automatic rows link back to the record that produced them. Sales and
// InfinitePay redemptions deep-link to the sale; dōTERRA orders go to the
// orders list (no edit deep-link for purchases).
const originLink = (transaction) => {
  if (!transaction.orderId) return null;
  if (
    transaction.origin === 'VENDA' ||
    transaction.origin === 'RESGATE_INFINITEPAY'
  ) {
    return `/sales?editSale=${transaction.orderId}`;
  }
  if (transaction.origin === 'PEDIDO_DOTERRA') return '/orders';
  return null;
};

const FinancesTable = ({
  transactions,
  hasActiveFilters,
  onEdit,
  onDelete,
}) => {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-ink-faint">
          {hasActiveFilters
            ? 'Nenhum lançamento encontrado para os filtros aplicados.'
            : 'Nenhum lançamento cadastrado'}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <table className="w-full text-sm text-left block lg:table lg:table-fixed">
        <thead className="hidden lg:table-header-group bg-base">
          <tr>
            <th
              scope="col"
              className="w-[10%] px-6 py-3 text-left text-xs font-medium text-ink-faint"
            >
              Data
            </th>
            <th
              scope="col"
              className="w-[24%] px-6 py-3 text-left text-xs font-medium text-ink-faint"
            >
              Descrição
            </th>
            <th
              scope="col"
              className="w-[13%] px-6 py-3 text-left text-xs font-medium text-ink-faint"
            >
              Categoria
            </th>
            <th
              scope="col"
              className="w-[12%] px-6 py-3 text-left text-xs font-medium text-ink-faint"
            >
              Origem
            </th>
            <th
              scope="col"
              className="w-[10%] px-6 py-3 text-left text-xs font-medium text-ink-faint"
            >
              Tipo
            </th>
            <th
              scope="col"
              className="w-[11%] px-6 py-3 text-right text-xs font-medium text-ink-faint"
            >
              Valor
            </th>
            <th
              scope="col"
              className="w-[10%] px-6 py-3 text-right text-xs font-medium text-ink-faint"
            >
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="block lg:table-row-group bg-surface lg:divide-y divide-line">
          {transactions.map((transaction) => {
            const link = originLink(transaction);
            const isManual = transaction.origin === 'MANUAL';
            const feeCents = transaction.feeAmount
              ? toCents(parseFloat(transaction.feeAmount))
              : 0;

            return (
              <tr
                key={transaction.id}
                className="block lg:table-row border border-line lg:border-0 rounded-lg lg:rounded-none shadow-sm lg:shadow-none mb-3 lg:mb-0 hover:bg-accent-soft transition-colors"
              >
                <td
                  data-label="Data"
                  className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-ink before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
                >
                  {formatDateBR(transaction.transactionDate)}
                </td>
                <td
                  data-label="Descrição"
                  className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
                >
                  <span
                    title={transaction.description}
                    className="block text-sm text-ink truncate"
                  >
                    {transaction.description}
                  </span>
                  {feeCents > 0 && (
                    <span
                      data-testid={`transaction-fee-${transaction.id}`}
                      className="block text-xs text-warning-fg mt-0.5"
                    >
                      Taxa do gateway: {formatBRL(feeCents / 100)}
                    </span>
                  )}
                  {transaction.notes && (
                    <span
                      title={transaction.notes}
                      className="block text-xs text-ink-faint mt-0.5 truncate"
                    >
                      {transaction.notes}
                    </span>
                  )}
                </td>
                <td
                  data-label="Categoria"
                  className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 text-sm text-ink before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
                >
                  {transaction.category ? (
                    transaction.category.name
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </td>
                <td
                  data-label="Origem"
                  className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-ink-soft before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
                >
                  {link ? (
                    <Link
                      to={link}
                      data-testid={`transaction-link-${transaction.id}`}
                      className="inline-flex items-center gap-1 text-accent hover:underline"
                    >
                      {originLabel(transaction.origin)}
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </Link>
                  ) : (
                    originLabel(transaction.origin)
                  )}
                </td>
                <td
                  data-label="Tipo"
                  className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
                >
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      TYPE_BADGE_CLASSES[transaction.type] || ''
                    }`}
                  >
                    {transactionTypeLabel(transaction.type)}
                  </span>
                </td>
                <td
                  data-label="Valor"
                  className={`block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm font-medium lg:text-right before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden ${
                    transaction.type === 'RECEITA'
                      ? 'text-success-fg'
                      : 'text-danger-fg'
                  }`}
                >
                  {formatSignedBRL(transaction.amount, transaction.type)}
                </td>
                <td
                  data-label="Ações"
                  className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 text-left lg:text-right text-sm font-medium before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
                >
                  {isManual ? (
                    <div className="flex justify-end">
                      <ActionMenu
                        actions={[
                          {
                            label: 'Editar',
                            icon: Pencil,
                            onClick: () => onEdit(transaction),
                          },
                          {
                            label: 'Excluir',
                            icon: Trash,
                            onClick: () => onDelete(transaction.id),
                            variant: 'danger',
                          },
                        ]}
                        ariaLabel="Ações do lançamento"
                        testIdPrefix={`transaction-actions-${transaction.id}`}
                      />
                    </div>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default FinancesTable;
