import { describe, it, expect, vi } from 'vitest'
import { GET, POST } from '@/app/api/gastos/route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  checkAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@gbsolutions.com', role: 'admin' },
  }),
}))

describe('API Route /api/gastos', () => {
  it('GET returns list of expenses with success response wrapper', async () => {
    const req = new NextRequest('http://localhost:3000/api/gastos')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data)).toBe(true)
  })

  it('POST creates new expense when validation passes', async () => {
    const payload = {
      usuarioId: 'user-1',
      concepto: 'Hospedaje Hotel Ejecutivo',
      monto: 1800,
      categoria: 'Hospedaje',
      fecha: '2026-07-22',
      estado: 'Pendiente',
    }

    const req = new NextRequest('http://localhost:3000/api/gastos', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.success).toBe(true)
    expect(json.data.concepto).toBe('Hospedaje Hotel Ejecutivo')
  })
})
