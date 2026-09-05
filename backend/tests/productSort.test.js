import {
  sortProducts,
  SORTABLE_FIELDS,
  NUMERIC_SORT_FIELDS,
} from '../src/utils/productSort.js';

const product = (code, name, extra = {}) => ({
  code,
  name,
  ...extra,
});

describe('productSort util', () => {
  describe('SORTABLE_FIELDS / NUMERIC_SORT_FIELDS', () => {
    it('exposes the sortable and numeric field lists', () => {
      expect(SORTABLE_FIELDS).toEqual([
        'name',
        'code',
        'regularPrice',
        'memberPrice',
        'pricePerPv',
        'pv',
      ]);
      expect(NUMERIC_SORT_FIELDS).toEqual([
        'regularPrice',
        'memberPrice',
        'pricePerPv',
        'pv',
      ]);
    });
  });

  describe('sortProducts', () => {
    it('defaults to name ascending when sortBy is missing or unknown', () => {
      const products = [
        product('P3', 'Óleo de Limão'),
        product('P1', 'Óleo de Hortelã'),
        product('P2', 'Óleo de Lavanda'),
      ];

      for (const sortBy of [undefined, 'bogus']) {
        const sorted = sortProducts(products, sortBy, undefined);
        expect(sorted.map((p) => p.name)).toEqual([
          'Óleo de Hortelã',
          'Óleo de Lavanda',
          'Óleo de Limão',
        ]);
      }
    });

    it('sorts names with pt-BR locale ordering', () => {
      const products = [
        product('P4', 'Óleo de Olíbano'),
        product('P1', 'Óleo de Hortelã'),
        product('P3', 'Óleo de Limão'),
        product('P2', 'Óleo de Lavanda'),
      ];

      const sorted = sortProducts(products, 'name', undefined);

      expect(sorted.map((p) => p.code)).toEqual(['P1', 'P2', 'P3', 'P4']);
    });

    it('sorts by code ascending and descending', () => {
      const products = [
        product('TESTCRUD3', 'C'),
        product('TESTCRUD1', 'A'),
        product('TESTCRUD2', 'B'),
      ];

      const asc = sortProducts(products, 'code', 'asc');
      expect(asc.map((p) => p.code)).toEqual([
        'TESTCRUD1',
        'TESTCRUD2',
        'TESTCRUD3',
      ]);

      const desc = sortProducts(products, 'code', 'desc');
      expect(desc.map((p) => p.code)).toEqual([
        'TESTCRUD3',
        'TESTCRUD2',
        'TESTCRUD1',
      ]);
    });

    it('sorts numeric fields parsing decimal strings', () => {
      const products = [
        product('P1', 'Lavanda', { pv: '15' }),
        product('P2', 'Hortelã', { pv: '9' }),
        product('P3', 'Olíbano', { pv: '30' }),
        product('P4', 'Limão', { pv: '12' }),
      ];

      const asc = sortProducts(products, 'pv', 'asc');
      expect(asc.map((p) => p.code)).toEqual(['P2', 'P4', 'P1', 'P3']);

      const desc = sortProducts(products, 'pv', 'desc');
      expect(desc.map((p) => p.code)).toEqual(['P3', 'P1', 'P4', 'P2']);
    });

    it('sorts by pricePerPv numerically', () => {
      const products = [
        product('P1', 'Lavanda', { pricePerPv: '9.72' }),
        product('P2', 'Hortelã', { pricePerPv: '8.61' }),
        product('P3', 'Olíbano', { pricePerPv: '6.25' }),
      ];

      const sorted = sortProducts(products, 'pricePerPv', 'asc');
      expect(sorted.map((p) => p.code)).toEqual(['P3', 'P2', 'P1']);
    });

    it('treats missing or null numeric values as 0', () => {
      const products = [
        product('P1', 'Com preço', { pv: '9' }),
        product('P2', 'Sem preço', { pv: null }),
      ];

      const asc = sortProducts(products, 'pv', 'asc');
      expect(asc.map((p) => p.code)).toEqual(['P2', 'P1']);

      const desc = sortProducts(products, 'pv', 'desc');
      expect(desc.map((p) => p.code)).toEqual(['P1', 'P2']);
    });

    it('treats any direction other than "desc" as ascending', () => {
      const products = [product('P2', 'B'), product('P1', 'A')];

      for (const sortDir of [undefined, 'asc', 'ASC', 'x']) {
        const sorted = sortProducts(products, 'name', sortDir);
        expect(sorted.map((p) => p.name)).toEqual(['A', 'B']);
      }
    });

    it('does not mutate the input array', () => {
      const products = [product('P2', 'B'), product('P1', 'A')];

      const sorted = sortProducts(products, 'name', undefined);

      expect(products.map((p) => p.name)).toEqual(['B', 'A']);
      expect(sorted).not.toBe(products);
    });
  });
});
