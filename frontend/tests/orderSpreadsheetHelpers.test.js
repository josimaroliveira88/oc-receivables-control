import { describe, it, expect } from 'vitest';
import {
  createEmptySpreadsheetRow,
  derivedChargedValueString,
  effectiveChargedValue,
  spreadsheetRowTotals,
  spreadsheetTotals,
  itemFromSpreadsheetRow,
  itemsFromSpreadsheetRows,
  spreadsheetRowFromItem,
  spreadsheetRowsFromItems,
  kitStockModeMissing,
} from '../src/pages/Orders/utils/orderSpreadsheetHelpers';

const products = [
  {
    id: 'p1',
    code: '60226006',
    name: 'Adaptiv Pastilhas',
    memberPrice: '231.25',
    pv: '31',
    productType: 'SIMPLES',
  },
  {
    id: 'p2',
    code: '60226007',
    name: 'Óleo de Lavanda',
    memberPrice: '180.00',
    pv: '30',
    productType: 'SIMPLES',
  },
  {
    id: 'kit1',
    code: 'KIT001',
    name: 'Kit Início',
    memberPrice: '300.00',
    pv: '50',
    productType: 'KIT',
  },
  {
    id: 'noprice',
    code: '0',
    name: 'Sem Preço',
    memberPrice: null,
    pv: null,
    productType: 'SIMPLES',
  },
];

describe('createEmptySpreadsheetRow', () => {
  it('creates an unselected row with the detailed-form defaults', () => {
    const row = createEmptySpreadsheetRow();
    expect(row.productId).toBe('');
    expect(row.quantity).toBe(1);
    expect(row.discountPercent).toBe(0);
    expect(row.chargedValue).toBe('');
    expect(row.chargedValueMode).toBe('UNIT');
    expect(row.forStock).toBe(false);
    expect(row.kitStockMode).toBe('');
    expect(row.details).toBe('');
    expect(row.itemId).toBeNull();
    expect(typeof row.id).toBe('string');
  });

  it('generates unique ids across calls', () => {
    const ids = new Set(
      Array.from({ length: 50 }, () => createEmptySpreadsheetRow().id),
    );
    expect(ids.size).toBe(50);
  });
});

describe('derivedChargedValueString', () => {
  it('derives the member value after the promotion', () => {
    expect(
      derivedChargedValueString(
        { productId: 'p2', discountPercent: 10 },
        products,
      ),
    ).toBe('162');
  });

  it('clamps the promotion percentage to 100%', () => {
    expect(
      derivedChargedValueString(
        { productId: 'p2', discountPercent: 150 },
        products,
      ),
    ).toBe('0');
  });

  it('returns an empty string without a priced product', () => {
    expect(derivedChargedValueString({ productId: 'noprice' }, products)).toBe(
      '',
    );
    expect(derivedChargedValueString({ productId: '' }, products)).toBe('');
  });
});

describe('effectiveChargedValue', () => {
  it('prefers the user-typed value', () => {
    expect(
      effectiveChargedValue({ productId: 'p2', chargedValue: '100' }, products),
    ).toBe('100');
  });

  it('falls back to the derived value', () => {
    expect(effectiveChargedValue({ productId: 'p2' }, products)).toBe('180');
  });
});

describe('spreadsheetRowTotals', () => {
  it('derives the charged line value from the catalog by default', () => {
    const totals = spreadsheetRowTotals(
      { productId: 'p2', quantity: 2 },
      products,
    );
    expect(totals.memberUnitCents).toBe(18000);
    expect(totals.memberTotalCents).toBe(36000);
    expect(totals.chargedLineCents).toBe(36000);
    expect(totals.pvTotal).toBe(60);
  });

  it('honors an explicit charged value in UNIT mode', () => {
    const totals = spreadsheetRowTotals(
      { productId: 'p2', quantity: 2, chargedValue: '100' },
      products,
    );
    expect(totals.chargedLineCents).toBe(20000);
  });

  it('honors an explicit charged value in TOTAL mode', () => {
    const totals = spreadsheetRowTotals(
      {
        productId: 'p2',
        quantity: 2,
        chargedValue: '100',
        chargedValueMode: 'TOTAL',
      },
      products,
    );
    expect(totals.chargedLineCents).toBe(10000);
  });

  it('applies the promotion to PV and member values', () => {
    const totals = spreadsheetRowTotals(
      { productId: 'p1', quantity: 2, discountPercent: 10 },
      products,
    );
    expect(totals.pvUnit).toBe(27.9);
    expect(totals.pvTotal).toBe(55.8);
    expect(totals.memberUnitCents).toBe(20813);
    expect(totals.memberTotalCents).toBe(41626);
  });

  it('applies the promotion to the charged value only', () => {
    const totals = spreadsheetRowTotals(
      { productId: 'p2', quantity: 1, discountPercent: 70 },
      products,
    );
    expect(totals.memberUnitCents).toBe(5400);
    expect(totals.chargedLineCents).toBe(5400);
    expect(totals.pvUnit).toBe(9);
  });

  it('returns zeros and no product flag when nothing is selected', () => {
    const totals = spreadsheetRowTotals(
      { productId: '', quantity: 3 },
      products,
    );
    expect(totals.hasProduct).toBe(false);
    expect(totals.memberTotalCents).toBe(0);
    expect(totals.chargedLineCents).toBe(0);
  });

  it('treats a product without a price as zero charged value', () => {
    const totals = spreadsheetRowTotals(
      { productId: 'noprice', quantity: 2 },
      products,
    );
    expect(totals.hasProduct).toBe(true);
    expect(totals.memberUnitCents).toBeNull();
    expect(totals.chargedLineCents).toBe(0);
  });
});

