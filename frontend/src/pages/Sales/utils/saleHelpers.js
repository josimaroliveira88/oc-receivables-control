import { toCents, fromCents, formatBRL } from '../../../utils/money';

// Default empty sale item row for the form.
export const emptySaleItem = () => ({
  id: Date.now(),
  description: '',
  chargedValue: '',
  productId: '',
  productName: '',
  productCode: '',
  memberPrice: '',
  details: '',
  quantity: 1,
  chargedValueMode: 'UNIT',
  kitStockMode: '',
});

export const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Converts a sale item to the create/update payload. Existing items keep their
// server UUID in `id` so the controller can sync by id without touching frozen
// kit snapshots of unchanged products.
export const saleItemPayload = (item) => ({
  ...(typeof item.id === 'string' && item.id ? { id: item.id } : {}),
  description: item.description.trim() || null,
  chargedValue:
    item.chargedValue === '' || item.chargedValue == null
      ? 0
      : parseFloat(item.chargedValue),
  productId: item.productId,
  memberPrice:
    item.memberPrice !== '' && item.memberPrice != null
      ? parseFloat(item.memberPrice)
      : null,
  details: item.details.trim() || null,
  quantity: Number(item.quantity) || 1,
  chargedValueMode: item.chargedValueMode || 'UNIT',
  kitStockMode: item.kitStockMode || null,
});

export const editSaleItemFromApi = (item) => ({
  id: item.id,
  description: item.description || '',
  chargedValue:
    item.chargedValue != null ? parseFloat(item.chargedValue).toString() : '',
  productId: item.productId || '',
  productName: item.product ? item.product.name : '',
  productCode: item.product ? item.product.code : '',
  memberPrice:
    item.memberPrice != null ? parseFloat(item.memberPrice).toString() : '',
  details: item.details || '',
  quantity: item.quantity != null ? Number(item.quantity) : 1,
  chargedValueMode: item.chargedValueMode || 'UNIT',
  kitStockMode: item.kitStockMode || '',
});

// Whether a sale item references a KIT product from the loaded catalog.
export const isKitItem = (item, products) => {
  if (!item.productId) return false;
  const product = (products || []).find((p) => p.id === item.productId);
  return !!product && product.productType === 'KIT';
};

// Line value in cents for a sale item, honoring the per-item price mode.
export const lineValueCents = (item) => {
  const base = toCents(parseFloat(item.chargedValue) || 0);
  if (item.chargedValueMode === 'TOTAL') return base;
  const qty = Math.max(1, Number(item.quantity) || 1);
  return base * qty;
};

// Member price total for display: unit member price * quantity.
export const memberLineTotal = (item) => {
  const member = parseFloat(item.memberPrice) || 0;
  return member * Math.max(1, Number(item.quantity) || 1);
};

// Display the line total (chargedValue respecting mode) as a BRL string.
export const lineTotalBRL = (item) =>
  formatBRL(fromCents(lineValueCents(item)));

// The client of a sale is injected into every item by the backend, so the
// first item's person is the sale client.
export const getSaleClientName = (sale) => sale.items?.[0]?.person?.name || '';

export const getSalePaidCents = (sale) =>
  (sale.payments || []).reduce(
    (sum, p) => sum + toCents(parseFloat(p.amount)),
    0,
  );

export const getSalePendingCents = (sale) =>
  Math.max(0, toCents(parseFloat(sale.totalValue)) - getSalePaidCents(sale));

export const getSaleFinancials = (sale) => {
  const totalCents = toCents(parseFloat(sale.totalValue));
  const paidCents = getSalePaidCents(sale);
  const pendingCents = Math.max(0, totalCents - paidCents);
  return { totalCents, paidCents, pendingCents };
};

export const shouldShowSalePaymentAction = (sale) => {
  const { totalCents, pendingCents } = getSaleFinancials(sale);
  return pendingCents > 0 || (totalCents === 0 && sale.status !== 'QUITADO');
};

export const getSalePaymentActionLabel = (sale) =>
  toCents(parseFloat(sale.totalValue)) === 0
    ? 'Dar baixa'
    : 'Registrar Pagamento';

// Options for the column selector next to the sales search input.
export const SALE_SEARCH_FIELD_OPTIONS = [
  { value: 'all', label: 'Todas as colunas' },
  { value: 'orderNumber', label: 'Número da venda' },
  { value: 'client', label: 'Cliente' },
  { value: 'description', label: 'Descrição' },
];

// Options for the sale status filter.
export const SALE_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'PENDENTE', label: 'Somente pendentes' },
  { value: 'PARCIAL', label: 'Somente parciais' },
  { value: 'QUITADO', label: 'Somente quitados' },
];

// Options for the delivery filter.
export const SALE_DELIVERY_FILTER_OPTIONS = [
  { value: '', label: 'Todas as entregas' },
  { value: 'true', label: 'Somente entregues' },
  { value: 'false', label: 'Somente pendentes de entrega' },
];

// Options for the per-payment "Forma de Pagamento" select.
export const PAYMENT_TYPE_OPTIONS = [
  { value: '', label: 'Não informada' },
  { value: 'PIX', label: 'PIX' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'CARTAO_CREDITO', label: 'Cartão de Crédito' },
  { value: 'INFINITE_PAY', label: 'InfinitePay' },
];
