import React from 'react';
import { Pencil, Trash } from 'lucide-react';
import Modal from '../../../components/Modal';
import { fromCents, formatBRL } from '../../../utils/money';
import { formatDateBR } from '../../../utils/dates';
import { INSTALLMENT_STATUS_CLASSES } from '../../../utils/badgeStyles';

const CreditCardBillDetail = ({
  bill,
  onClose,
  onPay,
  onUnpay,
  onEdit,
  onDelete,
}) => (
  <Modal
    isOpen={Boolean(bill)}
    title={bill ? bill.description : ''}
    onClose={onClose}
    maxWidth="max-w-2xl"
    testId="bill-detail-modal"
    closeAriaLabel="Fechar compra"
  >
    {() => (
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-ink-soft">
            {`${bill.installments} parcela(s)`}
          </span>
          <span className="text-lg font-semibold text-ink">
            {formatBRL(fromCents(bill.totalCents))}
          </span>
        </div>

        <ul className="divide-y divide-line border border-line rounded-md">
          {bill.transactions.map((transaction) => {
            const isEffective = transaction.isEffective;
            const status = isEffective ? 'Paga' : 'Pendente';
            return (
              <li
                key={transaction.id}
                data-testid={`installment-${transaction.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {`Parcela ${transaction.installmentNumber}/${transaction.installmentsTotal}`}
                  </p>
                  <p className="text-xs text-ink-faint">
                    {formatDateBR(
                      transaction.effectiveDate || transaction.transactionDate,
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-ink">
                    {formatBRL(parseFloat(transaction.amount))}
                  </span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      INSTALLMENT_STATUS_CLASSES[status]
                    }`}
                  >
                    {status}
                  </span>
                  {isEffective ? (
                    <button
                      type="button"
                      data-testid={`installment-unpay-${transaction.id}`}
                      onClick={() => onUnpay(bill, transaction)}
                      className="px-3 py-1 text-xs font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors"
                    >
                      Desfazer
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-testid={`installment-pay-${transaction.id}`}
                      onClick={() => onPay(bill, transaction)}
                      className="px-3 py-1 text-xs font-medium text-accent-on bg-accent hover:bg-accent-hover rounded-md transition-colors"
                    >
                      Marcar como paga
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => onDelete(bill.id)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-danger-fg hover:bg-danger-soft rounded-md transition-colors"
          >
            <Trash className="w-4 h-4" aria-hidden="true" />
            Excluir
          </button>
          <button
            type="button"
            onClick={() => onEdit(bill)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors"
          >
            <Pencil className="w-4 h-4" aria-hidden="true" />
            Editar
          </button>
        </div>
      </div>
    )}
  </Modal>
);

export default CreditCardBillDetail;
