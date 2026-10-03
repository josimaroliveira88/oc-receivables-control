import { z } from 'zod';
import { API_TOKEN_SCOPES } from '../services/apiTokenService.js';

const MAX_NAME = 60;

const tokenScopeSchema = z.enum(API_TOKEN_SCOPES);

const apiTokenCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'O nome do token é obrigatório')
    .max(MAX_NAME, `O nome deve ter no máximo ${MAX_NAME} caracteres`),
  scope: tokenScopeSchema.default(API_TOKEN_SCOPES[0]),
  ttlDays: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
});

export { tokenScopeSchema, apiTokenCreateSchema, MAX_NAME };
