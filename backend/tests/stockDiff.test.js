const { computeStockDiff } = require('../src/utils/stockDiff');

const selfId = 'self-person';
const otherId = 'other-person';

const item = (overrides = {}) => ({
  productId: 'p1',
  quantity: 1,
  forStock: false,
  personId: otherId,
  ...overrides,
});

describe('computeStockDiff', () => {
  const selfIds = new Set([selfId]);

  it('returns empty when there are no self stock items on either side', () => {
    const oldItems = [item()];
    const newItems = [item({ quantity: 3 })];
    expect(computeStockDiff(oldItems, newItems, selfIds)).toEqual([]);
  });

  it('returns ENTRADA delta for a newly added self stock item', () => {
    const diff = computeStockDiff(
      [],
      [item({ personId: selfId, forStock: true, quantity: 5 })],
      selfIds,
    );
    expect(diff).toEqual([{ productId: 'p1', delta: 5 }]);
  });

  it('returns SAIDA delta when a self stock item is removed', () => {
    const diff = computeStockDiff(
      [item({ personId: selfId, forStock: true, quantity: 5 })],
      [],
      selfIds,
    );
    expect(diff).toEqual([{ productId: 'p1', delta: -5 }]);
  });

  it('returns the net delta when a self stock item changes quantity', () => {
    const diff = computeStockDiff(
      [item({ personId: selfId, forStock: true, quantity: 5 })],
      [item({ personId: selfId, forStock: true, quantity: 3 })],
      selfIds,
    );
    expect(diff).toEqual([{ productId: 'p1', delta: -2 }]);
  });

  it('returns the delta when a self stock item increases quantity', () => {
    const diff = computeStockDiff(
      [item({ personId: selfId, forStock: true, quantity: 3 })],
      [item({ personId: selfId, forStock: true, quantity: 7 })],
      selfIds,
    );
    expect(diff).toEqual([{ productId: 'p1', delta: 4 }]);
  });

  it('returns two deltas when the product changes', () => {
    const diff = computeStockDiff(
      [
        item({
          personId: selfId,
          forStock: true,
          productId: 'p1',
          quantity: 3,
        }),
      ],
      [
        item({
          personId: selfId,
          forStock: true,
          productId: 'p2',
          quantity: 5,
        }),
      ],
      selfIds,
    );
    expect(diff).toEqual([
      { productId: 'p1', delta: -3 },
      { productId: 'p2', delta: 5 },
    ]);
  });

  it('ignores self items that are not forStock', () => {
    const diff = computeStockDiff(
      [item({ personId: selfId, forStock: false, quantity: 5 })],
      [item({ personId: selfId, forStock: false, quantity: 5 })],
      selfIds,
    );
    expect(diff).toEqual([]);
  });

  it('ignores forStock items that do not belong to the self person', () => {
    const diff = computeStockDiff(
      [item({ personId: otherId, forStock: true, quantity: 5 })],
      [item({ personId: otherId, forStock: true, quantity: 9 })],
      selfIds,
    );
    expect(diff).toEqual([]);
  });

  it('ignores self forStock items without a productId', () => {
    const diff = computeStockDiff(
      [
        item({
          personId: selfId,
          forStock: true,
          productId: null,
          quantity: 5,
        }),
      ],
      [
        item({
          personId: selfId,
          forStock: true,
          productId: null,
          quantity: 5,
        }),
      ],
      selfIds,
    );
    expect(diff).toEqual([]);
  });

  it('aggregates multiple self stock items of the same product', () => {
    const oldItems = [
      item({ personId: selfId, forStock: true, quantity: 2 }),
      item({ personId: selfId, forStock: true, quantity: 3 }),
    ];
    const newItems = [item({ personId: selfId, forStock: true, quantity: 1 })];
    expect(computeStockDiff(oldItems, newItems, selfIds)).toEqual([
      { productId: 'p1', delta: -4 },
    ]);
  });
});
