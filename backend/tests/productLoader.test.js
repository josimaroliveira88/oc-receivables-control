const prisma = require('../src/config/database');
const { parseProductCsv } = require('../src/utils/csvParser');
const { loadProductCatalog } = require('../src/utils/productLoader');

const HEADER = 'codigo;produto;tamanho;preco_regular;preco_membros;pv';

function csvRow(code, name, size, regular, member, pv) {
  return `${code};${name};${size};${regular};${member};${pv}`;
}

describe('parseProductCsv', () => {
  it('should parse valid rows skipping the header', () => {
    const csv = [
      HEADER,
      '60226006;Adaptiv® Pastilhas;60 pastilhas;308.00;231.25;31',
      '60215485;Basil;5 ml;103.00;77.50;9',
    ].join('\n');

    const rows = parseProductCsv(csv);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      code: '60226006',
      name: 'Adaptiv® Pastilhas',
      size: '60 pastilhas',
      regularPrice: '308.00',
      memberPrice: '231.25',
      pv: '31',
    });
  });

  it('should keep monetary values as strings to preserve precision', () => {
    const rows = parseProductCsv([HEADER, csvRow('60203876', 'Basil', '15 ml', '307.00', '230.00', '27')].join('\n'));
    expect(typeof rows[0].regularPrice).toBe('string');
    expect(rows[0].regularPrice).toBe('307.00');
  });

  it('should support fractional pv values', () => {
    const rows = parseProductCsv([HEADER, csvRow('60228314', 'Body Splash', '100 ml', '191.00', '142.88', '18.50')].join('\n'));
    expect(rows[0].pv).toBe('18.50');
  });

  it('should support empty file', () => {
    expect(parseProductCsv('')).toEqual([]);
  });

  it('should throw on malformed row', () => {
    const csv = [HEADER, '60226006;Adaptiv® Pastilhas;60 pastilhas;308.00'].join('\n');
    expect(() => parseProductCsv(csv)).toThrow(/Invalid row/);
  });
});

