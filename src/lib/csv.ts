import Papa from 'papaparse'
import { Gasto } from '@/types'

export interface CsvGastoRow {
  Fecha: string
  Concepto: string
  'Monto ($)': string
  Categoría: string
  Estado: string
  Notas: string
}

/**
 * Formats expense objects into CSV string using PapaParse.
 */
export function exportarGastosCSV(gastos: Gasto[]): string {
  const rows: CsvGastoRow[] = gastos.map((gasto) => ({
    Fecha: gasto.fecha ? gasto.fecha.slice(0, 10) : '',
    Concepto: gasto.concepto || '',
    'Monto ($)': Number(gasto.monto || 0).toFixed(2),
    Categoría: gasto.categoria || '',
    Estado: gasto.estado || 'Pendiente',
    Notas: gasto.notas || '',
  }))

  return Papa.unparse(rows, {
    header: true,
  })
}

/**
 * Initiates browser CSV file download.
 */
export function descargarGastosCSV(gastos: Gasto[]): void {
  const csvContent = exportarGastosCSV(gastos)
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const dateStr = new Date().toISOString().slice(0, 10)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `gastos_${dateStr}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
