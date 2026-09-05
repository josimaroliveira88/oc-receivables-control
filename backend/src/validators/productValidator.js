import { z } from 'zod';

const productStatusSchema = z.enum(['ATIVO', 'INDISPONIVEL', 'INATIVO']);
const productTypeSchema = z.enum(['SIMPLES', 'KIT']);

const componentSchema = z.object({
  componentProductId: z
    .string()
    .uuid('Component product ID must be a valid UUID'),
  quantity: z
    .number()
    .int('Component quantity must be an integer')
    .min(1, 'Component quantity must be at least 1'),
});

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
  productType: productTypeSchema.default('SIMPLES'),
  components: z.array(componentSchema).optional().default([]),
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
  productType: productTypeSchema.optional(),
  components: z.array(componentSchema).optional(),
});

export {
  productStatusSchema,
  productTypeSchema,
  componentSchema,
  createProductSchema,
  updateProductSchema,
};
