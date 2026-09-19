import React from 'react';
import { Search } from 'lucide-react';
import {
  ORIGIN_FILTER_OPTIONS,
  TRANSACTION_TYPE_OPTIONS,
} from '../utils/financeHelpers';

const selectClass =
  'w-full sm:w-auto px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors';

const inputClass =
  'w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors';

const FinancesToolbar = ({
  filters,
  categories,
  onChange,
  onSearchSubmit,
  onReset,
  hasActiveFilters,
}) => {
  const categoryOptions = categories
    .filter((category) => {
      if (filters.type) return category.type === filters.type;
      return true;
    })
    .filter((category) => category.active)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  return (
    <form
      onSubmit={onSearchSubmit}
      className="flex flex-col gap-3"
      aria-label="Filtros de lançamentos"
    >
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            className="w-full pl-9 pr-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
            placeholder="Buscar lançamentos..."
            aria-label="Buscar lançamentos"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
          aria-label="Pesquisar lançamentos"
        >
          <Search className="w-4 h-4" />
          Pesquisar
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors"
          >
            Limpar
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center flex-wrap">
        <label className="block text-sm font-medium text-ink-soft">
          <span className="sr-only">Tipo</span>
          <select
            value={filters.type}
            onChange={(e) => onChange({ type: e.target.value })}
            className={selectClass}
            aria-label="Tipo"
          >
            {TRANSACTION_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-ink-soft">
          <span className="sr-only">Origem</span>
          <select
            value={filters.origin}
            onChange={(e) => onChange({ origin: e.target.value })}
            className={selectClass}
            aria-label="Origem"
          >
            {ORIGIN_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-ink-soft">
          <span className="sr-only">Categoria</span>
          <select
            value={filters.categoryId}
            onChange={(e) => onChange({ categoryId: e.target.value })}
            className={selectClass}
            aria-label="Categoria (filtro)"
          >
            <option value="">Todas as categorias</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-ink-soft">
          <span className="sr-only">De</span>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => onChange({ from: e.target.value })}
            className={inputClass}
            aria-label="De"
          />
        </label>
        <label className="block text-sm font-medium text-ink-soft">
          <span className="sr-only">Até</span>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => onChange({ to: e.target.value })}
            className={inputClass}
            aria-label="Até"
          />
        </label>
      </div>
    </form>
  );
};

export default FinancesToolbar;
