import { describe, it, expect } from 'vitest'
import { generateReportePDF } from '@/lib/pdf'
import { Reporte } from '@/types'

describe('PDF Generation Library', () => {
  it('generates a valid jsPDF document instance', () => {
    const mockReporte: Reporte = {
      id: 'rep-99',
      usuarioId: 'u-5',
      titulo: 'Reporte Prueba PDF',
      descripcion: 'Pruebas unitarias de PDF',
      fechaInicio: '2026-07-01',
      fechaFin: '2026-07-05',
      montoTotal: 2500,
      estado: 'Aprobado',
      gastos: [
        {
          id: 'g-1',
          usuarioId: 'u-5',
          concepto: 'Comida en aeropuerto',
          monto: 350,
          categoria: 'Alimentación',
          fecha: '2026-07-02',
          estado: 'Aprobado',
        },
      ],
    }

    const pdfDoc = generateReportePDF(mockReporte)
    expect(pdfDoc).toBeDefined()
    expect(typeof pdfDoc.output).toBe('function')
  })
})
