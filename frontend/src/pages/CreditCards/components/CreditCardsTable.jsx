import React from 'react';
import { Pencil, Trash } from 'lucide-react';
import { fromCents, formatBRL } from '../../../utils/money';
import { formatDateBR } from '../../../utils/dates';
import ActionMenu from '../../../components/ActionMenu';
import { CREDIT_CARD_BILL_STATUS_CLASSES } from '../../../utils/badgeStyles';
import { formatBillStatus } from '../utils/creditCardHelpers';

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
            ? 'Nenhuma fatura encontrada para os filtros aplicados.'
            : 'Nenhuma fatura cadastrada'}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-base">
          <tr>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium text-ink-faint"
            >
              Descrição
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium text-ink-faint"
            >
              Parcelas
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium text-ink-faint"
            >
              Primeira parcela
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right text-xs font-medium text-ink-faint"
            >
              Total
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium text-ink-faint"
            >
              Status
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right text-xs font-medium text-ink-faint"
            >
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="bg-surface divide-y divide-line">
          {bills.map((bill) => {
            const status = formatBillStatus(bill);
            const paid = (bill.transactions || []).filter(
              (transaction) => transaction.isEffective,
            ).length;

            return (
              <tr
                key={bill.id}
                className="hover:bg-accent-soft transition-colors"
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onOpen(bill)}
                    className="text-left font-medium text-accent hover:underline"
                  >
                    {bill.description}
                  </button>
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {`Parcelas ${paid}/${bill.installments} pagas`}
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {formatDateBR(bill.firstInstallmentAt)}
                </td>
                <td
                  data-testid={`bill-total-${bill.id}`}
                  className="px-4 py-3 text-right font-medium text-ink"
                >
                  {formatBRL(fromCents(bill.totalCents))}
                </td>
                <td className="px-4 py-3">
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
                <td className="px-4 py-3 text-right">
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
                      ariaLabel="Ações da fatura"
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
