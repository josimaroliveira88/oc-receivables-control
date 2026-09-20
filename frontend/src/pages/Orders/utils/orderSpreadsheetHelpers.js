import { toCents, fromCents } from '../../../utils/money';
import { CASHBACK_DISCOUNT_RATE } from './orderHelpers';
import {
  normalizeDiscountPercent,
  normalizeQuantity,
} from './simulatorHelpers';

// Spreadsheet order-entry ("Planilha") helpers. A spreadsheet row mirrors a
// simulator row but carries every order-item concern from the detailed form:
// the editable paid value (with its UNIT/TOTAL mode), cashback, the stock
// flag, the KIT stock mode, the item details and the original item id when
// editing. Every monetary value stays in integer cents; conversion back to
// BRL happens only at the boundary (payload / display).
let rowSequence = 0;

const findProduct = (products, productId) =>
  (products || []).find((product) => product.id === productId) || null;

const numberOrZero = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const numberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasPrice = (value) =>
  value !== null && value !== undefined && value !== '';

// Creates an empty spreadsheet row. `itemId` links the row back to an existing
// order item so updateOrder can keep syncing items by id.
export const createEmptySpreadsheetRow = () => ({
  id: `srow-${Date.now()}-${rowSequence++}`,
  itemId: null,
  productId: '',
  quantity: 1,
  discountPercent: 0,
  useCashback: false,
  chargedValue: '',
  chargedValueMode: 'UNIT',
  forStock: false,
  kitStockMode: '',
  details: '',
});

// Derived charged unit value (integer cents) from the catalog member price
// after the promotion percentage and the cashback discount (30% of the member
// value). Returns null when the row has no priced product.
export const derivedChargedUnitCents = (row, products) => {
  const product = findProduct(products, row.productId);
  const memberPrice = product ? numberOrNull(product.memberPrice) : null;
  if (memberPrice === null || memberPrice <= 0) return null;
  const discountFactor =
    1 - normalizeDiscountPercent(row.discountPercent) / 100;
  const cashbackFactor = row.useCashback ? CASHBACK_DISCOUNT_RATE : 1;
  return Math.round(toCents(memberPrice) * discountFactor * cashbackFactor);
};

// BRL string for the derived value, or '' when it cannot be derived. Used to
// prefill the editable "Valor Pago" field whenever the product, promotion or
// cashback changes, mirroring the detailed form behavior.
export const derivedChargedValueString = (row, products) => {
  const cents = derivedChargedUnitCents(row, products);
  return cents === null ? '' : String(fromCents(cents));
};

// The value actually used for the row: the user-typed charged value when
// present, otherwise the value derived from the catalog.
export const effectiveChargedValue = (row, products) =>
  row.chargedValue !== '' && row.chargedValue != null
    ? row.chargedValue
    : derivedChargedValueString(row, products);

// Per-row derived totals in integer cents. PV and member values reflect the
// promotion only; the charged line value respects the UNIT/TOTAL mode and the
// cashback discount.
export const spreadsheetRowTotals = (row, products) => {
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
      chargedLineCents: 0,
    };
  }

  const pvUnitCents = Math.round(
    toCents(numberOrZero(product.pv)) * discountFactor,
  );
  const memberUnitCents = hasPrice(product.memberPrice)
    ? Math.round(toCents(numberOrZero(product.memberPrice)) * discountFactor)
    : null;

  const chargedRaw = effectiveChargedValue(row, products);
  const chargedCents =
    chargedRaw === '' || chargedRaw == null
      ? null
      : toCents(parseFloat(chargedRaw));
  const chargedLineCents =
    chargedCents === null || !Number.isFinite(chargedCents)
      ? 0
      : row.chargedValueMode === 'TOTAL'
        ? chargedCents
        : chargedCents * quantity;

  return {
    hasProduct: true,
    pvUnit: fromCents(pvUnitCents),
    pvTotal: fromCents(pvUnitCents * quantity),
    memberUnitCents,
    memberTotalCents: memberUnitCents === null ? 0 : memberUnitCents * quantity,
    chargedLineCents,
  };
};

