import { z } from 'zod';

const MAX_CATEGORY_NAME = 100;

const transactionTypeSchema = z.enum(['RECEITA', 'DESPESA']);

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

export {
  MAX_CATEGORY_NAME,
  transactionTypeSchema,
  createCategorySchema,
  updateCategorySchema,
};
