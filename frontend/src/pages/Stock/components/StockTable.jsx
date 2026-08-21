import React from 'react';
import { ArrowUpCircle, ArrowDownCircle, History } from 'lucide-react';
import ActionMenu from '../../../components/ActionMenu';
import SearchInput from '../../../components/SearchInput';
import SortableHeader from '../../../components/SortableHeader';
import { stockBadgeClass, formatQuantity } from '../utils/stockHelpers';

const StockTable = ({
  inventory,
  totalCount,
  hasActiveFilters,
  search,
  sortBy,
  sortDir,
  onSearchChange,
  onSort,
  onRegisterEntry,
  onRegisterExit,
  onViewHistory,
}) => {
  return (
    <>
      <div className="px-6 pt-4">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Buscar por código ou nome..."
          ariaLabel="Buscar produtos em estoque"
        />
        {totalCount > 0 && (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            {totalCount === 1 ? '1 produto' : `${totalCount} produtos`}
          </p>
        )}
      </div>

      <div className="px-6 py-4">
        {inventory.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              {hasActiveFilters
                ? 'Nenhum produto encontrado para os filtros aplicados.'
                : 'Nenhum produto em estoque'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm text-left block lg:table lg:table-fixed">
            <thead className="hidden lg:table-header-group bg-gray-50 dark:bg-gray-700">
              <tr>
                <SortableHeader
                  label="Código"
                  field="code"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width="w-[15%]"
                  testIdPrefix="stock"
                />
                <SortableHeader
                  label="Produto"
                  field="name"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width="w-[35%]"
                />
                <SortableHeader
                  label="Tamanho"
                  field="size"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width="w-[15%]"
                />
                <SortableHeader
                  label="Estoque Atual"
                  field="quantity"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width="w-[15%]"
                  align="right"
                  testIdPrefix="stock"
                />
                <th
                  scope="col"
                  className="w-[20%] px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="block lg:table-row-group bg-white dark:bg-gray-800 lg:divide-y divide-gray-200 dark:divide-gray-700">
              {inventory.map((item) => (
                <tr
                  key={item.productId}
                  className="block lg:table-row border border-gray-200 dark:border-gray-700 lg:border-0 rounded-lg lg:rounded-none shadow-sm lg:shadow-none mb-3 lg:mb-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <td
                    data-label="Código"
                    className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                  >
                    {item.code}
                  </td>
                  <td
                    data-label="Produto"
                    className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 break-words text-sm text-gray-900 dark:text-gray-100 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                  >
                    {item.name}
                  </td>
                  <td
                    data-label="Tamanho"
                    className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                  >
                    {item.size || '-'}
                  </td>
                  <td
                    data-label="Estoque Atual"
                    className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-left lg:text-right before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                  >
                    <span
                      data-testid={`stock-quantity-${item.productId}`}
                      className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium ${stockBadgeClass(item.quantity)}`}
                    >
                      {formatQuantity(item.quantity)}
                    </span>
                  </td>
                  <td
                    data-label="Ações"
                    className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 text-left lg:text-right text-sm font-medium before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden relative"
                  >
                    <div className="flex items-center justify-end gap-2">
                      <ActionMenu
                        actions={[
                          {
                            label: 'Nova Entrada',
                            icon: ArrowUpCircle,
                            onClick: () => onRegisterEntry(item),
                          },
                          {
                            label: 'Nova Saída',
                            icon: ArrowDownCircle,
                            onClick: () => onRegisterExit(item),
                          },
                          {
                            label: 'Ver Histórico',
                            icon: History,
                            onClick: () => onViewHistory(item),
                          },
                        ]}
                        ariaLabel="Ações de estoque"
                        testIdPrefix={`stock-actions-${item.productId}`}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
};

export default StockTable;
