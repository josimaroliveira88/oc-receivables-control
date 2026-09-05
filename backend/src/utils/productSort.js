const SORTABLE_FIELDS = [
  'name',
  'code',
  'regularPrice',
  'memberPrice',
  'pricePerPv',
  'pv',
];
const NUMERIC_SORT_FIELDS = ['regularPrice', 'memberPrice', 'pricePerPv', 'pv'];

// In-memory sort of projected products. Price fields arrive as decimal
// strings, so numeric sorting parses them; names/codes use pt-BR collation.
const sortProducts = (products, sortBy, sortDir) => {
  const field = SORTABLE_FIELDS.includes(sortBy) ? sortBy : 'name';
  const direction = sortDir === 'desc' ? -1 : 1;

  return [...products].sort((a, b) => {
    let result;
    if (NUMERIC_SORT_FIELDS.includes(field)) {
      result = (parseFloat(a[field]) || 0) - (parseFloat(b[field]) || 0);
    } else {
      result = String(a[field] ?? '').localeCompare(
        String(b[field] ?? ''),
        'pt-BR',
      );
    }
    return result * direction;
  });
};

module.exports = { sortProducts, SORTABLE_FIELDS, NUMERIC_SORT_FIELDS };
