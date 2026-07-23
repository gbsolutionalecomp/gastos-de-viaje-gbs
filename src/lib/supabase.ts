import { createClient } from '@supabase/supabase-js'

// ── Cliente público (browser) ──────────────────────────────────
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

export const supabase = createClient(
  supabaseUrl,
  anonKey
)

// ── Cliente admin (server-side únicamente) ─────────────────────
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || anonKey
)

// ================================================================
// TIPOS
// ================================================================
export type Rol = 'Administrador' | 'Aprobador' | 'Contador' | 'Empleado'
export type EstadoExp = 'CAPTURA' | 'ENVIADA' | 'APROBADA' | 'COMPROBACION' | 'RECHAZADA' | 'CERRADA'
export type TipoExp = 'viaje' | 'reembolso' | 'caja-chica'

export interface Usuario {
  id: string
  empresa_id: string
  nombre: string
  correo: string
  rol: Rol
  departamento?: string
  ubicacion?: string
  cc?: string
  banco?: string
  clabe?: string
  titular_cuenta?: string
  activo: boolean
}

export interface Expediente {
  id: string
  empresa_id: string
  folio: string
  tipo: TipoExp
  estado: EstadoExp
  proyecto?: string
  proyecto_id?: string
  pedido?: string
  cliente?: string
  objetivo?: string
  solicitante: string
  solicitante_id: string
  departamento?: string
  cc?: string
  fecha_inicio?: string
  fecha_fin?: string
  fecha_solicitud: string
  monto_clara: number
  fondo_efectivo: number
  presupuesto: Record<string, number>
  autorizador?: string
  historial: Array<{ fecha: string; quien: string; accion: string }>
  movimientos?: Movimiento[]
}

export interface Movimiento {
  id: string
  expediente_id: string
  origen: 'clara' | 'clara-reembolso' | 'manual'
  fecha: string
  concepto: string
  categoria?: string
  cuenta_contable?: string
  subtotal?: number
  iva: number
  total: number
  factura: boolean
  uuid_cfdi?: string
  forma_pago?: string
  reembolso: boolean
}

// ================================================================
// AUTENTICACIÓN
// ================================================================
export async function loginConGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` }
  })
}

export async function loginConMicrosoft() {
  return supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      scopes: 'email profile',
      redirectTo: `${window.location.origin}/auth/callback`
    }
  })
}

export async function cerrarSesion() {
  return supabase.auth.signOut()
}

export async function obtenerSesion() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// ================================================================
// USUARIOS
// ================================================================
export async function obtenerMiUsuario(): Promise<Usuario | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .single()
  if (error) return null
  return data
}

export async function obtenerUsuariosEmpresa(empresaId: string) {
  const { data } = await supabase
    .from('usuarios')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('nombre')
  return data || []
}

export async function actualizarUsuario(id: string, cambios: Partial<Usuario>) {
  const { data, error } = await supabase
    .from('usuarios')
    .update(cambios)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function crearUsuario(usuario: Omit<Usuario, 'id'>) {
  // El Admin crea usuarios — requiere service role en el servidor
  const res = await fetch('/api/admin/usuarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(usuario)
  })
  return res.json()
}

// ================================================================
// EXPEDIENTES
// ================================================================
export async function obtenerExpedientes(filtros?: {
  estado?: string
  tipo?: string
  mes?: number
  anio?: number
  usuarioId?: string
}) {
  let query = supabase
    .from('expedientes')
    .select('*, movimientos(*)')
    .order('creado_en', { ascending: false })

  if (filtros?.estado) query = query.eq('estado', filtros.estado)
  if (filtros?.tipo)   query = query.eq('tipo', filtros.tipo)
  if (filtros?.mes && filtros?.anio) {
    const inicio = `${filtros.anio}-${String(filtros.mes + 1).padStart(2,'0')}-01`
    const fin    = new Date(filtros.anio, filtros.mes + 1, 0).toISOString().slice(0,10)
    query = query.gte('fecha_solicitud', inicio).lte('fecha_solicitud', fin)
  }

  const { data, error } = await query
  return { data: data || [], error }
}

export async function obtenerExpediente(id: string) {
  const { data, error } = await supabase
    .from('expedientes')
    .select('*, movimientos(*)')
    .eq('id', id)
    .single()
  return { data, error }
}

export async function crearExpediente(exp: Omit<Expediente, 'id'>) {
  const { data, error } = await supabase
    .from('expedientes')
    .insert(exp)
    .select()
    .single()
  return { data, error }
}

export async function actualizarExpediente(id: string, cambios: Partial<Expediente>) {
  const { data, error } = await supabase
    .from('expedientes')
    .update({ ...cambios, actualizado_en: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function eliminarExpediente(id: string) {
  const { error } = await supabase
    .from('expedientes')
    .delete()
    .eq('id', id)
  return { error }
}

// ================================================================
// MOVIMIENTOS
// ================================================================
export async function upsertMovimientos(expedienteId: string, movimientos: Partial<Movimiento>[]) {
  // Borrar los existentes del origen indicado y reinsertar
  const { error } = await supabase
    .from('movimientos')
    .upsert(movimientos.map(m => ({ ...m, expediente_id: expedienteId })))
  return { error }
}

export async function eliminarMovimiento(id: string) {
  return supabase.from('movimientos').delete().eq('id', id)
}

// ================================================================
// ARCHIVOS (XMLs, PDFs adjuntos)
// ================================================================
export async function subirArchivo(
  expedienteId: string,
  archivo: File,
  tipo: 'xml' | 'pdf'
): Promise<string | null> {
  const ext   = tipo === 'xml' ? '.xml' : '.pdf'
  const ruta  = `${expedienteId}/${Date.now()}${ext}`
  const { error } = await supabase.storage
    .from('archivos-expedientes')
    .upload(ruta, archivo)
  if (error) return null
  const { data } = supabase.storage.from('archivos-expedientes').getPublicUrl(ruta)
  return data.publicUrl
}

export async function subirLogo(empresaId: string, archivo: File): Promise<string | null> {
  const ext  = archivo.name.split('.').pop()
  const ruta = `${empresaId}/logo.${ext}`
  const { error } = await supabase.storage
    .from('logos-empresas')
    .upload(ruta, archivo, { upsert: true })
  if (error) return null
  const { data } = supabase.storage.from('logos-empresas').getPublicUrl(ruta)
  return data.publicUrl
}

// ================================================================
// EMPRESAS
// ================================================================
export async function obtenerEmpresa(id: string) {
  const { data } = await supabase
    .from('empresas')
    .select('*')
    .eq('id', id)
    .single()
  return data
}

export async function actualizarEmpresa(id: string, cambios: object) {
  const { data, error } = await supabase
    .from('empresas')
    .update(cambios)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

// ================================================================
// TICKETS
// ================================================================
export async function obtenerTickets() {
  const { data } = await supabase
    .from('tickets')
    .select('*')
    .order('creado_en', { ascending: false })
  return data || []
}

export async function crearTicket(ticket: object) {
  const { data, error } = await supabase
    .from('tickets')
    .insert(ticket)
    .select()
    .single()
  return { data, error }
}

export async function actualizarTicket(id: string, cambios: object) {
  const { data, error } = await supabase
    .from('tickets')
    .update(cambios)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}
