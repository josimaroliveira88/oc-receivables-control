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

describe('computeStockDiff with kit items', () => {
  const selfIds = new Set([selfId]);

  const kitItem = (overrides = {}) =>
    item({
      personId: selfId,
      forStock: true,
      productId: 'kit-1',
      kitStockMode: 'COMPONENTS',
      kitSnapshot: [
        { componentProductId: 'comp-a', quantity: 3 },
        { componentProductId: 'comp-b', quantity: 1 },
      ],
      ...overrides,
    });

  it('adds each component times quantity when a COMPONENTS kit item is added', () => {
    const diff = computeStockDiff([], [kitItem({ quantity: 2 })], selfIds);
    expect(diff).toEqual([
      { productId: 'comp-a', delta: 6 },
      { productId: 'comp-b', delta: 2 },
    ]);
  });

  it('reverses each component when a COMPONENTS kit item is removed', () => {
    const diff = computeStockDiff([kitItem({ quantity: 2 })], [], selfIds);
    expect(diff).toEqual([
      { productId: 'comp-a', delta: -6 },
      { productId: 'comp-b', delta: -2 },
    ]);
  });

  it('adjusts components when the quantity of a COMPONENTS kit item changes', () => {
    const diff = computeStockDiff(
      [kitItem({ quantity: 2 })],
      [kitItem({ quantity: 3 })],
      selfIds,
    );
    expect(diff).toEqual([
      { productId: 'comp-a', delta: 3 },
      { productId: 'comp-b', delta: 1 },
    ]);
  });

  it('moves stock from the kit to its components when switching KIT -> COMPONENTS', () => {
    const diff = computeStockDiff(
      [kitItem({ quantity: 2, kitStockMode: 'KIT' })],
      [kitItem({ quantity: 2 })],
      selfIds,
    );
    expect(diff).toEqual([
      { productId: 'kit-1', delta: -2 },
      { productId: 'comp-a', delta: 6 },
      { productId: 'comp-b', delta: 2 },
    ]);
  });

  it('moves stock from components to the kit when switching COMPONENTS -> KIT', () => {
    const diff = computeStockDiff(
      [kitItem({ quantity: 2 })],
      [kitItem({ quantity: 2, kitStockMode: 'KIT' })],
      selfIds,
    );
    expect(diff).toEqual([
      { productId: 'comp-a', delta: -6 },
      { productId: 'comp-b', delta: -2 },
      { productId: 'kit-1', delta: 2 },
    ]);
  });
});
