const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const prisma = new PrismaClient();
const { toCents } = require('../utils/money');

const productStatusSchema = z.enum(['ATIVO', 'INDISPONIVEL', 'INATIVO']);

const createProductSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  size: z.string().min(1, 'Size is required'),
  regularPrice: z.number().nonnegative('Regular price must be non-negative'),
  memberPrice: z.number().nonnegative('Member price must be non-negative'),
  pv: z.number().nonnegative('PV must be non-negative'),
  doterraUrl: z
    .string()
    .url('Invalid product URL')
    .max(2048, 'Product URL is too long')
    .optional()
    .nullable(),
});

const updateProductSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  size: z.string().min(1, 'Size is required').optional(),
  status: productStatusSchema.optional(),
  doterraUrl: z
    .string()
    .url('Invalid product URL')
    .max(2048, 'Product URL is too long')
    .optional()
    .nullable(),
  regularPrice: z
    .number()
    .nonnegative('Regular price must be non-negative')
    .optional(),
  memberPrice: z
    .number()
    .nonnegative('Member price must be non-negative')
    .optional(),
  pv: z.number().nonnegative('PV must be non-negative').optional(),
});

const priceFieldsPresent = (data) =>
  data.regularPrice !== undefined ||
  data.memberPrice !== undefined ||
  data.pv !== undefined;

const priceFieldsEqual = (a, b) =>
  toCents(a.regularPrice) === toCents(b.regularPrice) &&
  toCents(a.memberPrice) === toCents(b.memberPrice) &&
  toCents(a.pv) === toCents(b.pv);

const projectCurrentPrice = (product) => {
  const currentPrice = product.prices
    ? product.prices.find((price) => price.validTo === null)
    : null;
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    size: product.size,
    status: product.status,
    doterraUrl: product.doterraUrl,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    regularPrice: currentPrice ? currentPrice.regularPrice : null,
    memberPrice: currentPrice ? currentPrice.memberPrice : null,
    pv: currentPrice ? currentPrice.pv : null,
  };
};

const SORTABLE_FIELDS = ['name', 'code', 'regularPrice', 'memberPrice', 'pv'];
const NUMERIC_SORT_FIELDS = ['regularPrice', 'memberPrice', 'pv'];
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const sortProducts = (products, sortBy, sortDir) => {
  const field = SORTABLE_FIELDS.includes(sortBy) ? sortBy : 'name';
  const direction = sortDir === 'desc' ? -1 : 1;

  return [...products].sort((a, b) => {
    let result;
    if (NUMERIC_SORT_FIELDS.includes(field)) {
      result = (parseFloat(a[field]) || 0) - (parseFloat(b[field]) || 0);
    } else {
      result = String(a[field] ?? '').localeCompare(
        String(b[field] ?? ''),
        'pt-BR',
      );
    }
    return result * direction;
  });
};

const getProducts = async (req, res) => {
  try {
    const {
      active,
      status,
      available,
      q,
      sortBy,
      sortDir,
      page: pageParam,
      pageSize: pageSizeParam,
    } = req.query;

    const where = {};

    const statusValues = Array.isArray(status)
      ? status
      : status
        ? [status]
        : [];

    if (available === 'true') {
      where.status = { in: ['ATIVO', 'INDISPONIVEL'] };
    } else if (statusValues.length > 0) {
      where.status =
        statusValues.length === 1 ? statusValues[0] : { in: statusValues };
    } else if (active !== undefined) {
      where.status = active === 'true' ? 'ATIVO' : 'INATIVO';
    }

    if (q && q.trim()) {
      const search = q.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        prices: {
          where: { validTo: null },
          orderBy: { validFrom: 'desc' },
          take: 1,
        },
      },
    });

    const sorted = sortProducts(
      products.map(projectCurrentPrice),
      sortBy,
      sortDir,
    );

    const total = sorted.length;
    const pageSize =
      pageSizeParam === 'all'
        ? Math.max(total, 1)
        : Math.min(
            Math.max(parseInt(pageSizeParam, 10) || DEFAULT_PAGE_SIZE, 1),
            MAX_PAGE_SIZE,
          );
    const page = Math.max(parseInt(pageParam, 10) || 1, 1);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const data = sorted.slice(start, start + pageSize);

    res.status(200).json({
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasMore: start + pageSize < total,
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        prices: {
          where: { validTo: null },
          orderBy: { validFrom: 'desc' },
          take: 1,
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(200).json(projectCurrentPrice(product));
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createProduct = async (req, res) => {
  try {
    const validatedData = createProductSchema.parse(req.body);

    const existing = await prisma.product.findUnique({
      where: { code: validatedData.code },
    });

    if (existing) {
      return res.status(409).json({ error: 'Product code already exists' });
    }

    const product = await prisma.product.create({
      data: {
        code: validatedData.code,
        name: validatedData.name,
        size: validatedData.size,
        doterraUrl: validatedData.doterraUrl ?? null,
        prices: {
          create: {
            regularPrice: validatedData.regularPrice,
            memberPrice: validatedData.memberPrice,
            pv: validatedData.pv,
          },
        },
      },
      include: {
        prices: {
          where: { validTo: null },
          orderBy: { validFrom: 'desc' },
          take: 1,
        },
      },
    });

    res.status(201).json(projectCurrentPrice(product));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateProductSchema.parse(req.body);

    const existingProduct = await prisma.product.findUnique({
      where: { id },
      include: {
        prices: {
          where: { validTo: null },
          orderBy: { validFrom: 'desc' },
          take: 1,
        },
      },
    });

    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = await prisma.$transaction(async (tx) => {
      const updateData = {
        ...(validatedData.name !== undefined && { name: validatedData.name }),
        ...(validatedData.size !== undefined && { size: validatedData.size }),
        ...(validatedData.status !== undefined && {
          status: validatedData.status,
        }),
        ...(validatedData.doterraUrl !== undefined && {
          doterraUrl: validatedData.doterraUrl,
        }),
      };

      let currentPrice = existingProduct.prices.find(
        (price) => price.validTo === null,
      );

      if (priceFieldsPresent(validatedData)) {
        const newPrice = {
          regularPrice:
            validatedData.regularPrice !== undefined
              ? validatedData.regularPrice
              : currentPrice
                ? currentPrice.regularPrice
                : 0,
          memberPrice:
            validatedData.memberPrice !== undefined
              ? validatedData.memberPrice
              : currentPrice
                ? currentPrice.memberPrice
                : 0,
          pv:
            validatedData.pv !== undefined
              ? validatedData.pv
              : currentPrice
                ? currentPrice.pv
                : 0,
        };

        if (currentPrice && !priceFieldsEqual(currentPrice, newPrice)) {
          await tx.productPrice.update({
            where: { id: currentPrice.id },
            data: { validTo: new Date() },
          });
          await tx.productPrice.create({
            data: {
              productId: id,
              regularPrice: newPrice.regularPrice,
              memberPrice: newPrice.memberPrice,
              pv: newPrice.pv,
            },
          });
        } else if (!currentPrice) {
          await tx.productPrice.create({
            data: {
              productId: id,
              regularPrice: newPrice.regularPrice,
              memberPrice: newPrice.memberPrice,
              pv: newPrice.pv,
            },
          });
        }
      }

      return tx.product.update({
        where: { id },
        data: updateData,
        include: {
          prices: {
            where: { validTo: null },
            orderBy: { validFrom: 'desc' },
            take: 1,
          },
        },
      });
    });

    res.status(200).json(projectCurrentPrice(product));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await prisma.product.update({
      where: { id },
      data: { status: 'INATIVO' },
    });

    res.status(200).json({ message: 'Product deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
