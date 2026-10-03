import { describe, it, expect } from 'vitest';
import { navigationItems } from '../src/utils/navigation';

describe('navigationItems', () => {
  it('exposes the seven application destinations in order with Finanças last', () => {
    expect(navigationItems.map(({ to }) => to)).toEqual([
      '/people',
      '/orders',
      '/sales',
      '/products',
      '/stock',
      '/credit-cards',
      '/finances',
    ]);
  });

  it('keeps the PT-BR labels in the expected order', () => {
    expect(navigationItems.map(({ label }) => label)).toEqual([
      'Clientes',
      'Pedidos dōTERRA',
      'Vendas',
      'Produtos',
      'Estoque',
      'Cartões de crédito',
      'Finanças',
    ]);
  });

  it('provides an icon component for every item', () => {
    for (const { icon, label } of navigationItems) {
      expect(icon, label).toBeTruthy();
    }
  });

  it('uses unique route paths', () => {
    const paths = navigationItems.map(({ to }) => to);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
