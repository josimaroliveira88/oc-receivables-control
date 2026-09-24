import { z } from 'zod';

// Zod schema for login validation
const loginSchema = z.object({
  username: z.string().min(3, 'O usuário deve ter pelo menos 3 caracteres'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

// Zod schema for registration validation
const registerSchema = z.object({
  username: z.string().min(3, 'O usuário deve ter pelo menos 3 caracteres'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

export { loginSchema, registerSchema };
