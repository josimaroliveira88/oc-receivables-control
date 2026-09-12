import { formatBRL, toCents } from '../../../utils/money';
import { PRODUCT_STATUS_CLASSES } from '../../../utils/badgeStyles';

export const PAGE_SIZE = 20;

export const MEMBER_DISCOUNT_PERCENT = 30;

export const calculateDiscountedPrice = (memberPrice) => {
  const cents = toCents(memberPrice || 0);
  return Math.round((cents * MEMBER_DISCOUNT_PERCENT) / 100);
};

const SORTABLE_FIELDS = [
  'name',
  'code',
  'size',
  'regularPrice',
  'memberPrice',
  'pv',
  'pricePerPv',
  'memberDiscountPrice',
];

export const PRODUCT_STATUS = {
  ATIVO: {
    label: 'Ativo',
    className: PRODUCT_STATUS_CLASSES.ATIVO,
  },
  INDISPONIVEL: {
    label: 'Indisponível',
    className: PRODUCT_STATUS_CLASSES.INDISPONIVEL,
  },
  INATIVO: {
    label: 'Inativo',
    className: PRODUCT_STATUS_CLASSES.INATIVO,
  },
};

export const inputClass =
  'w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors disabled:bg-base disabled:text-ink-faint disabled:cursor-not-allowed';

export const formatProductRowForCopy = (product) => {
  const firstLine = product.size
    ? `${product.name} (${product.size})`
    : product.name;
  const pv =
    product.pv === null || product.pv === undefined || product.pv === ''
      ? '—'
      : product.pv;
  const lines = [
    firstLine,
    `Preço Regular: ${formatBRL(product.regularPrice)}`,
    `Preço de Membros: ${formatBRL(product.memberPrice)}`,
    `PV: ${pv}`,
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

export const filterAndSortProducts = (
  products,
  search,
  statusFilter,
  sortBy,
  sortDir,
) => {
  const field = SORTABLE_FIELDS.includes(sortBy) ? sortBy : 'name';
  const direction = sortDir === 'desc' ? -1 : 1;
  const query = search.trim().toLowerCase();

  const result = products.filter((product) => {
    if (
      query &&
      !String(product.name ?? '')
        .toLowerCase()
        .includes(query) &&
      !String(product.code ?? '')
        .toLowerCase()
        .includes(query)
    ) {
      return false;
    }
    if (statusFilter !== '' && product.status !== statusFilter) {
      return false;
    }
    return true;
  });

  return [...result].sort((a, b) => {
    if (field === 'memberDiscountPrice') {
      const aValue = calculateDiscountedPrice(a.memberPrice);
      const bValue = calculateDiscountedPrice(b.memberPrice);
      return (aValue - bValue) * direction;
    }
    const numericFields = ['regularPrice', 'memberPrice', 'pricePerPv', 'pv'];
    if (numericFields.includes(field)) {
      const aValue = parseFloat(a[field]) || 0;
      const bValue = parseFloat(b[field]) || 0;
      return (aValue - bValue) * direction;
    }
    return (
      String(a[field] ?? '').localeCompare(String(b[field] ?? ''), 'pt-BR') *
      direction
    );
  });
};
