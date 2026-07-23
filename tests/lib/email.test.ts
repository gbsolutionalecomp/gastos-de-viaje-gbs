import { describe, it, expect } from 'vitest'
import { sendReporteAprobado, sendReporteRechazado } from '@/lib/email'

describe('Email Notification Library', () => {
  it('handles missing Resend API key gracefully', async () => {
    const user = { nombre: 'Juan Perez', email: 'juan@gbsolutions.com' }
    const reporte = { id: 'rep-1', titulo: 'Viaje Trabajo', montoTotal: 1200 }

    const resAprobado = await sendReporteAprobado(user, reporte)
    expect(resAprobado.ok).toBe(true)

    const resRechazado = await sendReporteRechazado(user, reporte, 'Comprobante ilegible')
    expect(resRechazado.ok).toBe(true)
  })
})
