import { describe, it, expect } from 'vitest'
import { exportarGastosCSV } from '@/lib/csv'
import { Gasto } from '@/types'

describe('CSV Export Library', () => {
  it('converts array of expenses to formatted CSV string', () => {
    const gastos: Gasto[] = [
      {
        id: 'g-1',
        usuarioId: 'u-1',
        concepto: 'Gasolina Pemex',
        monto: 800,
        categoria: 'Gasolina',
        fecha: '2026-07-10',
        estado: 'Aprobado',
        notas: 'Factura 1234',
      },
    ]

    const csvOutput = exportarGastosCSV(gastos)
    expect(csvOutput).toContain('Fecha,Concepto,Monto ($),Categoría,Estado,Notas')
    expect(csvOutput).toContain('Gasolina Pemex')
    expect(csvOutput).toContain('800.00')
    expect(csvOutput).toContain('Gasolina')
  })
})
