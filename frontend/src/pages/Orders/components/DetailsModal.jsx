import React from 'react';
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { formatBRL, toCents, fromCents } from '../../../utils/money';
import { formatDateBR } from '../../../utils/dates';
import { getOrderPendingCents } from '../utils/receivablesHelpers';
import { lineValueCents } from '../utils/orderHelpers';
import { PaymentTypeBadge } from './Badges';
import Modal from '../../../components/Modal';

const DetailsModal = ({
  order,
  balances,
  loading,
  expandedPersonId,
  onClose,
  onTogglePerson,
  personItems,
  personPayments,
  onEditPayment,
}) => {
  return (
    <Modal
      title={`Detalhamento — ${order.orderNumber}`}
      onClose={onClose}
      testId="details-modal"
      closeAriaLabel="Fechar detalhamento"
    >
      {(requestClose) => (
        <div className="px-6 py-4">
          <div className="mb-4 rounded-md border border-line bg-base p-3">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <dt className="text-xs text-ink-faint">Número</dt>
                <dd className="text-sm font-medium text-ink">
                  {order.orderNumber}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Data</dt>
                <dd className="text-sm font-medium text-ink">
                  {formatDateBR(order.orderDate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Conta ID</dt>
                <dd className="text-sm font-medium text-ink">
                  {order.accountOwner || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Valor Total</dt>
                <dd
                  data-testid="details-summary-total"
                  className="text-sm font-medium text-ink"
                >
                  {formatBRL(parseFloat(order.totalValue))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Frete</dt>
                <dd
                  data-testid="details-summary-shipping"
                  className="text-sm font-medium text-ink"
                >
                  {formatBRL(parseFloat(order.shippingValue || 0))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Valor Pendente</dt>
                <dd
                  data-testid="details-summary-pending"
                  className="text-sm font-medium text-ink"
                >
                  {formatBRL(getOrderPendingCents(order) / 100)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Descrição</dt>
                <dd
                  data-testid="details-summary-description"
                  className="text-sm font-medium text-ink truncate"
                  title={order.orderNotes || undefined}
                >
                  {order.orderNotes || '—'}
                </dd>
              </div>
            </dl>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-ink-faint">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent mr-2" />
              Carregando detalhamento...
            </div>
          ) : balances.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-faint">
              Nenhuma pessoa neste pedido
            </p>
          ) : (
            <div className="rounded-md border border-line overflow-hidden">
              {balances.map((balance) => {
                const expanded = expandedPersonId === balance.personId;
                const items = personItems(balance.personId);
                const payments = personPayments(balance.personId);
                return (
                  <div
                    key={balance.personId}
                    className="border-b last:border-b-0 border-line"
                  >
                    <button
                      type="button"
                      data-testid={`detail-person-${balance.personId}`}
                      aria-expanded={expanded}
                      onClick={() => onTogglePerson(balance.personId)}
                      className="w-full px-3 py-3 flex items-center justify-between gap-3 text-left hover:bg-accent-soft transition-colors"
                    >
                      <span className="font-medium text-ink">
                        {balance.personName}
                        {balance.isSelf ? ' (Você)' : ''}
                      </span>
                      <span className="flex items-center gap-3 text-sm whitespace-nowrap">
                        <span className="text-ink-soft">
                          Total: {formatBRL(balance.itemTotal)}
                        </span>
                        {balance.isSelf ? (
                          <span className="text-success-fg">Recebido</span>
                        ) : (
                          <span
                            className={
                              toCents(balance.pending) === 0
                                ? 'text-ink-faint'
                                : 'text-accent'
                            }
                          >
                            Pendente: {formatBRL(balance.pending)}
                          </span>
                        )}
                        {expanded ? (
                          <ChevronUp size={18} aria-hidden="true" />
                        ) : (
                          <ChevronDown size={18} aria-hidden="true" />
                        )}
                      </span>
                    </button>

                    {expanded && (
                      <div
                        data-testid={`detail-panel-${balance.personId}`}
                        className="px-3 pb-4 bg-base"
                      >
                        <h4 className="pt-3 mb-2 text-sm font-medium text-ink-soft">
                          Itens desta pessoa
                        </h4>
                        {items.length === 0 ? (
                          <p className="text-sm text-ink-faint">
                            Nenhum item registrado para esta pessoa
                          </p>
                        ) : (
                          <div className="rounded-md border border-line divide-y divide-line overflow-hidden">
                            {items.map((item) => (
                              <div
                                key={item.id}
                                className="px-3 py-2 bg-surface"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-sm font-medium text-ink">
                                    {item.product?.name ||
                                      item.description ||
                                      '—'}
                                  </span>
                                  <span className="text-sm font-semibold text-accent whitespace-nowrap">
                                    {formatBRL(fromCents(lineValueCents(item)))}
                                  </span>
                                </div>
                                <p className="text-xs text-ink-faint mt-0.5">
                                  {item.quantity > 1
                                    ? `Qtd: ${item.quantity} · `
                                    : ''}
                                  Detalhes: {item.details || '—'}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        <h4 className="mt-4 mb-2 text-sm font-medium text-ink-soft">
                          Pagamentos recebidos
                        </h4>
                        {payments.length === 0 ? (
                          <p className="text-sm text-ink-faint">
                            Nenhum pagamento recebido
                          </p>
                        ) : (
                          <div className="rounded-md border border-line divide-y divide-line overflow-hidden">
                            {payments.map((payment) => (
                              <div
                                key={payment.id}
                                className="px-3 py-2 bg-surface"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-sm text-ink">
                                    {formatDateBR(payment.paidAt)}
                                  </span>
                                  <span className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-success-fg whitespace-nowrap">
                                      {formatBRL(parseFloat(payment.amount))}
                                    </span>
                                    {payment.paymentType && (
                                      <PaymentTypeBadge
                                        type={payment.paymentType}
                                        testId={`payment-badge-${payment.id}`}
                                      />
                                    )}
                                    <button
                                      type="button"
                                      data-testid={`edit-payment-${payment.id}`}
                                      aria-label="Editar pagamento"
                                      onClick={() => onEditPayment(payment)}
                                      className="text-ink-faint hover:text-ink transition-colors"
                                    >
                                      <Pencil size={16} aria-hidden="true" />
                                    </button>
                                  </span>
                                </div>
                                <p className="text-xs text-ink-faint mt-0.5">
                                  Observação: {payment.notes || '—'}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

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

export default DetailsModal;
