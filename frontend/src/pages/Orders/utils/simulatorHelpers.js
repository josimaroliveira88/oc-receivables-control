import { fromCents, formatBRL, toCents } from '../../../utils/money';

// Monotonic counter combined with a timestamp keeps row ids unique even when
// several rows are created within the same millisecond.
let rowSequence = 0;

// A simulator row is ephemeral: it only references a catalog product and a
// quantity. PV and member values are always derived from the catalog on render.
export const createEmptyRow = () => ({
  id: `sim-${Date.now()}-${rowSequence++}`,
  productId: '',
  quantity: 1,
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

// Per-line totals derived from the selected product, in integer cents for the
// member price (financial correctness) and two-decimal PV for the points.
export const rowTotals = (row, products) => {
  const product = findProduct(products, row.productId);
  const quantity = normalizeQuantity(row.quantity);

  if (!product) {
    return {
      hasProduct: false,
      pvUnit: 0,
      pvTotal: 0,
      memberUnitCents: null,
      memberTotalCents: 0,
    };
  }

  const pvUnitCents = toCents(numberOrZero(product.pv));
  const memberUnitCents = hasPrice(product.memberPrice)
    ? toCents(numberOrZero(product.memberPrice))
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
