import React from 'react';
import { Search } from 'lucide-react';
import {
  SEARCH_FIELD_OPTIONS,
  STATUS_FILTER_OPTIONS,
  PAYMENT_TYPE_FILTER_OPTIONS,
} from '../utils/orderHelpers';

const selectClass =
  'w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors';

const OrdersTableToolbar = ({
  search,
  searchField,
  statusFilter,
  paymentTypeFilter,
  onSearchChange,
  onSearchFieldChange,
  onStatusFilterChange,
  onPaymentTypeFilterChange,
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            placeholder="Buscar pedidos..."
            aria-label="Buscar pedidos"
          />
        </div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-700 to-primary-500 hover:from-primary-800 hover:to-primary-600 text-white font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          aria-label="Pesquisar pedidos"
        >
          <Search className="w-4 h-4" />
          Pesquisar
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          <span className="sr-only">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className={selectClass}
            aria-label="Status"
          >
            {STATUS_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          <span className="sr-only">Tipo de pagamento</span>
          <select
            value={paymentTypeFilter}
            onChange={(e) => onPaymentTypeFilterChange(e.target.value)}
            className={selectClass}
            aria-label="Tipo de pagamento"
          >
            {PAYMENT_TYPE_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </form>
  );
};

export default OrdersTableToolbar;
