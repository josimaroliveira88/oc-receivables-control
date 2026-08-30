import { useState, useCallback } from 'react';

// Owns the search/filter/sort state for the sales list and the query params
// sent to the backend. The search term is committed on submit, while filters
// and sort trigger a refetch immediately (see useSales).
export function useSaleFilters() {
  const [search, setSearch] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const buildSaleParams = useCallback(() => {
    const params = {};
    if (search.trim()) {
      params.q = search.trim();
    }
    if (searchField !== 'all') {
      params.searchField = searchField;
    }
    if (statusFilter) params.status = statusFilter;
    if (deliveryFilter) params.delivered = deliveryFilter;
    if (sortBy) {
      params.sortBy = sortBy;
      params.sortDir = sortDir;
    }
    return params;
  }, [search, searchField, statusFilter, deliveryFilter, sortBy, sortDir]);

  const handleSort = (field, dir) => {
    setSortBy(field);
    setSortDir(dir);
  };

  const hasActiveFilters =
    search.trim() !== '' ||
    searchField !== 'all' ||
    statusFilter !== '' ||
    deliveryFilter !== '' ||
    sortBy !== '';

  return {
    search,
    searchField,
    statusFilter,
    deliveryFilter,
    sortBy,
    sortDir,
    setSearch,
    setSearchField,
    setStatusFilter,
    setDeliveryFilter,
    buildSaleParams,
    handleSort,
    hasActiveFilters,
  };
}