describe('spreadsheetTotals', () => {
  it('sums PV, member and charged totals across rows', () => {
    const totals = spreadsheetTotals(
      [
        { productId: 'p1', quantity: 1 },
        { productId: 'p2', quantity: 1, discountPercent: 70 },
      ],
      products,
    );
    expect(totals.totalPv).toBe(31 + 9);
    expect(totals.totalMemberCents).toBe(23125 + 5400);
    expect(totals.totalChargedCents).toBe(23125 + 5400);
  });

  it('returns zeros for an empty list', () => {
    expect(spreadsheetTotals([], products)).toEqual({
      totalPv: 0,
      totalMemberCents: 0,
      totalChargedCents: 0,
    });
  });
});

describe('itemFromSpreadsheetRow', () => {
  it('maps the product snapshot and derived charged value in UNIT mode', () => {
    const item = itemFromSpreadsheetRow(
      { productId: 'p2', quantity: 2, discountPercent: 10, forStock: true },
      products,
    );
    expect(item.productId).toBe('p2');
    expect(item.productName).toBe('Óleo de Lavanda');
    expect(item.productCode).toBe('60226007');
    expect(item.memberPrice).toBe('180');
    expect(item.chargedValue).toBe('162');
    expect(item.quantity).toBe(2);
    expect(item.chargedValueMode).toBe('UNIT');
    expect(item.forStock).toBe(true);
    expect(item.kitStockMode).toBe('');
    expect(item).not.toHaveProperty('useCashback');
  });

  it('uses the explicit charged value and mode when provided', () => {
    const item = itemFromSpreadsheetRow(
      {
        productId: 'p2',
        quantity: 2,
        chargedValue: '100',
        chargedValueMode: 'TOTAL',
        details: 'Obs',
      },
      products,
    );
    expect(item.chargedValue).toBe('100');
    expect(item.chargedValueMode).toBe('TOTAL');
    expect(item.details).toBe('Obs');
  });

  it('applies the promotion to the derived charged value', () => {
    const item = itemFromSpreadsheetRow(
      { productId: 'p2', quantity: 1, discountPercent: 70, forStock: true },
      products,
    );
    expect(item.chargedValue).toBe('54');
  });

  it('preserves the original item id when editing', () => {
    const item = itemFromSpreadsheetRow(
      { itemId: 'item-uuid', productId: 'p2', quantity: 1 },
      products,
    );
    expect(item.id).toBe('item-uuid');
  });

  it('omits the id for brand new rows', () => {
    const item = itemFromSpreadsheetRow(
      { productId: 'p2', quantity: 1 },
      products,
    );
    expect(item).not.toHaveProperty('id');
  });

  it('keeps forStock false when the stock flag is off', () => {
    const item = itemFromSpreadsheetRow(
      { productId: 'p2', quantity: 1, forStock: false },
      products,
    );
    expect(item.forStock).toBe(false);
  });

  it('maps a stocked KIT row with its stock mode', () => {
    const item = itemFromSpreadsheetRow(
      {
        productId: 'kit1',
        quantity: 1,
        forStock: true,
        kitStockMode: 'COMPONENTS',
      },
      products,
    );
    expect(item.forStock).toBe(true);
    expect(item.kitStockMode).toBe('COMPONENTS');
  });

  it('binds team items to the order-level client without stock', () => {
    const item = itemFromSpreadsheetRow(
      { productId: 'p2', quantity: 1, forStock: true },
      products,
      { isTeamOrder: true, teamPersonId: 'person-1' },
    );
    expect(item.personId).toBe('person-1');
    expect(item.forStock).toBe(false);
    expect(item.kitStockMode).toBe('');
  });

  it('falls back to an empty charged value for an unpriced product', () => {
    const item = itemFromSpreadsheetRow(
      { productId: 'noprice', quantity: 1 },
      products,
    );
    expect(item.chargedValue).toBe('');
    expect(item.memberPrice).toBe('');
  });
});

