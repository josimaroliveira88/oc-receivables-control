import { badRequest, notFound, forbidden } from '../src/utils/httpError.js';

describe('httpError util', () => {
  describe('badRequest', () => {
    it('returns an Error with status 400 and the given message', () => {
      const error = badRequest('Invalid input');

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Invalid input');
      expect(error.status).toBe(400);
    });
  });

  describe('notFound', () => {
    it('returns an Error with status 404 and the given message', () => {
      const error = notFound('Order not found');

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Order not found');
      expect(error.status).toBe(404);
    });
  });

  describe('forbidden', () => {
    it('returns an Error with status 403 and the given message', () => {
      const error = forbidden('Not allowed');

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Not allowed');
      expect(error.status).toBe(403);
    });
  });

  describe('extras attachment', () => {
    it('allows callers to attach extra fields to the returned error', () => {
      const error = badRequest('Vinculada ao pedido');
      error.orderNumber = 'P-0001';
      error.orderId = 'order-1';

      expect(error.status).toBe(400);
      expect(error.orderNumber).toBe('P-0001');
      expect(error.orderId).toBe('order-1');
    });
  });
});
