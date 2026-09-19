import { z } from 'zod';
import { paymentTypeSchema } from '../utils/paymentTypes.js';

// `netAmount` is the net value the user received after the gateway fee. It is
// optional and nullable: null/omitted means no fee (net equals `amount`).
const netAmountSchema = z
  .number()
  .nonnegative('Net amount must be greater than or equal to zero')
  .optional()
  .nullable();

// Order-level flag (sales): whether the gateway fee was passed on to the
// client. Persisted on the order when informed alongside the payment.
const passesGatewayFeeToClientSchema = z.boolean().optional();

const paymentSchema = z.object({
  amount: z
    .number()
    .nonnegative('Amount must be greater than or equal to zero'),
  netAmount: netAmountSchema,
  passesGatewayFeeToClient: passesGatewayFeeToClientSchema,
  personId: z.string().uuid('Person ID must be a valid UUID'),
  paidAt: z.string().optional(),
  paymentType: paymentTypeSchema.optional().nullable(),
  notes: z.string().optional(),
});

const updatePaymentSchema = z.object({
  amount: z
    .number()
    .nonnegative('Amount must be greater than or equal to zero'),
  netAmount: netAmountSchema,
  passesGatewayFeeToClient: passesGatewayFeeToClientSchema,
  paidAt: z.string().optional(),
  paymentType: paymentTypeSchema.optional().nullable(),
  notes: z.string().nullable().optional(),
});

export { paymentSchema, updatePaymentSchema };
