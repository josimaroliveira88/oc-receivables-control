import { z } from 'zod';
import { dateSchema, MAX_NOTES } from './financesValidator.js';

// One sale that composed a redemption: the order and the part of the redeemed
// amount attributed to it, in integer cents.
const rescueAssignmentSchema = z.object({
  orderId: z.string().uuid('O ID do pedido deve ser um UUID válido'),
  amountCents: z
    .number()
    .int('O valor deve ser um número inteiro de centavos')
    .positive('O valor deve ser maior que zero'),
});

// One confirmed redemption. `rescueAmountCents` is the value that left
// InfinitePay; the service checks the assignments sum to it within tolerance.
const rescueSchema = z.object({
  line: z.number().int().positive(),
  rescueAmountCents: z
    .number()
    .int()
    .positive('O valor deve ser maior que zero'),
  transactionDate: dateSchema,
  notes: z
    .string()
    .max(
      MAX_NOTES,
      `As observações devem ter no máximo ${MAX_NOTES} caracteres`,
    )
    .nullable()
    .optional(),
  assignments: z.array(rescueAssignmentSchema).min(1),
});

const commitRescueSchema = z.object({
  batchId: z.string().uuid('O ID do lote deve ser um UUID válido'),
  rescues: z.array(rescueSchema).min(1),
});

const batchIdParamSchema = z.object({
  batchId: z.string().uuid('O ID do lote deve ser um UUID válido'),
});

export { commitRescueSchema, batchIdParamSchema };
