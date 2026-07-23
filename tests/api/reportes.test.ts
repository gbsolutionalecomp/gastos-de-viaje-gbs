import { describe, it, expect, vi } from 'vitest'
import { GET, POST } from '@/app/api/reportes/route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  checkAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@gbsolutions.com', role: 'admin' },
  }),
}))

describe('API Route /api/reportes', () => {
  it('GET returns list of reports', async () => {
    const req = new NextRequest('http://localhost:3000/api/reportes')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data)).toBe(true)
  })

  it('POST creates new report', async () => {
    const payload = {
      usuarioId: 'user-1',
      titulo: 'Viaje Trabajo Cancún',
      fechaInicio: '2026-07-10',
      fechaFin: '2026-07-15',
      montoTotal: 5000,
      estado: 'Borrador',
    }

    const req = new NextRequest('http://localhost:3000/api/reportes', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.success).toBe(true)
    expect(json.data.titulo).toBe('Viaje Trabajo Cancún')
  })
})
