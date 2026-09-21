import { z } from 'zod';
import { dateSchema, MAX_DESCRIPTION, MAX_NOTES } from './financesValidator.js';

const MAX_BRAND = 40;
const MAX_OFX_TEXT = 1024 * 1024;

const billCategoryIdSchema = z
  .string()
  .uuid('Category ID must be a valid UUID')
  .nullable()
  .optional();

const installmentsSchema = z
  .number()
  .int('Installments must be an integer')
  .min(1, 'Installments must be at least 1')
  .max(24, 'Installments must be at most 24');

const createBillSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(
      MAX_DESCRIPTION,
      `Description must be at most ${MAX_DESCRIPTION} characters`,
    ),
  totalAmount: z.number().positive('Amount must be greater than zero'),
  installments: installmentsSchema,
  firstInstallmentAt: dateSchema,
  brand: z
    .string()
    .trim()
    .max(MAX_BRAND, `Brand must be at most ${MAX_BRAND} characters`)
    .nullable()
    .optional(),
  notes: z
    .string()
    .max(MAX_NOTES, `Notes must be at most ${MAX_NOTES} characters`)
    .nullable()
    .optional(),
  categoryId: billCategoryIdSchema,
});

const updateBillSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(
      MAX_DESCRIPTION,
      `Description must be at most ${MAX_DESCRIPTION} characters`,
    )
    .optional(),
  totalAmount: z
    .number()
    .positive('Amount must be greater than zero')
    .optional(),
  installments: installmentsSchema.optional(),
  firstInstallmentAt: dateSchema.optional(),
  brand: z
    .string()
    .trim()
    .max(MAX_BRAND, `Brand must be at most ${MAX_BRAND} characters`)
    .nullable()
    .optional(),
  notes: z
    .string()
    .max(MAX_NOTES, `Notes must be at most ${MAX_NOTES} characters`)
    .nullable()
    .optional(),
  categoryId: billCategoryIdSchema,
});

const payInstallmentSchema = z.object({
  paidAt: dateSchema,
});

const reconcilePreviewSchema = z.object({
  ofxText: z
    .string()
    .min(1, 'OFX text is required')
    .max(MAX_OFX_TEXT, `OFX file must be at most ${MAX_OFX_TEXT} characters`),
});

const reconcileMatchSchema = z.object({
  statementFitid: z
    .string()
    .min(1, 'FITID is required')
    .max(64, 'FITID must be at most 64 characters'),
  statementDate: dateSchema,
  installmentId: z.string().uuid('Installment ID must be a valid UUID'),
});

const reconcileCommitSchema = z.object({
  batchId: z.string().uuid('Batch ID must be a valid UUID'),
  matches: z.array(reconcileMatchSchema),
});

export {
  MAX_BRAND,
  MAX_OFX_TEXT,
  createBillSchema,
  updateBillSchema,
  payInstallmentSchema,
  reconcilePreviewSchema,
  reconcileCommitSchema,
};
