import { z } from 'zod';
import { dateSchema, MAX_NOTES } from './financesValidator.js';

// One sale that composed a redemption: the order and the part of the redeemed
// amount attributed to it, in integer cents.
const rescueAssignmentSchema = z.object({
  orderId: z.string().uuid('Order ID must be a valid UUID'),
  amountCents: z
    .number()
    .int('Amount must be an integer number of cents')
    .positive('Amount must be greater than zero'),
});

// One confirmed redemption. `rescueAmountCents` is the value that left
// InfinitePay; the service checks the assignments sum to it within tolerance.
const rescueSchema = z.object({
  line: z.number().int().positive(),
  rescueAmountCents: z
    .number()
    .int()
    .positive('Amount must be greater than zero'),
  transactionDate: dateSchema,
  notes: z
    .string()
    .max(MAX_NOTES, `Notes must be at most ${MAX_NOTES} characters`)
    .nullable()
    .optional(),
  assignments: z.array(rescueAssignmentSchema).min(1),
});

const commitRescueSchema = z.object({
  batchId: z.string().uuid('Batch ID must be a valid UUID'),
  rescues: z.array(rescueSchema).min(1),
});

const batchIdParamSchema = z.object({
  batchId: z.string().uuid('Batch ID must be a valid UUID'),
});

export { commitRescueSchema, batchIdParamSchema };
