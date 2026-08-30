import React from 'react';
import { DollarSign, Eye, Truck, Pencil, Trash } from 'lucide-react';
import { formatBRL } from '../../../utils/money';
import { formatDateBR } from '../../../utils/dates';
import {
  getSaleClientName,
  getSaleFinancials,
  getSalePaymentActionLabel,
  shouldShowSalePaymentAction,
} from '../utils/saleHelpers';
import { StatusBadge, DeliveryBadge } from './SaleBadges';
import ActionMenu from '../../../components/ActionMenu';
import SortableHeader from '../../../components/SortableHeader';
import SalesTableToolbar from './SalesTableToolbar';

const SalesTable = ({
  sales,
  search,
  searchField,
  statusFilter,
  deliveryFilter,
  sortBy,
  sortDir,
  hasActiveFilters,
  onSearchChange,
  onSearchFieldChange,
  onStatusFilterChange,
  onDeliveryFilterChange,
  onSearchSubmit,
  onSort,
  onEdit,
  onDelete,
  onPayment,
  onDetails,
  onToggleDelivery,
}) => {
  return (
    <div>
      <SalesTableToolbar
        search={search}
        searchField={searchField}
        statusFilter={statusFilter}
        deliveryFilter={deliveryFilter}
        onSearchChange={onSearchChange}
        onSearchFieldChange={onSearchFieldChange}
        onStatusFilterChange={onStatusFilterChange}
        onDeliveryFilterChange={onDeliveryFilterChange}
        onSearchSubmit={onSearchSubmit}
      />

      {sales.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            {hasActiveFilters
              ? 'Nenhuma venda encontrada para os filtros aplicados.'
              : 'Nenhuma venda cadastrada'}
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <table className="w-full text-sm text-left block lg:table lg:table-fixed">
            <thead className="hidden lg:table-header-group bg-gray-50 dark:bg-gray-700">
              <tr>
                <SortableHeader
                  label="Nº Venda"
                  field="orderNumber"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width="w-[9%]"
                  align="right"
                  testIdPrefix="sales"
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
                  label="Cliente"
                  field="clientName"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width="w-[12%]"
                />
                <SortableHeader
                  label="Valor (R$)"
                  field="totalValue"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width="w-[7%]"
                  testIdPrefix="sales"
                />
                <SortableHeader
                  label="Pendente"
                  field="pendingValue"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width="w-[8%]"
                />
                <SortableHeader
                  label="Entrega"
                  field="deliveredAt"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width="w-[12%]"
                />
                <SortableHeader
                  label="Descrição"
                  field="orderNotes"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width="w-[18%]"
                />
                <SortableHeader
                  label="Status"
                  field="status"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width="w-[5%]"
                />
                <th
                  scope="col"
                  className="w-[14%] px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                >
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="block lg:table-row-group bg-white dark:bg-gray-800 lg:divide-y divide-gray-200 dark:divide-gray-700">
              {sales.map((sale) => {
                const { pendingCents } = getSaleFinancials(sale);
                const showPaymentAction = shouldShowSalePaymentAction(sale);
                const paymentActionLabel = getSalePaymentActionLabel(sale);
                return (
                  <tr
                    key={sale.id}
                    className="block lg:table-row border border-gray-200 dark:border-gray-700 lg:border-0 rounded-lg lg:rounded-none shadow-sm lg:shadow-none mb-3 lg:mb-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <td
                      data-label="Nº Venda"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 lg:text-right before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                    >
                      <span className="inline-block lg:w-full lg:text-right font-medium">
                        {sale.orderNumber}
                      </span>
                    </td>
                    <td
                      data-label="Data"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                    >
                      {formatDateBR(sale.orderDate)}
                    </td>
                    <td
                      data-label="Cliente"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 break-words text-sm text-gray-900 dark:text-gray-100 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                    >
                      {getSaleClientName(sale) || '—'}
                    </td>
                    <td
                      data-label="Valor (R$)"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                    >
                      {formatBRL(parseFloat(sale.totalValue))}
                    </td>
                    <td
                      data-label="Pendente"
                      className={`block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm ${pendingCents === 0 ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'} before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden`}
                    >
                      {formatBRL(pendingCents / 100)}
                    </td>
                    <td
                      data-label="Entrega"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                    >
                      <DeliveryBadge deliveredAt={sale.deliveredAt} />
                    </td>
                    <td
                      data-label="Descrição"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                    >
                      {sale.orderNotes ? (
                        <span
                          title={sale.orderNotes}
                          className="block text-sm text-gray-900 dark:text-gray-100 line-clamp-2"
                        >
                          {sale.orderNotes}
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
                      <StatusBadge status={sale.status} />
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
                                    onClick: () => onPayment(sale),
                                  },
                                ]
                              : []),
                            {
                              label: 'Detalhar Pagamentos',
                              icon: Eye,
                              onClick: () => onDetails(sale),
                            },
                            {
                              label: sale.deliveredAt
                                ? 'Desmarcar entrega'
                                : 'Marcar como entregue',
                              icon: Truck,
                              onClick: () => onToggleDelivery(sale),
                            },
                            {
                              label: 'Editar',
                              icon: Pencil,
                              onClick: () => onEdit(sale),
                            },
                            {
                              label: 'Excluir',
                              icon: Trash,
                              onClick: () => onDelete(sale.id),
                              variant: 'danger',
                            },
                          ]}
                          ariaLabel="Ações da venda"
                          testIdPrefix={`sale-actions-${sale.id}`}
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

export default SalesTable;
