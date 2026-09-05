const { z } = require('zod');
const { paymentTypeSchema } = require('../utils/paymentTypes');

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

module.exports = { paymentSchema, updatePaymentSchema };