describe('itemsFromSpreadsheetRows', () => {
  it('drops rows without a selected product', () => {
    const items = itemsFromSpreadsheetRows(
      [
        { productId: 'p2', quantity: 1 },
        { productId: '', quantity: 3 },
        { productId: 'p1', quantity: 1 },
      ],
      products,
    );
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.productId)).toEqual(['p2', 'p1']);
  });

  it('returns an empty list when no row has a product', () => {
    expect(
      itemsFromSpreadsheetRows([{ productId: '', quantity: 1 }], products),
    ).toEqual([]);
  });
});

describe('spreadsheetRowFromItem', () => {
  it('reconstructs the promotion percentage from the member price', () => {
    const row = spreadsheetRowFromItem({
      id: 'uuid-1',
      productId: 'p2',
      memberPrice: '180',
      chargedValue: '162',
      quantity: 1,
      chargedValueMode: 'UNIT',
    });
    expect(row.itemId).toBe('uuid-1');
    expect(row.discountPercent).toBe(10);
    expect(row.chargedValue).toBe('162');
    expect(row.chargedValueMode).toBe('UNIT');
    expect(row).not.toHaveProperty('useCashback');
  });

  it('converts legacy cashback items into a 70% promotion', () => {
    const row = spreadsheetRowFromItem({
      id: 'uuid-2',
      productId: 'p2',
      memberPrice: '180',
      chargedValue: '54',
      quantity: 1,
      chargedValueMode: 'UNIT',
      useCashback: true,
    });
    expect(row.discountPercent).toBe(70);
    expect(row.chargedValue).toBe('54');
  });

  it('does not infer a promotion in TOTAL mode', () => {
    const row = spreadsheetRowFromItem({
      productId: 'p2',
      memberPrice: '180',
      chargedValue: '360',
      quantity: 2,
      chargedValueMode: 'TOTAL',
    });
    expect(row.discountPercent).toBe(0);
    expect(row.chargedValueMode).toBe('TOTAL');
    expect(row.quantity).toBe(2);
  });

  it('carries forStock, kitStockMode and details', () => {
    const row = spreadsheetRowFromItem({
      productId: 'kit1',
      chargedValue: '300',
      quantity: 1,
      forStock: true,
      kitStockMode: 'KIT',
      details: 'Detalhe',
    });
    expect(row.forStock).toBe(true);
    expect(row.kitStockMode).toBe('KIT');
    expect(row.details).toBe('Detalhe');
  });

  it('ignores items without a uuid and without a discount', () => {
    const row = spreadsheetRowFromItem({
      id: 123,
      productId: '',
      chargedValue: '',
      quantity: 1,
    });
    expect(row.itemId).toBeNull();
    expect(row.productId).toBe('');
    expect(row.discountPercent).toBe(0);
    expect(row.chargedValue).toBe('');
  });

  it('maps a list of items preserving the order', () => {
    const rows = spreadsheetRowsFromItems([
      { id: 'a', productId: 'p1', memberPrice: '231.25', chargedValue: '' },
      { id: 'b', productId: 'p2', memberPrice: '180', chargedValue: '180' },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].itemId).toBe('a');
    expect(rows[1].itemId).toBe('b');
  });
});

describe('kitStockModeMissing', () => {
  it('flags a stocked KIT row without a stock mode', () => {
    expect(
      kitStockModeMissing({ productId: 'kit1', forStock: true }, products),
    ).toBe(true);
  });

  it('accepts a KIT row with a stock mode', () => {
    expect(
      kitStockModeMissing(
        { productId: 'kit1', forStock: true, kitStockMode: 'KIT' },
        products,
      ),
    ).toBe(false);
  });

  it('ignores non-kit, unstocked and unselected rows', () => {
    expect(
      kitStockModeMissing({ productId: 'p1', forStock: true }, products),
    ).toBe(false);
    expect(
      kitStockModeMissing({ productId: 'kit1', forStock: false }, products),
    ).toBe(false);
    expect(kitStockModeMissing({ productId: '' }, products)).toBe(false);
  });
});
