import { ApiResponse, Gasto, Reporte } from '@/types'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || ''

interface FetchOptions extends RequestInit {
  timeoutMs?: number
  retries?: number
}

/**
 * Generic fetch wrapper with timeout, retry logic, and centralized error handling.
 */
async function fetchWithRetry<T>(
  url: string,
  options: FetchOptions = {}
): Promise<ApiResponse<T>> {
  const { timeoutMs = 10000, retries = 2, ...fetchOptions } = options

  let attempt = 0
  let lastError: Error | null = null

  while (attempt <= retries) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url.startsWith('http') ? url : `${BASE_URL}${url}`, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
        signal: controller.signal,
      })

      clearTimeout(id)
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || `HTTP error ${response.status}`)
      }

      return json as ApiResponse<T>
    } catch (err: any) {
      clearTimeout(id)
      lastError = err
      attempt++
      if (attempt > retries) break
      // Exponential backoff delay
      await new Promise((res) => setTimeout(res, 300 * Math.pow(2, attempt)))
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Error de conexión con el servidor',
    timestamp: new Date().toISOString(),
  }
}

export const apiClient = {
  // Gastos
  async getGastos(usuarioId?: string): Promise<ApiResponse<Gasto[]>> {
    const query = usuarioId ? `?usuarioId=${encodeURIComponent(usuarioId)}` : ''
    return fetchWithRetry<Gasto[]>(`/api/gastos${query}`, { method: 'GET' })
  },

  async createGasto(gasto: Partial<Gasto>): Promise<ApiResponse<Gasto>> {
    return fetchWithRetry<Gasto>('/api/gastos', {
      method: 'POST',
      body: JSON.stringify(gasto),
    })
  },

  async updateGasto(id: string, gasto: Partial<Gasto>): Promise<ApiResponse<Gasto>> {
    return fetchWithRetry<Gasto>(`/api/gastos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(gasto),
    })
  },

  async deleteGasto(id: string): Promise<ApiResponse<{ id: string }>> {
    return fetchWithRetry<{ id: string }>(`/api/gastos/${id}`, {
      method: 'DELETE',
    })
  },

  // Reportes
  async getReportes(): Promise<ApiResponse<Reporte[]>> {
    return fetchWithRetry<Reporte[]>('/api/reportes', { method: 'GET' })
  },

  async createReporte(reporte: Partial<Reporte>): Promise<ApiResponse<Reporte>> {
    return fetchWithRetry<Reporte>('/api/reportes', {
      method: 'POST',
      body: JSON.stringify(reporte),
    })
  },
}
