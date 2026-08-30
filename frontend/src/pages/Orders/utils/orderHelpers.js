import { toCents, fromCents, formatBRL } from '../../../utils/money';

export const emptyItem = () => ({
  id: Date.now(),
  description: '',
  chargedValue: '',
  personId: '',
  productId: '',
  productName: '',
  productCode: '',
  memberPrice: '',
  details: '',
  quantity: 1,
  forStock: false,
  chargedValueMode: 'UNIT',
  kitStockMode: '',
});

// Sentinel value used by the person <select> to represent the logged-in user
// when they have not yet been registered as a Person.
export const SELF_PERSON_ID = '__SELF__';

// Returns the self person (the logged-in user's own Person record), if any.
export const findSelfPerson = (people) =>
  (people || []).find((person) => person.isSelf) || null;

// Builds the option label for a person in the order item select.
export const personSelectLabel = (person) =>
  person.isSelf ? `${person.name} (Você)` : person.name;

export const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const trackingUrl = (orderNumber) =>
  `https://status.ondeestameupedido.com/tracking/22747/${encodeURIComponent(orderNumber)}/`;

export const paymentTypeLabel = (type) => {
  const map = {
    PIX: 'PIX',
    BOLETO: 'Boleto',
    CARTAO_CREDITO: 'Cartão de Crédito',
    INFINITE_PAY: 'InfinitePay',
  };
  return map[type] || type;
};

// Options for the column selector next to the orders search input.
export const SEARCH_FIELD_OPTIONS = [
  { value: 'all', label: 'Todas as colunas' },
  { value: 'orderNumber', label: 'Número do pedido' },
  { value: 'accountOwner', label: 'Conta ID' },
  { value: 'orderNotes', label: 'Descrição' },
];

// Options for the order status filter.
export const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'PENDENTE', label: 'Somente pendentes' },
  { value: 'PARCIAL', label: 'Somente parciais' },
  { value: 'QUITADO', label: 'Somente quitados' },
  { value: 'EQUIPE', label: 'Somente da equipe' },
];

// Options for the payment type filter.
export const PAYMENT_TYPE_FILTER_OPTIONS = [
  { value: '', label: 'Todos os tipos de pagamento' },
  { value: 'PIX', label: 'Somente PIX' },
  { value: 'BOLETO', label: 'Somente Boleto' },
  { value: 'CARTAO_CREDITO', label: 'Somente Cartão de Crédito' },
  { value: 'INFINITE_PAY', label: 'Somente InfinitePay' },
];

export const itemPayload = (item) => ({
  ...(typeof item.id === 'string' && item.id ? { id: item.id } : {}),
  description: item.description.trim() || null,
  chargedValue:
    item.chargedValue === '' || item.chargedValue == null
      ? 0
      : parseFloat(item.chargedValue),
  personId: item.personId,
  productId: item.productId || null,
  memberPrice:
    item.memberPrice !== '' && item.memberPrice != null
      ? parseFloat(item.memberPrice)
      : null,
  details: item.details.trim() || null,
  quantity: Number(item.quantity) || 1,
  forStock: !!item.forStock,
  chargedValueMode: item.chargedValueMode || 'UNIT',
  kitStockMode: item.kitStockMode || null,
});

export const editItemFromApi = (item) => ({
  id: item.id,
  description: item.description || '',
  chargedValue:
    item.chargedValue != null ? parseFloat(item.chargedValue).toString() : '',
  personId: item.personId || '',
  productId: item.productId || '',
  productName: item.product ? item.product.name : '',
  productCode: item.product ? item.product.code : '',
  memberPrice:
    item.memberPrice != null ? parseFloat(item.memberPrice).toString() : '',
  details: item.details || '',
  quantity: item.quantity != null ? Number(item.quantity) : 1,
  forStock: !!item.forStock,
  chargedValueMode: item.chargedValueMode || 'UNIT',
  kitStockMode: item.kitStockMode || '',
});

// Whether an order item references a KIT product from the loaded catalog.
export const isKitItem = (item, products) => {
  if (!item.productId) return false;
  const product = (products || []).find((p) => p.id === item.productId);
  return !!product && product.productType === 'KIT';
};

// Whether an order item belongs to the logged-in user themselves.
export const isItemForSelf = (item, people) => {
  const self = findSelfPerson(people);
  return !!self && item.personId === self.id;
};

// Line value in cents for an item, honoring the per-item price mode:
// - 'UNIT' (default): chargedValue is the unit price -> unit * quantity.
// - 'TOTAL': chargedValue already is the full line value.
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