describe('loadProductCatalog', () => {
  let originalStates;

  beforeAll(async () => {
    // Snapshot the real catalog state so tests can restore it afterward.
    // The loader deactivates every product absent from the loaded CSV, so test
    // loads of TEST-only catalogs would otherwise disable the real products.
    originalStates = await prisma.product.findMany({
      select: { id: true, status: true },
    });
  });

  beforeEach(async () => {
    // Deactivate all non-test products so deactivation counts are deterministic
    // and only TEST products participate in assertions.
    await prisma.product.updateMany({
      where: { NOT: { code: { startsWith: 'TEST' } } },
      data: { status: "INATIVO" },
    });
  });

  afterEach(async () => {
    await prisma.product.deleteMany({ where: { code: { startsWith: 'TEST' } } });
  });

  afterAll(async () => {
    // Restore the original active state of every real product.
    for (const product of originalStates) {
      await prisma.product
        .update({
          where: { id: product.id },
          data: { status: product.status },
        })
        .catch(() => {});
    }
  });

  function rowsFrom(objects) {
    return objects.map((o) => ({
      code: o.code,
      name: o.name,
      size: o.size,
      regularPrice: o.regularPrice,
      memberPrice: o.memberPrice,
      pv: o.pv,
    }));
  }

  it('should create products with an active price on initial load', async () => {
    const rows = rowsFrom([
      { code: 'TEST0001', name: 'Adaptiv® Pastilhas', size: '60 pastilhas', regularPrice: '308.00', memberPrice: '231.25', pv: '31' },
      { code: 'TEST0002', name: 'Basil', size: '5 ml', regularPrice: '103.00', memberPrice: '77.50', pv: '9' },
    ]);

    const summary = await loadProductCatalog(prisma, rows);

    expect(summary.created).toBe(2);
    expect(summary.unchanged).toBe(0);

    const products = await prisma.product.findMany({
      where: { code: { in: ['TEST0001', 'TEST0002'] } },
      include: { prices: true },
    });
    expect(products).toHaveLength(2);
    for (const product of products) {
      expect(product.status).toBe("ATIVO");
      expect(product.prices).toHaveLength(1);
      expect(product.prices[0].validTo).toBeNull();
      expect(parseFloat(product.prices[0].regularPrice)).toBe(product.code === 'TEST0001' ? 308.0 : 103.0);
    }
  });

  it('should be idempotent — re-running identical load changes nothing', async () => {
    const rows = rowsFrom([
      { code: 'TEST0001', name: 'Adaptiv® Pastilhas', size: '60 pastilhas', regularPrice: '308.00', memberPrice: '231.25', pv: '31' },
    ]);

    await loadProductCatalog(prisma, rows);
    const summary = await loadProductCatalog(prisma, rows);

    expect(summary.created).toBe(0);
    expect(summary.unchanged).toBe(1);
    expect(summary.priceChanged).toBe(0);

    const product = await prisma.product.findUnique({
      where: { code: 'TEST0001' },
      include: { prices: true },
    });
    expect(product.prices).toHaveLength(1);
  });

  it('should close old price and create new one when a price changes, preserving history', async () => {
    const initial = rowsFrom([
      { code: 'TEST0001', name: 'Adaptiv® Pastilhas', size: '60 pastilhas', regularPrice: '308.00', memberPrice: '231.25', pv: '31' },
    ]);
    await loadProductCatalog(prisma, initial);

    const updated = rowsFrom([
      { code: 'TEST0001', name: 'Adaptiv® Pastilhas', size: '60 pastilhas', regularPrice: '320.00', memberPrice: '240.00', pv: '32' },
    ]);
    const summary = await loadProductCatalog(prisma, updated);

    expect(summary.priceChanged).toBe(1);

    const product = await prisma.product.findUnique({
      where: { code: 'TEST0001' },
      include: { prices: { orderBy: { validFrom: 'asc' } } },
    });
    expect(product.prices).toHaveLength(2);
    expect(parseFloat(product.prices[0].regularPrice)).toBe(308.0);
    expect(product.prices[0].validTo).not.toBeNull();
    expect(parseFloat(product.prices[1].regularPrice)).toBe(320.0);
    expect(product.prices[1].validTo).toBeNull();
  });

  it('should update product metadata when name or size changes without price change', async () => {
    const initial = rowsFrom([
      { code: 'TEST0001', name: 'Basil', size: '5 ml', regularPrice: '103.00', memberPrice: '77.50', pv: '9' },
    ]);
    await loadProductCatalog(prisma, initial);

    const renamed = rowsFrom([
      { code: 'TEST0001', name: 'Basil - Manjericão', size: '15 ml', regularPrice: '103.00', memberPrice: '77.50', pv: '9' },
    ]);
    const summary = await loadProductCatalog(prisma, renamed);

    expect(summary.updated).toBe(1);

    const product = await prisma.product.findUnique({ where: { code: 'TEST0001' }, include: { prices: true } });
    expect(product.name).toBe('Basil - Manjericão');
    expect(product.size).toBe('15 ml');
    expect(product.prices).toHaveLength(1);
  });

  it('should deactivate products missing from the CSV and reactivate when they return', async () => {
    const firstLoad = rowsFrom([
      { code: 'TEST0001', name: 'Basil', size: '5 ml', regularPrice: '103.00', memberPrice: '77.50', pv: '9' },
      { code: 'TEST0002', name: 'Cedarwood', size: '15 ml', regularPrice: '140.00', memberPrice: '105.00', pv: '14' },
    ]);
    await loadProductCatalog(prisma, firstLoad);

    const secondLoad = rowsFrom([
      { code: 'TEST0001', name: 'Basil', size: '5 ml', regularPrice: '103.00', memberPrice: '77.50', pv: '9' },
    ]);
    const summary = await loadProductCatalog(prisma, secondLoad);

    expect(summary.deactivated).toBe(1);
    const deactivated = await prisma.product.findUnique({ where: { code: 'TEST0002' } });
    expect(deactivated.status).toBe("INATIVO");

    const thirdLoad = rowsFrom([
      { code: 'TEST0001', name: 'Basil', size: '5 ml', regularPrice: '103.00', memberPrice: '77.50', pv: '9' },
      { code: 'TEST0002', name: 'Cedarwood', size: '15 ml', regularPrice: '140.00', memberPrice: '105.00', pv: '14' },
    ]);
    const summary3 = await loadProductCatalog(prisma, thirdLoad);

    const reactivated = await prisma.product.findUnique({ where: { code: 'TEST0002' } });
    expect(reactivated.status).toBe("ATIVO");
    expect(summary3.created).toBe(0);
  });

  it('should preserve the INDISPONIVEL status of a product present in the CSV', async () => {
    const rows = rowsFrom([
      { code: 'TEST0001', name: 'Basil', size: '5 ml', regularPrice: '103.00', memberPrice: '77.50', pv: '9' },
    ]);
    await loadProductCatalog(prisma, rows);

    await prisma.product.update({
      where: { code: 'TEST0001' },
      data: { status: 'INDISPONIVEL' },
    });

    const summary = await loadProductCatalog(prisma, rows);

    expect(summary.deactivated).toBe(0);
    const product = await prisma.product.findUnique({ where: { code: 'TEST0001' } });
    expect(product.status).toBe('INDISPONIVEL');
  });

  it('should not deactivate an INDISPONIVEL product that is missing from the CSV', async () => {
    const rows = rowsFrom([
      { code: 'TEST0001', name: 'Basil', size: '5 ml', regularPrice: '103.00', memberPrice: '77.50', pv: '9' },
      { code: 'TEST0002', name: 'Cedarwood', size: '15 ml', regularPrice: '140.00', memberPrice: '105.00', pv: '14' },
    ]);
    await loadProductCatalog(prisma, rows);

    await prisma.product.update({
      where: { code: 'TEST0002' },
      data: { status: 'INDISPONIVEL' },
    });

    const partial = rowsFrom([
      { code: 'TEST0001', name: 'Basil', size: '5 ml', regularPrice: '103.00', memberPrice: '77.50', pv: '9' },
    ]);
    const summary = await loadProductCatalog(prisma, partial);

    expect(summary.deactivated).toBe(0);
    const product = await prisma.product.findUnique({ where: { code: 'TEST0002' } });
    expect(product.status).toBe('INDISPONIVEL');
  });

  it('should add new products to the catalog without touching existing ones', async () => {
    const firstLoad = rowsFrom([
      { code: 'TEST0001', name: 'Basil', size: '5 ml', regularPrice: '103.00', memberPrice: '77.50', pv: '9' },
    ]);
    await loadProductCatalog(prisma, firstLoad);

    const secondLoad = rowsFrom([
      { code: 'TEST0001', name: 'Basil', size: '5 ml', regularPrice: '103.00', memberPrice: '77.50', pv: '9' },
      { code: 'TEST0003', name: 'Copaíba', size: '15 ml', regularPrice: '320.00', memberPrice: '240.00', pv: '40' },
    ]);
    const summary = await loadProductCatalog(prisma, secondLoad);

    expect(summary.created).toBe(1);
    const newProduct = await prisma.product.findUnique({ where: { code: 'TEST0003' }, include: { prices: true } });
    expect(newProduct.status).toBe("ATIVO");
    expect(newProduct.prices).toHaveLength(1);
  });

  it('should preserve unchanged prices when only metadata changes (no duplicate price rows)', async () => {
    const initial = rowsFrom([
      { code: 'TEST0001', name: 'Basil', size: '5 ml', regularPrice: '103.00', memberPrice: '77.50', pv: '9' },
    ]);
    await loadProductCatalog(prisma, initial);

    const renamed = rowsFrom([
      { code: 'TEST0001', name: 'Basil (Ingestão)', size: '5 ml', regularPrice: '103.00', memberPrice: '77.50', pv: '9' },
    ]);
    await loadProductCatalog(prisma, renamed);

    const product = await prisma.product.findUnique({ where: { code: 'TEST0001' }, include: { prices: true } });
    expect(product.prices).toHaveLength(1);
  });

  it('should support a retroactive validFrom date passed as an option', async () => {
    const initial = rowsFrom([
      { code: 'TEST0001', name: 'Adaptiv® Pastilhas', size: '60 pastilhas', regularPrice: '308.00', memberPrice: '231.25', pv: '31' },
    ]);
    await loadProductCatalog(prisma, initial, { validFrom: new Date('2026-01-15T00:00:00') });

    const retroDate = new Date('2026-02-01T00:00:00');
    const updated = rowsFrom([
      { code: 'TEST0001', name: 'Adaptiv® Pastilhas', size: '60 pastilhas', regularPrice: '320.00', memberPrice: '240.00', pv: '32' },
    ]);
    const summary = await loadProductCatalog(prisma, updated, { validFrom: retroDate });

    expect(summary.priceChanged).toBe(1);

    const product = await prisma.product.findUnique({
      where: { code: 'TEST0001' },
      include: { prices: { orderBy: { validFrom: 'asc' } } },
    });
    expect(product.prices).toHaveLength(2);
    expect(product.prices[0].validFrom).toEqual(new Date('2026-01-15T00:00:00'));
    expect(product.prices[0].validTo).toEqual(retroDate);
    expect(product.prices[1].validFrom).toEqual(retroDate);
    expect(product.prices[1].validTo).toBeNull();
  });

  it('should use the passed validFrom for newly created products too', async () => {
    const rows = rowsFrom([
      { code: 'TEST0001', name: 'Basil', size: '5 ml', regularPrice: '103.00', memberPrice: '77.50', pv: '9' },
    ]);

    await loadProductCatalog(prisma, rows, { validFrom: new Date('2026-03-10T00:00:00') });

    const product = await prisma.product.findUnique({ where: { code: 'TEST0001' }, include: { prices: true } });
    expect(product.prices).toHaveLength(1);
    expect(product.prices[0].validFrom).toEqual(new Date('2026-03-10T00:00:00'));
  });

  it('should not persist any change when dryRun is true', async () => {
    const initial = rowsFrom([
      { code: 'TEST0001', name: 'Adaptiv® Pastilhas', size: '60 pastilhas', regularPrice: '308.00', memberPrice: '231.25', pv: '31' },
    ]);
    await loadProductCatalog(prisma, initial);

    const updated = rowsFrom([
      { code: 'TEST0001', name: 'Adaptiv® Pastilhas', size: '60 pastilhas', regularPrice: '320.00', memberPrice: '240.00', pv: '32' },
      { code: 'TEST0002', name: 'Novo Produto', size: '15 ml', regularPrice: '200.00', memberPrice: '150.00', pv: '20' },
    ]);

    const summary = await loadProductCatalog(prisma, updated, { dryRun: true });

    expect(summary.priceChanged).toBe(1);
    expect(summary.created).toBe(1);

    const product = await prisma.product.findUnique({ where: { code: 'TEST0001' }, include: { prices: true } });
    expect(product.prices).toHaveLength(1);
    expect(parseFloat(product.prices[0].regularPrice)).toBe(308.0);
    expect(product.prices[0].validTo).toBeNull();

    const newProduct = await prisma.product.findUnique({ where: { code: 'TEST0002' } });
    expect(newProduct).toBeNull();
  });

  it('should report deactivations in dryRun without applying them', async () => {
    const initial = rowsFrom([
      { code: 'TEST0001', name: 'Basil', size: '5 ml', regularPrice: '103.00', memberPrice: '77.50', pv: '9' },
      { code: 'TEST0002', name: 'Cedarwood', size: '15 ml', regularPrice: '140.00', memberPrice: '105.00', pv: '14' },
    ]);
    await loadProductCatalog(prisma, initial);

    const partial = rowsFrom([
      { code: 'TEST0001', name: 'Basil', size: '5 ml', regularPrice: '103.00', memberPrice: '77.50', pv: '9' },
    ]);
    const summary = await loadProductCatalog(prisma, partial, { dryRun: true });

    expect(summary.deactivated).toBe(1);

    const stillActive = await prisma.product.findUnique({ where: { code: 'TEST0002' } });
    expect(stillActive.status).toBe("ATIVO");
  });
});
