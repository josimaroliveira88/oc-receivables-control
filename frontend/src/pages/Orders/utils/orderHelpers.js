import { toCents, fromCents, formatBRL } from '../../../utils/money';
import { normalizeDiscountPercent } from './simulatorHelpers';

// Legacy cashback items granted a 70% discount; they are represented as a
// promotion percentage when hydrating the order forms.
export const CASHBACK_PROMOTION_PERCENT = 70;

export const emptyItem = () => ({
  id: Date.now(),
  description: '',
  chargedValue: '',
  personId: '',
  personName: '',
  productId: '',
  productName: '',
  productCode: '',
  memberPrice: '',
  details: '',
  quantity: 1,
  forStock: false,
  discountPercent: 0,
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
    CARTAO_CREDITO: 'Crédito',
    INFINITE_PAY: 'InfinitePay',
    DINHEIRO: 'Dinheiro',
  };
  return map[type] || type;
};

// Hover text for the order-number cell. Non-team orders list one entry per
// item with its line total, e.g. "Produto A (Paguei R$ 100,00) / Produto B
// (Paguei R$ 200,00)". Team orders group items by unique product and use
// "Pago" instead of "Paguei". Products are separated by " / ", never trailing.
export const getOrderNumberTooltip = (order) => {
  if (!order) return '';
  const items = order.items || [];
  const nameOf = (item) => item.product?.name || item.description || '—';

  if (order.isTeamOrder) {
    const totals = new Map();
    items.forEach((item) => {
      const name = nameOf(item);
      totals.set(name, (totals.get(name) || 0) + lineValueCents(item));
    });
    return Array.from(totals.entries())
      .map(([name, cents]) => `${name} (Pago ${formatBRL(fromCents(cents))})`)
      .join(' / ');
  }

  return items
    .map(
      (item) =>
        `${nameOf(item)} (Paguei ${formatBRL(fromCents(lineValueCents(item)))})`,
    )
    .join(' / ');
};

// Options for the column selector next to the orders search input.
export const SEARCH_FIELD_OPTIONS = [
  { value: 'all', label: 'Todas as colunas' },
  { value: 'orderNumber', label: 'Número do pedido' },
  { value: 'accountOwner', label: 'Conta ID' },
  { value: 'orderNotes', label: 'Descrição' },
];

// Reconstructs the promotion percentage shown in the order forms from a
// persisted item. Legacy cashback items map to the equivalent 70% promotion;
// UNIT items derive the percentage from the member price, while TOTAL items
// keep 0% because the percentage is not meaningful there.
export const reconstructDiscountPercent = (item) => {
  if (item.useCashback) return CASHBACK_PROMOTION_PERCENT;

  const memberPrice = parseFloat(item.memberPrice);
  const chargedValue = parseFloat(item.chargedValue);
  const quantity = Math.max(1, Number(item.quantity) || 1);
  const mode = item.chargedValueMode || 'UNIT';
  const unitCharged =
    mode === 'TOTAL'
      ? (Number.isFinite(chargedValue) ? chargedValue : 0) / quantity
      : chargedValue;

  if (
    mode !== 'UNIT' ||
    !Number.isFinite(memberPrice) ||
    memberPrice <= 0 ||
    !Number.isFinite(unitCharged) ||
    unitCharged >= memberPrice
  ) {
    return 0;
  }

  return Math.round((1 - unitCharged / memberPrice) * 10000) / 100;
};

export const itemPayload = (item) => ({
  ...(typeof item.id === 'string' && item.id ? { id: item.id } : {}),
  description: item.description.trim() || null,
  chargedValue:
    item.chargedValue === '' || item.chargedValue == null
      ? 0
      : parseFloat(item.chargedValue),
  // Empty means "no person" (backend binds the item to the self person), so
  // never send '' where the API expects a UUID or null.
  personId: item.personId || null,
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
  personName: item.person ? personSelectLabel(item.person) : '',
  productId: item.productId || '',
  productName: item.product ? item.product.name : '',
  productCode: item.product ? item.product.code : '',
  memberPrice:
    item.memberPrice != null ? parseFloat(item.memberPrice).toString() : '',
  details: item.details || '',
  quantity: item.quantity != null ? Number(item.quantity) : 1,
  forStock: !!item.forStock,
  discountPercent: reconstructDiscountPercent(item),
  chargedValueMode: item.chargedValueMode || 'UNIT',
  kitStockMode: item.kitStockMode || '',
});

// Derives the order-level client state for a team order from its items:
// - every item without a person (all empty) or every item sharing the same
//   person maps to the new order-level client mode;
// - items with divergent persons stay in the legacy per-item mode.
export const deriveTeamClientFromItems = (items = []) => {
  const personIds = items.map((item) => item.personId).filter(Boolean);
  const allEmpty = items.length > 0 && personIds.length === 0;
  const allSameNonEmpty =
    items.length > 0 &&
    personIds.length === items.length &&
    new Set(personIds).size === 1;
  const usesOrderLevelClient = allEmpty || allSameNonEmpty;
  return {
    usesOrderLevelClient,
    teamPersonId: allSameNonEmpty ? personIds[0] : '',
  };
};

// Human-readable client for the orders table:
// - team orders show the single client, "Vários" when items diverge, or "—";
// - regular orders show the logged-in user when the self person is present.
export const getOrderClientLabel = (order) => {
  const people = (order?.items || [])
    .map((item) => item.person)
    .filter(Boolean);
  if (!order?.isTeamOrder) {
    const self = people.find((person) => person.isSelf);
    return self ? `${self.name} (Você)` : '—';
  }
  const names = [...new Set(people.map((person) => person.name))];
  if (names.length === 0) return '—';
  if (names.length === 1) return names[0];
  return 'Vários';
};

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

// Prefilled "Valor Pago" for an item: the member price discounted by the
// promotion percentage. Returns '' when there is no member price so the user
// can type a value freely.
export const prefilledChargedValue = (item) => {
  const member = parseFloat(item.memberPrice);
  if (!Number.isFinite(member) || member <= 0) return '';
  const discountFactor =
    1 - normalizeDiscountPercent(item.discountPercent) / 100;
  return (member * discountFactor).toFixed(2);
};

// Display the line total (chargedValue respecting mode) as a BRL string.
export const lineTotalBRL = (item) =>
  formatBRL(fromCents(lineValueCents(item)));
