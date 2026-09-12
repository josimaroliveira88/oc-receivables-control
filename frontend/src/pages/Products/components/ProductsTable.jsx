import React from 'react';
import { Search, ExternalLink, Pencil, Copy } from 'lucide-react';
import { formatBRL, fromCents } from '../../../utils/money';
import { calculateDiscountedPrice } from '../utils/productHelpers';
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
  sortBy,
  sortDir,
  sentinelRef,
  onSearchChange,
  onStatusFilterChange,
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
              placeholder="Buscar por nome ou código..."
              aria-label="Buscar produtos"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
            <label className="block text-sm font-medium text-ink-soft">
              <span className="sr-only">Status</span>
              <select
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
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
          <p className="mt-3 text-sm text-ink-faint">
            {totalCount === 1 ? '1 produto' : `${totalCount} produtos`}
          </p>
        )}
      </div>

      <div className="px-6 py-4">
        {products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-ink-faint">
              {hasActiveFilters
                ? 'Nenhum produto encontrado para os filtros aplicados.'
                : 'Nenhum produto cadastrado'}
            </p>
          </div>
        ) : (
          <div>
            <table className="w-full text-sm text-left block lg:table lg:table-fixed">
              <thead className="hidden lg:table-header-group bg-base">
                <ProductsTableHeader
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                />
              </thead>
              <tbody className="block lg:table-row-group bg-surface lg:divide-y divide-line">
                {products.map((product) => {
                  return (
                    <tr
                      key={product.id}
                      className="block lg:table-row border border-line lg:border-0 rounded-lg lg:rounded-none shadow-sm lg:shadow-none mb-3 lg:mb-0 hover:bg-accent-soft transition-colors"
                    >
                      <td
                        data-label="Código"
                        className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-ink before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
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
                            className="text-left cursor-pointer hover:underline hover:text-accent focus:outline-none focus:underline focus:text-accent transition-colors"
                          >
                            {product.code}
                          </button>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td
                        data-label="Site"
                        className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-left lg:text-center before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
                      >
                        {product.doterraUrl ? (
                          <a
                            href={product.doterraUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center text-accent hover:text-accent-hover transition-colors"
                            title="Ver produto no site da dōTERRA"
                            aria-label="Ver produto no site"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td
                        data-label="Produto"
                        className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 break-words text-sm text-ink before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
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
                            className="text-left cursor-pointer hover:underline hover:text-accent focus:outline-none focus:underline focus:text-accent transition-colors"
                          >
                            {product.name}
                          </button>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td
                        data-label="Tamanho"
                        className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-ink-faint before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
                      >
                        {product.size || '-'}
                      </td>
                      <td
                        data-label="Preço Regular"
                        className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-left lg:text-right text-sm text-ink-soft before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
                      >
                        {product.regularPrice === null ||
                        product.regularPrice === undefined ||
                        product.regularPrice === ''
                          ? '—'
                          : formatBRL(product.regularPrice)}
                      </td>
                      <td
                        data-label="Preço Membro"
                        className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-left lg:text-right text-sm text-ink-soft before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
                      >
                        {product.memberPrice === null ||
                        product.memberPrice === undefined ||
                        product.memberPrice === ''
                          ? '—'
                          : formatBRL(product.memberPrice)}
                      </td>
                      <td
                        data-label="PV"
                        className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-left lg:text-right text-sm text-ink-soft before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
                      >
                        {product.pv === null ||
                        product.pv === undefined ||
                        product.pv === ''
                          ? '—'
                          : product.pv}
                      </td>
                      <td
                        data-label="R$/PV"
                        className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-left lg:text-right text-sm text-ink-soft before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
                      >
                        {product.pricePerPv === null ||
                        product.pricePerPv === undefined
                          ? '—'
                          : formatBRL(product.pricePerPv)}
                      </td>
                      <td
                        data-label="70% OFF"
                        className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-left lg:text-right text-sm text-ink-soft before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
                      >
                        {product.memberPrice === null ||
                        product.memberPrice === undefined ||
                        product.memberPrice === ''
                          ? '—'
                          : formatBRL(
                              fromCents(
                                calculateDiscountedPrice(product.memberPrice),
                              ),
                            )}
                      </td>
                      <td
                        data-label="Status"
                        className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 text-left lg:text-center before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
                      >
                        <StatusBadgeDropdown
                          product={product}
                          onStatusChange={onStatusChange}
                        />
                      </td>
                      <td
                        data-label="Ações"
                        className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 text-left lg:text-right text-sm font-medium before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden relative"
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
                <span className="text-ink-faint text-sm">
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
