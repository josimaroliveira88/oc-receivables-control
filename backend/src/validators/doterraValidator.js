import { z } from 'zod';
import { paymentTypeSchema } from '../utils/paymentTypes.js';
import { dateSchema } from './financesValidator.js';

const MAX_OWNER = 120;
const MAX_DESCRIPTION = 500;
const MAX_CODE = 20;

// Lookup: which captured order numbers the user already has (any order type).
const lookupSchema = z.object({
  numbers: z
    .array(z.string().trim().min(1, 'O número do pedido é obrigatório'))
    .min(1, 'Informe ao menos um número de pedido'),
});

// One item line captured from the order detail page.
const doterraItemSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'O código do produto é obrigatório')
    .max(MAX_CODE, `O código deve ter no máximo ${MAX_CODE} caracteres`),
  description: z.string().max(MAX_DESCRIPTION).optional().nullable(),
  quantity: z
    .number()
    .int('A quantidade deve ser um número inteiro')
    .min(1, 'A quantidade deve ser maior ou igual a 1'),
  unitPrice: z.number().nonnegative().nullish().default(0),
  unitPv: z.number().nonnegative().nullish().default(0),
});

// One captured order. `firstInstallmentAt` is never required from the client:
// the service defaults it to the order date.
const importOrderSchema = z
  .object({
    orderNumber: z.string().trim().min(1, 'O número do pedido é obrigatório'),
    orderDate: dateSchema,
    accountOwner: z.string().max(MAX_OWNER).optional().nullable(),
    listTypeCode: z.string().max(10).optional().nullable(),
    listOriginCode: z.string().max(10).optional().nullable(),
    pvMonth: z
      .string()
      .regex(/^\d{4}-\d{2}$/, 'Mês do PV inválido (esperado AAAA-MM)')
      .optional()
      .nullable(),
    doterraPv: z.number().nonnegative().optional().nullable(),
    listValue: z.number().nonnegative().optional().nullable(),
    shippingValue: z.number().nonnegative().nullish().default(0),
    installmentValue: z.number().nonnegative().optional().nullable(),
    paymentType: paymentTypeSchema.optional().nullable(),
    installments: z.number().int().min(1).max(24).optional().nullable(),
    items: z
      .array(doterraItemSchema)
      .min(1, 'É necessário informar pelo menos um item'),
  })
  .superRefine((data, ctx) => {
    if (data.paymentType === 'CARTAO_CREDITO' && data.installments == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['installments'],
        message:
          'A quantidade de parcelas é obrigatória para pagamentos no cartão de crédito',
      });
    }
  });

// Envelope only: each order is validated individually inside the import
// service so one malformed order fails alone instead of rejecting the whole
// batch (partial success is a product requirement).
const importSchema = z.object({
  orders: z.array(z.unknown()).min(1, 'Informe ao menos um pedido'),
});

export { lookupSchema, doterraItemSchema, importOrderSchema, importSchema };
