import { z } from 'zod';

/**
 * Auth Validation Schemas
 */

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres')
});

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  confirmPassword: z.string(),
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  role: z.enum(['user', 'b2b']).optional(),
  company: z.string().min(2, 'Nome da empresa deve ter no mínimo 2 caracteres').optional(),
  taxId: z.string().regex(/^[0-9]{9}$/, 'NIF inválido. Deve ter 9 dígitos').optional(),
  phone: z.string().optional(),
  agreeTerms: z.boolean().refine((value) => value === true, {
    message: 'É necessário aceitar os termos e condições',
    path: ['agreeTerms']
  })
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não correspondem',
  path: ['confirmPassword']
}).refine((data) => data.role !== 'b2b' || !!data.company, {
  message: 'Empresa é obrigatória para registo B2B',
  path: ['company']
}).refine((data) => data.role !== 'b2b' || !!data.taxId, {
  message: 'NIF é obrigatório para registo B2B',
  path: ['taxId']
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token de verificação é obrigatório')
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido')
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não correspondem',
  path: ['confirmPassword']
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePasswordInput = z.infer<typeof resetPasswordSchema>;
