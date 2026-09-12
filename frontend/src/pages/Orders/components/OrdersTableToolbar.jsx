import React from 'react';
import { Search } from 'lucide-react';
import { SEARCH_FIELD_OPTIONS } from '../utils/orderHelpers';

const selectClass =
  'w-full sm:w-auto px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors';

const OrdersTableToolbar = ({
  search,
  searchField,
  onSearchChange,
  onSearchFieldChange,
  onSearchSubmit,
}) => {
  return (
    <form
      onSubmit={onSearchSubmit}
      className="flex flex-col gap-3"
      aria-label="Filtros de pedidos"
    >
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
            placeholder="Buscar pedidos..."
            aria-label="Buscar pedidos"
          />
        </div>
        <label className="block text-sm font-medium text-ink-soft">
          <span className="sr-only">Coluna de busca</span>
          <select
            value={searchField}
            onChange={(e) => onSearchFieldChange(e.target.value)}
            className={selectClass}
            aria-label="Coluna de busca"
          >
            {SEARCH_FIELD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
          aria-label="Pesquisar pedidos"
        >
          <Search className="w-4 h-4" />
          Pesquisar
        </button>
      </div>
    </form>
  );
};

export default OrdersTableToolbar;
