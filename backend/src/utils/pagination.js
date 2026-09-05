// Slices an already-sorted list into a page and builds the pagination block
// shared by list endpoints. `page`/`pageSize` accept raw query values (strings
// or numbers); `pageSize: 'all'` returns everything in a single page.
const paginate = (
  items,
  { page, pageSize, maxPageSize = 100, defaultPageSize = 20 },
) => {
  const total = items.length;
  const size =
    pageSize === 'all'
      ? Math.max(total, 1)
      : Math.min(
          Math.max(parseInt(pageSize, 10) || defaultPageSize, 1),
          maxPageSize,
        );
  const currentPage = Math.max(parseInt(page, 10) || 1, 1);
  const totalPages = Math.max(1, Math.ceil(total / size));
  const start = (currentPage - 1) * size;
  const data = items.slice(start, start + size);

  return {
    data,
    pagination: {
      page: currentPage,
      pageSize: size,
      total,
      totalPages,
      hasMore: start + size < total,
    },
  };
};

export { paginate };
