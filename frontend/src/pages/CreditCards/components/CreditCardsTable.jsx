import React from 'react';
import { Pencil, Trash } from 'lucide-react';
import { fromCents, formatBRL } from '../../../utils/money';
import { formatDateBR } from '../../../utils/dates';
import ActionMenu from '../../../components/ActionMenu';
import { CREDIT_CARD_BILL_STATUS_CLASSES } from '../../../utils/badgeStyles';
import { formatBillStatus } from '../utils/creditCardHelpers';

const cellLabel =
  'before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden';

const CreditCardsTable = ({
  bills,
  hasActiveFilters,
  onOpen,
  onEdit,
  onDelete,
}) => {
  if (bills.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-ink-faint">
          {hasActiveFilters
            ? 'Nenhuma compra encontrada para os filtros aplicados.'
            : 'Nenhuma compra cadastrada'}
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
              className="w-[28%] px-4 py-3 text-left text-xs font-medium text-ink-faint"
            >
              Descrição
            </th>
            <th
              scope="col"
              className="w-[14%] px-4 py-3 text-left text-xs font-medium text-ink-faint"
            >
              Parcelas
            </th>
            <th
              scope="col"
              className="w-[14%] px-4 py-3 text-left text-xs font-medium text-ink-faint"
            >
              Primeira parcela
            </th>
            <th
              scope="col"
              className="w-[14%] px-4 py-3 text-right text-xs font-medium text-ink-faint"
            >
              Total
            </th>
            <th
              scope="col"
              className="w-[12%] px-4 py-3 text-left text-xs font-medium text-ink-faint"
            >
              Status
            </th>
            <th
              scope="col"
              className="w-[18%] px-4 py-3 text-right text-xs font-medium text-ink-faint"
            >
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="block lg:table-row-group bg-surface lg:divide-y divide-line">
          {bills.map((bill) => {
            const status = formatBillStatus(bill);
            const paid = (bill.transactions || []).filter(
              (transaction) => transaction.isEffective,
            ).length;

            return (
              <tr
                key={bill.id}
                className="block lg:table-row border border-line lg:border-0 rounded-lg lg:rounded-none shadow-sm lg:shadow-none mb-3 lg:mb-0 hover:bg-accent-soft transition-colors"
              >
                <td
                  data-label="Descrição"
                  className={`block lg:table-cell px-3 lg:px-4 py-2 lg:py-4 lg:min-w-0 break-words text-sm text-ink ${cellLabel}`}
                >
                  <button
                    type="button"
                    onClick={() => onOpen(bill)}
                    className="text-left font-medium text-accent hover:underline"
                  >
                    {bill.description}
                  </button>
                </td>
                <td
                  data-label="Parcelas"
                  className={`block lg:table-cell px-3 lg:px-4 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-ink-soft ${cellLabel}`}
                >
                  {`Parcelas ${paid}/${bill.installments} pagas`}
                </td>
                <td
                  data-label="Primeira parcela"
                  className={`block lg:table-cell px-3 lg:px-4 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-ink-soft ${cellLabel}`}
                >
                  {formatDateBR(bill.firstInstallmentAt)}
                </td>
                <td
                  data-label="Total"
                  data-testid={`bill-total-${bill.id}`}
                  className={`block lg:table-cell px-3 lg:px-4 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-left lg:text-right font-medium text-ink ${cellLabel}`}
                >
                  {formatBRL(fromCents(bill.totalCents))}
                </td>
                <td
                  data-label="Status"
                  className={`block lg:table-cell px-3 lg:px-4 py-2 lg:py-4 lg:whitespace-nowrap ${cellLabel}`}
                >
                  <span
                    data-testid={`bill-status-${bill.id}`}
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      CREDIT_CARD_BILL_STATUS_CLASSES[status] ||
                      'bg-base text-ink-soft'
                    }`}
                  >
                    {status}
                  </span>
                </td>
                <td
                  data-label="Ações"
                  className={`block lg:table-cell px-3 lg:px-4 py-2 lg:py-4 lg:min-w-0 text-left lg:text-right text-sm font-medium ${cellLabel}`}
                >
                  <div className="flex justify-end">
                    <ActionMenu
                      actions={[
                        {
                          label: 'Editar',
                          icon: Pencil,
                          onClick: () => onEdit(bill),
                        },
                        {
                          label: 'Excluir',
                          icon: Trash,
                          onClick: () => onDelete(bill.id),
                          variant: 'danger',
                        },
                      ]}
                      ariaLabel="Ações da compra"
                      testIdPrefix={`bill-actions-${bill.id}`}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default CreditCardsTable;
