// src/lib/constantes.ts
// Constantes globales, mapeos de categorías, estados, roles y permisos

export const CATS = ["Transporte", "Alimentos", "Hospedaje", "Materiales", "Otros"]

export const MAPA_CLARA: Record<string, string> = {
  // Transporte
  "Combustibles": "Transporte", "Gasolina": "Transporte", "Gas": "Transporte",
  "Peaje": "Transporte", "Caseta": "Transporte", "Autopista": "Transporte",
  "Taxi": "Transporte", "Uber": "Transporte", "Didi": "Transporte", "Cabify": "Transporte",
  "Aerolínea": "Transporte", "Aerolinea": "Transporte", "Vuelo": "Transporte",
  "Autobús": "Transporte", "Autobus": "Transporte", "ADO": "Transporte",
  "Estacionamiento": "Transporte", "Parking": "Transporte", "Renta de auto": "Transporte",
  "Transporte": "Transporte",
  // Alimentos
  "Alimentos": "Alimentos", "Restaurante": "Alimentos", "Restaurant": "Alimentos",
  "Comida": "Alimentos", "Cafetería": "Alimentos", "Cafeteria": "Alimentos",
  "Café": "Alimentos", "Cafe": "Alimentos", "Starbucks": "Alimentos",
  "McDonald": "Alimentos", "Domino": "Alimentos", "Pizza": "Alimentos",
  "Supermercado": "Alimentos", "Abarrotes": "Alimentos",
  // Hospedaje
  "Hospedaje": "Hospedaje", "Hotel": "Hospedaje", "Airbnb": "Hospedaje",
  "Motel": "Hospedaje", "Hostal": "Hospedaje",
  // Materiales
  "Materiales": "Materiales", "Papelería": "Materiales", "Papeleria": "Materiales",
  "Office Depot": "Materiales", "Staples": "Materiales", "Office Max": "Materiales",
  "Ferretería": "Materiales", "Ferreteria": "Materiales", "Home Depot": "Materiales",
  // Otros
  "Médico": "Otros", "Medico": "Otros", "Farmacia": "Otros",
  "Fondo Nacional": "Otros", "FONADIN": "Transporte",
  "Telefonía": "Otros", "Telefonia": "Otros", "Telcel": "Otros",
  "Internet": "Otros", "Telmex": "Otros",
  "Servicios profesionales": "Otros",
  // legacy
  Viajes: "Hospedaje", "Venta Minorista": "Materiales"
}

export const ESTADOS: Record<string, { label: string; color: string; bg: string }> = {
  CAPTURA:       { label: "Captura de gastos",              color: "#18181b", bg: "#f4f4f5" },
  ENVIADA:       { label: "Enviada — pendiente aprobación", color: "#27272a", bg: "#e4e4e7" },
  APROBADA:      { label: "Aprobada — viaje en curso",      color: "#18181b", bg: "#f4f4f5" },
  RECHAZADA:     { label: "Rechazada",                      color: "#71717a", bg: "#e4e4e7" },
  COMPROBACION:  { label: "En comprobación",                color: "#18181b", bg: "#f4f4f5" },
  COMP_REVISION: { label: "Comprobación en revisión",       color: "#27272a", bg: "#e4e4e7" },
  CERRADA:       { label: "Cerrada",                        color: "#52525b", bg: "#f4f4f5" },
  CANCELADA:     { label: "Cancelada",                      color: "#71717a", bg: "#e4e4e7" },
}

export const ROLES: Record<string, { label: string; color: string; bg: string }> = {
  Administrador: { label: "Administrador",       color: "#18181b", bg: "#e4e4e7" },
  Aprobador:     { label: "Gerente / Aprobador", color: "#27272a", bg: "#f4f4f5" },
  Contador:      { label: "Contador / Tesorería", color: "#3f3f46", bg: "#f4f4f5" },
  RH:            { label: "Recursos Humanos",    color: "#52525b", bg: "#f4f4f5" },
  Empleado:      { label: "Empleado",            color: "#71717a", bg: "#f4f4f5" },
}

export const PERMISOS_DISPONIBLES = [
  { key:"verTesoreria",      label:"Ver Tesorería",           grupo:"Tesorería" },
  { key:"actuarTesoreria",   label:"Gestionar pagos/cobros",  grupo:"Tesorería" },
  { key:"verSaldos",         label:"Ver saldos en contra",    grupo:"Tesorería" },
  { key:"aprobar",           label:"Aprobar expedientes",     grupo:"Expedientes" },
  { key:"verTodos",          label:"Ver todos los expedientes",grupo:"Expedientes" },
  { key:"eliminar",          label:"Eliminar expedientes",    grupo:"Expedientes" },
  { key:"reabrir",           label:"Reabrir expedientes",     grupo:"Expedientes" },
  { key:"contabilizar",      label:"Exportación contable",    grupo:"Contabilidad" },
  { key:"verContabilidad",   label:"Ver módulo Contabilizar", grupo:"Contabilidad" },
  { key:"gestionarUsuarios", label:"Gestionar usuarios",      grupo:"Administración" },
  { key:"configurarEmpresa", label:"Configurar empresa",      grupo:"Administración" },
  { key:"gestionarRH",       label:"Gestionar nómina/RH",     grupo:"RH" },
]

