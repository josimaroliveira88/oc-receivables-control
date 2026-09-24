import { z } from 'zod';

const MAX_DAYS_BY_MONTH = {
  1: 31,
  2: 29,
  3: 31,
  4: 30,
  5: 31,
  6: 30,
  7: 31,
  8: 31,
  9: 30,
  10: 31,
  11: 30,
  12: 31,
};

// Validates a "DD/MM" birthday (no year). February 29th is accepted because
// the year is unknown.
const isValidBirthday = (value) => {
  const [day, month] = value.split('/').map(Number);
  if (!Number.isInteger(day) || !Number.isInteger(month)) return false;
  return (
    month >= 1 && month <= 12 && day >= 1 && day <= MAX_DAYS_BY_MONTH[month]
  );
};

// Zod schema for person validation
const personSchema = z.object({
  name: z.string().min(1, 'O nome é obrigatório'),
  whatsapp: z.string().optional().nullable(),
  commonGroups: z.string().max(255).optional().nullable(),
  instagram: z.string().max(255).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  observacao: z
    .string()
    .max(2000, 'Observação deve ter no máximo 2000 caracteres')
    .optional()
    .nullable(),
  birthday: z
    .string()
    .regex(/^\d{2}\/\d{2}$/, 'Aniversário deve estar no formato DD/MM')
    .refine(isValidBirthday, 'Data de aniversário inválida')
    .optional()
    .nullable(),
  isVip: z.boolean().optional(),
  isDoterraMember: z.boolean().optional(),
  isTeamMember: z.boolean().optional(),
  isSelf: z.boolean().optional(),
});

export { personSchema, MAX_DAYS_BY_MONTH, isValidBirthday };
