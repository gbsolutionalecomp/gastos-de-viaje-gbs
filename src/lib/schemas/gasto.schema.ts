import { z } from 'zod'

export const CategoriaGastoEnum = z.enum([
  'Alimentación',
  'Hospedaje',
  'Transporte',
  'Gasolina',
  'Peajes',
  'Vuelos',
  'Entretenimiento',
  'Otros',
])

export const EstadoGastoEnum = z.enum(['Pendiente', 'Aprobado', 'Rechazado'])

export const GastoSchema = z.object({
  id: z.string().optional(),
  reporteId: z.string().optional(),
  usuarioId: z.string().min(1, 'El ID de usuario es requerido'),
  concepto: z
    .string()
    .min(5, 'El concepto debe tener al menos 5 caracteres')
    .max(500, 'El concepto no puede exceder los 500 caracteres'),
  monto: z
    .number({ message: 'El monto es obligatorio' })
    .positive('El monto debe ser un número positivo mayor a 0')
    .max(999999, 'El monto máximo permitido es de $999,999.00'),
  categoria: CategoriaGastoEnum,
  fecha: z
    .string()
    .min(1, 'La fecha es obligatoria')
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Fecha no válida' })
    .refine((val) => new Date(val) <= new Date(Date.now() + 86400000), {
      message: 'La fecha del gasto no puede ser futura',
    }),
  comprobanteUrl: z.string().url('Debe ser una URL de comprobante válida').optional().or(z.literal('')),
  estado: EstadoGastoEnum.default('Pendiente'),
  notas: z.string().max(1000, 'Las notas no pueden exceder 1000 caracteres').optional(),
})

export type GastoSchemaInput = z.infer<typeof GastoSchema>
