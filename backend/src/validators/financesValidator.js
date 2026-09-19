import { z } from 'zod';

const MAX_CATEGORY_NAME = 100;
const MAX_DESCRIPTION = 255;
const MAX_NOTES = 2000;

const transactionTypeSchema = z.enum(['RECEITA', 'DESPESA']);
const transactionOriginSchema = z.enum([
  'VENDA',
  'RESGATE_INFINITEPAY',
  'PEDIDO_DOTERRA',
  'MANUAL',
]);

// `YYYY-MM-DD` calendar date. The regex alone accepts impossible dates like
// `2026-13-45`, so the parsed components are compared back to catch them.
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const isValidCalendarDate = (value) => {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

const dateSchema = z
  .string()
  .refine(isValidCalendarDate, 'Invalid date (expected YYYY-MM-DD)');

const categoryIdSchema = z
  .string()
  .uuid('Category ID must be a valid UUID')
  .nullable()
  .optional();

const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(
      MAX_CATEGORY_NAME,
      `Name must be at most ${MAX_CATEGORY_NAME} characters`,
    ),
  type: transactionTypeSchema,
});

// Only `name` and `active` are updatable; a category's type is immutable so
// changing it can never orphan or mismatched its linked transactions.
const updateCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(
      MAX_CATEGORY_NAME,
      `Name must be at most ${MAX_CATEGORY_NAME} characters`,
    )
    .optional(),
  active: z.boolean().optional(),
});

// A manual entry. `origin` is never accepted from the client: every row
// created here is forced to MANUAL by the service.
const createTransactionSchema = z.object({
  type: transactionTypeSchema,
  amount: z.number().positive('Amount must be greater than zero'),
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(
      MAX_DESCRIPTION,
      `Description must be at most ${MAX_DESCRIPTION} characters`,
    ),
  transactionDate: dateSchema,
  categoryId: categoryIdSchema,
  notes: z
    .string()
    .max(MAX_NOTES, `Notes must be at most ${MAX_NOTES} characters`)
    .nullable()
    .optional(),
});

// Partial update for a manual entry; any omitted field keeps its value.
const updateTransactionSchema = z.object({
  type: transactionTypeSchema.optional(),
  amount: z.number().positive('Amount must be greater than zero').optional(),
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(
      MAX_DESCRIPTION,
      `Description must be at most ${MAX_DESCRIPTION} characters`,
    )
    .optional(),
  transactionDate: dateSchema.optional(),
  categoryId: categoryIdSchema,
  notes: z
    .string()
    .max(MAX_NOTES, `Notes must be at most ${MAX_NOTES} characters`)
    .nullable()
    .optional(),
});

// Listing/summary filters, shared by both endpoints.
const listTransactionsQuerySchema = z.object({
  type: transactionTypeSchema.optional(),
  origin: transactionOriginSchema.optional(),
  categoryId: z.string().uuid('Category ID must be a valid UUID').optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  q: z.string().trim().optional(),
});

// InfinitePay redemption: the user informs the amount and date of the money
// that actually entered the account. Multiple partial redemptions are allowed.
const settlementSchema = z.object({
  orderId: z.string().uuid('Order ID must be a valid UUID'),
  amount: z.number().positive('Amount must be greater than zero'),
  transactionDate: dateSchema,
  notes: z
    .string()
    .max(MAX_NOTES, `Notes must be at most ${MAX_NOTES} characters`)
    .nullable()
    .optional(),
});

export {
  MAX_CATEGORY_NAME,
  MAX_DESCRIPTION,
  MAX_NOTES,
  transactionTypeSchema,
  transactionOriginSchema,
  dateSchema,
  createCategorySchema,
  updateCategorySchema,
  createTransactionSchema,
  updateTransactionSchema,
  listTransactionsQuerySchema,
  settlementSchema,
};
