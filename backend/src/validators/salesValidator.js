import { z } from 'zod';

const saleItemSchema = z.object({
  id: z.string().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  chargedValue: z
    .number()
    .min(0, 'Charged value must not be negative')
    .default(0),
  productId: z.string().uuid('Product ID must be a valid UUID'),
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
  chargedValueMode: z.enum(['UNIT', 'TOTAL']).default('UNIT'),
  kitStockMode: z.enum(['KIT', 'COMPONENTS']).optional().nullable(),
  useCashback: z.boolean().optional(),
});

const createSaleSchema = z.object({
  clientPersonId: z.string().uuid('Person ID must be a valid UUID'),
  orderDate: z.string().optional(),
  shippingValue: z
    .number()
    .min(0, 'Shipping value must not be negative')
    .optional()
    .nullable()
    .default(0),
  additionalValue: z
    .number()
    .min(0, 'Additional value must not be negative')
    .optional()
    .nullable()
    .default(0),
  // Expense generated from "Valores Adicionais". Both are required by the
  // service whenever the additional value is greater than zero.
  additionalExpenseCategoryId: z
    .string()
    .uuid('Expense category ID must be a valid UUID')
    .optional()
    .nullable(),
  additionalExpenseDescription: z
    .string()
    .trim()
    .max(255, 'Expense description must be at most 255 characters')
    .optional()
    .nullable(),
  description: z
    .string()
    .max(2000, 'Description must be at most 2000 characters')
    .optional()
    .nullable(),
  deliveredAt: z.string().optional().nullable(),
  // Whether the payment-gateway fee is passed on to the client (InfinitePay).
  passesGatewayFeeToClient: z.boolean().optional(),
  items: z.array(saleItemSchema).min(1, 'At least one item is required'),
});

const updateSaleSchema = z.object({
  clientPersonId: z.string().uuid('Person ID must be a valid UUID').optional(),
  orderDate: z.string().optional(),
  shippingValue: z
    .number()
    .min(0, 'Shipping value must not be negative')
    .optional()
    .nullable(),
  additionalValue: z
    .number()
    .min(0, 'Additional value must not be negative')
    .optional()
    .nullable(),
  // Expense generated from "Valores Adicionais". Both are required by the
  // service whenever the effective additional value is greater than zero.
  additionalExpenseCategoryId: z
    .string()
    .uuid('Expense category ID must be a valid UUID')
    .optional()
    .nullable(),
  additionalExpenseDescription: z
    .string()
    .trim()
    .max(255, 'Expense description must be at most 255 characters')
    .optional()
    .nullable(),
  description: z
    .string()
    .max(2000, 'Description must be at most 2000 characters')
    .optional()
    .nullable(),
  deliveredAt: z.string().optional().nullable(),
  // Whether the payment-gateway fee is passed on to the client (InfinitePay).
  passesGatewayFeeToClient: z.boolean().optional(),
  items: z
    .array(saleItemSchema)
    .min(1, 'At least one item is required')
    .optional(),
});

export { saleItemSchema, createSaleSchema, updateSaleSchema };
