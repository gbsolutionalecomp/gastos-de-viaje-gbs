import { NextRequest } from 'next/server'
import { checkAuth } from '@/lib/auth'
import { GastoSchema } from '@/lib/schemas/gasto.schema'
import { apiSuccess, apiError } from '@/lib/api-response'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkAuth(req)
  if (auth.errorResponse) return auth.errorResponse

  const { id } = await params

  try {
    const body = await req.json()
    const parsed = GastoSchema.partial().parse(body)

    const updatedGasto = {
      id,
      ...parsed,
      actualizadoEn: new Date().toISOString(),
    }

    return apiSuccess(updatedGasto, 'Gasto actualizado correctamente')
  } catch (err: any) {
    if (err.name === 'ZodError') {
      const issue = err.errors[0]?.message || 'Datos de gasto inválidos'
      return apiError(issue, 'Error de validación', 400)
    }
    return apiError(err.message, 'Error al actualizar el gasto', 500)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkAuth(req)
  if (auth.errorResponse) return auth.errorResponse

  const { id } = await params
  return apiSuccess({ id }, 'Gasto eliminado exitosamente')
}
