import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ReporteList } from '@/components/ReporteList'
import { Reporte } from '@/types'

const sampleReportes: Reporte[] = [
  {
    id: 'rep-1',
    usuarioId: 'u-1',
    titulo: 'Viaje Monterrey',
    fechaInicio: '2026-07-01',
    fechaFin: '2026-07-05',
    montoTotal: 3200,
    estado: 'Aprobado',
  },
  {
    id: 'rep-2',
    usuarioId: 'u-1',
    titulo: 'Visita Cliente CDMX',
    fechaInicio: '2026-07-10',
    fechaFin: '2026-07-12',
    montoTotal: 1500,
    estado: 'Rechazado',
  },
]

describe('ReporteList Component', () => {
  it('renders report list items', () => {
    render(<ReporteList reportes={sampleReportes} />)
    expect(screen.getByText('Viaje Monterrey')).toBeInTheDocument()
    expect(screen.getByText('Visita Cliente CDMX')).toBeInTheDocument()
  })

  it('filters report list by status', () => {
    render(<ReporteList reportes={sampleReportes} />)
    const select = screen.getByLabelText('Filtrar:')

    fireEvent.change(select, { target: { value: 'aprobado' } })
    expect(screen.getByText('Viaje Monterrey')).toBeInTheDocument()
    expect(screen.queryByText('Visita Cliente CDMX')).not.toBeInTheDocument()
  })

  it('calls onDownloadPDF when download button is clicked', () => {
    const mockDownload = vi.fn()
    render(<ReporteList reportes={sampleReportes} onDownloadPDF={mockDownload} />)

    const buttons = screen.getAllByText('Descargar PDF')
    fireEvent.click(buttons[0])

    expect(mockDownload).toHaveBeenCalledWith(sampleReportes[0])
  })
})
