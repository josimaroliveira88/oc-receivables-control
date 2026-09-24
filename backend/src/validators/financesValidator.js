import { z } from 'zod';

const MAX_CATEGORY_NAME = 100;
const MAX_DESCRIPTION = 255;
const MAX_NOTES = 2000;

const transactionTypeSchema = z.enum(['RECEITA', 'DESPESA']);
const transactionOriginSchema = z.enum([
  'VENDA',
  'RESGATE_INFINITEPAY',
  'PEDIDO_DOTERRA',
  'VENDA_ADICIONAL',
  'MANUAL',
  'CARTAO_CREDITO',
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
  .refine(isValidCalendarDate, 'Data inválida (esperado o formato AAAA-MM-DD)');

const categoryIdSchema = z
  .string()
  .uuid('O ID da categoria deve ser um UUID válido')
  .nullable()
  .optional();

const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'O nome é obrigatório')
    .max(
      MAX_CATEGORY_NAME,
      `O nome deve ter no máximo ${MAX_CATEGORY_NAME} caracteres`,
    ),
  type: transactionTypeSchema,
});

// Only `name` and `active` are updatable; a category's type is immutable so
// changing it can never orphan or mismatched its linked transactions.
const updateCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'O nome é obrigatório')
    .max(
      MAX_CATEGORY_NAME,
      `O nome deve ter no máximo ${MAX_CATEGORY_NAME} caracteres`,
    )
    .optional(),
  active: z.boolean().optional(),
});

// A manual entry. `origin` is never accepted from the client: every row
// created here is forced to MANUAL by the service.
const createTransactionSchema = z.object({
  type: transactionTypeSchema,
  amount: z.number().positive('O valor deve ser maior que zero'),
  description: z
    .string()
    .trim()
    .min(1, 'A descrição é obrigatória')
    .max(
      MAX_DESCRIPTION,
      `A descrição deve ter no máximo ${MAX_DESCRIPTION} caracteres`,
    ),
  transactionDate: dateSchema,
  categoryId: categoryIdSchema,
  notes: z
    .string()
    .max(
      MAX_NOTES,
      `As observações devem ter no máximo ${MAX_NOTES} caracteres`,
    )
    .nullable()
    .optional(),
});

// Partial update for a manual entry; any omitted field keeps its value.
const updateTransactionSchema = z.object({
  type: transactionTypeSchema.optional(),
  amount: z.number().positive('O valor deve ser maior que zero').optional(),
  description: z
    .string()
    .trim()
    .min(1, 'A descrição é obrigatória')
    .max(
      MAX_DESCRIPTION,
      `A descrição deve ter no máximo ${MAX_DESCRIPTION} caracteres`,
    )
    .optional(),
  transactionDate: dateSchema.optional(),
  categoryId: categoryIdSchema,
  notes: z
    .string()
    .max(
      MAX_NOTES,
      `As observações devem ter no máximo ${MAX_NOTES} caracteres`,
    )
    .nullable()
    .optional(),
});

// Listing/summary filters, shared by both endpoints.
const listTransactionsQuerySchema = z.object({
  type: transactionTypeSchema.optional(),
  origin: transactionOriginSchema.optional(),
  categoryId: z
    .string()
    .uuid('O ID da categoria deve ser um UUID válido')
    .optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  effective: z.enum(['yes', 'no', 'all']).optional(),
  q: z.string().trim().optional(),
});

// InfinitePay redemption: the user informs the amount and date of the money
// that actually entered the account. Multiple partial redemptions are allowed.
const settlementSchema = z.object({
  orderId: z.string().uuid('O ID do pedido deve ser um UUID válido'),
  amount: z.number().positive('O valor deve ser maior que zero'),
  transactionDate: dateSchema,
  notes: z
    .string()
    .max(
      MAX_NOTES,
      `As observações devem ter no máximo ${MAX_NOTES} caracteres`,
    )
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
