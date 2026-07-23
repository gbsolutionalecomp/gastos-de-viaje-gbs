import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    // Si no hay API key de Resend configurada, retornar OK sin enviar
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'sin_correos') {
      console.log('Resend no configurado — correo omitido')
      return NextResponse.json({ ok: true, omitido: true })
    }

    const { Resend } = await import('resend')
    const { correoSolicitudPendiente, correoSolicitudAprobada, 
            correoSolicitudRechazada, correoReembolsoAprobado, correoTicketCreado } = await import('@/lib/correos')
    
    const { tipo, expedienteId, ticketId, extra } = await req.json()
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Error correos:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
