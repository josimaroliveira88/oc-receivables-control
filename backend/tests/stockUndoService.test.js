import { undoLastMovement } from '../src/services/stockUndoService.js';

const baseMovement = {
  id: 'mov-1',
  userId: 'user-1',
  productId: 'prod-1',
  quantity: 3,
  type: 'ENTRADA',
  orderId: null,
  createdAt: new Date('2026-01-01T10:00:00Z'),
};

// Minimal Prisma-like transaction client stub. The two `count` calls are
// disambiguated by the presence of `where.createdAt` (newer-movement check)
// versus the total-for-pair check.
const stubClient = ({
  movement = baseMovement,
  order = null,
  newerCount = 0,
  totalForPair = 1,
  inventory = null,
  updatedInventory = null,
} = {}) => ({
  stockMovement: {
    findUnique: vi.fn(async () => movement),
    count: vi.fn(async ({ where }) =>
      where.createdAt !== undefined ? newerCount : totalForPair,
    ),
    delete: vi.fn(async () => movement),
  },
  order: {
    findUnique: vi.fn(async () => order),
  },
  inventory: {
    findUnique: vi.fn(async () => inventory),
    delete: vi.fn(async () => inventory),
    update: vi.fn(async () => updatedInventory),
  },
});

describe('stockUndoService', () => {
  describe('undoLastMovement', () => {
    it('throws 404 "Movement not found" when the movement does not exist', async () => {
      const client = stubClient({ movement: null });

      await expect(
        undoLastMovement(client, { id: 'missing', userId: 'user-1' }),
      ).rejects.toMatchObject({
        status: 404,
        message: 'Movement not found',
      });
    });

    it('throws 404 "Movement not found" when the movement belongs to another user', async () => {
      const client = stubClient({
        movement: { ...baseMovement, userId: 'user-2' },
      });

      await expect(
        undoLastMovement(client, { id: 'mov-1', userId: 'user-1' }),
      ).rejects.toMatchObject({
        status: 404,
        message: 'Movement not found',
      });
    });

    it('rejects an order-locked movement with the Venda label and order reference', async () => {
      const movement = { ...baseMovement, orderId: 'order-1' };
      const client = stubClient({
        movement,
        order: { orderNumber: 'V-0001', orderType: 'VENDA' },
      });

      await expect(
        undoLastMovement(client, { id: 'mov-1', userId: 'user-1' }),
      ).rejects.toMatchObject({
        status: 400,
        message:
          'Esta movimentação está vinculada ao Venda V-0001 e só pode ser desfeita editando ou removendo o item correspondente no pedido.',
        orderNumber: 'V-0001',
        orderId: 'order-1',
      });
      expect(client.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        select: { orderNumber: true, orderType: true },
      });
      expect(client.stockMovement.delete).not.toHaveBeenCalled();
    });

    it('rejects an order-locked movement with the Pedido label and falls back to the orderId when the order row is gone', async () => {
      const movement = { ...baseMovement, orderId: 'order-1' };
      const client = stubClient({ movement, order: null });

      await expect(
        undoLastMovement(client, { id: 'mov-1', userId: 'user-1' }),
      ).rejects.toMatchObject({
        status: 400,
        message:
          'Esta movimentação está vinculada ao Pedido order-1 e só pode ser desfeita editando ou removendo o item correspondente no pedido.',
        orderNumber: undefined,
        orderId: 'order-1',
      });
    });

    it('rejects a non-last movement with the "Apenas a última" rule', async () => {
      const client = stubClient({ newerCount: 1 });

      await expect(
        undoLastMovement(client, { id: 'mov-1', userId: 'user-1' }),
      ).rejects.toMatchObject({
        status: 400,
        message: 'Apenas a última movimentação pode ser desfeita',
      });
      expect(client.stockMovement.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          productId: 'prod-1',
          createdAt: { gt: baseMovement.createdAt },
        },
      });
      expect(client.stockMovement.delete).not.toHaveBeenCalled();
    });

    it('rejects the undo when it would result in negative stock', async () => {
      const client = stubClient({
        inventory: { productId: 'prod-1', quantity: 2 },
      });

      await expect(
        undoLastMovement(client, { id: 'mov-1', userId: 'user-1' }),
      ).rejects.toMatchObject({
        status: 400,
        message: 'Não é possível desfazer: resultaria em estoque negativo',
      });
      expect(client.stockMovement.delete).not.toHaveBeenCalled();
      expect(client.inventory.update).not.toHaveBeenCalled();
    });

    it('deletes the movement and the inventory row when it is the only movement', async () => {
      const inventory = { productId: 'prod-1', quantity: 3 };
      const client = stubClient({
        inventory,
        totalForPair: 1,
      });

      const result = await undoLastMovement(client, {
        id: 'mov-1',
        userId: 'user-1',
      });

      expect(result).toEqual({ movement: baseMovement, inventory: null });
      expect(client.stockMovement.delete).toHaveBeenCalledWith({
        where: { id: 'mov-1' },
      });
      expect(client.inventory.delete).toHaveBeenCalledTimes(1);
      expect(client.inventory.update).not.toHaveBeenCalled();
    });

    it('skips the inventory delete when no inventory row exists', async () => {
      const movement = { ...baseMovement, quantity: 0, type: 'AJUSTE' };
      const client = stubClient({
        movement,
        inventory: null,
        totalForPair: 1,
      });

      const result = await undoLastMovement(client, {
        id: 'mov-1',
        userId: 'user-1',
      });

      expect(result).toEqual({ movement, inventory: null });
      expect(client.inventory.delete).not.toHaveBeenCalled();
    });

    it('decrements the inventory and keeps the row when other movements remain', async () => {
      const client = stubClient({
        inventory: { productId: 'prod-1', quantity: 10 },
        totalForPair: 2,
        updatedInventory: { productId: 'prod-1', quantity: 7 },
      });

      const result = await undoLastMovement(client, {
        id: 'mov-1',
        userId: 'user-1',
      });

      expect(result).toEqual({
        movement: baseMovement,
        inventory: { productId: 'prod-1', quantity: 7 },
      });
      expect(client.inventory.update).toHaveBeenCalledWith({
        where: {
          userId_productId: { userId: 'user-1', productId: 'prod-1' },
        },
        data: { quantity: 7 },
      });
      expect(client.inventory.delete).not.toHaveBeenCalled();
    });
  });
});
