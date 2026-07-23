import { jsPDF } from 'jspdf'
import { Reporte } from '@/types'

/**
 * Generates a PDF report document for travel expenses.
 */
export function generateReportePDF(reporte: Reporte): jsPDF {
  const doc = new jsPDF()

  // Primary palette
  const primaryColor = '#1E3A8A' // Deep Blue
  const textColor = '#1F2937'

  // Header Banner
  doc.setFillColor(30, 58, 138)
  doc.rect(0, 0, 210, 30, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('GBS SOLUTIONS — Reporte de Gastos', 14, 20)

  // Report Information
  doc.setTextColor(textColor)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(`Título: ${reporte.titulo || 'Reporte de Viáticos'}`, 14, 42)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Folio ID: ${reporte.id || 'N/A'}`, 14, 50)
  doc.text(`Usuario ID: ${reporte.usuarioId || 'N/A'}`, 14, 56)
  doc.text(`Estado: ${reporte.estado || 'Borrador'}`, 14, 62)
  doc.text(`Período: ${reporte.fechaInicio || ''} a ${reporte.fechaFin || ''}`, 14, 68)

  if (reporte.descripcion) {
    doc.text(`Descripción: ${reporte.descripcion}`, 14, 74)
  }

  // Divider
  doc.setDrawColor(200, 200, 200)
  doc.line(14, 80, 196, 80)

  // Table Headers
  let startY = 90
  doc.setFillColor(243, 244, 246)
  doc.rect(14, startY, 182, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 58, 138)
  doc.text('Fecha', 16, startY + 6)
  doc.text('Concepto', 45, startY + 6)
  doc.text('Categoría', 115, startY + 6)
  doc.text('Monto ($)', 165, startY + 6)

  // Table Rows
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(textColor)
  startY += 12

  const gastos = reporte.gastos || []

  if (gastos.length === 0) {
    doc.text('No hay gastos registrados en este reporte.', 16, startY)
    startY += 10
  } else {
    gastos.forEach((gasto) => {
      if (startY > 270) {
        doc.addPage()
        startY = 20
      }
      doc.text(String(gasto.fecha || '').slice(0, 10), 16, startY)
      doc.text(String(gasto.concepto || '').slice(0, 35), 45, startY)
      doc.text(String(gasto.categoria || ''), 115, startY)
      doc.text(`$${Number(gasto.monto || 0).toFixed(2)}`, 165, startY)
      startY += 8
    })
  }

  // Summary Total
  startY += 6
  doc.setDrawColor(30, 58, 138)
  doc.line(14, startY, 196, startY)
  startY += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(`TOTAL GENERAL: $${Number(reporte.montoTotal || 0).toFixed(2)} MXN`, 120, startY)

  return doc
}

/**
 * Downloads the generated PDF directly in the browser environment.
 */
export function downloadReportePDF(reporte: Reporte): void {
  const doc = generateReportePDF(reporte)
  const filename = `reporte_gastos_${reporte.id || Date.now()}.pdf`
  doc.save(filename)
}
