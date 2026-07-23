import { NextRequest } from 'next/server'
import { checkAuth } from '@/lib/auth'
import { ReporteSchema } from '@/lib/schemas/reporte.schema'
import { apiSuccess, apiError } from '@/lib/api-response'

let mockReportes = [
  {
    id: 'rep-101',
    usuarioId: 'user-1',
    titulo: 'Viaje Comercial Guadalajara Julio 2026',
    descripcion: 'Visita a clientes clave y cierre de contrato',
    fechaInicio: '2026-07-15',
    fechaFin: '2026-07-18',
    montoTotal: 4500,
    estado: 'Aprobado',
    creadoEn: '2026-07-19T10:00:00.000Z',
  },
]

export async function GET(req: NextRequest) {
  const auth = await checkAuth(req)
  if (auth.errorResponse) return auth.errorResponse

  const response = apiSuccess(mockReportes, 'Reportes obtenidos exitosamente')
  response.headers.set('Cache-Control', 'public, max-age=600, s-maxage=600')
  return response
}

export async function POST(req: NextRequest) {
  const auth = await checkAuth(req)
  if (auth.errorResponse) return auth.errorResponse

  try {
    const body = await req.json()
    const parsed = ReporteSchema.parse(body)

    const nuevoReporte = {
      ...parsed,
      id: parsed.id || `rep-${Date.now()}`,
      creadoEn: new Date().toISOString(),
    }

    mockReportes.unshift(nuevoReporte as any)

    return apiSuccess(nuevoReporte, 'Reporte creado correctamente', 201)
  } catch (err: any) {
    if (err.name === 'ZodError') {
      const issue = err.errors[0]?.message || 'Datos de reporte inválidos'
      return apiError(issue, 'Error de validación', 400)
    }
    return apiError(err.message, 'Error al crear el reporte', 500)
  }
}
