import React from 'react';
import { Pencil } from 'lucide-react';
import { formatBRL, fromCents } from '../../../utils/money';
import { formatDateBR } from '../../../utils/dates';
import { getSalePendingCents } from '../utils/saleHelpers';
import { lineValueCents } from '../utils/saleHelpers';
import { PaymentTypeBadge } from '../../Orders/components/Badges';
import Modal from '../../../components/Modal';

const SaleDetailsModal = ({
  sale,
  loading,
  onClose,
  personItems,
  personPayments,
  onEditPayment,
}) => {
  const pendingCents = getSalePendingCents(sale);
  const clientPersonId = sale.items?.[0]?.personId || '';
  const items = clientPersonId ? personItems(clientPersonId) : [];
  const payments = clientPersonId ? personPayments(clientPersonId) : [];

  return (
    <Modal
      title={`Detalhamento — ${sale.orderNumber}`}
      onClose={onClose}
      testId="sale-details-modal"
      closeAriaLabel="Fechar detalhamento"
    >
      {(requestClose) => (
        <div className="px-6 py-4">
          <div className="mb-4 rounded-md border border-line bg-base p-3">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <dt className="text-xs text-ink-faint">Nº Venda</dt>
                <dd className="text-sm font-medium text-ink">
                  {sale.orderNumber}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Data</dt>
                <dd className="text-sm font-medium text-ink">
                  {formatDateBR(sale.orderDate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Cliente</dt>
                <dd className="text-sm font-medium text-ink">
                  {sale.items?.[0]?.person?.name || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Valor Total</dt>
                <dd
                  data-testid="sale-details-summary-total"
                  className="text-sm font-medium text-ink"
                >
                  {formatBRL(parseFloat(sale.totalValue))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Frete</dt>
                <dd
                  data-testid="sale-details-summary-shipping"
                  className="text-sm font-medium text-ink"
                >
                  {formatBRL(parseFloat(sale.shippingValue || 0))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Valores Adicionais</dt>
                <dd
                  data-testid="sale-details-summary-additional"
                  className="text-sm font-medium text-ink"
                >
                  {formatBRL(parseFloat(sale.additionalValue || 0))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Valor Pendente</dt>
                <dd
                  data-testid="sale-details-summary-pending"
                  className={`text-sm font-semibold whitespace-nowrap ${
                    pendingCents === 0 ? 'text-ink-faint' : 'text-accent'
                  }`}
                >
                  {formatBRL(pendingCents / 100)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Descrição</dt>
                <dd
                  data-testid="sale-details-summary-description"
                  className="text-sm font-medium text-ink truncate"
                  title={sale.orderNotes || undefined}
                >
                  {sale.orderNotes || '—'}
                </dd>
              </div>
            </dl>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-ink-faint">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent mr-2" />
              Carregando detalhamento...
            </div>
          ) : (
            <>
              <h4 className="mb-2 text-sm font-medium text-ink-soft">Itens</h4>
              {items.length === 0 ? (
                <p className="text-sm text-ink-faint">
                  Nenhum item nesta venda
                </p>
              ) : (
                <div className="rounded-md border border-line divide-y divide-line overflow-hidden">
                  {items.map((item) => (
                    <div key={item.id} className="px-3 py-2 bg-surface">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-ink">
                          {item.product?.name || item.description || '—'}
                        </span>
                        <span className="text-sm font-semibold text-accent whitespace-nowrap">
                          {formatBRL(fromCents(lineValueCents(item)))}
                        </span>
                      </div>
                      <p className="text-xs text-ink-faint mt-0.5">
                        {item.quantity > 1 ? `Qtd: ${item.quantity} · ` : ''}
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
                    <div key={payment.id} className="px-3 py-2 bg-surface">
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
            </>
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

export default SaleDetailsModal;
