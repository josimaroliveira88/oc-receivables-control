// Pure helpers for the finances module. No React here so labels, options and
// error extraction stay unit-testable and reusable across the page widgets.

import { fromCents, formatBRL, toCents } from '../../../utils/money';
import { FINANCIAL_TRANSACTION_TYPE_CLASSES } from '../../../utils/badgeStyles';
import { saleHasInfinitePay } from '../../Sales/utils/saleHelpers';

export { saleHasInfinitePay };

export const CATEGORY_TYPE_OPTIONS = [
  { value: 'RECEITA', label: 'Receita' },
  { value: 'DESPESA', label: 'Despesa' },
];

// Type filter/select options; '' means "all types".
export const TRANSACTION_TYPE_OPTIONS = [
  { value: '', label: 'Todos os tipos' },
  { value: 'RECEITA', label: 'Receita' },
  { value: 'DESPESA', label: 'Despesa' },
];

export const ORIGIN_FILTER_OPTIONS = [
  { value: '', label: 'Todas as origens' },
  { value: 'VENDA', label: 'Venda' },
  { value: 'RESGATE_INFINITEPAY', label: 'Resgate InfinitePay' },
  { value: 'PEDIDO_DOTERRA', label: 'Pedido dōTERRA' },
  { value: 'VENDA_ADICIONAL', label: 'Adicional de venda' },
  { value: 'MANUAL', label: 'Manual' },
];

export const ORIGIN_LABELS = {
  VENDA: 'Venda',
  RESGATE_INFINITEPAY: 'Resgate InfinitePay',
  PEDIDO_DOTERRA: 'Pedido dōTERRA',
  VENDA_ADICIONAL: 'Adicional de venda',
  MANUAL: 'Manual',
};

export const TYPE_LABELS = {
  RECEITA: 'Receita',
  DESPESA: 'Despesa',
};

export const TYPE_BADGE_CLASSES = FINANCIAL_TRANSACTION_TYPE_CLASSES;

export const transactionTypeLabel = (type) => TYPE_LABELS[type] || '—';

export const originLabel = (origin) => ORIGIN_LABELS[origin] || '—';

// Displayed amount with an explicit sign: income enters the account, expense
// leaves it. Keeps the sign in integer cents so it never does float math.
export const formatSignedBRL = (amount, type) => {
  const cents = toCents(parseFloat(amount) || 0);
  const formatted = formatBRL(fromCents(Math.abs(cents)));
  if (type === 'DESPESA') return `-${formatted}`;
  return `+${formatted}`;
};

// Builds the `/finances/transactions` and `/finances/summary` query params from
// the filter state. '' values are dropped so the backend never receives empty
// filters, and the free-text term is sent as `q`.
export const buildTransactionParams = (filters = {}) => {
  const params = {};

  if (filters.type) params.type = filters.type;
  if (filters.origin) params.origin = filters.origin;
  if (filters.categoryId) params.categoryId = filters.categoryId;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.search && filters.search.trim()) {
    params.q = filters.search.trim();
  }

  return params;
};

export const hasActiveTransactionFilters = (filters = {}) =>
  Boolean(
    filters.type ||
    filters.origin ||
    filters.categoryId ||
    filters.from ||
    filters.to ||
    (filters.search && filters.search.trim()),
  );

// Short human description of the active filters for the empty state.
export const describeTransactionFilters = (filters = {}) => {
  const parts = [];
  if (filters.type) parts.push(TYPE_LABELS[filters.type] || filters.type);
  if (filters.origin)
    parts.push(ORIGIN_LABELS[filters.origin] || filters.origin);
  if (filters.from) parts.push(`de ${filters.from}`);
  if (filters.to) parts.push(`até ${filters.to}`);
  if (filters.search && filters.search.trim()) {
    parts.push(`"${filters.search.trim()}"`);
  }
  return parts.join(', ');
};

// Normalizes an API error into a user-facing string. Zod validation issues
// arrive as an array of `{ message }`, while business errors arrive as a single
// string; anything else falls back to the provided generic message.
export const errorMessageFrom = (error, fallback) => {
  const data = error?.response?.data?.error;

  if (Array.isArray(data)) {
    const messages = data.map((issue) => issue?.message).filter(Boolean);
    if (messages.length > 0) return messages.join(' ');
  }

  if (typeof data === 'string' && data.trim() !== '') return data;

  return fallback;
};

export const emptyTransactionForm = () => ({
  id: null,
  type: 'DESPESA',
  amount: '',
  description: '',
  transactionDate: '',
  categoryId: '',
  notes: '',
});

// Form values -> API payload. The masked currency string becomes a number and
// empty optional fields become null.
export const buildTransactionPayload = (form) => ({
  type: form.type,
  amount: parseFloat(form.amount) || 0,
  description: form.description.trim(),
  transactionDate: form.transactionDate,
  categoryId: form.categoryId || null,
  notes: form.notes.trim() ? form.notes.trim() : null,
});

// Settlement (InfinitePay redemption) form -> API payload.
export const buildSettlementPayload = ({ amount, transactionDate, notes }) => ({
  amount: parseFloat(amount) || 0,
  transactionDate,
  notes: notes && notes.trim() ? notes.trim() : null,
});

export const emptySettlementForm = () => ({
  amount: '',
  transactionDate: '',
  notes: '',
});

// Whether a sale has at least one InfinitePay payment (the only sales that can
// be redeemed). Reads the embedded payments returned by the sales API.
export const findInfinitePaySales = (sales = []) =>
  sales.filter(saleHasInfinitePay);

// Gross InfinitePay charged amount of a sale, in cents.
const infinitePayGrossCents = (sale) =>
  (sale?.payments || [])
    .filter((p) => p.paymentType === 'INFINITE_PAY')
    .reduce((sum, p) => sum + toCents(parseFloat(p.amount) || 0), 0);

// Money already redeemed for a sale, from its linked RESGATE_INFINITEPAY rows.
export const summarizeSaleSettlements = (transactions = [], orderId) => {
  const linked = transactions.filter(
    (t) => t.origin === 'RESGATE_INFINITEPAY' && t.orderId === orderId,
  );
  const settledCents = linked.reduce(
    (sum, t) => sum + toCents(parseFloat(t.amount) || 0),
    0,
  );
  return { settledCents, count: linked.length };
};

// Full redemption picture for a sale: gross charged, already redeemed and the
// remaining amount the user can still redeem.
export const summarizeInfinitePaySale = (sale, transactions = []) => {
  const infinitePayCents = infinitePayGrossCents(sale);
  const { settledCents, count } = summarizeSaleSettlements(
    transactions,
    sale?.id,
  );
  return {
    hasInfinitePay: infinitePayCents > 0,
    infinitePayCents,
    settledCents,
    pendingCents: Math.max(0, infinitePayCents - settledCents),
    count,
  };
};

// Today as `YYYY-MM-DD` for date inputs, parsed as a local date.
export const todayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
