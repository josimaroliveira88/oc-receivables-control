import prisma from '../config/database.js';
import { handleError } from '../middlewares/errorResponse.js';
import { notFound } from '../utils/httpError.js';
import {
  createProductSchema,
  updateProductSchema,
} from '../validators/productValidator.js';
import { validateKitComponents } from '../services/kitValidationService.js';
import {
  projectCurrentPrice,
  priceFieldsPresent,
  priceFieldsEqual,
} from '../utils/productsProjection.js';
import { sortProducts } from '../utils/productSort.js';
import { paginate } from '../utils/pagination.js';

const getProducts = async (req, res) => {
  try {
    const {
      active,
      status,
      available,
      inStock,
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

    // Restrict to products that exist in the user inventory (any quantity,
    // including zero). Used by the sale form to offer only stocked products.
    if (inStock === 'true') {
      where.inventory = { some: { userId: req.user.userId } };
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
        kitComponents: true,
      },
    });

    const sorted = sortProducts(
      products.map(projectCurrentPrice),
      sortBy,
      sortDir,
    );

    const { data, pagination } = paginate(sorted, {
      page: pageParam,
      pageSize: pageSizeParam,
    });

    res.status(200).json({ data, pagination });
  } catch (error) {
    handleError(res, error, { label: 'Error fetching products' });
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
        kitComponents: true,
      },
    });

    if (!product) {
      throw notFound('Product not found');
    }

    res.status(200).json(projectCurrentPrice(product));
  } catch (error) {
    handleError(res, error, { label: 'Error fetching product' });
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

    const product = await prisma.$transaction(async (tx) => {
      await validateKitComponents(tx, {
        productType: validatedData.productType,
        components: validatedData.components,
      });

      const created = await tx.product.create({
        data: {
          code: validatedData.code,
          name: validatedData.name,
          size: validatedData.size,
          doterraUrl: validatedData.doterraUrl ?? null,
          productType: validatedData.productType,
          prices: {
            create: {
              regularPrice: validatedData.regularPrice,
              memberPrice: validatedData.memberPrice,
              pv: validatedData.pv,
            },
          },
          ...(validatedData.productType === 'KIT'
            ? {
                kitComponents: {
                  create: validatedData.components.map((c) => ({
                    componentProductId: c.componentProductId,
                    quantity: c.quantity,
                  })),
                },
              }
            : {}),
        },
        include: {
          prices: {
            where: { validTo: null },
            orderBy: { validFrom: 'desc' },
            take: 1,
          },
          kitComponents: true,
        },
      });

      return created;
    });

    res.status(201).json(projectCurrentPrice(product));
  } catch (error) {
    handleError(res, error, { label: 'Error creating product' });
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
        kitComponents: true,
      },
    });

    if (!existingProduct) {
      throw notFound('Product not found');
    }

    const product = await prisma.$transaction(async (tx) => {
      const newProductType =
        validatedData.productType ?? existingProduct.productType;
      const componentsProvided = validatedData.components !== undefined;
      const newComponents = componentsProvided
        ? validatedData.components
        : newProductType === 'KIT'
          ? existingProduct.kitComponents.map((c) => ({
              componentProductId: c.componentProductId,
              quantity: c.quantity,
            }))
          : [];

      await validateKitComponents(tx, {
        productId: id,
        productType: newProductType,
        components: newComponents,
      });

      const updateData = {
        ...(validatedData.name !== undefined && { name: validatedData.name }),
        ...(validatedData.size !== undefined && { size: validatedData.size }),
        ...(validatedData.status !== undefined && {
          status: validatedData.status,
        }),
        ...(validatedData.doterraUrl !== undefined && {
          doterraUrl: validatedData.doterraUrl,
        }),
        ...(validatedData.productType !== undefined && {
          productType: validatedData.productType,
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

      // Replace or clear the kit composition when the type or components
      // change. Existing order items keep their own frozen snapshots, so this
      // never affects stock control of already-registered orders.
      if (validatedData.productType !== undefined || componentsProvided) {
        await tx.kitComposition.deleteMany({ where: { kitProductId: id } });
        if (newProductType === 'KIT' && newComponents.length > 0) {
          await tx.kitComposition.createMany({
            data: newComponents.map((c) => ({
              kitProductId: id,
              componentProductId: c.componentProductId,
              quantity: c.quantity,
            })),
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
          kitComponents: true,
        },
      });
    });

    res.status(200).json(projectCurrentPrice(product));
  } catch (error) {
    handleError(res, error, { label: 'Error updating product' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      throw notFound('Product not found');
    }

    await prisma.product.update({
      where: { id },
      data: { status: 'INATIVO' },
    });

    res.status(200).json({ message: 'Product deactivated successfully' });
  } catch (error) {
    handleError(res, error, { label: 'Error deactivating product' });
  }
};

export {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
