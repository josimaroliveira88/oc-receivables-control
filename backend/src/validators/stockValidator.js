import { z } from 'zod';

const movementSchema = z.object({
  productId: z.string().uuid(),
  type: z.enum(['ENTRADA', 'SAIDA', 'AJUSTE']),
  quantity: z.number().int(),
  reason: z.string().max(255).optional(),
  effectiveDate: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'A data de vigência deve estar no formato AAAA-MM-DD',
    )
    .optional(),
});

export { movementSchema };
