import { z } from 'zod'

export const RolUsuarioEnum = z.enum(['admin', 'aprobador', 'empleado'])

export const UsuarioSchema = z.object({
  id: z.string().optional(),
  email: z
    .string()
    .min(1, 'El correo electrónico es requerido')
    .email('Ingresa un correo electrónico válido'),
  nombre: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(150, 'El nombre no puede exceder 150 caracteres'),
  departamento: z.string().max(100, 'El departamento no puede exceder 100 caracteres').optional(),
  rol: RolUsuarioEnum.default('empleado'),
})

export const LoginSchema = z.object({
  email: z.string().min(1, 'El correo es requerido').email('Correo no válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

export type UsuarioSchemaInput = z.infer<typeof UsuarioSchema>
export type LoginSchemaInput = z.infer<typeof LoginSchema>
