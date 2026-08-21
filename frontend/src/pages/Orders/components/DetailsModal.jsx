import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatBRL, toCents } from '../../../utils/money';
import { formatDateBR } from '../../../utils/dates';
import { getOrderPendingCents } from '../utils/receivablesHelpers';

const DetailsModal = ({
  order,
  balances,
  loading,
  expandedPersonId,
  onClose,
  onTogglePerson,
  personItems,
  personPayments,
}) => {
  return (
    <div
      data-testid="details-modal"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Detalhamento — {order.orderNumber}
          </h3>
          <button
            type="button"
            aria-label="Fechar detalhamento"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="px-6 py-4">
          <div className="mb-4 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Número
                </dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {order.orderNumber}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Data
                </dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {formatDateBR(order.orderDate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Responsável
                </dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {order.accountOwner || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Valor Total
                </dt>
                <dd
                  data-testid="details-summary-total"
                  className="text-sm font-medium text-gray-900 dark:text-gray-100"
                >
                  {formatBRL(parseFloat(order.totalValue))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Valor Pendente
                </dt>
                <dd
                  data-testid="details-summary-pending"
                  className="text-sm font-medium text-gray-900 dark:text-gray-100"
                >
                  {formatBRL(getOrderPendingCents(order) / 100)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Descrição
                </dt>
                <dd
                  data-testid="details-summary-description"
                  className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate"
                  title={order.orderNotes || undefined}
                >
                  {order.orderNotes || '—'}
                </dd>
              </div>
            </dl>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-gray-500 dark:text-gray-400">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600 mr-2" />
              Carregando detalhamento...
            </div>
          ) : balances.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhuma pessoa neste pedido
            </p>
          ) : (
            <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
              {balances.map((balance) => {
                const expanded = expandedPersonId === balance.personId;
                const items = personItems(balance.personId);
                const payments = personPayments(balance.personId);
                return (
                  <div
                    key={balance.personId}
                    className="border-b last:border-b-0 border-gray-200 dark:border-gray-700"
                  >
                    <button
                      type="button"
                      data-testid={`detail-person-${balance.personId}`}
                      aria-expanded={expanded}
                      onClick={() => onTogglePerson(balance.personId)}
                      className="w-full px-3 py-3 flex items-center justify-between gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {balance.personName}
                        {balance.isSelf ? ' (Você)' : ''}
                      </span>
                      <span className="flex items-center gap-3 text-sm whitespace-nowrap">
                        <span className="text-gray-600 dark:text-gray-300">
                          Total: {formatBRL(balance.itemTotal)}
                        </span>
                        {balance.isSelf ? (
                          <span className="text-emerald-700 dark:text-emerald-400">
                            Recebido
                          </span>
                        ) : (
                          <span
                            className={
                              toCents(balance.pending) === 0
                                ? 'text-gray-400 dark:text-gray-500'
                                : 'text-primary-700 dark:text-primary-400'
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
                        className="px-3 pb-4 bg-gray-50 dark:bg-gray-900/30"
                      >
                        <h4 className="pt-3 mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                          Itens desta pessoa
                        </h4>
                        {items.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Nenhum item registrado para esta pessoa
                          </p>
                        ) : (
                          <div className="rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden">
                            {items.map((item) => (
                              <div
                                key={item.id}
                                className="px-3 py-2 bg-white dark:bg-gray-800"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {item.product?.name ||
                                      item.description ||
                                      '—'}
                                  </span>
                                  <span className="text-sm font-semibold text-primary-700 dark:text-primary-400 whitespace-nowrap">
                                    {formatBRL(parseFloat(item.chargedValue))}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  Detalhes: {item.details || '—'}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        <h4 className="mt-4 mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                          Pagamentos recebidos
                        </h4>
                        {payments.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Nenhum pagamento recebido
                          </p>
                        ) : (
                          <div className="rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden">
                            {payments.map((payment) => (
                              <div
                                key={payment.id}
                                className="px-3 py-2 bg-white dark:bg-gray-800"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-sm text-gray-900 dark:text-gray-100">
                                    {formatDateBR(payment.paidAt)}
                                  </span>
                                  <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                                    {formatBRL(parseFloat(payment.amount))}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
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
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailsModal;
