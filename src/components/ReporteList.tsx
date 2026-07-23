'use client'

import React, { useState } from 'react'
import { Reporte } from '@/types'

interface ReporteListProps {
  reportes: Reporte[]
  onDownloadPDF?: (reporte: Reporte) => void
}

export function ReporteList({ reportes, onDownloadPDF }: ReporteListProps) {
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')

  const reportesFiltrados = reportes.filter((r) => {
    if (filtroEstado === 'todos') return true
    return r.estado.toLowerCase() === filtroEstado.toLowerCase()
  })

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-gray-800">Reportes de Gastos</h3>
        <div>
          <label htmlFor="filtro-estado" className="mr-2 text-sm font-medium text-gray-600">
            Filtrar:
          </label>
          <select
            id="filtro-estado"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="px-3 py-1.5 border rounded-md text-sm text-gray-700"
          >
            <option value="todos">Todos</option>
            <option value="borrador">Borrador</option>
            <option value="enviado">Enviado</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
          </select>
        </div>
      </div>

      {reportesFiltrados.length === 0 ? (
        <p className="text-gray-500 py-4 text-center">No hay reportes para mostrar.</p>
      ) : (
        <div className="divide-y divide-gray-200" data-testid="reportes-lista">
          {reportesFiltrados.map((rep) => (
            <div key={rep.id} className="py-4 flex justify-between items-center">
              <div>
                <h4 className="font-semibold text-gray-900">{rep.titulo}</h4>
                <p className="text-xs text-gray-500">
                  {rep.fechaInicio} — {rep.fechaFin} | Folio: {rep.id}
                </p>
                <span
                  className={`inline-block mt-2 px-2.5 py-0.5 text-xs font-medium rounded-full ${
                    rep.estado === 'Aprobado'
                      ? 'bg-green-100 text-green-800'
                      : rep.estado === 'Rechazado'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {rep.estado}
                </span>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">
                  ${Number(rep.montoTotal || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                </p>
                {onDownloadPDF && (
                  <button
                    onClick={() => onDownloadPDF(rep)}
                    className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800 underline"
                  >
                    Descargar PDF
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
