import React from 'react';
import {
  DollarSign,
  ExternalLink,
  Eye,
  Paperclip,
  Pencil,
  Trash,
} from 'lucide-react';
import { formatBRL } from '../../../utils/money';
import { formatDateBR } from '../../../utils/dates';
import { getOrderNumberTooltip, trackingUrl } from '../utils/orderHelpers';
import {
  getPaymentActionLabel,
  shouldShowPaymentAction,
} from '../utils/receivablesHelpers';
import { PaymentTypeBadge, OrderOriginBadge } from './Badges';
import ActionMenu from '../../../components/ActionMenu';
import SortableHeader from '../../../components/SortableHeader';
import OrdersTableToolbar from './OrdersTableToolbar';

const OrdersTable = ({
  orders,
  search,
  searchField,
  sortBy,
  sortDir,
  hasActiveFilters,
  onSearchChange,
  onSearchFieldChange,
  onSearchSubmit,
  onSort,
  onEdit,
  onDelete,
  onPayment,
  onDetails,
  onViewAttachment,
}) => {
  return (
    <div>
      <OrdersTableToolbar
        search={search}
        searchField={searchField}
        onSearchChange={onSearchChange}
        onSearchFieldChange={onSearchFieldChange}
        onSearchSubmit={onSearchSubmit}
      />

      {orders.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-ink-faint">
            {hasActiveFilters
              ? 'Nenhum pedido encontrado para os filtros aplicados.'
              : 'Nenhum pedido cadastrado'}
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <table className="w-full text-sm text-left block lg:table lg:table-fixed">
            <thead className="hidden lg:table-header-group bg-base">
              <tr>
                <SortableHeader
                  label="Número"
                  field="orderNumber"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width="w-[9%]"
                  align="right"
                  testIdPrefix="orders"
                />
                <SortableHeader
                  label="Data"
                  field="orderDate"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width="w-[7%]"
                />
                <SortableHeader
                  label="Conta ID"
                  field="accountOwner"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width="w-[9%]"
                />
                <SortableHeader
                  label="Pagamento"
                  field="paymentType"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width="w-[7%]"
                  testIdPrefix="orders"
                />
                <SortableHeader
                  label="PV"
                  field="doterraPv"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width="w-[7%]"
                  testIdPrefix="orders"
                />
                <SortableHeader
                  label="Valor"
                  field="totalValue"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width="w-[7%]"
                  align="right"
                  testIdPrefix="orders"
                />
                <SortableHeader
                  label="Origem"
                  field="isTeamOrder"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width="w-[8%]"
                  testIdPrefix="orders"
                />
                <th
                  scope="col"
                  className="w-[32%] px-6 py-3 text-left text-xs font-medium text-ink-faint tracking-wider"
                >
                  Descrição
                </th>
                <th
                  scope="col"
                  className="w-[14%] px-6 py-3 text-right text-xs font-medium text-ink-faint"
                >
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="block lg:table-row-group bg-surface lg:divide-y divide-line">
              {orders.map((order) => {
                const showPaymentAction = shouldShowPaymentAction(order);
                const paymentActionLabel = getPaymentActionLabel(order);
                return (
                  <tr
                    key={order.id}
                    className="block lg:table-row border border-line lg:border-0 rounded-lg lg:rounded-none shadow-sm lg:shadow-none mb-3 lg:mb-0 hover:bg-accent-soft transition-colors"
                  >
                    <td
                      data-label="Número"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-ink lg:text-right before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
                    >
                      <a
                        href={trackingUrl(order.orderNumber)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 whitespace-nowrap text-sm text-accent hover:text-accent-hover transition-colors lg:w-full lg:justify-end"
                        title={getOrderNumberTooltip(order)}
                      >
                        <span className="min-w-[10ch] text-right">
                          {order.orderNumber}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    </td>
                    <td
                      data-label="Data"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-ink before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
                    >
                      {formatDateBR(order.orderDate)}
                    </td>
                    <td
                      data-label="Conta ID"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 break-words text-sm text-ink before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
                    >
                      {order.accountOwner || '—'}
                    </td>
                    <td
                      data-label="Pagamento"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
                    >
                      <PaymentTypeBadge type={order.paymentType} />
                    </td>
                    <td
                      data-label="PV"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-ink before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
                    >
                      {order.doterraPv != null
                        ? parseFloat(order.doterraPv).toFixed(2)
                        : '—'}
                    </td>
                    <td
                      data-label="Valor"
                      className={`block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm ${order.isTeamOrder ? 'text-ink-faint' : 'text-ink'} before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden`}
                    >
                      {formatBRL(parseFloat(order.totalValue))}
                    </td>
                    <td
                      data-label="Origem"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
                    >
                      <OrderOriginBadge isTeamOrder={order.isTeamOrder} />
                    </td>
                    <td
                      data-label="Descrição"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
                    >
                      {order.orderNotes ? (
                        <span
                          title={order.orderNotes}
                          className="block text-sm text-ink truncate"
                        >
                          {order.orderNotes}
                        </span>
                      ) : (
                        <span className="text-sm text-ink-faint">—</span>
                      )}
                    </td>
                    <td
                      data-label="Ações"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 text-left lg:text-right text-sm font-medium before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
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
                            ...(order.attachmentFilename
                              ? [
                                  {
                                    label: 'Visualizar Anexo',
                                    icon: Paperclip,
                                    onClick: () => onViewAttachment(order),
                                  },
                                ]
                              : []),
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
      )}
    </div>
  );
};

export default OrdersTable;