// Grand totals across every row: PV, member value and the amount actually
// charged (per-line values already honor mode, promotion and cashback).
export const spreadsheetTotals = (rows, products) =>
  (rows || []).reduce(
    (acc, row) => {
      const totals = spreadsheetRowTotals(row, products);
      return {
        totalPv: fromCents(toCents(acc.totalPv) + toCents(totals.pvTotal)),
        totalMemberCents: acc.totalMemberCents + totals.memberTotalCents,
        totalChargedCents: acc.totalChargedCents + totals.chargedLineCents,
      };
    },
    { totalPv: 0, totalMemberCents: 0, totalChargedCents: 0 },
  );

// Converts a spreadsheet row into the item shape consumed by itemPayload.
// Team orders bind every item to the order-level client and never affect
// stock; regular orders stock an item when the user left the stock flag on.
export const itemFromSpreadsheetRow = (row, products, options = {}) => {
  const { isTeamOrder = false, teamPersonId = '' } = options;
  const product = findProduct(products, row.productId);
  const memberPrice = product ? numberOrNull(product.memberPrice) : null;
  const isKit = !!product && product.productType === 'KIT';
  const forStock = !isTeamOrder && !!product && !!row.forStock;

  return {
    ...(row.itemId ? { id: row.itemId } : {}),
    description: product ? product.name : '',
    chargedValue: effectiveChargedValue(row, products),
    personId: isTeamOrder ? teamPersonId : '',
    productId: row.productId || '',
    productName: product ? product.name : '',
    productCode: product ? product.code : '',
    memberPrice: memberPrice === null ? '' : String(memberPrice),
    details: row.details || '',
    quantity: Math.max(1, Number(row.quantity) || 1),
    forStock,
    useCashback: !!row.useCashback,
    chargedValueMode: row.chargedValueMode || 'UNIT',
    kitStockMode: isKit && forStock ? row.kitStockMode || '' : '',
  };
};

// Builds the payload items from the spreadsheet rows, dropping unselected rows
// (a row without a product has no meaning in this mode). Team binding and the
// product-derived fields flow through itemFromSpreadsheetRow.
export const itemsFromSpreadsheetRows = (rows, products, options = {}) =>
  (rows || [])
    .filter((row) => row.productId)
    .map((row) => itemFromSpreadsheetRow(row, products, options));

// Hydrates a spreadsheet row from an existing order item (edit mode). When the
// item used a UNIT promotion, the percentage is reconstructed from the member
// price so the row shows the same value. Cashback items keep the flag.
export const spreadsheetRowFromItem = (item) => {
  const memberPrice = numberOrNull(item.memberPrice);
  const rawCharged = numberOrNull(item.chargedValue);
  const quantity = Math.max(1, Number(item.quantity) || 1);
  const mode = item.chargedValueMode || 'UNIT';
  const unitCharged =
    mode === 'TOTAL' ? (rawCharged ?? 0) / quantity : rawCharged;
  const useCashback = !!item.useCashback;

  let discountPercent = 0;
  if (
    !useCashback &&
    mode === 'UNIT' &&
    memberPrice !== null &&
    memberPrice > 0 &&
    unitCharged !== null &&
    unitCharged < memberPrice
  ) {
    discountPercent = Math.round((1 - unitCharged / memberPrice) * 10000) / 100;
  }

  return {
    id: `srow-${Date.now()}-${rowSequence++}`,
    itemId: typeof item.id === 'string' && item.id ? item.id : null,
    productId: item.productId || '',
    quantity,
    discountPercent,
    useCashback,
    chargedValue:
      item.chargedValue !== '' && item.chargedValue != null
        ? String(item.chargedValue)
        : '',
    chargedValueMode: mode,
    forStock: !!item.forStock,
    kitStockMode: item.kitStockMode || '',
    details: item.details || '',
  };
};

export const spreadsheetRowsFromItems = (items) =>
  (items || []).map((item) => spreadsheetRowFromItem(item));

// A KIT row becomes invalid when it will be stocked but no stock mode was
// chosen, mirroring the detailed form validation.
export const kitStockModeMissing = (row, products) => {
  const product = findProduct(products, row.productId);
  if (!product || product.productType !== 'KIT') return false;
  if (!row.forStock) return false;
  return !row.kitStockMode;
};
