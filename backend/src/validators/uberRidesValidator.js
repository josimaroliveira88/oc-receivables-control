import { z } from 'zod';
import { dateSchema, MAX_DESCRIPTION } from './financesValidator.js';

const MAX_JSON = 5 * 1024 * 1024;
const MAX_PROFILE_TYPE = 20;

const rideSourceSchema = z.enum([
  'UBER_ACTIVITY_JSON',
  'UBER_SESSION',
  'UBER_EMAIL',
  'UBER_BUSINESS',
  'MANUAL',
]);

// ISO-8601 instant (the window bounds come from the capture script). Only the
// format is checked here; the parser rejects an inverted/empty window.
const instantSchema = z
  .string()
  .trim()
  .refine(
    (value) => Number.isFinite(Date.parse(value)),
    'Data/hora inválida (esperado ISO-8601)',
  );

const importRidesSchema = z.object({
  source: rideSourceSchema.optional(),
  windowStart: instantSchema.optional(),
  windowEnd: instantSchema.optional(),
  json: z
    .string()
    .min(1, 'O JSON é obrigatório')
    .max(MAX_JSON, `O JSON deve ter no máximo ${MAX_JSON} caracteres`),
});

const rideExpenseItemSchema = z.object({
  rideId: z.string().uuid('O ID da corrida deve ser um UUID válido'),
  categoryId: z
    .string()
    .uuid('O ID da categoria deve ser um UUID válido')
    .nullable()
    .optional(),
  description: z
    .string()
    .trim()
    .max(
      MAX_DESCRIPTION,
      `A descrição deve ter no máximo ${MAX_DESCRIPTION} caracteres`,
    )
    .nullable()
    .optional(),
});

const createRideExpensesSchema = z.object({
  items: z
    .array(rideExpenseItemSchema)
    .min(1, 'Selecione ao menos uma corrida'),
});

const rideIdParamSchema = z.object({
  id: z.string().uuid('O ID da corrida deve ser um UUID válido'),
});

const listRidesQuerySchema = z.object({
  status: z.enum(['COMPLETED', 'CANCELLED']).optional(),
  source: rideSourceSchema.optional(),
  profileType: z.string().trim().max(MAX_PROFILE_TYPE).optional(),
  rideType: z.enum(['RIDE', 'DELIVERY', 'UNKNOWN']).optional(),
  launched: z.enum(['yes', 'no']).optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  q: z.string().trim().optional(),
});

export {
  rideSourceSchema,
  instantSchema,
  importRidesSchema,
  createRideExpensesSchema,
  rideIdParamSchema,
  listRidesQuerySchema,
};
