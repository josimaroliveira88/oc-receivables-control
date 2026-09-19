import { z } from 'zod';
import { paymentTypeSchema } from '../utils/paymentTypes.js';

const itemSchema = z.object({
  id: z.string().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  chargedValue: z
    .number()
    .min(0, 'Charged value must not be negative')
    .default(0),
  // An empty string means "no person" (the UI sends '' for unassigned items):
  // normalize it to null so service-level binding can resolve it to the self
  // person instead of failing UUID validation.
  personId: z.preprocess(
    (value) => (value === '' ? null : value),
    z.string().uuid('Person ID must be a valid UUID').optional().nullable(),
  ),
  productId: z
    .string()
    .uuid('Product ID must be a valid UUID')
    .optional()
    .nullable(),
  memberPrice: z
    .number()
    .nonnegative('Member price must not be negative')
    .optional()
    .nullable(),
  details: z
    .string()
    .max(500, 'Details must be at most 500 characters')
    .optional()
    .nullable(),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .positive('Quantity must be greater than zero')
    .default(1),
  forStock: z.boolean().optional(),
  useCashback: z.boolean().optional(),
  chargedValueMode: z.enum(['UNIT', 'TOTAL']).default('UNIT'),
  kitStockMode: z.enum(['KIT', 'COMPONENTS']).optional().nullable(),
});

const orderDescriptiveSchema = {
  isTeamOrder: z.boolean().optional(),
  accountOwner: z
    .string()
    .max(120, 'Account owner must be at most 120 characters')
    .optional()
    .nullable(),
  paymentType: paymentTypeSchema.optional().nullable(),
  orderNotes: z
    .string()
    .max(2000, 'Order notes must be at most 2000 characters')
    .optional()
    .nullable(),
  doterraPv: z
    .number()
    .nonnegative('PV doTERRA must not be negative')
    .optional()
    .nullable(),
};

const createOrderSchema = z.object({
  orderNumber: z.string().min(1, 'Order number is required'),
  orderDate: z.string().optional(),
  shippingValue: z
    .number()
    .min(0, 'Shipping value must not be negative')
    .optional()
    .nullable()
    .default(0),
  ...orderDescriptiveSchema,
  items: z.array(itemSchema).min(1, 'At least one item is required'),
});

const updateOrderSchema = z.object({
  orderNumber: z.string().min(1, 'Order number is required').optional(),
  orderDate: z.string().optional(),
  shippingValue: z
    .number()
    .min(0, 'Shipping value must not be negative')
    .optional()
    .nullable(),
  ...orderDescriptiveSchema,
  items: z.array(itemSchema).min(1, 'At least one item is required').optional(),
});

export { itemSchema, createOrderSchema, updateOrderSchema };