export const PERMISOS_BASE: Record<string, Record<string, boolean>> = {
  Administrador: { verTesoreria:true, actuarTesoreria:true, verSaldos:true, aprobar:true,
    verTodos:true, eliminar:true, reabrir:true, contabilizar:true, verContabilidad:true,
    gestionarUsuarios:true, configurarEmpresa:true, gestionarRH:true },
  Aprobador:     { verTesoreria:false, actuarTesoreria:false, verSaldos:true, aprobar:true,
    verTodos:false, verGrupo:true, eliminar:false, reabrir:false, contabilizar:false, verContabilidad:false,
    gestionarUsuarios:true, configurarEmpresa:false, gestionarRH:false },
  Tesoreria:     { verTesoreria:true, actuarTesoreria:true, verSaldos:true, aprobar:false,
    verTodos:true, eliminar:false, reabrir:false, contabilizar:true, verContabilidad:true,
    gestionarUsuarios:false, configurarEmpresa:false, gestionarRH:false },
  Contador:      { verTesoreria:true, actuarTesoreria:false, verSaldos:true, aprobar:false,
    verTodos:true, eliminar:false, reabrir:false, contabilizar:true, verContabilidad:true,
    gestionarUsuarios:false, configurarEmpresa:false, gestionarRH:false },
  RH:            { verTesoreria:true, actuarTesoreria:false, verSaldos:true, aprobar:false,
    verTodos:true, eliminar:false, reabrir:false, contabilizar:false, verContabilidad:false,
    gestionarUsuarios:false, configurarEmpresa:false, gestionarRH:true },
  Empleado:      { verTesoreria:false, actuarTesoreria:false, verSaldos:false, aprobar:false,
    verTodos:false, eliminar:false, reabrir:false, contabilizar:false, verContabilidad:false,
    gestionarUsuarios:false, configurarEmpresa:false, gestionarRH:false },
}

export const getPermisos = (usuario: any) => {
  const base = PERMISOS_BASE[usuario?.rol] || PERMISOS_BASE.Empleado
  return { ...base, ...(usuario?.permisosExtra || {}) }
}

export const puedeAprobar  = (u: any) => getPermisos(u).aprobar
export const puedeVerTodos = (u: any) => getPermisos(u).verTodos
export const puedeVerGrupo = (u: any) => getPermisos(u).verGrupo
export const esAdmin       = (u: any) => u?.rol === "Administrador" || getPermisos(u).configurarEmpresa
export const esTesoreria   = (u: any) => u?.rol === "Tesorería" || getPermisos(u).actuarTesoreria
export const esContador    = (u: any) => u?.rol === "Contador" || u?.rol === "Tesorería" || getPermisos(u).contabilizar
export const esRH          = (u: any) => u?.rol === "RH" || getPermisos(u).gestionarRH
export const puedeVerSaldos = (u: any) => getPermisos(u).verSaldos
export const puedeActuarTesoreria = (u: any) => getPermisos(u).actuarTesoreria
export const puedeVerTesoreria = (u: any) => getPermisos(u).verTesoreria || puedeVerSaldos(u)

// Sistema de diseño S
export const S = {
  font: { fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", letterSpacing: "-0.01em" },
  num: { fontVariantNumeric: "tabular-nums", fontFeatureSettings: "'tnum'" },
  input: { width: "100%", padding: "10px 14px", border: "1.5px solid #e4e4e7", borderRadius: 8, fontSize: 13.5, background: "#ffffff", boxSizing: "border-box", outline: "none", transition: "border-color .15s ease, box-shadow .15s ease", color: "#18181b", fontFamily: "'Inter', system-ui, sans-serif" },
  label: { fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "#a1a1aa", display: "block", marginBottom: 6 },
  btn: (primary: boolean) => ({
    padding: "9px 18px", borderRadius: 8,
    border: primary ? "1.5px solid #18181b" : "1.5px solid #e4e4e7",
    background: primary ? "#18181b" : "#ffffff",
    color: primary ? "#ffffff" : "#18181b",
    fontWeight: 600, fontSize: 13.5, cursor: "pointer",
    boxShadow: primary ? "0 1px 3px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.06)" : "0 1px 2px rgba(0,0,0,0.04)",
    transition: "all .15s ease", letterSpacing: "-0.01em",
    fontFamily: "'Inter', system-ui, sans-serif",
  }),
  card: { background: "#ffffff", border: "1px solid #e4e4e7", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" },
  th: { textAlign: "left" as const, padding: "11px 14px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#a1a1aa", borderBottom: "1.5px solid #27272a", background: "#fafafa" },
  td: { padding: "12px 14px", fontSize: 13.5, borderBottom: "1px solid #f4f4f5", verticalAlign: "middle", color: "#27272a" },
}
