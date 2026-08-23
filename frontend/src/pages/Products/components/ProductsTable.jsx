import React from 'react';
import { Search, ExternalLink, Pencil } from 'lucide-react';
import { formatBRL } from '../../../utils/money';
import { SORT_OPTIONS } from '../utils/productHelpers';
import StatusBadgeDropdown from './StatusBadgeDropdown';
import ActionMenu from '../../../components/ActionMenu';

const ProductsTable = ({
  products,
  hasMore,
  hasActiveFilters,
  totalCount,
  search,
  statusFilter,
  sort,
  sentinelRef,
  onSearchChange,
  onStatusFilterChange,
  onSortChange,
  onStatusChange,
  onEdit,
}) => {
  return (
    <>
      <div className="px-6 pt-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              placeholder="Buscar por nome ou código..."
              aria-label="Buscar produtos"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              <span className="sr-only">Ordenar por</span>
              <select
                value={sort}
                onChange={(e) => onSortChange(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                aria-label="Ordenar por"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              <span className="sr-only">Status</span>
              <select
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                aria-label="Status"
              >
                <option value="">Todos os status</option>
                <option value="ATIVO">Somente ativos</option>
                <option value="INDISPONIVEL">Somente indisponíveis</option>
                <option value="INATIVO">Somente inativos</option>
              </select>
            </label>
          </div>
        </div>
        {totalCount > 0 && (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            {totalCount === 1 ? '1 produto' : `${totalCount} produtos`}
          </p>
        )}
      </div>

      <div className="px-6 py-4">
        {products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              {hasActiveFilters
                ? 'Nenhum produto encontrado para os filtros aplicados.'
                : 'Nenhum produto cadastrado'}
            </p>
          </div>
        ) : (
          <div>
            <table className="w-full text-sm text-left block lg:table lg:table-fixed">
              <thead className="hidden lg:table-header-group bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th
                    scope="col"
                    className="w-[7%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    Código
                  </th>
                  <th
                    scope="col"
                    className="w-[5%] px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    Site
                  </th>
                  <th
                    scope="col"
                    className="w-[26%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    Produto
                  </th>
                  <th
                    scope="col"
                    className="w-[10%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    Tamanho
                  </th>
                  <th
                    scope="col"
                    className="w-[10%] px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    Preço Regular
                  </th>
                  <th
                    scope="col"
                    className="w-[10%] px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    Preço Membro
                  </th>
                  <th
                    scope="col"
                    className="w-[6%] px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    PV
                  </th>
                  <th
                    scope="col"
                    className="w-[8%] px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    R$/PV
                  </th>
                  <th
                    scope="col"
                    className="w-[11%] px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="w-[8%] px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="block lg:table-row-group bg-white dark:bg-gray-800 lg:divide-y divide-gray-200 dark:divide-gray-700">
                {products.map((product) => (
                  <tr
                    key={product.id}
                    className="block lg:table-row border border-gray-200 dark:border-gray-700 lg:border-0 rounded-lg lg:rounded-none shadow-sm lg:shadow-none mb-3 lg:mb-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <td
                      data-label="Código"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                    >
                      {product.code}
                    </td>
                    <td
                      data-label="Site"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-left lg:text-center before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                    >
                      {product.doterraUrl ? (
                        <a
                          href={product.doterraUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
                          title="Ver produto no site da dōTERRA"
                          aria-label="Ver produto no site"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      )}
                    </td>
                    <td
                      data-label="Produto"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 break-words text-sm text-gray-900 dark:text-gray-100 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                    >
                      {product.name}
                    </td>
                    <td
                      data-label="Tamanho"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                    >
                      {product.size || '-'}
                    </td>
                    <td
                      data-label="Preço Regular"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-left lg:text-right text-sm text-gray-700 dark:text-gray-200 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                    >
                      {formatBRL(product.regularPrice)}
                    </td>
                    <td
                      data-label="Preço Membro"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-left lg:text-right text-sm text-gray-700 dark:text-gray-200 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                    >
                      {formatBRL(product.memberPrice)}
                    </td>
                    <td
                      data-label="PV"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-left lg:text-right text-sm text-gray-700 dark:text-gray-200 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                    >
                      {product.pv}
                    </td>
                    <td
                      data-label="R$/PV"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-left lg:text-right text-sm text-gray-700 dark:text-gray-200 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                    >
                      {product.pricePerPv === null ||
                      product.pricePerPv === undefined
                        ? '—'
                        : formatBRL(product.pricePerPv)}
                    </td>
                    <td
                      data-label="Status"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 text-left lg:text-center before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                    >
                      <StatusBadgeDropdown
                        product={product}
                        onStatusChange={onStatusChange}
                      />
                    </td>
                    <td
                      data-label="Ações"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 text-left lg:text-right text-sm font-medium before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden relative"
                    >
                      <div className="flex items-center justify-end gap-2">
                        <ActionMenu
                          actions={[
                            {
                              label: 'Editar',
                              icon: Pencil,
                              onClick: () => onEdit(product),
                            },
                          ]}
                          ariaLabel="Ações do produto"
                          testIdPrefix={`product-actions-${product.id}`}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div
              ref={sentinelRef}
              className="py-4 flex items-center justify-center"
            >
              {hasMore && (
                <span className="text-gray-400 dark:text-gray-500 text-sm">
                  Rolando para carregar mais...
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ProductsTable;
