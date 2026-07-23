// src/lib/correos.ts
// Servicio de correos automáticos usando Resend
// Documentación: https://resend.com/docs

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const DE = process.env.CORREO_REMITENTE || 'viaticos@tuempresa.com'

// ================================================================
// PLANTILLAS DE CORREO
// ================================================================

function plantillaBase(titulo: string, contenido: string, folio: string, url: string) {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #F4F5F3; margin: 0; padding: 20px; }
    .card { background: #fff; border-radius: 12px; max-width: 600px; margin: 0 auto; overflow: hidden; }
    .header { background: #16303F; color: #fff; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .header .folio { font-family: monospace; font-size: 13px; opacity: .7; margin-top: 4px; }
    .body { padding: 28px 32px; color: #1B2830; line-height: 1.6; }
    .btn { display: inline-block; background: #16303F; color: #fff; padding: 12px 24px;
           border-radius: 8px; text-decoration: none; font-weight: 700; margin-top: 20px; }
    .footer { background: #F4F5F3; padding: 16px 32px; font-size: 12px; color: #8A949C; text-align: center; }
    .chip { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
    .aprobado { background: #E4F3EF; color: #0E7C66; }
    .pendiente { background: #FCF3E3; color: #B7791F; }
    .rechazado { background: #F9E9E7; color: #B4443C; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    td { padding: 8px 0; border-bottom: 1px dotted #E3E6E9; font-size: 14px; }
    td:last-child { text-align: right; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Gastos de Viaje</h1>
      <div class="folio">${folio}</div>
    </div>
    <div class="body">
      <h2 style="margin-top:0">${titulo}</h2>
      ${contenido}
      <a href="${url}" class="btn">Ver expediente →</a>
    </div>
    <div class="footer">
      Este correo fue generado automáticamente por el sistema de Gastos de Viaje.
      No responder directamente a este mensaje.
    </div>
  </div>
</body>
</html>`
}

// ================================================================
// FUNCIONES DE ENVÍO
// ================================================================

interface DatosExpediente {
  folio: string
  proyecto: string
  cliente: string
  pedido: string
  solicitante: string
  departamento: string
  fechaInicio: string
  fechaFin: string
  totalPresupuesto: number
  totalComprobado?: number
  totalReembolso?: number
  autorizador?: string
}

const mxn = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0)
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tuapp.vercel.app'

// ── 1. Solicitud enviada → notificar al aprobador ──────────────
export async function correoSolicitudPendiente(
  para: string,
  cc: string | undefined,
  exp: DatosExpediente
) {
  const url = `${appUrl}/expedientes/${exp.folio}`
  const html = plantillaBase(
    'Solicitud de viáticos pendiente de aprobación',
    `<p><b>${exp.solicitante}</b> (${exp.departamento}) ha enviado una solicitud de viáticos que requiere tu aprobación.</p>
     <table>
       <tr><td>Proyecto</td><td>${exp.proyecto || '—'}</td></tr>
       <tr><td>Cliente</td><td>${exp.cliente || '—'}</td></tr>
       <tr><td>Pedido</td><td>${exp.pedido || '—'}</td></tr>
       <tr><td>Período</td><td>${exp.fechaInicio} al ${exp.fechaFin}</td></tr>
       <tr><td>Presupuesto solicitado</td><td>${mxn(exp.totalPresupuesto)}</td></tr>
     </table>
     <p>Entra al sistema para aprobar o rechazar esta solicitud.</p>`,
    exp.folio, url
  )
  return resend.emails.send({
    from: DE,
    to: para,
    cc: cc ? [cc] : [],
    subject: `[Pendiente] Solicitud ${exp.folio} — ${exp.proyecto || exp.solicitante}`,
    html
  })
}

// ── 2. Solicitud aprobada → notificar al solicitante ──────────
export async function correoSolicitudAprobada(
  para: string,
  exp: DatosExpediente
) {
  const url = `${appUrl}/expedientes/${exp.folio}`
  const html = plantillaBase(
    '✅ Tu solicitud fue aprobada',
    `<p>Tu solicitud de viáticos <b>${exp.folio}</b> fue aprobada por <b>${exp.autorizador}</b>.</p>
     <table>
       <tr><td>Proyecto</td><td>${exp.proyecto || '—'}</td></tr>
       <tr><td>Período</td><td>${exp.fechaInicio} al ${exp.fechaFin}</td></tr>
       <tr><td>Presupuesto autorizado</td><td>${mxn(exp.totalPresupuesto)}</td></tr>
     </table>
     <p>Ya puedes realizar tu viaje. Recuerda guardar todos tus comprobantes y cargar la comprobación al regresar.</p>`,
    exp.folio, url
  )
  return resend.emails.send({
    from: DE,
    to: para,
    subject: `✅ Aprobada — ${exp.folio} — ${exp.proyecto || ''}`,
    html
  })
}

// ── 3. Solicitud rechazada ─────────────────────────────────────
export async function correoSolicitudRechazada(
  para: string,
  exp: DatosExpediente,
  motivo?: string
) {
  const url = `${appUrl}/expedientes/${exp.folio}`
  const html = plantillaBase(
    '❌ Tu solicitud fue rechazada',
    `<p>Tu solicitud de viáticos <b>${exp.folio}</b> fue rechazada por <b>${exp.autorizador}</b>.</p>
     ${motivo ? `<p><b>Motivo:</b> ${motivo}</p>` : ''}
     <p>Puedes corregir la solicitud y reenviarla a aprobación desde el sistema.</p>`,
    exp.folio, url
  )
  return resend.emails.send({
    from: DE,
    to: para,
    subject: `❌ Rechazada — ${exp.folio}`,
    html
  })
}

// ── 4. Comprobación recibida → notificar al aprobador ─────────
export async function correoComprobacionPendiente(
  para: string,
  cc: string | undefined,
  exp: DatosExpediente
) {
  const url = `${appUrl}/expedientes/${exp.folio}`
  const html = plantillaBase(
    'Comprobación de gastos lista para revisión',
    `<p><b>${exp.solicitante}</b> ha cargado la comprobación de gastos del expediente <b>${exp.folio}</b>.</p>
     <table>
       <tr><td>Proyecto</td><td>${exp.proyecto || '—'}</td></tr>
       <tr><td>Presupuesto autorizado</td><td>${mxn(exp.totalPresupuesto)}</td></tr>
       <tr><td>Total comprobado</td><td>${mxn(exp.totalComprobado || 0)}</td></tr>
       <tr><td>Variación</td><td>${mxn((exp.totalPresupuesto || 0) - (exp.totalComprobado || 0))}</td></tr>
     </table>`,
    exp.folio, url
  )
  return resend.emails.send({
    from: DE,
    to: para,
    cc: cc ? [cc] : [],
    subject: `[Comprobación] ${exp.folio} — ${exp.proyecto || exp.solicitante}`,
    html
  })
}

// ── 5. Reembolso aprobado → notificar a finanzas/contador ─────
export async function correoReembolsoAprobado(
  para: string,
  cc: string | undefined,
  exp: DatosExpediente,
  datosBancarios: {
    banco: string; clabe: string; titularCuenta: string; cuentaBanco?: string
  }
) {
  const url = `${appUrl}/expedientes/${exp.folio}`
  const html = plantillaBase(
    '💰 Reembolso aprobado — pendiente de pago',
    `<p>El siguiente reembolso fue aprobado y está pendiente de pago en nómina o finanzas.</p>
     <table>
       <tr><td>Solicitante</td><td>${exp.solicitante}</td></tr>
       <tr><td>Expediente</td><td>${exp.folio}</td></tr>
       <tr><td>Proyecto / Pedido</td><td>${exp.proyecto || '—'} / ${exp.pedido || '—'}</td></tr>
       <tr><td><b>Monto a reembolsar</b></td><td><b>${mxn(exp.totalReembolso || 0)}</b></td></tr>
     </table>
     <h3 style="margin-bottom:8px">Datos bancarios</h3>
     <table>
       <tr><td>Banco</td><td>${datosBancarios.banco}</td></tr>
       <tr><td>Titular</td><td>${datosBancarios.titularCuenta}</td></tr>
       <tr><td>CLABE</td><td style="font-family:monospace">${datosBancarios.clabe}</td></tr>
       ${datosBancarios.cuentaBanco ? `<tr><td>No. cuenta</td><td style="font-family:monospace">${datosBancarios.cuentaBanco}</td></tr>` : ''}
     </table>`,
    exp.folio, url
  )
  return resend.emails.send({
    from: DE,
    to: para,
    cc: cc ? [cc] : [],
    subject: `💰 Reembolso ${mxn(exp.totalReembolso || 0)} — ${exp.folio} — ${exp.solicitante}`,
    html
  })
}

// ── 6. Ticket de soporte creado ────────────────────────────────
export async function correoTicketCreado(
  para: string,
  ticket: { folio: string; asunto: string; autor: string; categoria: string; prioridad: string }
) {
  const url = `${appUrl}/tickets/${ticket.folio}`
  const html = plantillaBase(
    `Nuevo ticket de soporte — ${ticket.prioridad}`,
    `<p><b>${ticket.autor}</b> creó un ticket de soporte que requiere atención.</p>
     <table>
       <tr><td>Categoría</td><td>${ticket.categoria}</td></tr>
       <tr><td>Prioridad</td><td>${ticket.prioridad}</td></tr>
       <tr><td>Asunto</td><td>${ticket.asunto}</td></tr>
     </table>`,
    ticket.folio, url
  )
  return resend.emails.send({
    from: DE,
    to: para,
    subject: `[${ticket.prioridad}] Ticket ${ticket.folio} — ${ticket.asunto}`,
    html
  })
}
