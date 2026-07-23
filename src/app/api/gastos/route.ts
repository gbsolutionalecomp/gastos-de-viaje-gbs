import { NextRequest } from 'next/server'
import { checkAuth } from '@/lib/auth'
import { GastoSchema } from '@/lib/schemas/gasto.schema'
import { apiSuccess, apiError } from '@/lib/api-response'

// In-memory mock store for API routes when testing or local without live DB
let mockGastos = [
  {
    id: 'gasto-1',
    usuarioId: 'user-1',
    concepto: 'Comida de negocios con cliente',
    monto: 850,
    categoria: 'Alimentación',
    fecha: '2026-07-20',
    estado: 'Aprobado',
    notas: 'Reunión con equipo técnico',
  },
  {
    id: 'gasto-2',
    usuarioId: 'user-1',
    concepto: 'Gasolina viaje a Guadalajara',
    monto: 1200,
    categoria: 'Gasolina',
    fecha: '2026-07-21',
    estado: 'Pendiente',
    notas: 'Carga en Shell',
  },
]

export async function GET(req: NextRequest) {
  const auth = await checkAuth(req)
  if (auth.errorResponse) return auth.errorResponse

  const { searchParams } = new URL(req.url)
  const usuarioId = searchParams.get('usuarioId')

  const filtered = usuarioId
    ? mockGastos.filter((g) => g.usuarioId === usuarioId)
    : mockGastos

  const response = apiSuccess(filtered, 'Gastos obtenidos exitosamente')
  response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300')
  return response
}

export async function POST(req: NextRequest) {
  const auth = await checkAuth(req)
  if (auth.errorResponse) return auth.errorResponse

  try {
    const body = await req.json()
    const parsed = GastoSchema.parse(body)

    const nuevoGasto = {
      ...parsed,
      id: parsed.id || `gasto-${Date.now()}`,
      creadoEn: new Date().toISOString(),
    }

    mockGastos.unshift(nuevoGasto as any)

    return apiSuccess(nuevoGasto, 'Gasto registrado correctamente', 201)
  } catch (err: any) {
    if (err.name === 'ZodError') {
      const issue = err.errors[0]?.message || 'Datos de gasto inválidos'
      return apiError(issue, 'Error de validación', 400)
    }
    return apiError(err.message, 'Error al crear el gasto', 500)
  }
}
