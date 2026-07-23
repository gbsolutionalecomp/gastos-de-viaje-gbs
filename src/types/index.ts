export type CategoriaGasto =
  | 'Alimentación'
  | 'Hospedaje'
  | 'Transporte'
  | 'Gasolina'
  | 'Peajes'
  | 'Vuelos'
  | 'Entretenimiento'
  | 'Otros'

export type EstadoGasto = 'Pendiente' | 'Aprobado' | 'Rechazado'

export type EstadoReporte = 'Borrador' | 'Enviado' | 'Aprobado' | 'Rechazado' | 'Pagado'

export type RolUsuario = 'admin' | 'aprobador' | 'empleado'

export interface Usuario {
  id: string
  email: string
  nombre: string
  departamento?: string
  rol: RolUsuario
  creadoEn?: string
}

export interface Gasto {
  id: string
  reporteId?: string
  usuarioId: string
  concepto: string
  monto: number
  categoria: CategoriaGasto
  fecha: string
  comprobanteUrl?: string
  estado: EstadoGasto
  notas?: string
  creadoEn?: string
}

export interface Reporte {
  id: string
  usuarioId: string
  titulo: string
  descripcion?: string
  fechaInicio: string
  fechaFin: string
  montoTotal: number
  estado: EstadoReporte
  gastos?: Gasto[]
  creadoEn?: string
  aprobadoPor?: string
  motivoRechazo?: string
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp: string
}

export interface ApiError {
  message: string
  code?: string
  details?: any
}
