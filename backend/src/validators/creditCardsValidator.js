import { z } from 'zod';
import { dateSchema, MAX_DESCRIPTION, MAX_NOTES } from './financesValidator.js';

const MAX_BRAND = 40;
const MAX_OFX_TEXT = 1024 * 1024;

const billCategoryIdSchema = z
  .string()
  .uuid('O ID da categoria deve ser um UUID válido')
  .nullable()
  .optional();

const installmentsSchema = z
  .number()
  .int('A quantidade de parcelas deve ser um número inteiro')
  .min(1, 'A quantidade de parcelas deve ser pelo menos 1')
  .max(24, 'A quantidade de parcelas deve ser no máximo 24');

const createBillSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'A descrição é obrigatória')
    .max(
      MAX_DESCRIPTION,
      `A descrição deve ter no máximo ${MAX_DESCRIPTION} caracteres`,
    ),
  totalAmount: z.number().positive('O valor deve ser maior que zero'),
  installments: installmentsSchema,
  firstInstallmentAt: dateSchema,
  brand: z
    .string()
    .trim()
    .max(MAX_BRAND, `A bandeira deve ter no máximo ${MAX_BRAND} caracteres`)
    .nullable()
    .optional(),
  notes: z
    .string()
    .max(
      MAX_NOTES,
      `As observações devem ter no máximo ${MAX_NOTES} caracteres`,
    )
    .nullable()
    .optional(),
  categoryId: billCategoryIdSchema,
});

const updateBillSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'A descrição é obrigatória')
    .max(
      MAX_DESCRIPTION,
      `A descrição deve ter no máximo ${MAX_DESCRIPTION} caracteres`,
    )
    .optional(),
  totalAmount: z
    .number()
    .positive('O valor deve ser maior que zero')
    .optional(),
  installments: installmentsSchema.optional(),
  firstInstallmentAt: dateSchema.optional(),
  brand: z
    .string()
    .trim()
    .max(MAX_BRAND, `A bandeira deve ter no máximo ${MAX_BRAND} caracteres`)
    .nullable()
    .optional(),
  notes: z
    .string()
    .max(
      MAX_NOTES,
      `As observações devem ter no máximo ${MAX_NOTES} caracteres`,
    )
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
    .min(1, 'O texto OFX é obrigatório')
    .max(
      MAX_OFX_TEXT,
      `O arquivo OFX deve ter no máximo ${MAX_OFX_TEXT} caracteres`,
    ),
});

const reconcileMatchSchema = z.object({
  statementFitid: z
    .string()
    .min(1, 'O FITID é obrigatório')
    .max(64, 'O FITID deve ter no máximo 64 caracteres'),
  statementDate: dateSchema,
  installmentId: z.string().uuid('O ID da parcela deve ser um UUID válido'),
});

const reconcileCommitSchema = z.object({
  batchId: z.string().uuid('O ID do lote deve ser um UUID válido'),
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
