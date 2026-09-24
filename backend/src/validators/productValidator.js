import { z } from 'zod';

const productStatusSchema = z.enum(['ATIVO', 'INDISPONIVEL', 'INATIVO']);
const productTypeSchema = z.enum(['SIMPLES', 'KIT']);

const componentSchema = z.object({
  componentProductId: z
    .string()
    .uuid('O ID do produto componente deve ser um UUID válido'),
  quantity: z
    .number()
    .int('A quantidade do componente deve ser um número inteiro')
    .min(1, 'A quantidade do componente deve ser pelo menos 1'),
});

const createProductSchema = z.object({
  code: z.string().min(1, 'O código é obrigatório'),
  name: z.string().min(1, 'O nome é obrigatório'),
  size: z.string().min(1, 'O tamanho é obrigatório'),
  regularPrice: z.number().nonnegative('O preço regular não pode ser negativo'),
  memberPrice: z
    .number()
    .nonnegative('O preço de membro não pode ser negativo'),
  pv: z.number().nonnegative('O PV não pode ser negativo'),
  doterraUrl: z
    .string()
    .url('URL do produto inválida')
    .max(2048, 'A URL do produto é muito longa')
    .optional()
    .nullable(),
  productType: productTypeSchema.default('SIMPLES'),
  components: z.array(componentSchema).optional().default([]),
});

const updateProductSchema = z.object({
  name: z.string().min(1, 'O nome é obrigatório').optional(),
  size: z.string().min(1, 'O tamanho é obrigatório').optional(),
  status: productStatusSchema.optional(),
  doterraUrl: z
    .string()
    .url('URL do produto inválida')
    .max(2048, 'A URL do produto é muito longa')
    .optional()
    .nullable(),
  regularPrice: z
    .number()
    .nonnegative('O preço regular não pode ser negativo')
    .optional(),
  memberPrice: z
    .number()
    .nonnegative('O preço de membro não pode ser negativo')
    .optional(),
  pv: z.number().nonnegative('O PV não pode ser negativo').optional(),
  productType: productTypeSchema.optional(),
  components: z.array(componentSchema).optional(),
});

export {
  productStatusSchema,
  productTypeSchema,
  componentSchema,
  createProductSchema,
  updateProductSchema,
};
