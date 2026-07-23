import { NextResponse } from 'next/server'
import { ApiResponse } from '@/types'

/**
 * Normalizes successful API responses.
 */
export function apiSuccess<T>(
  data: T,
  message?: string,
  statusCode: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(message ? { message } : {}),
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  )
}

/**
 * Normalizes error API responses.
 */
export function apiError(
  error: any,
  message?: string,
  statusCode: number = 400
): NextResponse<ApiResponse> {
  const errorMessage =
    typeof error === 'string'
      ? error
      : error?.message || message || 'Ha ocurrido un error inesperado'

  return NextResponse.json(
    {
      success: false,
      error: errorMessage,
      ...(message ? { message } : {}),
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  )
}
