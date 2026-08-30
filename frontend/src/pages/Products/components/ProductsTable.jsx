import React from 'react';
import { Search, ExternalLink, Pencil, Copy, Eye, EyeOff } from 'lucide-react';
import { formatBRL } from '../../../utils/money';
import {
  LOYALTY_TIERS,
  calculatePoints,
  formatPoints,
  isBelowMinimumPv,
  getLoyaltyTierDescription,
} from '../utils/productHelpers';
import ProductsTableHeader from './ProductsTableHeader';
import StatusBadgeDropdown from './StatusBadgeDropdown';
import ActionMenu from '../../../components/ActionMenu';

const ProductsTable = ({
  products,
  hasMore,
  hasActiveFilters,
  totalCount,
  search,
  statusFilter,
  loyaltyTier,
  showPointsColumn,
  sortBy,
  sortDir,
  sentinelRef,
  onSearchChange,
  onStatusFilterChange,
  onLoyaltyTierChange,
  onTogglePointsColumn,
  onSort,
  onStatusChange,
  onEdit,
  onCopyField,
  onCopyRow,
}) => {
  return (
    <>
      <div className="px-6 pt-4">
        <div className="flex flex-col md:flex-row md:items-start gap-3">
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
          <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
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
            {showPointsColumn && (
              <div className="flex flex-col gap-1 sm:max-w-[220px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <span className="sr-only">Regularidade</span>
                  <select
                    value={loyaltyTier}
                    onChange={(e) => onLoyaltyTierChange(e.target.value)}
                    className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    aria-label="Regularidade"
                  >
                    <option value="">Selecione…</option>
                    {LOYALTY_TIERS.map((tier) => (
                      <option key={tier.value} value={tier.value}>
                        {tier.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-xs leading-snug text-gray-500 dark:text-gray-400">
                  {getLoyaltyTierDescription(loyaltyTier)}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={onTogglePointsColumn}
              aria-pressed={showPointsColumn}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                showPointsColumn
                  ? 'text-primary-700 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {showPointsColumn ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              Pontos
            </button>
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
                <ProductsTableHeader
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  showPointsColumn={showPointsColumn}
                />
              </thead>
              <tbody className="block lg:table-row-group bg-white dark:bg-gray-800 lg:divide-y divide-gray-200 dark:divide-gray-700">
                {products.map((product) => {
                  const points = calculatePoints(product.pv, loyaltyTier);
                  const belowMinimum = isBelowMinimumPv(product.pv);
                  const pointsCellClass =
                    points !== null && belowMinimum
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-gray-700 dark:text-gray-200';
                  const pointsTitle =
                    points !== null && belowMinimum
                      ? 'PV abaixo de 50: isoladamente este produto não acumula pontos'
                      : undefined;
                  return (
                    <tr
                      key={product.id}
                      className="block lg:table-row border border-gray-200 dark:border-gray-700 lg:border-0 rounded-lg lg:rounded-none shadow-sm lg:shadow-none mb-3 lg:mb-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td
                        data-label="Código"
                        className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                      >
                        {product.code ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCopyField(product, 'code');
                            }}
                            title="Copiar código"
                            data-testid={`product-code-${product.id}`}
                            className="text-left cursor-pointer hover:underline hover:text-primary-600 dark:hover:text-primary-400 focus:outline-none focus:underline focus:text-primary-600 transition-colors"
                          >
                            {product.code}
                          </button>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">
                            —
                          </span>
                        )}
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
                        {product.name ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCopyField(product, 'name');
                            }}
                            title="Copiar nome"
                            data-testid={`product-name-${product.id}`}
                            className="text-left cursor-pointer hover:underline hover:text-primary-600 dark:hover:text-primary-400 focus:outline-none focus:underline focus:text-primary-600 transition-colors"
                          >
                            {product.name}
                          </button>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">
                            —
                          </span>
                        )}
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
                      {showPointsColumn && (
                        <td
                          data-label="Pontos"
                          className={`block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-left lg:text-right text-sm ${pointsCellClass} before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden`}
                          title={pointsTitle}
                        >
                          {formatPoints(points)}
                        </td>
                      )}
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
                                label: 'Copiar linha',
                                icon: Copy,
                                onClick: () => onCopyRow(product),
                              },
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
                  );
                })}
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
