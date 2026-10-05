import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import Modal from '../../../components/Modal';
import { formatBRL } from '../../../utils/money';
import { formatDateBR } from '../../../utils/dates';
import { EFFECTIVENESS_CLASSES } from '../../../utils/badgeStyles';
import { PaymentTypeBadge } from '../../Orders/components/Badges';
import { formatInstallmentBadge } from '../../CreditCards/utils/creditCardHelpers';
import {
  formatSignedBRL,
  originLabel,
  transactionTypeLabel,
  TYPE_BADGE_CLASSES,
} from '../utils/financeHelpers';

// Read-only view of one ledger row. Automatic rows (order/sale derived) are
// owned by their source and cannot be edited, so they get this display-only
// modal instead of the create/edit form.
const FinancialTransactionDetailsModal = ({
  transaction,
  onClose = () => {},
}) => {
  if (!transaction) return null;

  const hasInstallment =
    transaction.installmentNumber && transaction.installmentsTotal;
  const feeAmount = transaction.feeAmount
    ? parseFloat(transaction.feeAmount)
    : null;
  const effectiveness = transaction.isEffective ? 'Efetiva' : 'Pendente';

  return (
    <Modal
      isOpen
      title="Detalhamento do lançamento"
      onClose={onClose}
      testId="transaction-details-modal"
      closeAriaLabel="Fechar detalhamento"
    >
      {(requestClose) => (
        <div className="px-6 py-4">
          <div className="mb-4 rounded-md border border-line bg-base p-3">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <dt className="text-xs text-ink-faint">Descrição</dt>
                <dd
                  data-testid="transaction-details-description"
                  className="text-sm font-medium text-ink"
                >
                  {transaction.description || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Valor</dt>
                <dd
                  data-testid="transaction-details-amount"
                  className="text-sm font-semibold text-ink"
                >
                  {formatSignedBRL(transaction.amount, transaction.type)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Data</dt>
                <dd
                  data-testid="transaction-details-date"
                  className="text-sm font-medium text-ink"
                >
                  {formatDateBR(transaction.transactionDate)}
                </dd>
              </div>
              {transaction.ride?.requestedAt && (
                <div>
                  <dt className="text-xs text-ink-faint">Data da corrida</dt>
                  <dd
                    data-testid="transaction-details-ride-date"
                    className="text-sm font-medium text-ink"
                  >
                    {formatDateBR(transaction.ride.requestedAt)}
                  </dd>
                </div>
              )}
              {transaction.effectiveDate && (
                <div>
                  <dt className="text-xs text-ink-faint">Data da fatura</dt>
                  <dd
                    data-testid="transaction-details-effective-date"
                    className="text-sm font-medium text-ink"
                  >
                    {formatDateBR(transaction.effectiveDate)}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-ink-faint">Tipo</dt>
                <dd data-testid="transaction-details-type">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      TYPE_BADGE_CLASSES[transaction.type] || ''
                    }`}
                  >
                    {transactionTypeLabel(transaction.type)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Origem</dt>
                <dd
                  data-testid="transaction-details-origin"
                  className="text-sm font-medium text-ink-soft"
                >
                  {originLabel(transaction.origin)}
                </dd>
              </div>
              {transaction.origin === 'UBER' && transaction.orderId && (
                <div>
                  <dt className="text-xs text-ink-faint">Venda</dt>
                  <dd data-testid="transaction-details-sale">
                    <Link
                      to={`/sales?detailsSale=${transaction.orderId}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                    >
                      Ver venda
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </Link>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-ink-faint">Categoria</dt>
                <dd
                  data-testid="transaction-details-category"
                  className="text-sm font-medium text-ink"
                >
                  {transaction.category?.name || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Situação</dt>
                <dd data-testid="transaction-details-effectiveness">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      EFFECTIVENESS_CLASSES[effectiveness] || ''
                    }`}
                  >
                    {effectiveness}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Pagamento</dt>
                <dd data-testid="transaction-details-payment-type">
                  {transaction.paymentType ? (
                    <PaymentTypeBadge type={transaction.paymentType} />
                  ) : (
                    <span className="text-sm text-ink-faint">—</span>
                  )}
                </dd>
              </div>
              {feeAmount != null && feeAmount > 0 && (
                <div>
                  <dt className="text-xs text-ink-faint">Taxa do gateway</dt>
                  <dd
                    data-testid="transaction-details-fee"
                    className="text-sm font-medium text-warning-fg"
                  >
                    {formatBRL(feeAmount)}
                  </dd>
                </div>
              )}
              {hasInstallment && (
                <div>
                  <dt className="text-xs text-ink-faint">Parcelamento</dt>
                  <dd
                    data-testid="transaction-details-installment"
                    className="text-sm font-medium text-ink"
                  >
                    {formatInstallmentBadge(
                      transaction.installmentNumber,
                      transaction.installmentsTotal,
                    )}
                  </dd>
                </div>
              )}
              <div className="sm:col-span-2">
                <dt className="text-xs text-ink-faint">Observações</dt>
                <dd
                  data-testid="transaction-details-notes"
                  className="text-sm font-medium text-ink"
                >
                  {transaction.notes || '—'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-4 flex justify-end">
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
  );
};

export default FinancialTransactionDetailsModal;
