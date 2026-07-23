import { z } from 'zod'

export const EstadoReporteEnum = z.enum(['Borrador', 'Enviado', 'Aprobado', 'Rechazado', 'Pagado'])

export const ReporteSchema = z
  .object({
    id: z.string().optional(),
    usuarioId: z.string().min(1, 'El ID del usuario es obligatorio'),
    titulo: z
      .string()
      .min(5, 'El título debe contener al menos 5 caracteres')
      .max(200, 'El título no debe exceder 200 caracteres'),
    descripcion: z.string().max(1000, 'La descripción no debe exceder 1000 caracteres').optional(),
    fechaInicio: z
      .string()
      .min(1, 'La fecha de inicio es requerida')
      .refine((val) => !isNaN(Date.parse(val)), { message: 'Fecha de inicio no válida' }),
    fechaFin: z
      .string()
      .min(1, 'La fecha de fin es requerida')
      .refine((val) => !isNaN(Date.parse(val)), { message: 'Fecha de fin no válida' }),
    montoTotal: z
      .number()
      .min(0, 'El monto total no puede ser negativo')
      .max(9999999, 'El monto total excede el límite permitido'),
    estado: EstadoReporteEnum.default('Borrador'),
    gastosIds: z.array(z.string()).optional(),
    aprobadoPor: z.string().optional(),
    motivoRechazo: z.string().max(500, 'El motivo de rechazo no puede exceder 500 caracteres').optional(),
  })
  .refine(
    (data) => new Date(data.fechaFin) >= new Date(data.fechaInicio),
    {
      message: 'La fecha de fin debe ser posterior o igual a la fecha de inicio',
      path: ['fechaFin'],
    }
  )

export type ReporteSchemaInput = z.infer<typeof ReporteSchema>
