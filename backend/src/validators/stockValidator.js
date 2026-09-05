import { z } from 'zod';

const movementSchema = z.object({
  productId: z.string().uuid(),
  type: z.enum(['ENTRADA', 'SAIDA', 'AJUSTE']),
  quantity: z.number().int(),
  reason: z.string().max(255).optional(),
  effectiveDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective date must be YYYY-MM-DD')
    .optional(),
});

export { movementSchema };
