import { useState, useCallback } from 'react';

// Owns the search/filter/sort state for the orders list and the query params
// that are sent to the backend. The search term is committed on submit, while
// filters and sort trigger a refetch immediately (see useOrders).
export function useOrderFilters() {
  const [search, setSearch] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [reviewFilter, setReviewFilter] = useState('');

  const buildOrderParams = useCallback(() => {
    const params = {};
    if (search.trim()) {
      params.q = search.trim();
    }
    if (searchField !== 'all') {
      params.searchField = searchField;
    }
    if (reviewFilter) {
      params.pendingReview = reviewFilter;
    }
    if (sortBy) {
      params.sortBy = sortBy;
      params.sortDir = sortDir;
    }
    return params;
  }, [search, searchField, sortBy, sortDir, reviewFilter]);

  const handleSort = (field, dir) => {
    setSortBy(field);
    setSortDir(dir);
  };

  const hasActiveFilters =
    search.trim() !== '' ||
    searchField !== 'all' ||
    sortBy !== '' ||
    reviewFilter !== '';

  return {
    search,
    searchField,
    sortBy,
    sortDir,
    reviewFilter,
    setSearch,
    setSearchField,
    setReviewFilter,
    buildOrderParams,
    handleSort,
    hasActiveFilters,
  };
}
