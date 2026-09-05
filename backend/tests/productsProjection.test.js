const {
  projectCurrentPrice,
  priceFieldsPresent,
  priceFieldsEqual,
} = require('../src/utils/productsProjection');

const baseProduct = (overrides = {}) => ({
  id: 'product-1',
  code: 'TESTPROJ1',
  name: 'Óleo de Lavanda',
  size: '15 ml',
  status: 'ATIVO',
  productType: 'SIMPLES',
  doterraUrl: 'https://doterra.com/PT/lavanda',
  createdAt: new Date('2026-01-01T10:00:00Z'),
  updatedAt: new Date('2026-02-01T10:00:00Z'),
  prices: [
    {
      regularPrice: '103.00',
      memberPrice: '77.50',
      pv: '9',
      validTo: null,
    },
  ],
  kitComponents: [],
  ...overrides,
});

describe('productsProjection util', () => {
  describe('priceFieldsPresent', () => {
    it('is false when none of the price fields is defined', () => {
      expect(priceFieldsPresent({})).toBe(false);
      expect(priceFieldsPresent({ name: 'Novo nome' })).toBe(false);
    });

    it('is true when any price field is defined', () => {
      expect(priceFieldsPresent({ regularPrice: 10 })).toBe(true);
      expect(priceFieldsPresent({ memberPrice: 10 })).toBe(true);
      expect(priceFieldsPresent({ pv: 10 })).toBe(true);
    });
  });

  describe('priceFieldsEqual', () => {
    it('compares prices in integer cents, mixing strings and numbers', () => {
      const decimal = {
        regularPrice: '103.00',
        memberPrice: '77.50',
        pv: '9',
      };
      const numeric = { regularPrice: 103, memberPrice: 77.5, pv: 9 };

      expect(priceFieldsEqual(decimal, numeric)).toBe(true);
    });

    it('is false when any price field differs', () => {
      const a = { regularPrice: '103.00', memberPrice: '77.50', pv: '9' };
      expect(
        priceFieldsEqual(a, {
          regularPrice: '104.00',
          memberPrice: '77.50',
          pv: '9',
        }),
      ).toBe(false);
      expect(
        priceFieldsEqual(a, {
          regularPrice: '103.00',
          memberPrice: '77.51',
          pv: '9',
        }),
      ).toBe(false);
      expect(
        priceFieldsEqual(a, {
          regularPrice: '103.00',
          memberPrice: '77.50',
          pv: '10',
        }),
      ).toBe(false);
    });

    it('compares without floating-point drift', () => {
      expect(
        priceFieldsEqual(
          { regularPrice: '0.3', memberPrice: '0.3', pv: '0.3' },
          { regularPrice: 0.3, memberPrice: 0.3, pv: 0.3 },
        ),
      ).toBe(true);
      expect(
        priceFieldsEqual(
          { regularPrice: '19.99', memberPrice: '19.99', pv: '19.99' },
          { regularPrice: 19.99, memberPrice: 19.99, pv: 19.99 },
        ),
      ).toBe(true);
    });
  });

  describe('projectCurrentPrice', () => {
    it('projects the product with the current price and pricePerPv', () => {
      const projected = projectCurrentPrice(baseProduct());

      expect(projected).toEqual({
        id: 'product-1',
        code: 'TESTPROJ1',
        name: 'Óleo de Lavanda',
        size: '15 ml',
        status: 'ATIVO',
        productType: 'SIMPLES',
        doterraUrl: 'https://doterra.com/PT/lavanda',
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-02-01T10:00:00Z'),
        regularPrice: '103.00',
        memberPrice: '77.50',
        pv: '9',
        pricePerPv: '8.61',
        components: [],
      });
    });

    it('picks the price whose validTo is null', () => {
      const product = baseProduct({
        prices: [
          {
            regularPrice: '1.00',
            memberPrice: '1.00',
            pv: '1',
            validTo: new Date('2025-12-31'),
          },
          {
            regularPrice: '103.00',
            memberPrice: '77.50',
            pv: '9',
            validTo: null,
          },
        ],
      });

      const projected = projectCurrentPrice(product);

      expect(projected.regularPrice).toBe('103.00');
      expect(projected.pricePerPv).toBe('8.61');
    });

    it('returns null price fields when the product has no prices', () => {
      const projected = projectCurrentPrice(baseProduct({ prices: [] }));

      expect(projected.regularPrice).toBeNull();
      expect(projected.memberPrice).toBeNull();
      expect(projected.pv).toBeNull();
      expect(projected.pricePerPv).toBeNull();
    });

    it('returns null price fields when prices is undefined', () => {
      const projected = projectCurrentPrice(baseProduct({ prices: undefined }));

      expect(projected.regularPrice).toBeNull();
      expect(projected.memberPrice).toBeNull();
      expect(projected.pv).toBeNull();
      expect(projected.pricePerPv).toBeNull();
    });

    it('defaults productType to SIMPLES when missing', () => {
      const projected = projectCurrentPrice(
        baseProduct({ productType: undefined }),
      );

      expect(projected.productType).toBe('SIMPLES');
    });

    it('maps kit components to only id and quantity', () => {
      const product = baseProduct({
        productType: 'KIT',
        kitComponents: [
          {
            componentProductId: 'comp-1',
            quantity: 2,
            product: { id: 'comp-1' },
          },
          { componentProductId: 'comp-2', quantity: 1 },
        ],
      });

      const projected = projectCurrentPrice(product);

      expect(projected.components).toEqual([
        { componentProductId: 'comp-1', quantity: 2 },
        { componentProductId: 'comp-2', quantity: 1 },
      ]);
    });
  });
});
