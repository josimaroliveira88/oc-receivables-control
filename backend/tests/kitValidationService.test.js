const {
  validateKitComponents,
} = require('../src/services/kitValidationService');

const component = (componentProductId, quantity = 1) => ({
  componentProductId,
  quantity,
});

const productRow = (id, productType = 'SIMPLES') => ({ id, productType });

// Minimal Prisma-like client stub: only product.findMany is needed because the
// validation rules either fail before touching the database or do a single
// lookup of the requested component ids.
const stubClient = ({ products = [] } = {}) => ({
  product: {
    findMany: vi.fn(async () => products),
  },
});

describe('kitValidationService', () => {
  describe('validateKitComponents', () => {
    it('rejects a KIT product without components', async () => {
      const client = stubClient();

      await expect(
        validateKitComponents(client, { productType: 'KIT', components: [] }),
      ).rejects.toMatchObject({
        status: 400,
        message: 'A KIT product must have at least one component',
      });
      expect(client.product.findMany).not.toHaveBeenCalled();
    });

    it('rejects a KIT product when components is undefined', async () => {
      const client = stubClient();

      await expect(
        validateKitComponents(client, { productType: 'KIT' }),
      ).rejects.toMatchObject({
        status: 400,
        message: 'A KIT product must have at least one component',
      });
    });

    it('rejects components on a SIMPLES product', async () => {
      const client = stubClient({
        products: [productRow('comp-1')],
      });

      await expect(
        validateKitComponents(client, {
          productType: 'SIMPLES',
          components: [component('comp-1')],
        }),
      ).rejects.toMatchObject({
        status: 400,
        message: 'Components are only allowed for KIT products',
      });
      expect(client.product.findMany).not.toHaveBeenCalled();
    });

    it('accepts a SIMPLES product without components and never queries the database', async () => {
      const client = stubClient();

      await expect(
        validateKitComponents(client, {
          productType: 'SIMPLES',
          components: [],
        }),
      ).resolves.toBeUndefined();
      expect(client.product.findMany).not.toHaveBeenCalled();
    });

    it('accepts a KIT with existing SIMPLES components and queries the exact ids', async () => {
      const client = stubClient({
        products: [productRow('comp-1'), productRow('comp-2')],
      });

      await expect(
        validateKitComponents(client, {
          productType: 'KIT',
          components: [component('comp-1', 2), component('comp-2')],
        }),
      ).resolves.toBeUndefined();
      expect(client.product.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['comp-1', 'comp-2'] } },
      });
    });

    it('rejects the same component twice without querying the database', async () => {
      const client = stubClient({
        products: [productRow('comp-1')],
      });

      await expect(
        validateKitComponents(client, {
          productType: 'KIT',
          components: [component('comp-1'), component('comp-1')],
        }),
      ).rejects.toMatchObject({
        status: 400,
        message: 'A kit cannot contain the same component twice',
      });
      expect(client.product.findMany).not.toHaveBeenCalled();
    });

    it('rejects a kit that contains itself without querying the database', async () => {
      const client = stubClient({
        products: [productRow('kit-1'), productRow('comp-1')],
      });

      await expect(
        validateKitComponents(client, {
          productId: 'kit-1',
          productType: 'KIT',
          components: [component('kit-1'), component('comp-1')],
        }),
      ).rejects.toMatchObject({
        status: 400,
        message: 'A kit cannot contain itself',
      });
      expect(client.product.findMany).not.toHaveBeenCalled();
    });

    it('allows a component id equal to the productId when no productId is given (create path)', async () => {
      const client = stubClient({
        products: [productRow('kit-1')],
      });

      await expect(
        validateKitComponents(client, {
          productType: 'KIT',
          components: [component('kit-1')],
        }),
      ).resolves.toBeUndefined();
    });

    it('rejects components that do not exist', async () => {
      const client = stubClient({
        products: [productRow('comp-1')],
      });

      await expect(
        validateKitComponents(client, {
          productType: 'KIT',
          components: [component('comp-1'), component('missing')],
        }),
      ).rejects.toMatchObject({
        status: 400,
        message: 'One or more components do not exist',
      });
    });

    it('rejects nested kits (component product of type KIT)', async () => {
      const client = stubClient({
        products: [productRow('comp-1'), productRow('nested-kit', 'KIT')],
      });

      await expect(
        validateKitComponents(client, {
          productType: 'KIT',
          components: [component('comp-1'), component('nested-kit')],
        }),
      ).rejects.toMatchObject({
        status: 400,
        message: 'A kit can only contain SIMPLES products',
      });
    });
  });
});
