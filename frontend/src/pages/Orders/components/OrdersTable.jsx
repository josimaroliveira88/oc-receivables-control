import React from 'react';
import { DollarSign, ExternalLink, Eye, Pencil, Trash } from 'lucide-react';
import { formatBRL } from '../../../utils/money';
import { formatDateBR } from '../../../utils/dates';
import { trackingUrl } from '../utils/orderHelpers';
import {
  getOrderFinancials,
  getOrderTotalPV,
  getPaymentActionLabel,
  shouldShowPaymentAction,
} from '../utils/receivablesHelpers';
import { StatusBadge, PaymentTypeBadge } from './Badges';
import ActionMenu from '../../../components/ActionMenu';

const OrdersTable = ({ orders, onEdit, onDelete, onPayment, onDetails }) => {
  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          Nenhum pedido cadastrado
        </p>
      </div>
    );
  }

  return (
    <div>
      <table className="w-full text-sm text-left block lg:table lg:table-fixed">
        <thead className="hidden lg:table-header-group bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="w-[11%] px-6 py-3 text-left lg:text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
              Número
            </th>
            <th className="w-[8%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
              Data
            </th>
            <th className="w-[10%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
              Responsável
            </th>
            <th className="w-[9%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
              Tipo Pgto
            </th>
            <th className="w-[8%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
              Valor (R$)
            </th>
            <th className="w-[9%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
              Valor Pendente
            </th>
            <th className="w-[7%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
              PV Total
            </th>
            <th className="w-[10%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
              Descrição
            </th>
            <th className="w-[8%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
              Status
            </th>
            <th className="w-[16%] px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="block lg:table-row-group bg-white dark:bg-gray-800 lg:divide-y divide-gray-200 dark:divide-gray-700">
          {orders.map((order) => {
            const totalPV = getOrderTotalPV(order);
            const { pendingCents } = getOrderFinancials(order);
            const showPaymentAction = shouldShowPaymentAction(order);
            const paymentActionLabel = getPaymentActionLabel(order);
            return (
              <tr
                key={order.id}
                className="block lg:table-row border border-gray-200 dark:border-gray-700 lg:border-0 rounded-lg lg:rounded-none shadow-sm lg:shadow-none mb-3 lg:mb-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <td
                  data-label="Número"
                  className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 lg:text-right before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                >
                  <a
                    href={trackingUrl(order.orderNumber)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 whitespace-nowrap text-sm text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 transition-colors lg:w-full lg:justify-end"
                    title="Ver pedido no site"
                  >
                    <span className="min-w-[10ch] text-right">
                      {order.orderNumber}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                </td>
                <td
                  data-label="Data"
                  className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                >
                  {formatDateBR(order.orderDate)}
                </td>
                <td
                  data-label="Responsável"
                  className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 break-words text-sm text-gray-900 dark:text-gray-100 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                >
                  {order.accountOwner || '—'}
                </td>
                <td
                  data-label="Tipo Pgto"
                  className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                >
                  <PaymentTypeBadge type={order.paymentType} />
                </td>
                <td
                  data-label="Valor (R$)"
                  className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                >
                  {formatBRL(parseFloat(order.totalValue))}
                </td>
                <td
                  data-label="Valor Pendente"
                  className={`block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm ${pendingCents === 0 ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'} before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden`}
                >
                  {formatBRL(pendingCents / 100)}
                </td>
                <td
                  data-label="PV Total"
                  className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                >
                  {totalPV.toFixed(2)}
                </td>
                <td
                  data-label="Descrição"
                  className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                >
                  {order.orderNotes ? (
                    <span
                      title={order.orderNotes}
                      className="block truncate text-sm text-gray-900 dark:text-gray-100"
                    >
                      {order.orderNotes}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400 dark:text-gray-500">
                      —
                    </span>
                  )}
                </td>
                <td
                  data-label="Status"
                  className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                >
                  <StatusBadge status={order.status} />
                </td>
                <td
                  data-label="Ações"
                  className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 text-left lg:text-right text-sm font-medium before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                >
                  <div className="flex justify-end">
                    <ActionMenu
                      actions={[
                        ...(showPaymentAction
                          ? [
                              {
                                label: paymentActionLabel,
                                icon: DollarSign,
                                variant: 'primary',
                                onClick: () => onPayment(order),
                              },
                            ]
                          : []),
                        {
                          label: 'Detalhar Pagamentos',
                          icon: Eye,
                          onClick: () => onDetails(order),
                        },
                        {
                          label: 'Editar',
                          icon: Pencil,
                          onClick: () => onEdit(order),
                        },
                        {
                          label: 'Excluir',
                          icon: Trash,
                          onClick: () => onDelete(order.id),
                          variant: 'danger',
                        },
                      ]}
                      ariaLabel="Ações do pedido"
                      testIdPrefix={`order-actions-${order.id}`}
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

export default OrdersTable;
