import { describe, it, expect } from 'vitest';
import { formatProductRowForCopy } from '../src/pages/Products/utils/productHelpers';

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
