import { z } from 'zod';

const saleItemSchema = z.object({
  id: z.string().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  chargedValue: z
    .number()
    .min(0, 'O valor cobrado não pode ser negativo')
    .default(0),
  productId: z.string().uuid('O ID do produto deve ser um UUID válido'),
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
  chargedValueMode: z.enum(['UNIT', 'TOTAL']).default('UNIT'),
  kitStockMode: z.enum(['KIT', 'COMPONENTS']).optional().nullable(),
  useCashback: z.boolean().optional(),
});

const createSaleSchema = z.object({
  clientPersonId: z.string().uuid('O ID da pessoa deve ser um UUID válido'),
  orderDate: z.string().optional(),
  shippingValue: z
    .number()
    .min(0, 'O valor do frete não pode ser negativo')
    .optional()
    .nullable()
    .default(0),
  additionalValue: z
    .number()
    .min(0, 'O valor adicional não pode ser negativo')
    .optional()
    .nullable()
    .default(0),
  // Whether "Valores Adicionais" are charged to the client (default true).
  additionalValueChargedToClient: z.boolean().optional(),
  // Expense generated from "Valores Adicionais". Both are required by the
  // service whenever the additional value is greater than zero.
  additionalExpenseCategoryId: z
    .string()
    .uuid('O ID da categoria de despesa deve ser um UUID válido')
    .optional()
    .nullable(),
  additionalExpenseDescription: z
    .string()
    .trim()
    .max(255, 'A descrição da despesa deve ter no máximo 255 caracteres')
    .optional()
    .nullable(),
  description: z
    .string()
    .max(2000, 'A descrição deve ter no máximo 2000 caracteres')
    .optional()
    .nullable(),
  deliveredAt: z.string().optional().nullable(),
  // Whether the payment-gateway fee is passed on to the client (InfinitePay).
  passesGatewayFeeToClient: z.boolean().optional(),
  items: z
    .array(saleItemSchema)
    .min(1, 'É necessário informar pelo menos um item'),
});

const updateSaleSchema = z.object({
  clientPersonId: z
    .string()
    .uuid('O ID da pessoa deve ser um UUID válido')
    .optional(),
  orderDate: z.string().optional(),
  shippingValue: z
    .number()
    .min(0, 'O valor do frete não pode ser negativo')
    .optional()
    .nullable(),
  additionalValue: z
    .number()
    .min(0, 'O valor adicional não pode ser negativo')
    .optional()
    .nullable(),
  // Whether "Valores Adicionais" are charged to the client.
  additionalValueChargedToClient: z.boolean().optional(),
  // Expense generated from "Valores Adicionais". Both are required by the
  // service whenever the effective additional value is greater than zero.
  additionalExpenseCategoryId: z
    .string()
    .uuid('O ID da categoria de despesa deve ser um UUID válido')
    .optional()
    .nullable(),
  additionalExpenseDescription: z
    .string()
    .trim()
    .max(255, 'A descrição da despesa deve ter no máximo 255 caracteres')
    .optional()
    .nullable(),
  description: z
    .string()
    .max(2000, 'A descrição deve ter no máximo 2000 caracteres')
    .optional()
    .nullable(),
  deliveredAt: z.string().optional().nullable(),
  // Whether the payment-gateway fee is passed on to the client (InfinitePay).
  passesGatewayFeeToClient: z.boolean().optional(),
  items: z
    .array(saleItemSchema)
    .min(1, 'É necessário informar pelo menos um item')
    .optional(),
});

export { saleItemSchema, createSaleSchema, updateSaleSchema };
