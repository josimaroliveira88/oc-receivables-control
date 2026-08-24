import { formatBRL } from '../../../utils/money';

export const PAGE_SIZE = 20;

export const LOYALTY_TIERS = [
  {
    value: '1-3',
    label: '1 a 3 meses',
    percentage: 0.1,
    rangeLabel: 'nos meses 1–3',
  },
  {
    value: '4-6',
    label: '4 a 6 meses',
    percentage: 0.15,
    rangeLabel: 'nos meses 4–6',
  },
  {
    value: '7-9',
    label: '7 a 9 meses',
    percentage: 0.2,
    rangeLabel: 'nos meses 7–9',
  },
  {
    value: '10-12',
    label: '10 a 12 meses',
    percentage: 0.25,
    rangeLabel: 'nos meses 10–12',
  },
  {
    value: '13+',
    label: '13+ meses',
    percentage: 0.3,
    rangeLabel: 'a partir do 13º mês',
  },
];

export const LOYALTY_MINIMUM_PV = 50;

export const getLoyaltyTier = (tierValue) =>
  LOYALTY_TIERS.find((tier) => tier.value === tierValue);

export const calculatePoints = (pv, tierValue) => {
  if (tierValue === '') return null;
  const tier = getLoyaltyTier(tierValue);
  if (!tier) return null;
  const pvNumber = parseFloat(pv) || 0;
  return Math.round(pvNumber * tier.percentage * 100) / 100;
};

export const formatPoints = (value) => {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export const isBelowMinimumPv = (pv) =>
  (parseFloat(pv) || 0) < LOYALTY_MINIMUM_PV;

export const getLoyaltyTierDescription = (tierValue) => {
  if (tierValue === '') return 'Selecione sua regularidade de pedidos';
  const tier = getLoyaltyTier(tierValue);
  if (!tier) return '';
  return `${tier.percentage * 100}% do PV ${tier.rangeLabel} • mínimo ${LOYALTY_MINIMUM_PV} PV por pedido`;
};

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

export const formatProductRowForCopy = (product) => {
  const firstLine = product.size
    ? `${product.name} (${product.size})`
    : product.name;
  const lines = [
    firstLine,
    `Preço Regular: ${formatBRL(product.regularPrice)}`,
    `Preço de Membros: ${formatBRL(product.memberPrice)}`,
    `PV: ${product.pv}`,
  ];
  if (product.doterraUrl) {
    lines.push(product.doterraUrl);
  }
  return lines.join('\n');
};

export const emptyForm = () => ({
  code: '',
  name: '',
  size: '',
  regularPrice: '',
  memberPrice: '',
  pv: '',
  doterraUrl: '',
  productType: 'SIMPLES',
  components: [],
});

export const emptyComponent = () => ({
  id: Date.now(),
  componentProductId: '',
  quantity: 1,
});

// Builds the components array sent to the API, dropping empty component rows.
export const kitComponentsPayload = (components) =>
  (components || [])
    .filter((c) => c.componentProductId)
    .map((c) => ({
      componentProductId: c.componentProductId,
      quantity: Number(c.quantity) || 1,
    }));

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
  productType: form.productType || 'SIMPLES',
  components: kitComponentsPayload(form.components),
});

export const updateProductPayload = (form, status) => ({
  name: form.name.trim(),
  size: form.size.trim(),
  status,
  doterraUrl: form.doterraUrl.trim() || null,
  regularPrice: parseFloat(form.regularPrice),
  memberPrice: parseFloat(form.memberPrice),
  pv: parseFloat(form.pv),
  productType: form.productType || 'SIMPLES',
  components: kitComponentsPayload(form.components),
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
