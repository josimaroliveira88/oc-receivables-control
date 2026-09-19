import { fromCents, formatBRL, toCents } from '../../../utils/money';

// Monotonic counter combined with a timestamp keeps row ids unique even when
// several rows are created within the same millisecond.
let rowSequence = 0;

// A simulator row is ephemeral: it only references a catalog product, a
// quantity and an optional promotion percentage. PV and member values are
// always derived from the catalog on render.
export const createEmptyRow = () => ({
  id: `sim-${Date.now()}-${rowSequence++}`,
  productId: '',
  quantity: 1,
  discountPercent: 0,
});

const findProduct = (products, productId) =>
  (products || []).find((product) => product.id === productId) || null;

const numberOrZero = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const hasPrice = (value) =>
  value !== null && value !== undefined && value !== '';

// Quantities are whole numbers of at least 1. Empty, invalid or out-of-range
// input falls back to 1 so the derived totals never break while typing.
export const normalizeQuantity = (quantity) => {
  const parsed = Number(quantity);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
};

// Promotion percentage is clamped to 0..100. Empty, invalid or negative input
// falls back to 0 so the derived totals never break while typing.
export const normalizeDiscountPercent = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(parsed, 100);
};

// Per-line totals derived from the selected product, in integer cents. The
// promotion percentage is applied to the unit values first, so the displayed
// unit and total always reflect the discounted amounts and unit × quantity
// stays consistent.
export const rowTotals = (row, products) => {
  const product = findProduct(products, row.productId);
  const quantity = normalizeQuantity(row.quantity);
  const discountFactor =
    1 - normalizeDiscountPercent(row.discountPercent) / 100;

  if (!product) {
    return {
      hasProduct: false,
      pvUnit: 0,
      pvTotal: 0,
      memberUnitCents: null,
      memberTotalCents: 0,
    };
  }

  const pvUnitCents = Math.round(
    toCents(numberOrZero(product.pv)) * discountFactor,
  );
  const memberUnitCents = hasPrice(product.memberPrice)
    ? Math.round(toCents(numberOrZero(product.memberPrice)) * discountFactor)
    : null;

  return {
    hasProduct: true,
    pvUnit: fromCents(pvUnitCents),
    pvTotal: fromCents(pvUnitCents * quantity),
    memberUnitCents,
    memberTotalCents: memberUnitCents === null ? 0 : memberUnitCents * quantity,
  };
};

// Grand totals across every independent row. Member totals accumulate in
// cents; PV accumulates in cents as well to avoid floating point drift.
export const totalsFor = (rows, products) =>
  (rows || []).reduce(
    (acc, row) => {
      const totals = rowTotals(row, products);
      return {
        totalPv: fromCents(toCents(acc.totalPv) + toCents(totals.pvTotal)),
        totalMemberCents: acc.totalMemberCents + totals.memberTotalCents,
      };
    },
    { totalPv: 0, totalMemberCents: 0 },
  );

// Shipping is optional and entered as BRL. Empty or invalid input is treated
// as zero so the order total stays a valid amount while typing.
export const shippingCentsFromValue = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(parsed)) return 0;
  return toCents(parsed);
};

export const formatPv = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  return parsed.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatMemberCents = (cents) => {
  if (cents === null || cents === undefined) return '—';
  return formatBRL(fromCents(cents));
};
