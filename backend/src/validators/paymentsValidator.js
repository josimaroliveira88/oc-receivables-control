import { z } from 'zod';
import { paymentTypeSchema } from '../utils/paymentTypes.js';

const paymentSchema = z.object({
  amount: z
    .number()
    .nonnegative('Amount must be greater than or equal to zero'),
  personId: z.string().uuid('Person ID must be a valid UUID'),
  paidAt: z.string().optional(),
  paymentType: paymentTypeSchema.optional().nullable(),
  notes: z.string().optional(),
});

const updatePaymentSchema = z.object({
  amount: z
    .number()
    .nonnegative('Amount must be greater than or equal to zero'),
  paidAt: z.string().optional(),
  paymentType: paymentTypeSchema.optional().nullable(),
  notes: z.string().nullable().optional(),
});

export { paymentSchema, updatePaymentSchema };
