import { Resend } from 'resend'
import { Reporte, Usuario } from '@/types'

const resendApiKey = process.env.RESEND_API_KEY
const correoRemitente = process.env.CORREO_REMITENTE || 'viaticos@gbsolutions.com'

const resend = resendApiKey && resendApiKey !== 'sin_correos' ? new Resend(resendApiKey) : null

export async function sendReporteAprobado(usuario: Partial<Usuario>, reporte: Partial<Reporte>) {
  if (!resend) {
    console.log('[EMAIL OMITIDO] Resend API Key no configurada:', reporte.id)
    return { ok: true, omitido: true }
  }

  try {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #1E3A8A; color: #ffffff; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px;">¡Reporte Aprobado!</h1>
        </div>
        <div style="padding: 24px; color: #374151;">
          <p>Hola <strong>${usuario.nombre || 'Usuario'}</strong>,</p>
          <p>Nos complace informarte que tu reporte de gastos <strong>"${reporte.titulo}"</strong> ha sido <strong>APROBADO</strong>.</p>
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Folio:</strong> ${reporte.id || 'N/A'}</p>
            <p style="margin: 4px 0;"><strong>Monto Aprobado:</strong> $${Number(reporte.montoTotal || 0).toFixed(2)} MXN</p>
          </div>
          <p>El área de tesorería procesará el reembolso/pago correspondiente.</p>
        </div>
      </div>
    `

    const res = await resend.emails.send({
      from: correoRemitente,
      to: [usuario.email || ''],
      subject: `[Aprobado] Reporte de Gastos ${reporte.titulo}`,
      html,
    })

    return { ok: true, data: res }
  } catch (err: any) {
    console.error('Error enviando email de aprobación:', err)
    return { ok: false, error: err.message }
  }
}

export async function sendReporteRechazado(
  usuario: Partial<Usuario>,
  reporte: Partial<Reporte>,
  motivo: string
) {
  if (!resend) {
    console.log('[EMAIL OMITIDO] Resend API Key no configurada:', reporte.id)
    return { ok: true, omitido: true }
  }

  try {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #DC2626; color: #ffffff; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px;">Reporte Rechazado</h1>
        </div>
        <div style="padding: 24px; color: #374151;">
          <p>Hola <strong>${usuario.nombre || 'Usuario'}</strong>,</p>
          <p>Tu reporte de gastos <strong>"${reporte.titulo}"</strong> ha sido <strong>RECHAZADO</strong>.</p>
          <div style="background-color: #fef2f2; border-left: 4px solid #DC2626; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #991B1B;"><strong>Motivo del rechazo:</strong> ${motivo}</p>
          </div>
          <p>Por favor revisa las observaciones y realiza los ajustes correspondientes en la plataforma.</p>
        </div>
      </div>
    `

    const res = await resend.emails.send({
      from: correoRemitente,
      to: [usuario.email || ''],
      subject: `[Rechazado] Reporte de Gastos ${reporte.titulo}`,
      html,
    })

    return { ok: true, data: res }
  } catch (err: any) {
    console.error('Error enviando email de rechazo:', err)
    return { ok: false, error: err.message }
  }
}

export async function sendRecordatorio(usuario: Partial<Usuario>) {
  if (!resend) {
    console.log('[EMAIL OMITIDO] Resend API Key no configurada:', usuario.email)
    return { ok: true, omitido: true }
  }

  try {
    const res = await resend.emails.send({
      from: correoRemitente,
      to: [usuario.email || ''],
      subject: `Recordatorio de comprobación de gastos pendietes`,
      html: `<p>Hola ${usuario.nombre}, tienes pendientes de comprobación en la plataforma de gastos de viaje GBS.</p>`,
    })
    return { ok: true, data: res }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}
