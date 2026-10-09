/**
 * Tests for the dōTERRA Back Office detail-page parser inside
 * `tools/captures-extension/src/doterra/content.js`.
 *
 * The content script is a self-contained IIFE (no module exports, no
 * namespace sharing with the Uber scripts — see AGENTS.md), so the tests
 * load it via `require` into the jsdom environment and reach the parsers
 * through the `globalThis.__DOTERRA_PARSERS__` escape hatch installed at
 * the bottom of the script. The sentinel is set in `tests/setup.js`, which
 * runs before this file.
 *
 * The fixtures under `tests/fixtures/` are minimal HTML snapshots of the
 * real Back Office `OrderInvoice` page; the 6-column variant reproduces the
 * BOGO / replacement-order layout that broke the import flow with
 * "Sem itens no detalhe" for one Brazilian consultant.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures');

const loadFixture = (name) =>
  fs.readFileSync(path.join(fixturesDir, name), 'utf8');

const parseDoc = (html) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc;
};

// Load the IIFE via a dynamic import. The script is a self-contained IIFE
// (no module exports) — `import()` simply runs the source for its side
// effects, and `globalThis.__DOTERRA_PARSERS__` (set by `tests/setup.js`
// before the IIFE loads) is populated by the escape hatch at the bottom of
// the file.
const scriptUrl = pathToFileURL(
  path.resolve(__dirname, '../src/doterra/content.js'),
).href;
await import(scriptUrl);

const parsers = globalThis.__DOTERRA_PARSERS__;

if (!parsers) {
  throw new Error(
    'dōTERRA parser escape hatch was not populated. ' +
      'Check that tests/setup.js sets globalThis.__DOTERRA_PARSERS__ before content.js loads.',
  );
}

describe('dōTERRA detail parser — 6-column items table (BOGO / replacement)', () => {
  // The header has 6 columns with no PV column. The previous parser hard-coded
  // `cells.length < 7` → continue and every item row was discarded, producing
  // "Sem itens no detalhe" for the consultant in the bug report.
  const html = loadFixture('detail-6-cols.html');
  const doc = parseDoc(html);

  it('detects all six columns and the absence of a PV column', () => {
    const headerCells = doc.querySelectorAll(
      '.ui.basic.segment.tabledivnm table thead th',
    );
    const columns = parsers.detectItemsColumns(headerCells);

    expect(columns).not.toBeNull();
    expect(columns.codeIdx).toBe(0);
    expect(columns.shippedIdx).toBe(1);
    expect(columns.orderedIdx).toBe(2);
    expect(columns.descriptionIdx).toBe(3);
    expect(columns.pvIdx).toBe(-1);
    expect(columns.unitPriceIdx).toBe(4);
    expect(columns.totalIdx).toBe(5);
  });

  it('parses the BOGO item and surfaces the line price as unitPrice', () => {
    const items = parsers.parseDetailItems(doc);

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      code: '3909',
      description: 'BOGO 2 - Dia 1',
      quantity: 4,
      unitPv: null,
      unitPrice: 199,
    });
  });

  it('reads "Frete (Envio Normal)" as 15.90 (regression for [^0-9R]* gap)', () => {
    const doc6 = parseDoc(loadFixture('detail-6-cols.html'));
    const shipping = parsers.extractShipping(doc6);

    expect(shipping).toBe(15.9);
  });

  it('parseDetail returns the items, freight, total, and Boleto paymentType', () => {
    const detail = parsers.parseDetail(doc);

    expect(detail.items).toHaveLength(1);
    expect(detail.items[0].code).toBe('3909');
    expect(detail.items[0].quantity).toBe(4);
    expect(detail.shippingValue).toBe(15.9);
    expect(detail.total).toBe(811.9);
    expect(detail.paymentType).toBeNull(); // "Boleto" — not Card Payment
    expect(detail.installments).toBeNull();
    expect(detail.installmentValue).toBeNull();
    expect(detail.warnings).toEqual([]);
  });

  it('buildOrderPayload keeps unitPrice = 199 and unitPv = 0 for a BOGO order', () => {
    const detail = parsers.parseDetail(doc);
    const list = {
      orderNumber: '176348264',
      orderDate: '2026-02-18',
      accountOwner: 'Thatiane Camilo Santos',
      listTypeCode: 'I',
      listOriginCode: 'IN',
      pvMonth: '2026-02',
      doterraPv: 0,
      listValue: 811.9,
      paymentHint: 'BOLETO',
      items: [],
    };

    const payload = parsers.buildOrderPayload(list, detail);

    expect(payload.orderNumber).toBe('176348264');
    expect(payload.paymentType).toBe('BOLETO');
    expect(payload.shippingValue).toBe(15.9);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toEqual({
      code: '3909',
      description: 'BOGO 2 - Dia 1',
      quantity: 4,
      unitPrice: 199,
      unitPv: 0, // missing PV defaults to 0, not undefined
    });
  });
});

describe('dōTERRA detail parser — 7-column items table (single product with PV)', () => {
  const html = loadFixture('detail-7-cols.html');
  const doc = parseDoc(html);

  it('detects all seven columns and the PV column at index 4', () => {
    const headerCells = doc.querySelectorAll(
      '.ui.basic.segment.tabledivnm table thead th',
    );
    const columns = parsers.detectItemsColumns(headerCells);

    expect(columns).not.toBeNull();
    expect(columns.codeIdx).toBe(0);
    expect(columns.shippedIdx).toBe(1);
    expect(columns.orderedIdx).toBe(2);
    expect(columns.descriptionIdx).toBe(3);
    expect(columns.pvIdx).toBe(4);
    expect(columns.unitPriceIdx).toBe(5);
    expect(columns.totalIdx).toBe(6);
  });

  it('parses every line with PV, unit price, and total', () => {
    const items = parsers.parseDetailItems(doc);

    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({
      code: '60225158',
      description: 'Lemongrass 15 mL',
      quantity: 1,
      unitPv: 7,
      unitPrice: 119.9,
    });
    expect(items[1]).toEqual({
      code: '60215423',
      description: 'On Guard 15 mL',
      quantity: 1,
      unitPv: 12,
      unitPrice: 215,
    });
    expect(items[2]).toEqual({
      code: '60232721',
      description: 'Deep Blue 5 mL',
      quantity: 2,
      unitPv: 18.5,
      unitPrice: 180,
    });
  });

  it('parseDetail returns Card Payment via the payment table', () => {
    const detail = parsers.parseDetail(doc);

    expect(detail.paymentType).toBe('CARTAO_CREDITO');
    expect(detail.shippingValue).toBe(23);
    expect(detail.total).toBe(717.9);
  });
});

describe('dōTERRA detail parser — installments + 6-column items', () => {
  const html = loadFixture('detail-installments.html');
  const doc = parseDoc(html);

  it('parses both the item and the installment line', () => {
    const detail = parsers.parseDetail(doc);

    expect(detail.items).toHaveLength(1);
    expect(detail.items[0]).toEqual({
      code: '60201234',
      description: 'Breathe Vapor Stick',
      quantity: 2,
      unitPv: null,
      unitPrice: 80,
    });
    expect(detail.installments).toBe(3);
    expect(detail.installmentValue).toBe(53.33);
    expect(detail.paymentType).toBe('CARTAO_CREDITO');
    expect(detail.total).toBe(160);
    expect(detail.shippingValue).toBe(0);
    expect(detail.warnings).toEqual([]);
  });
});

describe('dōTERRA detail parser — empty detail page', () => {
  const html = loadFixture('detail-empty.html');
  const doc = parseDoc(html);

  it('parseDetailItems returns []', () => {
    expect(parsers.parseDetailItems(doc)).toEqual([]);
  });

  it('parseDetail does not throw and reports no items / no freight', () => {
    const detail = parsers.parseDetail(doc);

    expect(detail.items).toEqual([]);
    expect(detail.shippingValue).toBeNull();
    expect(detail.total).toBeNull();
    expect(detail.warnings).toContain(
      'Frete não capturado no detalhe — confira o pedido.',
    );
  });
});

describe('dōTERRA detail parser — money helpers', () => {
  it('parseMoney accepts R$, thousands separators, and Brazilian decimals', () => {
    expect(parsers.parseMoney('R$ 199.00')).toBe(199);
    expect(parsers.parseMoney('R$ 1,045.63')).toBe(1045.63);
    expect(parsers.parseMoney('R$ 7,00')).toBe(7);
    expect(parsers.parseMoney('  R$\u00a0119.90  ')).toBe(119.9);
    expect(parsers.parseMoney('not a price')).toBeNull();
    expect(parsers.parseMoney(null)).toBeNull();
    expect(parsers.parseMoney('')).toBeNull();
  });

  it('parseQuantity strips non-digits and defaults missing to 0', () => {
    expect(parsers.parseQuantity('4')).toBe(4);
    expect(parsers.parseQuantity('Qtde: 12')).toBe(12);
    expect(parsers.parseQuantity('')).toBe(0);
    expect(parsers.parseQuantity('abc')).toBe(0);
  });

  it('toIsoDate converts dd/mm/yyyy without timezone drift', () => {
    expect(parsers.toIsoDate('18/02/2026')).toBe('2026-02-18');
    expect(parsers.toIsoDate('1/2/2026')).toBeNull();
    expect(parsers.toIsoDate('2026-02-18')).toBeNull();
  });

  it('toIsoMonth converts m/yyyy or mm/yyyy', () => {
    expect(parsers.toIsoMonth('2/2026')).toBe('2026-02');
    expect(parsers.toIsoMonth('02/2026')).toBe('2026-02');
    expect(parsers.toIsoMonth('2026-02')).toBeNull();
  });
});

describe('dōTERRA detail parser — list parsers are still exported', () => {
  // The escape hatch exposes the list parsers too; smoke-test that they
  // keep working with the new entry-point so a future refactor of the
  // detection logic cannot accidentally drop them.
  it('parseOrders returns [] for a page without OrderhistoryRows', () => {
    document.body.innerHTML = '<div></div>';
    expect(parsers.parseOrders()).toEqual([]);
  });

  it('parseInquiryOrders returns [] for a page without AITableDiv', () => {
    document.body.innerHTML = '<div></div>';
    expect(parsers.parseInquiryOrders()).toEqual([]);
  });
});
