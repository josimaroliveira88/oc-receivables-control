import { z } from 'zod';

// A single line of a stock exchange: a product, the quantity and the optional
// unit value the user provided. The direction (OUT/IN) is implied by which
// array the line lives in (`outgoingLines` vs `incomingLines`) — keeping it
// out of the payload prevents the user from mixing them up.
const lineSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitValueCents: z.number().int().nonnegative().nullable().optional(),
});

export const createStockExchangeSchema = z.object({
  personId: z.string().uuid(),
  effectiveDate: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'A data efetiva deve estar no formato AAAA-MM-DD',
    ),
  observation: z.string().max(1000).nullable().optional(),
  outgoingLines: z
    .array(lineSchema)
    .min(1, 'Informe ao menos um produto que sai'),
  incomingLines: z
    .array(lineSchema)
    .min(1, 'Informe ao menos um produto que entra'),
});

export { lineSchema };
