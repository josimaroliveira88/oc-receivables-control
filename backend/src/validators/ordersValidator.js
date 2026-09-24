import { z } from 'zod';
import { paymentTypeSchema } from '../utils/paymentTypes.js';
import { dateSchema } from './financesValidator.js';

const itemSchema = z.object({
  id: z.string().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  chargedValue: z
    .number()
    .min(0, 'O valor cobrado não pode ser negativo')
    .default(0),
  // An empty string means "no person" (the UI sends '' for unassigned items):
  // normalize it to null so service-level binding can resolve it to the self
  // person instead of failing UUID validation.
  personId: z.preprocess(
    (value) => (value === '' ? null : value),
    z
      .string()
      .uuid('O ID da pessoa deve ser um UUID válido')
      .optional()
      .nullable(),
  ),
  productId: z
    .string()
    .uuid('O ID do produto deve ser um UUID válido')
    .optional()
    .nullable(),
  memberPrice: z
    .number()
    .nonnegative('O preço de membro não pode ser negativo')
    .optional()
    .nullable(),
  details: z
    .string()
    .max(500, 'Os detalhes devem ter no máximo 500 caracteres')
    .optional()
    .nullable(),
  quantity: z
    .number()
    .int('A quantidade deve ser um número inteiro')
    .positive('A quantidade deve ser maior que zero')
    .default(1),
  forStock: z.boolean().optional(),
  useCashback: z.boolean().optional(),
  chargedValueMode: z.enum(['UNIT', 'TOTAL']).default('UNIT'),
  kitStockMode: z.enum(['KIT', 'COMPONENTS']).optional().nullable(),
});

const orderDescriptiveSchema = {
  isTeamOrder: z.boolean().optional(),
  accountOwner: z
    .string()
    .max(120, 'O responsável pela conta deve ter no máximo 120 caracteres')
    .optional()
    .nullable(),
  paymentType: paymentTypeSchema.optional().nullable(),
  orderNotes: z
    .string()
    .max(2000, 'As observações do pedido devem ter no máximo 2000 caracteres')
    .optional()
    .nullable(),
  doterraPv: z
    .number()
    .nonnegative('O PV doTERRA não pode ser negativo')
    .optional()
    .nullable(),
  installments: z
    .number()
    .int('A quantidade de parcelas deve ser um número inteiro')
    .min(1, 'A quantidade de parcelas deve ser pelo menos 1')
    .max(24, 'A quantidade de parcelas deve ser no máximo 24')
    .optional(),
  firstInstallmentAt: dateSchema.optional(),
};

const requireCreditCardFields = (data, ctx) => {
  if (data.paymentType !== 'CARTAO_CREDITO') return;

  if (data.installments == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['installments'],
      message:
        'A quantidade de parcelas é obrigatória para pedidos com cartão de crédito',
    });
  }
  if (!data.firstInstallmentAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['firstInstallmentAt'],
      message:
        'A data da primeira parcela é obrigatória para pedidos com cartão de crédito',
    });
  }
};

const createOrderSchema = z
  .object({
    orderNumber: z.string().min(1, 'O número do pedido é obrigatório'),
    orderDate: z.string().optional(),
    shippingValue: z
      .number()
      .min(0, 'O valor do frete não pode ser negativo')
      .optional()
      .nullable()
      .default(0),
    ...orderDescriptiveSchema,
    items: z
      .array(itemSchema)
      .min(1, 'É necessário informar pelo menos um item'),
  })
  .superRefine(requireCreditCardFields);

const updateOrderSchema = z
  .object({
    orderNumber: z
      .string()
      .min(1, 'O número do pedido é obrigatório')
      .optional(),
    orderDate: z.string().optional(),
    shippingValue: z
      .number()
      .min(0, 'O valor do frete não pode ser negativo')
      .optional()
      .nullable(),
    ...orderDescriptiveSchema,
    items: z
      .array(itemSchema)
      .min(1, 'É necessário informar pelo menos um item')
      .optional(),
  })
  .superRefine(requireCreditCardFields);

export { itemSchema, createOrderSchema, updateOrderSchema };
