export const PAGE_SIZE = 20;

export const SORT_OPTIONS = [
  { value: 'name:asc', label: 'Nome (A-Z)' },
  { value: 'name:desc', label: 'Nome (Z-A)' },
  { value: 'code:asc', label: 'Código (A-Z)' },
  { value: 'regularPrice:asc', label: 'Preço Regular (menor)' },
  { value: 'regularPrice:desc', label: 'Preço Regular (maior)' },
  { value: 'memberPrice:asc', label: 'Preço Membro (menor)' },
  { value: 'memberPrice:desc', label: 'Preço Membro (maior)' },
  { value: 'pricePerPv:asc', label: 'R$/PV (menor)' },
  { value: 'pricePerPv:desc', label: 'R$/PV (maior)' },
  { value: 'pv:asc', label: 'PV (menor)' },
  { value: 'pv:desc', label: 'PV (maior)' },
];

export const PRODUCT_STATUS = {
  ATIVO: {
    label: 'Ativo',
    className:
      'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  },
  INDISPONIVEL: {
    label: 'Indisponível',
    className:
      'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  },
  INATIVO: {
    label: 'Inativo',
    className: 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300',
  },
};

export const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed';

export const emptyForm = () => ({
  code: '',
  name: '',
  size: '',
  regularPrice: '',
  memberPrice: '',
  pv: '',
  doterraUrl: '',
});

export const isValidUrl = (value) => {
  const trimmed = (value || '').trim();
  if (trimmed === '') return true;
  try {
    // eslint-disable-next-line no-new
    new URL(trimmed);
    return true;
  } catch {
    return false;
  }
};

export const createProductPayload = (form) => ({
  code: form.code.trim(),
  name: form.name.trim(),
  size: form.size.trim(),
  regularPrice: parseFloat(form.regularPrice),
  memberPrice: parseFloat(form.memberPrice),
  pv: parseFloat(form.pv),
  doterraUrl: form.doterraUrl.trim() || null,
});

export const updateProductPayload = (form, status) => ({
  name: form.name.trim(),
  size: form.size.trim(),
  status,
  doterraUrl: form.doterraUrl.trim() || null,
  regularPrice: parseFloat(form.regularPrice),
  memberPrice: parseFloat(form.memberPrice),
  pv: parseFloat(form.pv),
});

export const filterAndSortProducts = (products, search, statusFilter, sort) => {
  const [sortBy, sortDir] = sort.split(':');
  const direction = sortDir === 'desc' ? -1 : 1;
  const query = search.trim().toLowerCase();

  const result = products.filter((product) => {
    if (
      query &&
      !product.name.toLowerCase().includes(query) &&
      !product.code.toLowerCase().includes(query)
    ) {
      return false;
    }
    if (statusFilter !== '' && product.status !== statusFilter) {
      return false;
    }
    return true;
  });

  return [...result].sort((a, b) => {
    const numericFields = ['regularPrice', 'memberPrice', 'pricePerPv', 'pv'];
    if (numericFields.includes(sortBy)) {
      const aValue = parseFloat(a[sortBy]) || 0;
      const bValue = parseFloat(b[sortBy]) || 0;
      return (aValue - bValue) * direction;
    }
    return (
      String(a[sortBy] ?? '').localeCompare(String(b[sortBy] ?? ''), 'pt-BR') *
      direction
    );
  });
};
