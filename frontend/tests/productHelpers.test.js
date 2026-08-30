import { describe, it, expect } from 'vitest';
import {
  formatProductRowForCopy,
  filterAndSortProducts,
} from '../src/pages/Products/utils/productHelpers';

describe('formatProductRowForCopy', () => {
  it('should format a full row with name, size and prices', () => {
    const product = {
      code: '60203876',
      name: 'Basil',
      size: '15 ml',
      regularPrice: 307,
      memberPrice: 230,
      pv: 27,
    };

    expect(formatProductRowForCopy(product)).toBe(
      [
        'Basil (15 ml)',
        'Preço Regular: R$\u00A0307,00',
        'Preço de Membros: R$\u00A0230,00',
        'PV: 27',
      ].join('\n'),
    );
  });

  it('should append the product URL as the last line when it exists', () => {
    const product = {
      code: '60203876',
      name: 'Basil',
      size: '15 ml',
      regularPrice: 307,
      memberPrice: 230,
      pv: 27,
      doterraUrl: 'https://www.doterra.com/BR/pt_BR/p/basil',
    };

    expect(formatProductRowForCopy(product)).toBe(
      [
        'Basil (15 ml)',
        'Preço Regular: R$\u00A0307,00',
        'Preço de Membros: R$\u00A0230,00',
        'PV: 27',
        'https://www.doterra.com/BR/pt_BR/p/basil',
      ].join('\n'),
    );
  });

  it('should omit the size parentheses when size is empty', () => {
    const product = {
      code: '60203876',
      name: 'Basil',
      size: '',
      regularPrice: 307,
      memberPrice: 230,
      pv: 27,
    };

    expect(formatProductRowForCopy(product)).toBe(
      [
        'Basil',
        'Preço Regular: R$\u00A0307,00',
        'Preço de Membros: R$\u00A0230,00',
        'PV: 27',
      ].join('\n'),
    );
  });

  it('should omit the size parentheses when size is null', () => {
    const product = {
      code: '60203876',
      name: 'Basil',
      size: null,
      regularPrice: 307,
      memberPrice: 230,
      pv: 27,
    };

    const result = formatProductRowForCopy(product);
    expect(result).toContain('Basil\n');
    expect(result).not.toContain('(');
  });

  it('should preserve newline separators between fields', () => {
    const product = {
      code: '1',
      name: 'Produto',
      size: '10 ml',
      regularPrice: 10,
      memberPrice: 8,
      pv: 1,
    };

    expect(formatProductRowForCopy(product).split('\n')).toHaveLength(4);
  });

  it('should have 5 lines when the product has a URL', () => {
    const product = {
      code: '1',
      name: 'Produto',
      size: '10 ml',
      regularPrice: 10,
      memberPrice: 8,
      pv: 1,
      doterraUrl: 'https://www.doterra.com/BR/pt_BR/p/produto',
    };

    expect(formatProductRowForCopy(product).split('\n')).toHaveLength(5);
  });
});

describe('filterAndSortProducts', () => {
  const products = [
    {
      id: '1',
      code: '60226006',
      name: 'Adaptiv® Pastilhas',
      size: '60 pastilhas',
      status: 'ATIVO',
      regularPrice: '308.00',
      memberPrice: '231.25',
      pv: '31',
      pricePerPv: '7.46',
    },
    {
      id: '2',
      code: '60215485',
      name: 'Basil',
      size: '5 ml',
      status: 'INATIVO',
      regularPrice: '103.00',
      memberPrice: '77.50',
      pv: '9',
      pricePerPv: '8.61',
    },
    {
      id: '3',
      code: '60230001',
      name: 'Deep Blue',
      size: '10 ml',
      status: 'INDISPONIVEL',
      regularPrice: '150.00',
      memberPrice: '112.50',
      pv: '15',
      pricePerPv: '7.50',
    },
  ];

  it('should sort by name ascending by default', () => {
    const result = filterAndSortProducts(products, '', '', 'name', 'asc');
    expect(result.map((p) => p.name)).toEqual([
      'Adaptiv® Pastilhas',
      'Basil',
      'Deep Blue',
    ]);
  });

  it('should fall back to name ascending for an unknown sort field', () => {
    const result = filterAndSortProducts(products, '', '', 'status', 'asc');
    expect(result.map((p) => p.name)).toEqual([
      'Adaptiv® Pastilhas',
      'Basil',
      'Deep Blue',
    ]);
  });

  it('should sort by code descending', () => {
    const result = filterAndSortProducts(products, '', '', 'code', 'desc');
    expect(result.map((p) => p.code)).toEqual([
      '60230001',
      '60226006',
      '60215485',
    ]);
  });

  it('should sort by size ascending alphabetically', () => {
    const result = filterAndSortProducts(products, '', '', 'size', 'asc');
    expect(result.map((p) => p.size)).toEqual([
      '10 ml',
      '5 ml',
      '60 pastilhas',
    ]);
  });

  it('should sort by regular price numerically even when values are strings', () => {
    const result = filterAndSortProducts(
      products,
      '',
      '',
      'regularPrice',
      'asc',
    );
    expect(result.map((p) => p.name)).toEqual([
      'Basil',
      'Deep Blue',
      'Adaptiv® Pastilhas',
    ]);
  });

  it('should sort by pricePerPv handling null values as zero', () => {
    const withNull = [
      { ...products[0], pricePerPv: null },
      products[1],
      products[2],
    ];
    const result = filterAndSortProducts(withNull, '', '', 'pricePerPv', 'asc');
    expect(result.map((p) => p.name)).toEqual([
      'Adaptiv® Pastilhas',
      'Deep Blue',
      'Basil',
    ]);
  });

  it('should keep the status filter applied when sorting', () => {
    const result = filterAndSortProducts(products, '', 'ATIVO', 'pv', 'desc');
    expect(result.map((p) => p.name)).toEqual(['Adaptiv® Pastilhas']);
  });
});
