import { ZodError } from 'zod';
import { handleError } from '../src/middlewares/errorResponse.js';
import { badRequest, notFound } from '../src/utils/httpError.js';

const stubRes = () => {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  return res;
};

describe('errorResponse middleware', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('ZodError mapping', () => {
    it('responds 400 with the zod error list and does not log', () => {
      const res = stubRes();
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['name'],
          message: 'Expected string, received number',
        },
      ]);

      handleError(res, zodError, { label: 'Test' });

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        error: [
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['name'],
            message: 'Esperado texto, recebido número',
          },
        ],
      });
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('status-carrying errors', () => {
    it('responds with the error status and message without logging', () => {
      const res = stubRes();

      handleError(res, badRequest('Invalid payload'), { label: 'Test' });

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid payload' });
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('responds 404 from a notFound error', () => {
      const res = stubRes();

      handleError(res, notFound('Order not found'), { label: 'Test' });

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'Order not found' });
    });

    it('copies orderNumber and orderId extras into the response body', () => {
      const res = stubRes();
      const error = badRequest('Esta movimentação está vinculada ao Pedido 1');
      error.orderNumber = 'P-0001';
      error.orderId = 'order-1';

      handleError(res, error, { label: 'Test' });

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        error: 'Esta movimentação está vinculada ao Pedido 1',
        orderNumber: 'P-0001',
        orderId: 'order-1',
      });
    });

    it('does not add extra keys when they are absent', () => {
      const res = stubRes();

      handleError(res, notFound('Movement not found'), { label: 'Test' });

      expect(res.body).toEqual({ error: 'Movement not found' });
    });
  });

  describe('fallback for unexpected errors', () => {
    it('logs and responds 500 with a generic message by default', () => {
      const res = stubRes();

      handleError(res, new Error('boom'), { label: 'Error creating order' });

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: 'Erro interno do servidor' });
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error creating order:',
        expect.any(Error),
      );
    });

    it('uses the provided fallback status with a generic message', () => {
      const res = stubRes();

      handleError(res, new Error('Prisma exploded'), {
        label: 'Test',
        fallback: 400,
      });

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'Erro interno do servidor' });
    });

    it('responds with the generic message for non-error values', () => {
      const res = stubRes();

      handleError(res, 'not an error object', { label: 'Test' });

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: 'Erro interno do servidor' });
    });
  });
});
