import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";
import TarjetasSesiones from "./src/components/TarjetasSesiones";


// ---------- constantes ----------
const CATS = ["Transporte", "Alimentos", "Hospedaje", "Materiales", "Otros"];
const MAPA_CLARA = {
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
  Transporte: "Transporte", Alimentos: "Alimentos", Viajes: "Hospedaje", "Venta Minorista": "Materiales" };
const ESTADOS = {
  CAPTURA:       { label: "Captura de gastos",              color: "#18181b", bg: "#f4f4f5" },
  ENVIADA:       { label: "Enviada — pendiente aprobación", color: "#27272a", bg: "#e4e4e7" },
  APROBADA:      { label: "Aprobada — viaje en curso",      color: "#18181b", bg: "#f4f4f5" },
  RECHAZADA:     { label: "Rechazada",                      color: "#71717a", bg: "#e4e4e7" },
  COMPROBACION:  { label: "En comprobación",                color: "#18181b", bg: "#f4f4f5" },
  COMP_REVISION: { label: "Comprobación en revisión",       color: "#27272a", bg: "#e4e4e7" },
  CERRADA:       { label: "Cerrada",                        color: "#52525b", bg: "#f4f4f5" },
  CANCELADA:     { label: "Cancelada",                      color: "#71717a", bg: "#e4e4e7" },
};
const detectarCategoria = (concepto = "", categoria = "") => {
  if (categoria && categoria !== "Otros" && MAPA_CLARA[categoria]) return MAPA_CLARA[categoria];
  const texto = (concepto + " " + categoria).toLowerCase();
  if (/gasolina|combustible|gas|peaje|caseta|autopista|fonadin|fondo nacional|taxi|uber|didi|cabify|aerol|vuelo|autobus|ado|estacionamiento|parking|renta.*auto/i.test(texto)) return "Transporte";
  if (/hotel|hospedaje|airbnb|motel|hostal/i.test(texto)) return "Hospedaje";
  if (/restaurant|comida|alimento|café|cafe|cafeteria|starbucks|mcdonald|domino|pizza|super|abarrote/i.test(texto)) return "Alimentos";
  if (/papeler|office|staples|ferret|home depot|material|herramienta/i.test(texto)) return "Materiales";
  return MAPA_CLARA[categoria] || "Otros";
};

const mxn = (n) => (n == null || isNaN(n) ? "—" : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n));
const hoy = () => new Date().toISOString().slice(0, 10);
const uid = () => {
  try { if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID(); } catch {}
  // Fallback UUID v4 manual
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
};

// ── Storage seguro: window.storage (artifact Claude) → localStorage (web) → memoria ──
const _mem = {};
const safeStorage = {
  async get(key, shared) {
    try { if (typeof window !== "undefined" && window.storage?.get) return await window.storage.get(key, shared); } catch {}
    try { const v = localStorage.getItem(key); return v !== null ? { key, value: v } : null; } catch {}
    return key in _mem ? { key, value: _mem[key] } : null;
  },
  async set(key, value, shared) {
    try { if (typeof window !== "undefined" && window.storage?.set) return await window.storage.set(key, value, shared); } catch {}
    try { localStorage.setItem(key, value); return { key, value }; } catch {}
    _mem[key] = value; return { key, value };
  },
  async delete(key, shared) {
    try { if (typeof window !== "undefined" && window.storage?.delete) return await window.storage.delete(key, shared); } catch {}
    try { localStorage.removeItem(key); } catch {}
    delete _mem[key]; return { key, deleted: true };
  },
};


// ================================================================
// CAPA DE DATOS — Supabase via npm (estable, sin CDN)
// ================================================================
const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Cliente Supabase creado una sola vez al cargar el módulo — no depende de CDN
let __sbClient = null;
// ── Subir archivo a Supabase Storage ─────────────────────
async function subirArchivoStorage(empresaId, expedienteId, archivo, nombreOriginal) {
  if (!enProduccion()) return null;
  const sb = getSB();
  if (!sb) return null;
  try {
    const ext  = nombreOriginal.split(".").pop().toLowerCase();
    const nombre = empresaId + "/" + expedienteId + "/" + Date.now() + "_" + nombreOriginal.replace(/[^a-zA-Z0-9._-]/g, "_");
    const bytes = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(new Uint8Array(r.result));
      r.onerror = rej;
      r.readAsArrayBuffer(archivo);
    });
    const { data, error } = await sb.storage
      .from("archivos-expedientes")
      .upload(nombre, bytes, { contentType: archivo.type || "application/octet-stream", upsert: false });
    if (error) { console.error("[Storage] Error subiendo:", error.message); return null; }
    // URL firmada válida por 10 años (archivos internos)
    const { data: urlData } = await sb.storage
      .from("archivos-expedientes")
      .createSignedUrl(nombre, 60 * 60);
    return urlData?.signedUrl || null;
  } catch(e) { console.error("[Storage] Exception:", e.message); return null; }
}

const getSB = () => {
  if (__sbClient) return __sbClient;
  if (!SB_URL || !SB_ANON) return null;
  try {
    __sbClient = createClient(SB_URL, SB_ANON);
    return __sbClient;
  } catch(e) {
    console.error("Error creando cliente Supabase:", e);
    return null;
  }
};

const enProduccion = () => {
  try {
    if (typeof window === "undefined") return false;
    const host = window.location?.hostname || "";
    return host.includes("vercel.app") || host.includes("supabase.co") ||
           (host !== "" && host !== "localhost" && !host.includes("127.") && !host.includes("claude"));
  } catch { return false; }
};

// ── MAPEOS DB <-> APP ─────────────────────────────────────────
function mapEmpresaFromDB(r) {
  return { id:r.id, nombre:r.nombre, rfc:r.rfc||"", catalogo:r.catalogo||[], mapa:r.mapa||{},
    politicas:r.politicas||{}, centrosCostos:r.centros_costos||[], ubicaciones:r.ubicaciones||[],
    departamentos:r.departamentos||[], proyectos:r.proyectos||[],
    correoNotificacion:r.correo_notificacion||"", correoCC:r.correo_cc||"",
    fechaCorte:r.fecha_corte||"", logoUrl:r.logo_url||"", logo:r.logo_url||"",
    ctasPuente:r.ctas_puente||{ clara:"", ivaAcreditable:"", deudores:"", comisiones:"", noDeducibles:"" } };
}
function mapEmpresaToDB(e) {
  return { id:e.id, nombre:e.nombre, rfc:e.rfc||null, catalogo:e.catalogo||[], mapa:e.mapa||{},
    politicas:e.politicas||{}, centros_costos:e.centrosCostos||[], ubicaciones:e.ubicaciones||[],
    departamentos:e.departamentos||[], proyectos:e.proyectos||[],
    correo_notificacion:e.correoNotificacion||null, correo_cc:e.correoCC||null,
    fecha_corte:e.fechaCorte||null, ctas_puente:e.ctasPuente||null, logo_url:e.logo||null };
}
function mapUsuarioFromDB(r) {
  return { id:r.id, empresaId:r.empresa_id, empresa:r.empresa_nombre||"",
    nombre:r.nombre, correo:r.correo, rol:r.rol,
    departamento:r.departamento||"", departamentoId:r.departamento_id||"",
    ubicacion:r.ubicacion||"", ubicacionId:r.ubicacion_id||"",
    cc:r.cc||"", banco:r.banco||"", clabe:r.clabe||"",
    cuentaBanco:r.cuenta_banco||"", titularCuenta:r.titular_cuenta||"",
    rfc:r.rfc||"", activo:r.activo!==false,
    aprobadorId:r.aprobador_id||"", permisosExtra:r.permisos_extra||{} };
}
function mapUsuarioToDB(u) {
  const row = { empresa_id:u.empresaId, nombre:u.nombre, correo:u.correo?.toLowerCase(), rol:u.rol,
    departamento:u.departamento||null, departamento_id:u.departamentoId||null,
    ubicacion:u.ubicacion||null, ubicacion_id:u.ubicacionId||null,
    cc:u.cc||null, banco:u.banco||null, clabe:u.clabe||null,
    cuenta_banco:u.cuentaBanco||null, titular_cuenta:u.titularCuenta||null,
    rfc:u.rfc||null, activo:u.activo!==false,
    aprobador_id:u.aprobadorId||null, permisos_extra:u.permisosExtra||{} };
  // Solo incluir id si parece un UUID real (36 chars con guiones)
  if (u.id && u.id.length === 36 && u.id.includes("-")) row.id = u.id;
  return row;
}
function mapMovFromDB(m) {
  return { id:m.id, origen:m.origen, fecha:m.fecha, concepto:m.concepto,
    categoria:m.categoria||"", subtotal:Number(m.subtotal)||0,
    iva:Number(m.iva)||0, iva16:Number(m.iva16)||0, iva8:Number(m.iva8)||0,
    ivaRetenido:Number(m.iva_retenido)||0, isrRetenido:Number(m.isr_retenido)||0,
    ish:Number(m.ish)||0, propina:Number(m.propina)||0, total:Number(m.total)||0,
    factura:!!m.factura, uuid:m.uuid_cfdi||null, rfcEmisor:m.rfc_emisor||"",
    emisor:m.emisor||"", formaPago:m.forma_pago||"", reembolso:!!m.reembolso,
    aprobacionClara:m.aprobacion_clara||"", tipoDiferencia:m.tipo_diferencia||null, esRetiro:!!m.es_retiro, esRechazado:!!m.es_rechazado, esComision:!!m.es_comision,
    archivoUrl:m.archivo_url||null, archivoNombre:m.archivo_nombre||null };
}
function mapMovToDB(m) {
  // Validar UUID — solo pasar id si tiene formato uuid válido
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const idValido = m.id && uuidRe.test(m.id) ? m.id : undefined;
  const row = { origen:m.origen, fecha:m.fecha, concepto:m.concepto,
    categoria:m.categoria||null, subtotal:m.subtotal||null,
    iva:m.iva||0, iva16:m.iva16||0, iva8:m.iva8||0,
    iva_retenido:m.ivaRetenido||0, isr_retenido:m.isrRetenido||0,
    ish:m.ish||0, propina:m.propina||0, total:m.total||0,
    factura:!!m.factura, uuid_cfdi:m.uuid||null, rfc_emisor:m.rfcEmisor||null,
    emisor:m.emisor||null, forma_pago:m.formaPago||null, reembolso:!!m.reembolso,
    aprobacion_clara:m.aprobacionClara||null, tipo_diferencia:m.tipoDiferencia||null,
    es_retiro:!!m.esRetiro, es_rechazado:!!m.esRechazado, es_comision:!!m.esComision,
    archivo_url: m.archivoUrl||null, archivo_nombre: m.archivoNombre||null };
  if (idValido) row.id = idValido;
  return row;
}
function mapExpFromDB(r) {
  return { id:r.id, empresaId:r.empresa_id, folio:r.folio, tipo:r.tipo, estado:r.estado,
    proyecto:r.proyecto||"", proyectoId:r.proyecto_id||"",
    pedido:r.pedido||"", pedidoId:r.pedido_id||"",
    cliente:r.cliente||"", objetivo:r.objetivo||"",
    solicitante:r.solicitante||"", solicitanteId:r.solicitante_id||"",
    departamento:r.departamento||"", departamentoId:r.departamento_id||"",
    ubicacion:r.ubicacion||"", cc:r.cc||"", encargado:r.encargado||"",
    origen:r.origen||"", destino:r.destino||"",
    fechaInicio:r.fecha_inicio||"", fechaFin:r.fecha_fin||"",
    fechaSolicitud:r.fecha_solicitud||"",
    montoClara:Number(r.monto_clara)||0, fondoEfectivo:Number(r.fondo_efectivo)||0,
    presupuesto:r.presupuesto||{}, autorizador:r.autorizador||"",
    historial:r.historial||[], datosBancarios:r.datos_bancarios||{},
    movimientos:(r.movimientos||[]).map(mapMovFromDB),
    saldoEstado:r.saldo_estado||"pendiente", saldoMetodo:r.saldo_metodo||"",
    saldoFechaRecuperacion:r.saldo_fecha_recuperacion||"",
    notaTesoreria:r.nota_tesoreria||"",
    montoCruceContra:r.monto_cruce_contra != null ? Number(r.monto_cruce_contra) : 0,
    montoCruceReemb: r.monto_cruce_reemb  != null ? Number(r.monto_cruce_reemb)  : 0,
    fechaPago:r.fecha_pago||"", pagadoPor:r.pagado_por||"",
    enTesoreria:!!r.en_tesoreria, fechaEnvioTesoreria:r.fecha_envio_tesoreria||"",
    enviadoPorTesoreria:r.enviado_por_tesoreria||"",
    descuentoAplicado:!!r.descuento_aplicado, fechaDescuentoNomina:r.fecha_descuento_nomina||"",
    descuentoConfirmadoPor:r.descuento_confirmado_por||"",
    folioPóliza:r.folio_poliza||"", fechaContabilizacion:r.fecha_contabilizacion||"",
    contabilizadoPor:r.contabilizado_por||"",
    enRH:!!r.en_rh, fechaEnvioRH:r.fecha_envio_rh||"", enviadoRHPor:r.enviado_rh_por||"" };
}
function mapExpToDB(sol) {
  return { id:sol.id, empresa_id:sol.empresaId, folio:sol.folio,
    tipo:sol.tipo||"viaje", estado:sol.estado,
    proyecto:sol.proyecto||null, proyecto_id:sol.proyectoId||null,
    pedido:sol.pedido||null, pedido_id:sol.pedidoId||null,
    cliente:sol.cliente||null, objetivo:sol.objetivo||null,
    solicitante:sol.solicitante||null, solicitante_id:sol.solicitanteId||null,
    departamento:sol.departamento||null, departamento_id:sol.departamentoId||null,
    ubicacion:sol.ubicacion||null, cc:sol.cc||null, encargado:sol.encargado||null,
    origen:sol.origen||null, destino:sol.destino||null,
    fecha_inicio:sol.fechaInicio||null, fecha_fin:sol.fechaFin||null,
    fecha_solicitud:sol.fechaSolicitud||hoy(),
    monto_clara:sol.montoClara||0, fondo_efectivo:sol.fondoEfectivo||0,
    presupuesto:sol.presupuesto||{}, autorizador:sol.autorizador||null,
    historial:sol.historial||[], datos_bancarios:sol.datosBancarios||{},
    saldo_estado:sol.saldoEstado||null, saldo_metodo:sol.saldoMetodo||null,
    saldo_fecha_recuperacion:sol.saldoFechaRecuperacion||null,
    nota_tesoreria:sol.notaTesoreria||null,
    monto_cruce_contra: sol.montoCruceContra != null ? Number(sol.montoCruceContra) : null,
    monto_cruce_reemb:  sol.montoCruceReemb  != null ? Number(sol.montoCruceReemb)  : null,
    fecha_pago:sol.fechaPago||null, pagado_por:sol.pagadoPor||null,
    en_tesoreria:sol.enTesoreria||false, fecha_envio_tesoreria:sol.fechaEnvioTesoreria||null,
    enviado_por_tesoreria:sol.enviadoPorTesoreria||null,
    descuento_aplicado:sol.descuentoAplicado||false, fecha_descuento_nomina:sol.fechaDescuentoNomina||null,
    descuento_confirmado_por:sol.descuentoConfirmadoPor||null,
    folio_poliza:sol.folioPóliza||null, fecha_contabilizacion:sol.fechaContabilizacion||null,
    contabilizado_por:sol.contabilizadoPor||null,
    en_rh:sol.enRH||false, fecha_envio_rh:sol.fechaEnvioRH||null, enviado_rh_por:sol.enviadoRHPor||null,
    actualizado_en: new Date().toISOString() };
}
function mapTicketFromDB(t) {
  return { id:t.id, empresaId:t.empresa_id, folio:t.folio, asunto:t.asunto,
    descripcion:t.descripcion||"", categoria:t.categoria||"",
    prioridad:t.prioridad||"Media", estado:t.estado||"Abierto",
    autor:t.autor_nombre||"", autorId:t.autor_id||"", departamento:t.departamento||"",
    asignadoId:t.asignado_id||"", asignadoNombre:t.asignado_nombre||"",
    comentarios:t.comentarios||[], historial:t.historial||[],
    fecha:t.creado_en?.slice(0,10)||hoy(),
    folioSolicitud:t.folio_solicitud||"", solicitudId:t.solicitud_id||"" };
}
function mapTicketToDB(t) {
  return { id:t.id, empresa_id:t.empresaId, folio:t.folio, asunto:t.asunto,
    descripcion:t.descripcion||null, categoria:t.categoria||null,
    prioridad:t.prioridad||"Media", estado:t.estado||"Abierto",
    autor_nombre:t.autor||null, autor_id:t.autorId||null, departamento:t.departamento||null,
    asignado_id:t.asignadoId||null, asignado_nombre:t.asignadoNombre||null,
    comentarios:t.comentarios||[], historial:t.historial||[],
    folio_solicitud:t.folioSolicitud||null, solicitud_id:t.solicitudId||null };
}

// ── EMPRESAS ──────────────────────────────────────────────────
async function cargarEmpresas() {
  if (enProduccion()) {
    const sb = getSB();
    if (sb) { const { data } = await sb.from("empresas").select("*"); return (data||[]).map(mapEmpresaFromDB); }
  }
  try { const r = await safeStorage.get("gv-empresas",true); return r ? JSON.parse(r.value) : []; } catch { return []; }
}
async function guardarEmpresas(arr) {
  try { await safeStorage.set("gv-empresas", JSON.stringify(arr), true); } catch {}
  if (enProduccion()) {
    const sb = getSB();
    if (sb) { for (const e of arr) await sb.from("empresas").upsert(mapEmpresaToDB(e)); return; }
  }
  try { await safeStorage.set("gv-empresas", JSON.stringify(arr), true); } catch {}
}

// ── USUARIOS ──────────────────────────────────────────────────
async function cargarUsuarios(empresaId) {
  if (enProduccion()) {
    const sb = getSB();
    if (sb) {
      let q = sb.from("usuarios").select("*");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      if (data?.length) return data.map(mapUsuarioFromDB);
    }
  }
  try { const r = await safeStorage.get("gv-usuarios",true); return r ? JSON.parse(r.value) : []; } catch { return []; }
}
async function guardarUsuarios(arr) {
  try { await safeStorage.set("gv-usuarios", JSON.stringify(arr), true); } catch {}
  if (enProduccion()) {
    const sb = getSB();
    if (sb) {
      for (const u of arr) {
        const row = mapUsuarioToDB(u);
        const { error } = await sb.from("usuarios")
          .upsert(row, { onConflict: "correo" });
        if (error) console.error("[guardarUsuarios]", u.correo, u.rol, "→ ERROR:", error.message, error.code);
        else console.log("[guardarUsuarios]", u.correo, "→ rol:", u.rol, "OK");
      }
      return;
    }
  }
  try { await safeStorage.set("gv-usuarios", JSON.stringify(arr), true); } catch {}
}

// ── EXPEDIENTES ───────────────────────────────────────────────
const KEY = "gv-solicitudes";
async function cargarTodo() {
  if (enProduccion()) {
    const sb = getSB();
    if (sb) {
      try {
        const { data, error } = await sb.from("expedientes").select("*, movimientos(*)").order("creado_en",{ascending:false});
        if (error) { console.error("cargarTodo error:", error.message, error.code); return []; }
        console.log("[cargarTodo] Supabase →", (data||[]).length, "expedientes");
        // Siempre retornar de Supabase en producción — no mezclar con localStorage
        return (data || []).map(mapExpFromDB);
      } catch(e) { console.error("cargarTodo exception:", e); return []; }
    }
    return []; // Sin cliente Supabase en producción → vacío
  }
  try { const r = await safeStorage.get(KEY,true); return r ? JSON.parse(r.value) : []; } catch { return []; }
}
// Guardar un expediente individual en Supabase
async function guardarUno(sol) {
  const sb = getSB();
  if (!sb) { console.error("[guardarUno] Sin cliente Supabase"); return false; }
  try {
    const movs = (sol.movimientos||[]).map(mapMovToDB);
    const expRow = mapExpToDB(sol);
    console.log("[guardarUno]", sol.folio, "→ upsert | cruce_contra:", expRow.monto_cruce_contra, "| saldo:", expRow.saldo_estado, "| estado:", expRow.estado);
    const { data: saved, error } = await sb.from("expedientes").upsert(expRow, { onConflict: "folio" }).select().single();
    if (error) {
      console.error("[guardarUno] Error upsert:", error.message, error.code, error.details);
      // Intentar insert si el upsert falla por ID inválido
      if (error.code === "23505" || error.message?.includes("duplicate")) {
        const { data: s2, error: e2 } = await sb.from("expedientes")
          .update(expRow).eq("folio", sol.folio).select().single();
        if (e2) { console.error("[guardarUno] Fallback update error:", e2.message); return false; }
        console.log("[guardarUno] Fallback update OK →", sol.folio);
        return true;
      }
      return false;
    }
    if (saved) {
      console.log("[guardarUno] OK →", saved.folio, "cruce_contra:", saved.monto_cruce_contra);
      if (movs.length) {
        const { error: delErr } = await sb.from("movimientos").delete().eq("expediente_id", saved.id);
        if (delErr) console.warn("[guardarUno] delete movimientos:", delErr.message);
        const movsConExpId = movs.map(m => ({ ...m, expediente_id: saved.id }));
        const { error: insErr } = await sb.from("movimientos").insert(movsConExpId);
        if (insErr) console.error("[guardarUno] insert movimientos error:", insErr.message, insErr.details, insErr.hint);
        else console.log("[guardarUno] movimientos guardados:", movsConExpId.length);
      }
      return true;
    }
  } catch(e) { console.error("Exception guardando:", e); }
  return false;
}

async function guardarTodo(arr) {
  // Guardar en localStorage como respaldo inmediato
  try { await safeStorage.set(KEY, JSON.stringify(arr), true); } catch {}
  if (enProduccion()) {
    // Guardar cada expediente en Supabase
    for (const sol of arr) {
      await guardarUno(sol);
    }
    return;
  }
  try { await safeStorage.set(KEY, JSON.stringify(arr), true); } catch (e) { console.error(e); }
}

// ── TICKETS ───────────────────────────────────────────────────
async function cargarTickets(empresaId) {
  if (enProduccion()) {
    const sb = getSB();
    if (sb) {
      let q = sb.from("tickets").select("*").order("creado_en",{ascending:false});
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      if (data?.length) return data.map(mapTicketFromDB);
    }
  }
  try { const r = await safeStorage.get("gv-tickets",true); return r ? JSON.parse(r.value) : []; } catch { return []; }
}
async function guardarTickets(arr) {
  try { await safeStorage.set("gv-tickets", JSON.stringify(arr), true); } catch {}
  if (enProduccion()) {
    const sb = getSB();
    if (sb) { for (const t of arr) await sb.from("tickets").upsert(mapTicketToDB(t)); return; }
  }
  try { await safeStorage.set("gv-tickets", JSON.stringify(arr), true); } catch {}
}

// ── SESIÓN ────────────────────────────────────────────────────
async function cargarSesion() {
  try {
    const sb = getSB();
    if (sb) {
      const { data: { session } } = await sb.auth.getSession();
      if (session?.user) {
        // Buscar perfil del usuario en tabla usuarios por correo
        const email = session.user.email;
        const lista = await cargarUsuarios(null);
        const perfil = lista.find(u => u.correo?.toLowerCase() === email?.toLowerCase());
        if (perfil) return { ...perfil, _authId: session.user.id };
        // Si no tiene perfil aún — primer acceso OAuth, devolver datos básicos
        return { _authId: session.user.id, _emailAuth: email,
          nombre: session.user.user_metadata?.full_name || email.split("@")[0],
          correo: email, rol: null, _sinPerfil: true };
      }
    }
    // Fallback localStorage (desarrollo local sin Supabase)
    const r = await safeStorage.get("gv-sesion");
    return r ? JSON.parse(r.value) : null;
  } catch { return null; }
}
async function guardarSesion(u) {
  // Con Supabase Auth la sesión persiste sola; solo guardamos en local como respaldo
  try { await safeStorage.set("gv-sesion", JSON.stringify(u)); } catch {}
}
async function cerrarSesion() {
  try { await safeStorage.delete("gv-sesion"); } catch {}
  try { const sb = getSB(); if (sb) await sb.auth.signOut(); } catch {}
}


const ROLES_EXTRA = { "Tesorería": { label:"Tesorería", color:"#0C4A6E", bg:"#E0F2FE" } };
const ROLES = {
  Administrador: { label: "Administrador",       color: "#18181b", bg: "#e4e4e7" },
  Aprobador:     { label: "Gerente / Aprobador", color: "#27272a", bg: "#f4f4f5" },
  Contador:      { label: "Contador / Tesorería", color: "#3f3f46", bg: "#f4f4f5" },
  RH:            { label: "Recursos Humanos",    color: "#52525b", bg: "#f4f4f5" },
  Empleado:      { label: "Empleado",            color: "#71717a", bg: "#f4f4f5" },
};

// ── PERMISOS INDIVIDUALES ──────────────────────────────
const PERMISOS_DISPONIBLES = [
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
];

// Permisos base por rol (se pueden sobrescribir por usuario)
const PERMISOS_BASE = {
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
};

// Obtener permisos efectivos de un usuario (base + overrides individuales)
const getPermisos = (usuario) => {
  const base = PERMISOS_BASE[usuario?.rol] || PERMISOS_BASE.Empleado;
  return { ...base, ...(usuario?.permisosExtra || {}) };
};

const puedeAprobar  = (u) => getPermisos(u).aprobar;
const puedeVerTodos = (u) => getPermisos(u).verTodos;
const puedeVerGrupo = (u) => getPermisos(u).verGrupo; // Aprobador ve solo su grupo
const esAdmin       = (u) => u?.rol === "Administrador" || getPermisos(u).configurarEmpresa;
const esTesoreria   = (u) => u?.rol === "Tesorería" || getPermisos(u).actuarTesoreria;
const esContador    = (u) => u?.rol === "Contador" || u?.rol === "Tesorería" || getPermisos(u).contabilizar;
const esRH          = (u) => u?.rol === "RH" || getPermisos(u).gestionarRH;
const puedeVerSaldos = (u) => getPermisos(u).verSaldos;
const puedeActuarTesoreria = (u) => getPermisos(u).actuarTesoreria;
const puedeVerTesoreria = (u) => getPermisos(u).verTesoreria || puedeVerSaldos(u);

// ---------- estilos base premium ----------
const S = {
  font: { fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", letterSpacing: "-0.01em" },
  num: { fontVariantNumeric: "tabular-nums", fontFeatureSettings: "'tnum'" },
  input: { width: "100%", padding: "10px 14px", border: "1.5px solid #e4e4e7", borderRadius: 8, fontSize: 13.5, background: "#ffffff", boxSizing: "border-box", outline: "none", transition: "border-color .15s ease, box-shadow .15s ease", color: "#18181b", fontFamily: "'Inter', system-ui, sans-serif" },
  label: { fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "#a1a1aa", display: "block", marginBottom: 6 },
  btn: (primary) => ({
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
  th: { textAlign: "left", padding: "11px 14px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#a1a1aa", borderBottom: "1.5px solid #27272a", background: "#fafafa" },
  td: { padding: "12px 14px", fontSize: 13.5, borderBottom: "1px solid #f4f4f5", verticalAlign: "middle", color: "#27272a" },
};

function Campo({ label, children, span }) {
  return <div style={{ gridColumn: span ? ("span " + span) : undefined }}><label style={S.label}>{label}</label>{children}</div>;
}
function Chip({ estado }) {
  const e = ESTADOS[estado] || ESTADOS.ENVIADA;
  return <span style={{ fontSize: 11, fontWeight: 700, color: e.color, background: e.bg, padding: "3px 10px", borderRadius: 4, border: "1px solid #d4d4d8", letterSpacing:"0.03em" }}>{e.label}</span>;
}
function Folio({ texto }) {
  return <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 12, fontWeight: 700, color: "#18181b", border: "1.5px solid #18181b", borderRadius: 4, padding: "2px 8px", letterSpacing: "0.04em", background:"#f4f4f5" }}>{texto}</span>;
}

// ---------- cálculo de totales ----------
function calcular(sol) {
  const movs = sol.movimientos || [];
  const retiros    = movs.filter((m) => m.esRetiro); // retiros de efectivo Clara = fondo entregado, NO gasto
  // Rechazados (cualquier origen) = saldo en contra del empleado
  const rechazadosC = movs.filter((m) => m.esRechazado && !m.esRetiro && !m.esComision);
  const comisiones  = movs.filter((m) => m.esComision); // cargos de servicio Clara
  const rechazadosReemb = []; // vacío — todos los rechazados van a saldo en contra
  const activos    = movs.filter((m) => !m.esRechazado);
  const clara      = activos.filter((m) => m.origen === "clara" && !m.esRetiro);
  const reembClara = activos.filter((m) => m.origen === "clara-reembolso" && !m.esRetiro);
  const manuales   = activos.filter((m) => m.origen !== "clara" && m.origen !== "clara-reembolso" && !m.esRetiro);
  const suma = (arr, campo) => arr.reduce((a, m) => a + (Number(m[campo]) || 0), 0);

  // Subtotal e IVA correctos: usar iva16+iva8 si están disponibles, sino usar iva
  const ivaReal = (m) => {
    if (m.iva16 !== undefined || m.iva8 !== undefined) return (Number(m.iva16)||0) + (Number(m.iva8)||0);
    return Number(m.iva) || 0;
  };
  const subtotalReal = (m) => Number(m.subtotal) || (Number(m.total)||0) - ivaReal(m);

  const movsGasto   = movs.filter((m) => !m.esRetiro && !m.esRechazado); // rechazados no son gasto comprobado
  const ivaTotal    = movsGasto.reduce((a,m) => a + ivaReal(m), 0);
  const subtotalTot = movsGasto.reduce((a,m) => a + subtotalReal(m), 0);
  const ivaRetenido = suma(movs, "ivaRetenido");
  const isrRetenido = suma(movs, "isrRetenido");
  const ish         = suma(movs, "ish");
  const propinas    = suma(movs, "propina");

  const porCat = {};
  CATS.forEach((c) => {
    porCat[c] = {
      presupuesto: Number(sol.presupuesto?.[c]) || 0,
      comprobado: suma(movsGasto.filter((m) => m.categoria === c), "total")
    };
  });

  return {
    clara:    suma(clara, "total"),
    manual:   suma(manuales, "total"),
    reembolsoClara: suma(reembClara, "total"),
    reembolsoClaraAprobado: suma(
      reembClara.filter((m) => String(m.aprobacionClara||"").toLowerCase().includes("aprob") || !!m.aprobado), "total"
    ),
    subtotal:    subtotalTot,
    iva:         ivaTotal,
    ivaRetenido, isrRetenido, ish, propinas,
    total:       suma(movsGasto, "total"),
    retirosClara: suma(retiros, "total"),   // efectivo dispuesto de la tarjeta (fondo)
    comisionesClara: suma(comisiones, "total"),  // cargos de servicio Clara — NO saldo en contra empleado
    rechazadosClara: suma(rechazadosC, "total"), // gastos rechazados tarjeta Clara → saldo en contra
    rechazadosReemb: suma(rechazadosReemb, "total"), // reembolsos no autorizados → NO saldo en contra
    reembolso:   suma(manuales.filter((m) => m.reembolso), "total"),
    efectivo:    suma(manuales.filter((m) => m.formaPago === "Efectivo"), "total"),
    sinFactura:  suma(movsGasto.filter((m) => !m.factura), "total"),
    presupuestoTotal: CATS.reduce((a, c) => a + porCat[c].presupuesto, 0),
    porCat,
  };
}

// ================================================================
export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [seccion, setSeccion] = useState("expedientes");
  const [vista, setVista] = useState("lista");
  const [selId, setSelId] = useState(null);
  const [selTicketId, setSelTicketId] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [empresas, setEmpresas] = useState([]);
  const [empresaId, setEmpresaId] = useState(null);
  const [todosUsuarios, setTodosUsuarios] = useState([]);
  const [sidebarAbierto, setSidebarAbierto] = useState(false);
  const [sidebarHover, setSidebarHover] = useState(false);

  useEffect(() => {
    (async () => {
      // Esperar a que Supabase esté disponible (max 5 segundos)
      for (let i = 0; i < 10; i++) {
        if (getSB()) break;
        await new Promise(r => setTimeout(r, 500));
      }
      try {
        // Escuchar cambios de auth (callback OAuth, magic link, etc.)
        const sb = getSB();
        if (sb) {
          sb.auth.onAuthStateChange(async (event, session) => {
            if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
              const email = session.user.email;
              const lista = await cargarUsuarios(null);
              setTodosUsuarios(lista);
              const perfil = lista.find(u => u.correo?.toLowerCase() === email?.toLowerCase());
              if (perfil) {
                // Si el id del perfil no coincide con auth.uid(), sincronizarlo
                if (perfil.id !== session.user.id) {
                  try {
                    const sbInner = getSB();
                    if (sbInner) {
                      // Actualizar el registro existente al auth.uid() correcto
                      await sbInner.from("usuarios")
                        .update({ id: session.user.id })
                        .eq("correo", email.toLowerCase());
                      // También actualizar expedientes que tenían el id viejo
                      await sbInner.from("expedientes")
                        .update({ solicitante_id: session.user.id })
                        .eq("solicitante_id", perfil.id);
                      console.log("[Auth] id sincronizado:", perfil.id, "->", session.user.id);
                    }
                  } catch(e) { console.warn("[Auth] No se pudo sincronizar id:", e.message); }
                }
                const u = { ...perfil, id: session.user.id, _authId: session.user.id };
                setUsuario(u);
                await guardarSesion(u);
                if (!empresaId && lista.length) setEmpresaId(perfil.empresaId || lista[0]?.id || null);
              }
            }
          });
        }
        const sesionGuardada = await cargarSesion();
        if (sesionGuardada) {
          try {
            const usrsGuardados = await cargarUsuarios(null);
            const actualizado = usrsGuardados.find((u) => u.id === sesionGuardada.id);
            const usr = actualizado ? { ...sesionGuardada, ...actualizado } : sesionGuardada;
            setUsuario(usr);
            if (usr.empresaId) {
              setEmpresaId(usr.empresaId);
            } else {
              // Usuario sin empresa asignada — asignar la primera disponible
              try {
                const empsDisp = await cargarEmpresas();
                if (empsDisp.length) {
                  const primeraEmp = empsDisp[0];
                  await getSB()?.from("usuarios").update({ empresa_id: primeraEmp.id }).eq("id", usr.id);
                  setEmpresaId(primeraEmp.id);
                }
              } catch {}
            }
          } catch { setUsuario(sesionGuardada); }
        }
      } catch {}
      let emps = [];
      emps = await cargarEmpresas();
      if (!emps.length) {
        emps = [{ id: uid(), nombre: "Mi empresa", rfc: "", catalogo: [], mapa: {} }];
        await guardarEmpresas(emps);
      }
      setEmpresas(emps);
      let activa = emps[0].id;
      try { const r = await safeStorage.get("gv-empresa-activa"); if (r?.value && emps.some((e) => e.id === r.value)) activa = r.value; } catch {}
      setEmpresaId(activa);
      let sols = await cargarTodo();
      if (sols.some((s) => !s.empresaId)) {
        sols = sols.map((s) => (s.empresaId ? s : { ...s, empresaId: emps[0].id }));
        await guardarTodo(sols);
      }
      setSolicitudes(sols);
      setTodosUsuarios(await cargarUsuarios(activa));
      setTickets(await cargarTickets(activa));
      setCargando(false);
    })();
  }, []);

  const persistir = async (arr, solActualizada = null) => {
    setSolicitudes(arr);
    if (solActualizada && enProduccion()) {
      // Guardar solo el expediente modificado — más rápido
      await guardarUno(solActualizada);
    } else {
      await guardarTodo(arr);
    }
  };
  const persistirEmpresas= async (arr) => { setEmpresas(arr); await guardarEmpresas(arr); };
  const persistirUsuarios= async (arr) => { setTodosUsuarios(arr); await guardarUsuarios(arr); };
  const persistirTickets = async (arr) => { setTickets(arr); await guardarTickets(arr); };
  const cambiarEmpresa   = async (id)  => { setEmpresaId(id); setVista("lista"); try { await safeStorage.set("gv-empresa-activa", id); } catch {} /* id simple, ok en ambos modos */ };

  // Actualizar datos del usuario en sesión si los cambia desde su perfil
  const actualizarUsuarioSesion = async (actualizado) => {
    setUsuario(actualizado);
    await guardarSesion(actualizado);
  };

  const sel        = solicitudes.find((s) => s.id === selId);
  const selTicket  = tickets.find((t) => t.id === selTicketId);
  const empresa    = empresas.find((e) => e.id === empresaId);
  const solsEmpresa = solicitudes
    .filter((s) => s.empresaId === empresaId)
    .filter((s) => {
      if (puedeVerTodos(usuario)) return true; // Admin, Tesorería, Contador, RH ven todos
      if (puedeVerGrupo(usuario)) return s.aprobadorId === usuario?.id || s.solicitanteId === usuario?.id; // Aprobador ve su grupo
      return s.solicitanteId === usuario?.id; // Empleado solo ve los suyos
    })
    .filter((s) => {
      if (s.estado === "CANCELADA") return esAdmin(usuario); // Solo Admin ve cancelados
      return true;
    });
  const ticketsEmpresa = tickets
    .filter((t) => t.empresaId === empresaId)
    .filter((t) => puedeVerTodos(usuario) || t.autorId === usuario?.id);

  const irSeccion = (s) => { setSeccion(s); setVista("lista"); setSelId(null); setSelTicketId(null); };

  if (cargando) return <div style={{ ...S.font, padding: 60, textAlign: "center", color: "#54606B" }}>Cargando…</div>;
  if (!usuario) return <Login onEntrar={async (u) => {
    setUsuario(u);
    await guardarSesion(u);
  }} />;

  const pendAprobacion = solsEmpresa.filter((s) => s.estado === "ENVIADA").length;
  const ticketsSinAtn  = ticketsEmpresa.filter((t) => t.estado === "Abierto").length;

  // Secciones visibles según rol
  // Conteo de pendientes personales
  const misPendientesCount = (() => {
    let n = 0;
    if (puedeAprobar(usuario)) n += solsEmpresa.filter(s => s.estado === "ENVIADA").length;
    if (esContador(usuario) || esAdmin(usuario)) n += solsEmpresa.filter(s => s.estado === "CERRADA" && !s.folioPóliza && !s.motivoCancelacion).length;
    if (esTesoreria(usuario) || esAdmin(usuario)) n += solsEmpresa.filter(s => s.enTesoreria && !s.fechaPago && (s.saldoEstado||"pendiente")==="pendiente").length;
    n += solsEmpresa.filter(s => s.solicitanteId === usuario.id && s.estado === "COMPROBACION").length;
    return n;
  })();

  const NAV_MAIN = [
    { id: "pendientes",  icono: "✅", label: "Mis pendientes",   badge: misPendientesCount },
    { id: "expedientes", icono: "📋", label: "Expedientes",      badge: puedeAprobar(usuario) ? pendAprobacion : 0 },
    { id: "tickets",     icono: "🎫", label: "Tickets",          badge: ticketsSinAtn },
    { id: "proyectos",   icono: "🗂️",  label: "Proyectos",        badge: 0 },
    { id: "equipo",      icono: "👥", label: "Equipo",            badge: 0 },
    ...((puedeVerTesoreria(usuario) || esRH(usuario)) ? [{ id: "saldos", icono: "🏦", label: "Tesorería", badge: solicitudes.filter(s => !s.fechaPago && (s.saldoEstado||"pendiente")==="pendiente" && (calcular(s).rechazadosClara>0||calcular(s).reembolsoClaraAprobado>0)).length }] : []),
    ...((esAdmin(usuario) || esContador(usuario)) ? [{ id: "tarjetas", icono: "💳", label: "Tarjetas y cortes", badge: 0 }, { id: "contabilizar", icono: "📤", label: "Exportación contable", badge: 0 }] : []),
  ];
  const NAV_BOTTOM = [
    ...(esAdmin(usuario) || puedeAprobar(usuario) ? [{ id: "config", icono: "⚙️", label: "Configuración", badge: 0 }] : []),
    { id: "perfil", icono: "👤", label: "Mi perfil", badge: 0 },
  ];
  // (saldos/tesorería está en NAV_MAIN)
  const NAV = [...NAV_MAIN, ...NAV_BOTTOM];

  const sidebarExpandido = sidebarAbierto || sidebarHover;
  const W = sidebarExpandido ? 210 : 56;

  return (
    <div style={{ ...S.font, minHeight: "100vh", background: "#fafafa", color: "#18181b", display: "flex", flexDirection: "column" }}>
      {/* Global CSS premium */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300;0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800;0,14..32,900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { font-family: 'Inter', system-ui, sans-serif; }
        .btn-hover:hover { opacity: 0.8; transform: translateY(-1px); }
        .btn-outline-hover:hover { background: #f4f4f5 !important; }
        .card-hover:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.09) !important; transform: translateY(-1px); }
        .nav-item:hover { background: rgba(255,255,255,0.08) !important; }
        .nav-item-active { background: rgba(255,255,255,0.13) !important; }
        input:focus, select:focus, textarea:focus {
          border-color: #52525b !important;
          box-shadow: 0 0 0 3px rgba(82,82,91,0.10) !important;
          outline: none !important;
        }
        .chip-hover { transition: transform .15s ease; }
        .chip-hover:hover { transform: scale(1.03); }
        @keyframes slideIn { from { opacity:0; transform:translateY(8px);} to { opacity:1; transform:translateY(0); } }
        .animate-in { animation: slideIn .22s ease; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d4d4d8; border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: #a1a1aa; }
        table { border-collapse: collapse; width: 100%; }
        .row-hover:hover td { background: #fafafa !important; }
        .month-btn { transition: all .15s ease !important; }
        .month-btn:hover { background: #f4f4f5 !important; color: #18181b !important; }
        .action-btn { transition: all .18s ease; }
        .action-btn:hover { background: #27272a !important; }
        select { -webkit-appearance: none; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%23a1a1aa' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; padding-right: 28px !important; }
      `}</style>
      {/* Header */}
      <header style={{ background: "#09090b", color: "#ffffff", padding: "0 20px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0, zIndex: 10, height: 56, borderBottom: "1px solid #1c1c1f" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flexShrink: 0 }}>
          {(empresa?.logo || empresa?.logoUrl)
            ? <img src={empresa.logo || empresa.logoUrl} alt="logo" style={{ height: 28, maxWidth: 72, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
            : <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:"#27272a", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>✈️</div>
                <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.03em", color: "#fff", whiteSpace: "nowrap" }}>GBS Solutions</span>
              </div>
          }
          <span style={{ color: "#3f3f46", fontSize: 18, fontWeight: 300, flexShrink:0 }}>|</span>
          <span style={{ fontWeight: 500, fontSize: 13, color: "#71717a", whiteSpace: "nowrap", letterSpacing:"-0.01em" }}>Gastos de Viaje <span style={{fontSize:10,opacity:.5}}>v2.1</span></span>
        </div>
        {/* Empresa selector */}
        {empresas.length > 1 && (
          <select value={empresaId || ""} onChange={(e) => cambiarEmpresa(e.target.value)}
            style={{ background: "#18181b", color: "#d4d4d8", border: "1px solid #3f3f46", borderRadius: 8, padding: "5px 28px 5px 10px", fontSize: 12.5, fontWeight: 600, marginLeft: 4, fontFamily:"'Inter',system-ui,sans-serif" }}>
            {empresas.map((e) => <option key={e.id} value={e.id} style={{ color: "#18181b" }}>{e.nombre}</option>)}
          </select>
        )}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {/* Nombre y rol */}
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:32, height:32, borderRadius:"50%", background:"#27272a", border:"1.5px solid #3f3f46",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:"#ffffff", flexShrink:0 }}>
              {usuario.nombre?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div style={{ lineHeight:1.3 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color:"#f4f4f5", letterSpacing:"-0.01em" }}>{usuario.nombre}</div>
              <div style={{ fontSize:10.5, color:"#52525b", fontWeight:500 }}>{usuario.rol}</div>
            </div>
          </div>
          <button className="btn-hover" style={{ background: "#18181b", color: "#a1a1aa", border: "1px solid #27272a", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", transition:"all .15s ease", fontFamily:"'Inter',system-ui,sans-serif", fontWeight:500 }}
            onClick={async () => { setUsuario(null); await cerrarSesion(); }}>Salir →</button>
        </div>
      </header>

      {/* Layout: sidebar + contenido */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <nav onMouseEnter={() => setSidebarHover(true)} onMouseLeave={() => setSidebarHover(false)}
          style={{ width: W, background: "#18181b", color: "#fff", display: "flex", flexDirection: "column", flexShrink: 0, transition: "width .2s ease", overflow: "hidden", position: "relative", zIndex: 5, borderRight: "1px solid #27272a" }}>
          {NAV_MAIN.map((n) => (
            <button key={n.id} onClick={() => irSeccion(n.id)} title={!sidebarExpandido ? n.label : ""}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: sidebarExpandido ? "12px 20px" : "14px 0", justifyContent: sidebarExpandido ? "flex-start" : "center",
                border: "none", background: seccion === n.id ? "#27272a" : "transparent",
                color: seccion === n.id ? "#ffffff" : "#a1a1aa", fontSize: 14,
                fontWeight: seccion === n.id ? 700 : 400, cursor: "pointer",
                borderLeft: sidebarExpandido && seccion === n.id ? "3px solid #ffffff" : sidebarExpandido ? "3px solid transparent" : "none",
                textAlign: "left", position: "relative", whiteSpace: "nowrap" }}>
              <span style={{ fontSize: sidebarExpandido ? 16 : 18 }}>{n.icono}</span>
              {sidebarExpandido && <span>{n.label}</span>}
              {n.badge > 0 && sidebarExpandido && <span style={{ marginLeft: "auto", background: "#ffffff", color: "#18181b", borderRadius: 4, fontSize: 11, fontWeight: 800, padding: "1px 7px" }}>{n.badge}</span>}
              {n.badge > 0 && !sidebarExpandido && <span style={{ position: "absolute", top: 8, right: 6, background: "#ffffff", color: "#18181b", borderRadius: 4, fontSize: 9, fontWeight: 800, padding: "1px 4px" }}>{n.badge}</span>}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ borderTop: "1px solid rgba(255,255,255,.1)", margin: "2px 0" }} />
          {NAV_BOTTOM.map((n) => (
            <button key={n.id} onClick={() => irSeccion(n.id)} title={!sidebarExpandido ? n.label : ""}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: sidebarExpandido ? "10px 20px" : "12px 0", justifyContent: sidebarExpandido ? "flex-start" : "center",
                border: "none", background: seccion === n.id ? "#27272a" : "transparent",
                color: seccion === n.id ? "#ffffff" : "#a1a1aa", fontSize: 13,
                fontWeight: seccion === n.id ? 700 : 400, cursor: "pointer",
                borderLeft: sidebarExpandido && seccion === n.id ? "3px solid #ffffff" : sidebarExpandido ? "3px solid transparent" : "none",
                textAlign: "left", position: "relative", whiteSpace: "nowrap" }}>
              <span style={{ fontSize: sidebarExpandido ? 15 : 17 }}>{n.icono}</span>
              {sidebarExpandido && <span>{n.label}</span>}
            </button>
          ))}
          {sidebarExpandido && (
            <div style={{ padding: "10px 16px", fontSize: 11, color: "rgba(255,255,255,.3)", lineHeight: 1.6 }}>
              {empresa?.nombre && <div>{empresa.nombre}</div>}
              {usuario.departamento && <div>{usuario.departamento}</div>}
              {usuario.cc && <div style={{ fontFamily: "ui-monospace,monospace" }}>CC: {usuario.cc}</div>}
            </div>
          )}
          <button onClick={() => setSidebarAbierto(!sidebarAbierto)} title={sidebarAbierto ? "Fijar colapsado" : "Fijar expandido"}
            style={{ margin: "4px 8px 8px", padding: "5px", border: "none", background: "rgba(255,255,255,.07)", borderRadius: 6,
              color: "rgba(255,255,255,.4)", cursor: "pointer", fontSize: 12, textAlign: "center" }}>
            {sidebarAbierto ? "◀ Colapsar" : "📌"}
          </button>
        </nav>

        {/* Área principal */}
        <main style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {/* Expedientes */}
          {seccion === "expedientes" && vista === "lista" &&
            <Lista solicitudes={solsEmpresa} usuario={usuario}
              onNueva={() => setVista("nueva")} onNuevoReembolso={() => setVista("nueva-reembolso")}
              onNuevaCajaChica={() => setVista("nueva-caja-chica")}
              onAbrir={(id) => { setSelId(id); setVista("detalle"); }} />}
          {seccion === "expedientes" && vista === "nueva-caja-chica" &&
            <FormCajaChica usuario={usuario} empresa={empresa} onCancelar={() => setVista("lista")}
              onGuardar={async (sol) => { await persistir([{ ...sol, empresaId, solicitanteId: usuario.id }, ...solicitudes]); setVista("lista"); }} />}
          {seccion === "expedientes" && vista === "nueva-reembolso" &&
            <FormReembolso usuario={usuario} empresa={empresa} onCancelar={() => setVista("lista")}
              onGuardar={async (sol) => { await persistir([{ ...sol, empresaId, solicitanteId: usuario.id }, ...solicitudes]); setVista("lista"); }} />}
          {seccion === "expedientes" && vista === "nueva" &&
            <FormSolicitud usuario={usuario} empresa={empresa} todosUsuarios={todosUsuarios} onCancelar={() => setVista("lista")}
              onGuardar={async (sol) => {
                const viajeroId = sol.viajeroId || usuario.id;
                const viajero = todosUsuarios.find(u => u.id === viajeroId) || usuario;
                await persistir([{ ...sol, empresaId,
                  solicitanteId: viajeroId,
                  solicitante: viajero.nombre,
                  creadoPor: usuario.id,
                  creadoPorNombre: usuario.nombre,
                  aprobadorId: sol.aprobadorId || viajero.aprobadorId || "",
                }, ...solicitudes]);
                setVista("lista");
              }} />}
          {seccion === "expedientes" && vista === "detalle" && sel &&
            <Detalle sol={sel} usuario={usuario} empresa={empresa} onVolver={() => setVista("lista")}
              onActualizar={async (nueva) => { await persistir(solicitudes.map((s) => (s.id === nueva.id ? nueva : s)), nueva); }}
              onEliminar={async () => { await persistir(solicitudes.filter((s) => s.id !== sel.id)); setVista("lista"); }}
              onNuevoTicket={async (ticket) => {
                await persistirTickets([{ ...ticket, empresaId }, ...tickets]);
                irSeccion("tickets");
              }} />}

          {/* Tickets */}
          {seccion === "proyectos" &&
            <CatalogoProyectos empresa={empresa} onGuardar={persistirEmpresas} usuario={usuario} solicitudes={solicitudes.filter(s=>s.empresaId===empresaId)} />}

          {seccion === "tickets" && vista === "lista" &&
            <ListaTickets tickets={ticketsEmpresa} usuario={usuario}
              onNuevo={() => setVista("nueva")} onAbrir={(id) => { setSelTicketId(id); setVista("detalle"); }} />}
          {seccion === "tickets" && vista === "nueva" &&
            <FormTicket usuario={usuario} empresa={empresa} todosUsuarios={todosUsuarios}
              onCancelar={() => setVista("lista")}
              onGuardar={async (t) => { await persistirTickets([{ ...t, empresaId }, ...tickets]); setVista("lista"); }} />}
          {seccion === "tickets" && vista === "detalle" && selTicket &&
            <DetalleTicket ticket={selTicket} usuario={usuario} todosUsuarios={todosUsuarios}
              onVolver={() => setVista("lista")}
              onActualizar={async (t) => { await persistirTickets(tickets.map((x) => (x.id === t.id ? t : x))); }} />}

          {/* Configuración: Admin ve todo; Gerente ve solo usuarios y puede editar su equipo */}
          {seccion === "config" && (esAdmin(usuario) || puedeAprobar(usuario)) && empresa &&
            <ConfigEmpresa empresa={empresa} empresas={empresas} usuarioActual={usuario}
              onGuardar={persistirEmpresas} onCrear={async (nueva) => { await persistirEmpresas([...empresas, nueva]); cambiarEmpresa(nueva.id); }}
              todosUsuarios={todosUsuarios} onGuardarUsuarios={persistirUsuarios} />}

          {/* Mi perfil */}
          {seccion === "saldos" && (puedeVerSaldos(usuario) || esRH(usuario)) &&
            <SaldosEnContra solicitudes={solsEmpresa} empresa={empresa} usuario={usuario}
              onActualizar={async (sol) => {
                const arr = solicitudes.map(s => s.id === sol.id ? sol : s);
                setSolicitudes(arr);
                await guardarUno(sol);
              }}
              onActualizarBatch={async (sols) => {
                // Actualizar múltiples expedientes de una vez (compensación entre dos)
                const arr = solicitudes.map(s => { const n = sols.find(x => x.id === s.id); return n || s; });
                setSolicitudes(arr);
                for (const s of sols) { await guardarUno(s); }
              }}
              onIrExpediente={(id) => { setSelId(id); setSeccion("expedientes"); setVista("detalle"); }} />}
          {seccion === "perfil" &&
            <MiPerfil usuario={usuario} empresa={empresa} empresas={empresas}
              todosUsuarios={todosUsuarios}
              onGuardar={async (actualizado) => {
                await persistirUsuarios(todosUsuarios.map((u) => u.id === actualizado.id ? actualizado : u));
                await actualizarUsuarioSesion(actualizado);
              }} />}
          {seccion === "pendientes" &&
            <MisPendientes solicitudes={solsEmpresa} usuario={usuario} empresa={empresa}
              onIrExpediente={(id) => { setSelId(id); setSeccion("expedientes"); setVista("detalle"); }}
              todosUsuarios={todosUsuarios}
              onActualizar={async (sol) => await persistir(solicitudes.map(s => s.id === sol.id ? sol : s), sol)} />}
          {seccion === "equipo" && (
            <ModuloEquipo usuario={usuario} empresa={empresa} empresas={empresas}
              todosUsuarios={todosUsuarios}
              onGuardarUsuarios={async (lista) => await persistirUsuarios(lista)} />
          )}
          {seccion === "tarjetas" && (esAdmin(usuario) || esContador(usuario)) && empresa && <TarjetasSesiones empresaId={empresa.id} />}
          {seccion === "contabilizar" && (esAdmin(usuario) || esContador(usuario)) && empresa &&
            <ExportacionContable solicitudes={solsEmpresa} empresa={empresa} usuario={usuario}
              onActualizar={async (sols) => {
                const arr = solicitudes.map(s => { const n = sols.find(x => x.id === s.id); return n || s; });
                setSolicitudes(arr);
                for (const s of sols) { await guardarUno(s); }
              }} />}
        </main>
      </div>
    </div>
  );
}

// ---------- gestión de usuarios (solo Admin) ----------
function GestionUsuarios({ empresa, empresas, todosUsuarios, usuarioActual, onGuardar }) {
  const esAdminActual = esAdmin(usuarioActual);
  // Gerente: solo puede gestionar empleados de sus mismos departamentos
  const deptosGerente = !esAdminActual
    ? (empresa.departamentos || []).filter((d) => d.encargado && usuarioActual?.nombre && d.encargado.toLowerCase().includes(usuarioActual.nombre.split(" ")[0].toLowerCase()))
    : empresa.departamentos || [];
  const idsDeptosGerente = new Set(deptosGerente.map((d) => d.id));

  const usuariosEmpresa = todosUsuarios.filter((u) => {
    if (u.empresaId !== empresa.id && !(u.empresaId === undefined)) return false;
    if (!esAdminActual) return idsDeptosGerente.has(u.departamentoId) || (!u.departamentoId && false);
    return true;
  });

  // Roles que el Gerente puede asignar (todo menos Admin)
  const rolesDisponibles = esAdminActual ? Object.keys(ROLES) : Object.keys(ROLES).filter((r) => r !== "Administrador");

  const [nuevoU, setNuevoU] = useState({ nombre: "", correo: "", rol: "Empleado", departamentoId: "", ubicacionId: "", aprobadorId: "" });
  const [editPermisos, setEditPermisos] = useState(null); // id del usuario editando permisos
  const [editId, setEditId] = useState(null);
  const deptos = empresa.departamentos || [];
  const ubics = empresa.ubicaciones || [];
  const ccs = empresa.centrosCostos || [];

  const ccDeDepto = (depId) => deptos.find((d) => d.id === depId)?.cc || "";
  const nombreDepto = (depId) => deptos.find((d) => d.id === depId)?.nombre || "";
  const nombreUbic = (ubId) => ubics.find((u) => u.id === ubId)?.nombre || "";
  const ok = nuevoU.nombre.trim() && /.+@.+\..+/.test(nuevoU.correo);

  const [usuarioCreado, setUsuarioCreado] = useState(null);

  const agregar = () => {
    const u = {
      id: uid(), nombre: nuevoU.nombre.trim(), correo: nuevoU.correo.trim().toLowerCase(),
      rol: nuevoU.rol, empresaId: empresa.id, empresa: empresa.nombre,
      departamentoId: nuevoU.departamentoId, departamento: nombreDepto(nuevoU.departamentoId),
      ubicacionId: nuevoU.ubicacionId, ubicacion: nombreUbic(nuevoU.ubicacionId),
      cc: ccDeDepto(nuevoU.departamentoId), activo: true,
      aprobadorId: nuevoU.aprobadorId || deptos.find(d=>d.id===nuevoU.departamentoId)?.aprobadorId || "",
      permisosExtra: {},
    };
    onGuardar([...todosUsuarios.filter((x) => x.correo !== u.correo), u]);
    setNuevoU({ nombre: "", correo: "", rol: "Empleado", departamentoId: "", ubicacionId: "", aprobadorId: "" });
    setUsuarioCreado(u); // mostrar instrucciones de acceso
  };

  const actualizar = (id, cambios) => {
    onGuardar(todosUsuarios.map((u) => {
      if (u.id !== id) return u;
      const actualizado = { ...u, ...cambios };
      return { ...actualizado, departamento: nombreDepto(actualizado.departamentoId), ubicacion: nombreUbic(actualizado.ubicacionId), cc: ccDeDepto(actualizado.departamentoId), empresa: empresa.nombre };
    }));
  };

  return (
    <div style={S.card}>
      <h3 style={{ marginTop: 0, fontSize: 15 }}>Usuarios de {empresa.nombre} ({usuariosEmpresa.length})</h3>

      {/* Banner después de crear usuario */}
      {usuarioCreado && (
        <div style={{ background:"#F0FDF4", border:"1.5px solid #86EFAC", borderRadius:10,
          padding:"14px 18px", marginBottom:16, position:"relative" }}>
          <button onClick={() => setUsuarioCreado(null)}
            style={{ position:"absolute", top:10, right:12, border:"none", background:"none",
              fontSize:16, color:"#6B7280", cursor:"pointer" }}>×</button>
          <div style={{ fontWeight:700, color:"#15803D", fontSize:14, marginBottom:6 }}>
            Usuario creado: {usuarioCreado.nombre}
          </div>
          <div style={{ fontSize:13, color:"#166534", lineHeight:1.7 }}>
            Indica a <strong>{usuarioCreado.nombre}</strong> que entre a:<br/>
            <code style={{ background:"#DCFCE7", padding:"2px 8px", borderRadius:4, fontSize:12 }}>
              {typeof window !== "undefined" ? window.location.origin : "la app"}
            </code><br/>
            e ingrese su correo <strong>{usuarioCreado.correo}</strong> para recibir su enlace de acceso.
          </div>
          <div style={{ fontSize:11, color:"#6B7280", marginTop:8 }}>
            No se requiere contraseña — el sistema enviará un magic link a su correo.
          </div>
        </div>
      )}
      <div style={{ fontSize: 12, color: "#54606B", marginBottom: 14 }}>
        Solo el Administrador puede dar de alta, editar o desactivar usuarios. El empleado no puede modificar sus propios datos.
      </div>

      {/* Alta de usuario */}
      <div style={{ background: "#F3F4FA", borderRadius: 8, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#54606B", marginBottom: 10 }}>Dar de alta usuario</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Campo label="Nombre completo"><input style={S.input} value={nuevoU.nombre} onChange={(e) => setNuevoU({ ...nuevoU, nombre: e.target.value })} placeholder="Nombre completo" /></Campo>
          <Campo label="Correo"><input type="email" style={S.input} value={nuevoU.correo} onChange={(e) => setNuevoU({ ...nuevoU, correo: e.target.value })} placeholder="correo@empresa.com" /></Campo>
          <Campo label="Rol">
            <select style={S.input} value={nuevoU.rol} onChange={(e) => setNuevoU({ ...nuevoU, rol: e.target.value })}>
              {rolesDisponibles.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
            </select>
          </Campo>
          <Campo label="Departamento">
            <select style={S.input} value={nuevoU.departamentoId} onChange={(e) => setNuevoU({ ...nuevoU, departamentoId: e.target.value })}>
              <option value="">— sin departamento —</option>
              {(esAdminActual ? deptos : deptosGerente).map((d) => <option key={d.id} value={d.id}>{d.nombre}{d.cc ? " (CC: " + d.cc + ")" : ""}</option>)}
            </select>
          </Campo>
          <Campo label="Ubicación / Oficina">
            <select style={S.input} value={nuevoU.ubicacionId} onChange={(e) => setNuevoU({ ...nuevoU, ubicacionId: e.target.value })}>
              <option value="">— sin ubicación —</option>
              {ubics.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Aprobador directo">
            <select style={S.input} value={nuevoU.aprobadorId}
              onChange={(e) => setNuevoU({ ...nuevoU, aprobadorId: e.target.value })}>
              <option value="">— hereda del departamento —</option>
              {todosUsuarios.filter(u => puedeAprobar(u) && u.empresaId === empresa.id)
                .map(u => <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>)}
            </select>
          </Campo>
          <div style={{ alignSelf: "end" }}>
            <button style={S.btn(true)} disabled={!ok} onClick={agregar}>Dar de alta</button>
          </div>
        </div>
        {nuevoU.departamentoId && ccDeDepto(nuevoU.departamentoId) && (
          <div style={{ fontSize: 12, color: "#3644AC", marginTop: 8 }}>
            CC asignado automáticamente: <b style={{ fontFamily: "ui-monospace,monospace" }}>{ccDeDepto(nuevoU.departamentoId)}</b>
          </div>
        )}
      </div>

      {/* Lista de usuarios */}
      {usuariosEmpresa.length === 0
        ? <div style={{ color: "#8A949C", fontSize: 13, textAlign: "center", padding: 20 }}>Aún no hay usuarios. Da de alta al primero.</div>
        : <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                {["Nombre","Correo","Rol","Departamento","Ubicación","CC","Aprobador","Estado","Permisos",""].map((h) => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {usuariosEmpresa.map((u) => (
                  <tr key={u.id} style={{ opacity: u.activo === false ? 0.45 : 1 }}>
                    {editId === u.id ? (
                      <>
                        <td style={S.td}><input style={{ ...S.input, padding: "4px 6px" }} value={u.nombre} onChange={(e) => actualizar(u.id, { nombre: e.target.value })} /></td>
                        <td style={S.td}><input style={{ ...S.input, padding: "4px 6px" }} value={u.correo} onChange={(e) => actualizar(u.id, { correo: e.target.value })} /></td>
                        <td style={S.td}><select style={{ ...S.input, padding: "4px 6px" }} value={u.rol} onChange={(e) => actualizar(u.id, { rol: e.target.value })}>{rolesDisponibles.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}</select></td>
                        <td style={S.td}><select style={{ ...S.input, padding: "4px 6px" }} value={u.departamentoId || ""} onChange={(e) => actualizar(u.id, { departamentoId: e.target.value })}><option value="">—</option>{deptos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}</select></td>
                        <td style={S.td}><select style={{ ...S.input, padding: "4px 6px" }} value={u.ubicacionId || ""} onChange={(e) => actualizar(u.id, { ubicacionId: e.target.value })}><option value="">—</option>{ubics.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></td>
                        <td style={S.td}><select style={{ ...S.input, padding: "4px 6px" }} value={u.aprobadorId || ""} onChange={(e) => actualizar(u.id, { aprobadorId: e.target.value })}><option value="">— depto —</option>{todosUsuarios.filter(a => puedeAprobar(a) && a.id !== u.id).map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></td>
                        <td style={{ ...S.td, fontFamily: "ui-monospace,monospace" }}>{ccDeDepto(u.departamentoId) || "—"}</td>
                        <td style={S.td}>{u.activo !== false ? "Activo" : "Inactivo"}</td>
                        <td style={S.td}><button style={{ ...S.btn(true), padding: "4px 10px", fontSize: 12 }} onClick={() => setEditId(null)}>Listo</button></td>
                      </>
                    ) : (
                      <>
                        <td style={{ ...S.td, fontWeight: 600 }}>{u.nombre}</td>
                        <td style={{ ...S.td, fontSize: 12, color: "#54606B" }}>{u.correo}</td>
                        <td style={S.td}><RolChip rol={u.rol} /></td>
                        <td style={S.td}>{u.departamento || "—"}</td>
                        <td style={S.td}>{u.ubicacion || "—"}</td>
                        <td style={{ ...S.td, fontFamily: "ui-monospace,monospace", fontSize: 12 }}>{u.cc || "—"}</td>
                        <td style={S.td}>{(() => { const a = todosUsuarios.find(x => x.id === u.aprobadorId); return a ? a.nombre : <span style={{color:"#9CA3AF",fontSize:11}}>del depto</span>; })()}</td>
                        <td style={S.td}><span style={{ fontSize: 12, fontWeight: 700, color: u.activo !== false ? "#0E7C66" : "#B4443C" }}>{u.activo !== false ? "Activo" : "Inactivo"}</span></td>
                        <td style={S.td}>
                          <button style={{ border:"1px solid #C6D0E8", background: Object.keys(u.permisosExtra||{}).length>0?"#EEF2FF":"#F9FAFB",
                            color:"#3644AC", cursor:"pointer", fontSize:11, padding:"3px 8px", borderRadius:5, fontWeight: Object.keys(u.permisosExtra||{}).length>0?700:400 }}
                            onClick={()=>setEditPermisos(editPermisos===u.id?null:u.id)}>
                            {Object.keys(u.permisosExtra||{}).length>0 ? (Object.keys(u.permisosExtra).length + " permisos custom") : "Permisos base"}
                          </button>
                        </td>
                        <td style={S.td}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button style={{ ...S.btn(false), padding: "3px 10px", fontSize: 12 }} onClick={() => setEditId(u.id)}>Editar</button>
                            <button style={{ border: "none", background: "none", fontSize: 12, cursor: "pointer", color: u.activo !== false ? "#B4443C" : "#0E7C66" }}
                              onClick={() => actualizar(u.id, { activo: u.activo === false })}>{u.activo !== false ? "Desactivar" : "Activar"}</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      }

          {/* Panel de permisos expandible */}
          {editPermisos && (() => {
            const u = todosUsuarios.find(x => x.id === editPermisos);
            if (!u) return null;
            const base = PERMISOS_BASE[u.rol] || PERMISOS_BASE.Empleado;
            const extra = u.permisosExtra || {};
            const grupos = [...new Set(PERMISOS_DISPONIBLES.map(p => p.grupo))];
            return (
              <div style={{ marginTop:16, background:"#F8FAFF", border:"1.5px solid #C6D0E8", borderRadius:10, padding:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <div>
                    <span style={{ fontWeight:800, fontSize:14, color:"#232D6B" }}>⚙ Permisos — {u.nombre}</span>
                    <span style={{ fontSize:11, color:"#54606B", marginLeft:8 }}>Rol base: {u.rol} · Los cambios sobrescriben los del rol</span>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button style={{ ...S.btn(false), fontSize:11, padding:"4px 10px", color:"#B4443C" }}
                      onClick={() => actualizar(u.id, { permisosExtra: {} })}>Restaurar rol base</button>
                    <button style={{ border:"none", background:"none", cursor:"pointer", fontSize:16 }}
                      onClick={() => setEditPermisos(null)}>✕</button>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:10 }}>
                  {grupos.map(grupo => (
                    <div key={grupo} style={{ background:"#fff", borderRadius:8, padding:"10px 14px", border:"1px solid #E3E6E9" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"#54606B", textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>{grupo}</div>
                      {PERMISOS_DISPONIBLES.filter(p => p.grupo === grupo).map(p => {
                        const valorBase = base[p.key];
                        const valorExtra = extra[p.key];
                        const valorActual = valorExtra !== undefined ? valorExtra : valorBase;
                        const esSobrescrito = valorExtra !== undefined;
                        return (
                          <label key={p.key} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, cursor:"pointer" }}>
                            <input type="checkbox" checked={!!valorActual}
                              onChange={e => {
                                const nuevo = e.target.checked;
                                const nuevosExtra = { ...extra };
                                if (nuevo === valorBase) delete nuevosExtra[p.key];
                                else nuevosExtra[p.key] = nuevo;
                                actualizar(u.id, { permisosExtra: nuevosExtra });
                              }} />
                            <span style={{ fontSize:13, color:esSobrescrito?"#232D6B":"#6B7280", fontWeight:esSobrescrito?700:400 }}>{p.label}</span>
                            {esSobrescrito && (
                              <span style={{ fontSize:10, marginLeft:"auto", padding:"1px 6px", borderRadius:999,
                                background:valorActual?"#DCFCE7":"#FEE2E2", color:valorActual?"#15803D":"#B91C1C" }}>
                                {valorActual?"✓ extra":"✗ bloqueado"}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
    </div>
  );
}

// ---------- cuenta contable de un movimiento ----------
// Prioridad: mapeo del departamento de la solicitud → mapeo general de la empresa.
// Sin CFDI se usa la cuenta de "No deducibles" si existe en cualquiera de los dos niveles.
function cuentaDe(mov, empresa, sol) {
  if (!empresa) return "";
  const depto = (empresa.departamentos || []).find((d) => d.id === sol?.departamentoId);
  const resolver = (clave) => depto?.mapa?.[clave] || empresa.mapa?.[clave] || "";
  if (!mov.factura) return resolver("No deducibles") || resolver(mov.categoria);
  return resolver(mov.categoria);
}

// ---------- configuración de empresa y catálogo ----------
function ConfigEmpresa({ empresa, empresas, usuarioActual, onGuardar, onCrear, todosUsuarios, onGuardarUsuarios }) {
  // Gerente: solo ve la sección de usuarios (de sus departamentos)
  // Admin: ve todo
  const soloUsuarios = !esAdmin(usuarioActual);
  const refCat = useRef(null);
  const [nuevaEmp, setNuevaEmp] = useState("");
  const [nuevaUbic, setNuevaUbic] = useState("");
  const [nuevoDep, setNuevoDep] = useState({ nombre: "", encargado: "" });
  const [nuevoCC, setNuevoCC] = useState({ clave: "", nombre: "" });
  const [depAbierto, setDepAbierto] = useState(null);
  const [cta, setCta] = useState({ cuenta: "", nombre: "" });
  const [aviso, setAviso] = useState(null);
  const actualizar = (cambios) => onGuardar(empresas.map((e) => (e.id === empresa.id ? { ...e, ...cambios } : e)));
  const destinos = [...CATS, "No deducibles"];

  const importarCatalogo = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      let filas = [];
      if (file.name.toLowerCase().endsWith(".csv")) {
        // Intentar UTF-8 primero, luego ISO-8859-1 si falla
      let texto;
      try {
        texto = new TextDecoder("utf-8").decode(reader.result);
        if (texto.includes("�")) texto = new TextDecoder("iso-8859-1").decode(reader.result);
      } catch { texto = new TextDecoder("iso-8859-1").decode(reader.result); }
        filas = Papa.parse(texto, { header: true, skipEmptyLines: true }).data;
      } else { setAviso("Por seguridad, importa el catálogo en formato CSV."); return; }
      const norm = (r, claves) => { for (const k of Object.keys(r)) if (claves.some((c) => k.toLowerCase().includes(c))) return String(r[k]).trim(); return ""; };
      const catalogo = filas.map((r) => ({ cuenta: norm(r, ["cuenta", "código", "codigo", "no."]), nombre: norm(r, ["nombre", "descrip", "concepto"]) }))
        .filter((c) => c.cuenta);
      if (!catalogo.length) { setAviso("No se encontraron cuentas. El archivo necesita una columna 'Cuenta' (o 'Código') y una 'Nombre' (o 'Descripción')."); return; }
      actualizar({ catalogo });
      setAviso(`Catálogo cargado: ${catalogo.length} cuentas.`);
    };
    reader.readAsArrayBuffer(file);
  };

  const refLogo = useRef(null);
  const subirLogo = (file) => {
    const reader = new FileReader();
    reader.onload = () => actualizar({ logo: reader.result });
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {!soloUsuarios && <div style={S.card}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Empresa: {empresa.nombre}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14 }}>
          <Campo label="Nombre de la empresa"><input style={S.input} value={empresa.nombre} onChange={(e) => actualizar({ nombre: e.target.value })} /></Campo>
          <Campo label="RFC (opcional)"><input style={S.input} value={empresa.rfc || ""} onChange={(e) => actualizar({ rfc: e.target.value })} /></Campo>
          <Campo label="Cierre de período — bloquear antes de:">
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <input type="date" style={{ ...S.input, fontFamily:"ui-monospace,monospace" }}
                value={empresa.fechaCorte || ""} onChange={(e) => actualizar({ fechaCorte: e.target.value })} />
              {empresa.fechaCorte && (
                <button style={{ border:"none", background:"none", color:"#B4443C", cursor:"pointer", fontSize:12, whiteSpace:"nowrap" }}
                  onClick={() => actualizar({ fechaCorte: "" })}>✕ Quitar</button>
              )}
            </div>
            <div style={{ fontSize:10, color:"#54606B", marginTop:3 }}>
              {empresa.fechaCorte
                ? `Empleados no pueden agregar gastos anteriores al ${empresa.fechaCorte}`
                : "Sin cierre activo — empleados pueden capturar cualquier fecha"}
            </div>
          </Campo>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "end", marginTop: 14 }}>
          <div>
            <div style={S.label}>Logo de la empresa</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {empresa.logo && <img src={empresa.logo} alt="logo" style={{ height: 48, objectFit: "contain", border: "1px solid #E3E6E9", borderRadius: 6, padding: 4 }} />}
              <button style={S.btn(false)} onClick={() => refLogo.current.click()}>
                {empresa.logo ? "Cambiar logo" : "Subir logo"}
              </button>
              {empresa.logo && <button style={{ border: "none", background: "none", color: "#B4443C", cursor: "pointer", fontSize: 12 }} onClick={() => actualizar({ logo: null })}>Quitar</button>}
              <input ref={refLogo} type="file" accept="image/*" hidden onChange={(e) => { e.target.files[0] && subirLogo(e.target.files[0]); e.target.value = ""; }} />
              <span style={{ fontSize: 11, color: "#8A949C" }}>PNG/SVG/JPG. Se mostrará en los reportes PDF.</span>
            </div>
          </div>
        </div>
        {esAdmin(usuarioActual) && (
          <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "end" }}>
            <Campo label="Agregar otra empresa"><input style={{ ...S.input, width: 260 }} value={nuevaEmp} onChange={(e) => setNuevaEmp(e.target.value)} placeholder="Nombre de la nueva empresa" /></Campo>
            <button style={S.btn(false)} disabled={!nuevaEmp.trim()}
              onClick={() => { onCrear({ id: uid(), nombre: nuevaEmp.trim(), rfc: "", catalogo: [], mapa: {} }); setNuevaEmp(""); }}>Crear y cambiar</button>
          </div>
        )}
      </div>}

      {!soloUsuarios && <div style={S.card}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Centros de costos ({(empresa.centrosCostos || []).length})</h3>
        <div style={{ fontSize: 12, color: "#54606B", marginBottom: 12 }}>
          Dimensión contable independiente de la cuenta: cada departamento tiene un CC por defecto y la solicitud lo hereda (con opción de cambiarlo). La póliza sale con cuenta + centro de costos.
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
          <Campo label="Clave"><input style={{ ...S.input, width: 130, fontFamily: "ui-monospace,monospace" }} value={nuevoCC.clave} onChange={(e) => setNuevoCC({ ...nuevoCC, clave: e.target.value })} placeholder="ING-MTY" /></Campo>
          <Campo label="Nombre"><input style={{ ...S.input, width: 240 }} value={nuevoCC.nombre} onChange={(e) => setNuevoCC({ ...nuevoCC, nombre: e.target.value })} placeholder="Ingeniería Monterrey" /></Campo>
          <button style={S.btn(false)} disabled={!nuevoCC.clave.trim()}
            onClick={() => { actualizar({ centrosCostos: [...(empresa.centrosCostos || []).filter((c) => c.clave !== nuevoCC.clave.trim()), { clave: nuevoCC.clave.trim(), nombre: nuevoCC.nombre.trim() }] }); setNuevoCC({ clave: "", nombre: "" }); }}>Agregar CC</button>
          {(empresa.centrosCostos || []).map((c) => (
            <span key={c.clave} style={{ fontSize: 13, background: "#EDEFF1", padding: "6px 12px", borderRadius: 999, fontFamily: "ui-monospace,monospace" }}>
              {c.clave}{c.nombre ? " · " + c.nombre : ""} <button style={{ border: "none", background: "none", color: "#B4443C", cursor: "pointer" }}
                onClick={() => actualizar({ centrosCostos: empresa.centrosCostos.filter((x) => x.clave !== c.clave) })}>×</button>
            </span>
          ))}
        </div>
      </div>}

      {!soloUsuarios && <div style={S.card}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Ubicaciones / oficinas ({(empresa.ubicaciones || []).length})</h3>
        <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
          <Campo label="Nueva ubicación"><input style={{ ...S.input, width: 260 }} value={nuevaUbic} onChange={(e) => setNuevaUbic(e.target.value)} placeholder="Ej. Oficina Monterrey" /></Campo>
          <button style={S.btn(false)} disabled={!nuevaUbic.trim()}
            onClick={() => { actualizar({ ubicaciones: [...(empresa.ubicaciones || []), { id: uid(), nombre: nuevaUbic.trim() }] }); setNuevaUbic(""); }}>Agregar</button>
          {(empresa.ubicaciones || []).map((u) => (
            <span key={u.id} style={{ fontSize: 13, background: "#EDEFF1", padding: "6px 12px", borderRadius: 999 }}>
              {u.nombre} <button style={{ border: "none", background: "none", color: "#B4443C", cursor: "pointer" }}
                onClick={() => actualizar({ ubicaciones: empresa.ubicaciones.filter((x) => x.id !== u.id) })}>×</button>
            </span>
          ))}
        </div>
      </div>}

      {!soloUsuarios && <div style={S.card}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Cuentas contables</h3>
        <div style={{ fontSize: 12, color: "#54606B", marginBottom: 14 }}>
          Estas cuentas se usan al generar el TXT contable interno. Deja en blanco las que no apliquen.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { key: "clara",         label: "Cuenta puente Clara",              hint: "Abono a tarjeta Clara y retiros ATM" },
            { key: "ivaAcreditable",label: "IVA acreditable",                  hint: "Cargo de IVA en gastos con CFDI" },
            { key: "deudores",      label: "Deudores diversos (empleado)",      hint: "Cargo cuando el trabajador no comprueba" },
            { key: "comisiones",    label: "Comisiones / cuota Clara",          hint: "Cargo de comisiones e intereses Clara" },
            { key: "noDeducibles",  label: "Gastos no deducibles",              hint: "Comprobado sin CFDI pero aprobado" },
          ].map(({ key, label, hint }) => {
            const ctas = empresa.ctasPuente || {};
            const listaCuentas = empresa.catalogo || [];
            return (
              <Campo key={key} label={label}>
                <div style={{ fontSize: 11, color: "#8A949C", marginBottom: 4 }}>{hint}</div>
                {listaCuentas.length > 0
                  ? <select style={S.input} value={ctas[key] || ""} onChange={(e) => actualizar({ ctasPuente: { ...ctas, [key]: e.target.value } })}>
                      <option value="">— Sin asignar —</option>
                      {listaCuentas.map(c => <option key={c.cuenta} value={c.cuenta}>{c.cuenta} — {c.nombre}</option>)}
                    </select>
                  : <input style={{ ...S.input, fontFamily: "ui-monospace,monospace" }} placeholder="Ej. 2130.2000.1.001"
                      value={ctas[key] || ""} onChange={(e) => actualizar({ ctasPuente: { ...ctas, [key]: e.target.value } })} />
                }
              </Campo>
            );
          })}
        </div>
        {!(empresa.catalogo?.length) && (
          <div style={{ fontSize: 12, color: "#B7791F", marginTop: 12, background: "#FFFBEB", padding: "8px 12px", borderRadius: 6 }}>
            💡 Si importas tu catálogo de cuentas, podrás seleccionar las cuentas desde un desplegable en lugar de escribirlas.
          </div>
        )}
      </div>}

      {!soloUsuarios && <div style={S.card}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Departamentos ({(empresa.departamentos || []).length})</h3>
        <div style={{ fontSize: 12, color: "#54606B", marginBottom: 12 }}>
          Cada departamento puede tener su propio mapeo de cuentas (por ejemplo, viáticos de Servicio ≠ viáticos de Ingeniería). Si una categoría queda sin cuenta, se usa el mapeo general de abajo.
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap", marginBottom: 14 }}>
          <Campo label="Nombre del departamento"><input style={{ ...S.input, width: 200 }} value={nuevoDep.nombre} onChange={(e) => setNuevoDep({ ...nuevoDep, nombre: e.target.value })} placeholder="Ej. Servicio" /></Campo>
          <Campo label="Encargado (usuario del sistema)">
            <select style={{ ...S.input, width: 240 }} value={nuevoDep.encargadoId || ""}
              onChange={(e) => {
                const u = (todosUsuarios||[]).find(x => x.id === e.target.value);
                setNuevoDep({ ...nuevoDep, encargadoId: e.target.value, encargado: u?.nombre || "" });
              }}>
              <option value="">— sin encargado —</option>
              {(todosUsuarios||[]).filter(u => u.empresaId === empresa?.id).map(u =>
                <option key={u.id} value={u.id}>{u.nombre} ({ROLES[u.rol]?.label || u.rol})</option>
              )}
            </select>
          </Campo>
          <button style={S.btn(false)} disabled={!nuevoDep.nombre.trim()}
            onClick={() => { actualizar({ departamentos: [...(empresa.departamentos || []), { id: uid(), nombre: nuevoDep.nombre.trim(), encargado: nuevoDep.encargado.trim(), encargadoId: nuevoDep.encargadoId || "", mapa: {} }] }); setNuevoDep({ nombre: "", encargado: "" }); }}>Agregar departamento</button>
        </div>
        {(empresa.departamentos || []).map((d) => (
          <div key={d.id} style={{ border: "1px solid #E3E6E9", borderRadius: 8, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input style={{ ...S.input, width: 180, fontWeight: 700 }} value={d.nombre}
                onChange={(e) => actualizar({ departamentos: empresa.departamentos.map((x) => x.id === d.id ? { ...x, nombre: e.target.value } : x) })} />
              <span style={{ fontSize: 12, color: "#54606B" }}>CC:</span>
              <select style={{ ...S.input, width: 170 }} value={d.cc || ""}
                onChange={(e) => actualizar({ departamentos: empresa.departamentos.map((x) => x.id === d.id ? { ...x, cc: e.target.value } : x) })}>
                <option value="">— sin CC —</option>
                {(empresa.centrosCostos || []).map((c) => <option key={c.clave} value={c.clave}>{c.clave}</option>)}
              </select>
              <span style={{ fontSize: 12, color: "#54606B" }}>Encargado:</span>
              <select style={{ ...S.input, width: 240 }} value={d.encargadoId || ""}
                onChange={(e) => {
                  const u = (todosUsuarios||[]).find(x => x.id === e.target.value);
                  actualizar({ departamentos: empresa.departamentos.map((x) => x.id === d.id ? { ...x, encargadoId: e.target.value, encargado: u?.nombre || "" } : x) });
                }}>
                <option value="">— sin encargado —</option>
                {(todosUsuarios||[]).filter(u => u.empresaId === empresa?.id).map(u =>
                  <option key={u.id} value={u.id}>{u.nombre} ({ROLES[u.rol]?.label || u.rol})</option>
                )}
              </select>
              <button style={{ ...S.btn(false), fontSize: 12, marginLeft: "auto" }}
                onClick={() => setDepAbierto(depAbierto === d.id ? null : d.id)}>{depAbierto === d.id ? "Ocultar cuentas" : "Cuentas del departamento" + (Object.values(d.mapa || {}).filter(Boolean).length ? " (" + Object.values(d.mapa || {}).filter(Boolean).length + ")" : "")}</button>
              <button style={{ border: "none", background: "none", color: "#B4443C", cursor: "pointer", fontSize: 12 }}
                onClick={() => actualizar({ departamentos: empresa.departamentos.filter((x) => x.id !== d.id) })}>Eliminar</button>
            </div>
            {depAbierto === d.id && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 12, background: "#F7F8F7", padding: 12, borderRadius: 8 }}>
                {destinos.map((cat) => (
                  <Campo key={cat} label={cat}>
                    {(empresa.catalogo || []).length > 0 ? (
                      <select style={S.input} value={d.mapa?.[cat] || ""}
                        onChange={(e) => actualizar({ departamentos: empresa.departamentos.map((x) => x.id === d.id ? { ...x, mapa: { ...(x.mapa || {}), [cat]: e.target.value } } : x) })}>
                        <option value="">— usar mapeo general —</option>
                        {empresa.catalogo.map((c) => <option key={c.cuenta} value={c.cuenta}>{c.cuenta} — {c.nombre}</option>)}
                      </select>
                    ) : (
                      <input style={{ ...S.input, fontFamily: "ui-monospace,monospace" }} value={d.mapa?.[cat] || ""} placeholder="6400.20.1"
                        onChange={(e) => actualizar({ departamentos: empresa.departamentos.map((x) => x.id === d.id ? { ...x, mapa: { ...(x.mapa || {}), [cat]: e.target.value } } : x) })} />
                    )}
                  </Campo>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>}

      {!soloUsuarios && <div style={S.card}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Catálogo de cuentas ({(empresa.catalogo || []).length})</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", marginBottom: 12 }}>
          <button style={S.btn(true)} onClick={() => refCat.current.click()}>Importar catálogo CSV</button>
          <input ref={refCat} type="file" accept=".csv,text/csv" hidden onChange={(e) => { e.target.files[0] && importarCatalogo(e.target.files[0]); e.target.value = ""; }} />
          <Campo label="Cuenta"><input style={{ ...S.input, width: 130, fontFamily: "ui-monospace,monospace" }} value={cta.cuenta} onChange={(e) => setCta({ ...cta, cuenta: e.target.value })} placeholder="6400.20.1" /></Campo>
          <Campo label="Nombre"><input style={{ ...S.input, width: 240 }} value={cta.nombre} onChange={(e) => setCta({ ...cta, nombre: e.target.value })} placeholder="Gastos de transporte" /></Campo>
          <button style={S.btn(false)} disabled={!cta.cuenta.trim()}
            onClick={() => { actualizar({ catalogo: [...(empresa.catalogo || []).filter((c) => c.cuenta !== cta.cuenta.trim()), { cuenta: cta.cuenta.trim(), nombre: cta.nombre.trim() }] }); setCta({ cuenta: "", nombre: "" }); }}>Agregar cuenta</button>
          <span style={{ fontSize: 12, color: "#54606B" }}>El archivo necesita columnas «Cuenta» y «Nombre». Reimportar reemplaza el catálogo.</span>
        </div>
        {aviso && <div style={{ background: "#E9EEF8", color: "#3644AC", padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{aviso}</div>}
        {(empresa.catalogo || []).length > 0 && (
          <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #E3E6E9", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={S.th}>Cuenta</th><th style={S.th}>Nombre</th><th style={S.th}></th></tr></thead>
              <tbody>
                {empresa.catalogo.map((c) => (
                  <tr key={c.cuenta}>
                    <td style={{ ...S.td, fontFamily: "ui-monospace,monospace" }}>{c.cuenta}</td>
                    <td style={S.td}>{c.nombre}</td>
                    <td style={S.td}><button style={{ border: "none", background: "none", color: "#B4443C", cursor: "pointer", fontSize: 12 }}
                      onClick={() => actualizar({ catalogo: empresa.catalogo.filter((x) => x.cuenta !== c.cuenta) })}>Eliminar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>}

      <GestionUsuarios empresa={empresa} empresas={empresas} todosUsuarios={todosUsuarios} usuarioActual={usuarioActual} onGuardar={onGuardarUsuarios} />
      {soloUsuarios && (
        <div style={{ ...S.card, color: "#54606B", fontSize: 13, textAlign: "center", padding: 20 }}>
          La configuración de empresa, catálogo de cuentas y centros de costos solo la puede editar el Administrador.
        </div>
      )}

      {!soloUsuarios && <div style={S.card}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Mapeo general: categoría → cuenta contable</h3>
        <div style={{ fontSize: 12, color: "#54606B", marginBottom: 12 }}>
          Este mapeo se usa cuando el departamento de la solicitud no define el suyo propio. Los gastos sin CFDI usan la cuenta de «No deducibles» si la defines.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          {destinos.map((cat) => (
            <Campo key={cat} label={cat}>
              {(empresa.catalogo || []).length > 0 ? (
                <select style={S.input} value={empresa.mapa?.[cat] || ""}
                  onChange={(e) => actualizar({ mapa: { ...(empresa.mapa || {}), [cat]: e.target.value } })}>
                  <option value="">— sin cuenta —</option>
                  {empresa.catalogo.map((c) => <option key={c.cuenta} value={c.cuenta}>{c.cuenta} — {c.nombre}</option>)}
                </select>
              ) : (
                <input style={{ ...S.input, fontFamily: "ui-monospace,monospace" }} value={empresa.mapa?.[cat] || ""} placeholder="6400.20.1"
                  onChange={(e) => actualizar({ mapa: { ...(empresa.mapa || {}), [cat]: e.target.value } })} />
              )}
            </Campo>
          ))}
        </div>
      </div>}
    </div>
  );
}

// ---------- mi perfil ----------
function MiPerfil({ usuario, empresa, empresas, todosUsuarios, onGuardar }) {
  const [f, setF] = useState({
    nombre: usuario.nombre || "",
    correo: usuario.correo || "",
    // Datos bancarios para reembolso
    banco: usuario.banco || "",
    clabe: usuario.clabe || "",
    cuentaBanco: usuario.cuentaBanco || "",
    titularCuenta: usuario.titularCuenta || "",
    rfc: usuario.rfc || "",
  });
  const [guardado, setGuardado] = useState(false);
  const [guardadoBanco, setGuardadoBanco] = useState(false);
  const emp = empresas.find((e) => e.id === usuario.empresaId);
  const deptos = emp?.departamentos || [];
  const depto = deptos.find((d) => d.id === usuario.departamentoId);
  const cc = emp?.centrosCostos || [];

  const guardar = async () => {
    await onGuardar({ ...usuario, nombre: f.nombre.trim(), correo: f.correo.trim().toLowerCase() });
    setGuardado(true); setTimeout(() => setGuardado(false), 2500);
  };

  const guardarBanco = async () => {
    await onGuardar({
      ...usuario, banco: f.banco.trim(), clabe: f.clabe.trim(),
      cuentaBanco: f.cuentaBanco.trim(), titularCuenta: f.titularCuenta.trim(), rfc: f.rfc.trim(),
    });
    setGuardadoBanco(true); setTimeout(() => setGuardadoBanco(false), 2500);
  };

  const datosBancoCompletos = f.banco && f.clabe && f.titularCuenta;

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 680 }}>
      <h2 style={{ margin: 0, fontSize: 20 }}>Mi perfil</h2>

      {/* Datos personales */}
      <div style={S.card}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Datos personales</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Campo label="Nombre completo">
            <input style={S.input} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
          </Campo>
          <Campo label="Correo">
            <input type="email" style={S.input} value={f.correo} onChange={(e) => setF({ ...f, correo: e.target.value })} />
          </Campo>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
          <button style={S.btn(true)} disabled={!f.nombre.trim()} onClick={guardar}>Guardar cambios</button>
          {guardado && <span style={{ fontSize: 13, color: "#0E7C66", fontWeight: 700 }}>✓ Guardado</span>}
        </div>
      </div>

      {/* Datos bancarios para reembolso */}
      <div style={{ ...S.card, border: datosBancoCompletos ? "1px solid #0E7C66" : "1px solid #B7791F" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Datos bancarios para reembolso</h3>
          {datosBancoCompletos
            ? <span style={{ fontSize: 12, fontWeight: 700, color: "#0E7C66", background: "#E4F3EF", padding: "3px 10px", borderRadius: 999 }}>✓ Completos</span>
            : <span style={{ fontSize: 12, fontWeight: 700, color: "#B7791F", background: "#FCF3E3", padding: "3px 10px", borderRadius: 999 }}>⚠ Incompletos</span>}
        </div>
        <div style={{ background: "#FCF3E3", border: "1px solid #B7791F", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#8A5A12", marginBottom: 14 }}>
          Estos datos aparecerán en los reportes de reembolso para que el área de nómina o finanzas procese el pago.
          <b> Verifica que sean correctos antes de enviar una solicitud de reembolso.</b>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Campo label="Banco">
            <input style={S.input} value={f.banco} onChange={(e) => setF({ ...f, banco: e.target.value })} placeholder="Ej. BBVA, Banorte, HSBC..." />
          </Campo>
          <Campo label="Titular de la cuenta">
            <input style={S.input} value={f.titularCuenta} onChange={(e) => setF({ ...f, titularCuenta: e.target.value })} placeholder="Nombre como aparece en la cuenta" />
          </Campo>
          <Campo label="CLABE interbancaria (18 dígitos)">
            <input style={{ ...S.input, fontFamily: "ui-monospace,monospace", letterSpacing: "0.1em" }}
              value={f.clabe} onChange={(e) => setF({ ...f, clabe: e.target.value.replace(/\D/g, "").slice(0, 18) })}
              placeholder="000000000000000000" maxLength={18} />
            {f.clabe && f.clabe.length !== 18 && (
              <div style={{ fontSize: 11, color: "#B4443C", marginTop: 3 }}>La CLABE debe tener exactamente 18 dígitos ({f.clabe.length}/18)</div>
            )}
          </Campo>
          <Campo label="Número de cuenta (opcional)">
            <input style={{ ...S.input, fontFamily: "ui-monospace,monospace" }}
              value={f.cuentaBanco} onChange={(e) => setF({ ...f, cuentaBanco: e.target.value })} placeholder="Opcional" />
          </Campo>
          <Campo label="RFC personal (opcional)">
            <input style={{ ...S.input, fontFamily: "ui-monospace,monospace", textTransform: "uppercase" }}
              value={f.rfc} onChange={(e) => setF({ ...f, rfc: e.target.value.toUpperCase() })} placeholder="XXXX000000XXX" />
          </Campo>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
          <button style={{ ...S.btn(true), background: "#0E7C66" }}
            disabled={!f.banco.trim() || !f.clabe.trim() || !f.titularCuenta.trim()} onClick={guardarBanco}>
            Guardar datos bancarios
          </button>
          {guardadoBanco && <span style={{ fontSize: 13, color: "#0E7C66", fontWeight: 700 }}>✓ Datos bancarios guardados</span>}
        </div>
      </div>

      {/* Asignación */}
      <div style={S.card}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Mi asignación</h3>
        <div style={{ fontSize: 12, color: "#54606B", marginBottom: 12 }}>
          Estos datos los asigna el Administrador o tu Gerente. Si alguno está incorrecto, levanta un ticket de soporte.
        </div>
        {[
          ["Empresa",          emp?.nombre || "—"],
          ["Departamento",     usuario.departamento || "—"],
          ["Ubicación",        usuario.ubicacion || "—"],
          ["Centro de costos", usuario.cc ? `${usuario.cc}${cc.find((c) => c.clave === usuario.cc)?.nombre ? ` — ${cc.find((c) => c.clave === usuario.cc).nombre}` : ""}` : "—"],
          ["Encargado",        depto?.encargado || "—"],
        ].map(([a, b]) => (
          <div key={a} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #EDEFF1", fontSize: 13 }}>
            <span style={{ fontWeight: 700, color: "#54606B" }}>{a}</span>
            <span style={{ fontFamily: a === "Centro de costos" ? "ui-monospace,monospace" : "inherit" }}>{b}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", fontSize: 13 }}>
          <span style={{ fontWeight: 700, color: "#54606B" }}>Rol</span>
          <RolChip rol={usuario.rol} />
        </div>
      </div>

      {/* Recuperación admin */}
      {!todosUsuarios.some((u) => u.rol === "Administrador") && usuario.rol !== "Administrador" && (
        <div style={{ ...S.card, border: "1px solid #5B3AD4", background: "#EDE9FB" }}>
          <div style={{ fontWeight: 700, color: "#5B3AD4", marginBottom: 6 }}>No existe ningún Administrador</div>
          <div style={{ fontSize: 13, color: "#54606B", marginBottom: 12 }}>
            Sin un Administrador nadie puede configurar la empresa ni gestionar todos los usuarios. Puedes promover tu usuario ahora.
          </div>
          <button style={{ ...S.btn(true), background: "#5B3AD4" }}
            onClick={() => onGuardar({ ...usuario, rol: "Administrador" })}>
            Promover mi usuario a Administrador
          </button>
        </div>
      )}
    </div>
  );
}




// ---------- login / registro de usuarios ----------
// Roles y sus permisos

function RolChip({ rol }) {
  const r = ROLES[rol] || ROLES.Empleado;
  return <span style={{ fontSize: 11, fontWeight: 700, color: r.color, background: r.bg, padding: "2px 9px", borderRadius: 999 }}>{r.label}</span>;
}

function Login({ onEntrar }) {
  const [modo, setModo]     = useState("cargando"); // cargando | inicio | magic-enviado | sin-perfil | primer-admin
  const [tabLogin, setTabLogin] = useState("directo"); // directo | correo
  const [correo, setCorreo] = useState("");
  const [cargandoOAuth, setCargandoOAuth] = useState("");
  const [aviso, setAviso]   = useState("");
  const [datosAuth, setDatosAuth] = useState(null); // cuando entró con OAuth pero no tiene perfil
  const [otpFallido, setOtpFallido] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const sb = getSB();
        if (sb) {
          const { data: { session } } = await sb.auth.getSession();
          if (session?.user) {
            const email = session.user.email;
            const lista = await cargarUsuarios(null);
            const perfil = lista.find(u => u.correo?.toLowerCase() === email?.toLowerCase());
            if (perfil) { onEntrar({ ...perfil, _authId: session.user.id }); return; }
            const hayAdmin = lista.some(u => u.rol === "Administrador");
            if (!hayAdmin) {
              setDatosAuth({ email, nombre: session.user.user_metadata?.full_name || email.split("@")[0], _authId: session.user.id });
              setModo("primer-admin");
            } else {
              try { await getSB()?.auth.signOut(); } catch {}
              setDatosAuth({ email });
              setModo("sin-perfil");
            }
            return;
          }
        }
        const lista = await cargarUsuarios(null);
        if (!lista.length && enProduccion()) { setModo("inicio"); return; }
        if (!lista.length) { setModo("primer-admin"); return; }
        setModo("inicio");
      } catch { setModo("inicio"); }
    })();
  }, []);

  const entrarDirectoRol = (rol, nombre, correoDemo) => {
    const usr = {
      id: uid(),
      nombre,
      correo: correoDemo,
      rol,
      empresaId: "emp-demo-01",
      empresa: "GBSolution",
      departamento: "Operaciones",
      activo: true,
      permisosExtra: {},
    };
    onEntrar(usr);
  };

  const enviarMagicLink = async () => {
    setAviso("");
    setOtpFallido(false);
    if (!correo.trim() || !/.+@.+\..+/.test(correo)) { setAviso("Ingresa un correo válido."); return; }
    const sb = getSB();
    if (!sb) {
      setOtpFallido(true);
      setAviso("El servicio de correo de Supabase no está conectado localmente. Usa el acceso directo para entrar.");
      return;
    }
    const { error } = await sb.auth.signInWithOtp({ email: correo.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin } });
    if (error) {
      setOtpFallido(true);
      setAviso("No fue posible enviar el correo (" + error.message + "). Puedes ingresar con acceso directo.");
      return;
    }
    setModo("magic-enviado");
  };

  return (
    <div style={{ ...S.font, minHeight:"100vh", display:"flex", background:"#0a0a0a" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { 0%,100%{opacity:0.4} 50%{opacity:1} }
        .login-btn:hover { opacity: 0.85; transform: translateY(-1px); }
        .login-btn-outline:hover { background: #f4f4f5 !important; }
        .login-input:focus { border-color: #52525b !important; box-shadow: 0 0 0 3px rgba(82,82,91,0.12) !important; }
        .feature-row { transition: transform .2s ease; }
        .feature-row:hover { transform: translateX(4px); }
      `}</style>

      {/* Panel izquierdo — marca premium */}
      <div style={{ flex:"0 0 440px", display:"flex", flexDirection:"column", justifyContent:"space-between",
        padding:"56px 48px", position:"relative", overflow:"hidden",
        background:"linear-gradient(160deg, #18181b 0%, #0a0a0a 100%)",
        borderRight:"1px solid #27272a" }}>
        {/* Geometric accent */}
        <div style={{ position:"absolute", top:-80, right:-80, width:280, height:280,
          borderRadius:"50%", border:"1px solid #27272a", opacity:0.5, pointerEvents:"none" }} />
        <div style={{ position:"absolute", top:20, right:20, width:160, height:160,
          borderRadius:"50%", border:"1px solid #27272a", opacity:0.3, pointerEvents:"none" }} />

        <div style={{ position:"relative", zIndex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:56 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:"#ffffff",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>
              ✈️
            </div>
            <div style={{ fontWeight:800, fontSize:18, color:"#ffffff", letterSpacing:"-0.03em" }}>GBS Solutions</div>
          </div>
          <div style={{ fontWeight:300, fontSize:13, color:"#71717a", letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:12 }}>
            Sistema de Gestión
          </div>
          <div style={{ fontWeight:800, fontSize:36, color:"#ffffff", lineHeight:1.1, letterSpacing:"-0.04em", marginBottom:24 }}>
            Gastos de<br/>Viaje y Viáticos
          </div>
          <div style={{ width:40, height:2, background:"#ffffff", opacity:0.2, marginBottom:40 }} />
          <div style={{ display:"grid", gap:18 }}>
            {[
              ["📋", "Solicitud y aprobación de viáticos"],
              ["🧾", "Comprobación con CFDIs reales"],
              ["📤", "Exportación contable interna"],
              ["🏦", "Gestión de Tesorería integrada"],
            ].map(([ic, txt]) => (
              <div key={txt} className="feature-row" style={{ display:"flex", alignItems:"center", gap:14 }}>
                <div style={{ width:34, height:34, borderRadius:8, background:"#27272a",
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0 }}>{ic}</div>
                <span style={{ fontSize:13.5, color:"#a1a1aa", fontWeight:400, letterSpacing:"-0.01em" }}>{txt}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize:11, color:"#3f3f46", letterSpacing:"0.04em", position:"relative", zIndex:1 }}>
          GBS Solutions · Sistema interno · v2.1
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center",
        background:"#fafafa", padding:40 }}>
        <div style={{ width:420, boxSizing:"border-box", animation:"fadeIn .4s ease" }}>
          <div style={{ marginBottom:32 }}>
            <div style={{ fontWeight:800, fontSize:24, color:"#09090b", letterSpacing:"-0.03em", marginBottom:6 }}>
              Iniciar sesión
            </div>
            <div style={{ fontSize:14, color:"#71717a", fontWeight:400 }}>
              Selecciona tu método de acceso
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:"flex", gap:4, marginBottom:24, background:"#f4f4f5", borderRadius:10, padding:4 }}>
            <button className="login-btn" style={{ flex:1, fontSize:12.5, fontWeight:600, cursor:"pointer", padding:"8px",
              borderRadius:7, border:"none", transition:"all .18s ease",
              background: tabLogin === "directo" ? "#ffffff" : "transparent",
              color: tabLogin === "directo" ? "#09090b" : "#71717a",
              boxShadow: tabLogin === "directo" ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}
              onClick={() => setTabLogin("directo")}>
              Acceso Directo
            </button>
            <button className="login-btn" style={{ flex:1, fontSize:12.5, fontWeight:600, cursor:"pointer", padding:"8px",
              borderRadius:7, border:"none", transition:"all .18s ease",
              background: tabLogin === "correo" ? "#ffffff" : "transparent",
              color: tabLogin === "correo" ? "#09090b" : "#71717a",
              boxShadow: tabLogin === "correo" ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}
              onClick={() => setTabLogin("correo")}>
              Código por Correo
            </button>
          </div>

          {modo === "cargando" && (
            <div style={{ textAlign:"center", color:"#71717a", padding:"50px 0" }}>
              <div style={{ fontSize:28, marginBottom:12, animation:"shimmer 1.4s ease infinite" }}>⏳</div>
              <div style={{ fontSize:14 }}>Cargando aplicación…</div>
            </div>
          )}

          {modo === "inicio" && (<>
            {tabLogin === "directo" ? (
              <div style={{ display:"grid", gap:10 }}>
                <div style={{ background:"#f4f4f5", padding:"10px 14px", borderRadius:8, fontSize:12.5, color:"#71717a", marginBottom:4, lineHeight:1.5 }}>
                  Entra inmediatamente seleccionando un perfil operativo:
                </div>
                {[
                  { rol:"Administrador", nombre:"Laura Méndez", email:"admin@gbsolution.mx", icon:"👑" },
                  { rol:"Aprobador", nombre:"Ing. Carlos Ruiz", email:"aprobador@gbsolution.mx", icon:"✅" },
                  { rol:"Contador", nombre:"Lic. Roberto Silva", email:"tesoreria@gbsolution.mx", icon:"🏦" },
                  { rol:"Empleado", nombre:"Ing. Ana Torres", email:"empleado@gbsolution.mx", icon:"👤" },
                ].map(({ rol, nombre, email, icon }) => (
                  <button key={rol} className="login-btn-outline" onClick={() => entrarDirectoRol(rol, nombre, email)}
                    style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", width:"100%",
                      border:"1.5px solid #e4e4e7", borderRadius:10, background:"#ffffff", cursor:"pointer",
                      transition:"all .18s ease", textAlign:"left",
                      boxShadow:"0 1px 2px rgba(0,0,0,0.04)", fontFamily:"'Inter', system-ui, sans-serif" }}>
                    <div style={{ width:36, height:36, borderRadius:8, background:"#f4f4f5",
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{icon}</div>
                    <div>
                      <div style={{ fontWeight:600, fontSize:13.5, color:"#09090b", letterSpacing:"-0.01em" }}>
                        Entrar como {rol}
                      </div>
                      <div style={{ fontSize:11.5, color:"#a1a1aa", marginTop:1 }}>{nombre}</div>
                    </div>
                    <div style={{ marginLeft:"auto", color:"#d4d4d8", fontSize:16 }}>›</div>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ display:"grid", gap:14 }}>
                <Campo label="Correo institucional">
                  <input className="login-input" style={{ ...S.input }} type="email"
                    placeholder="correo@gruposecovi.com" value={correo}
                    onChange={e => setCorreo(e.target.value)}
                    onKeyDown={e => e.key==="Enter" && enviarMagicLink()} />
                </Campo>
                <button className="login-btn" style={{ ...S.btn(true), padding:"12px", fontSize:14, width:"100%",
                  borderRadius:10, letterSpacing:"-0.01em", transition:"all .18s ease" }}
                  onClick={enviarMagicLink} disabled={!correo.trim()}>
                  Enviar enlace de acceso →
                </button>
                {aviso && <div style={{ fontSize:12.5, color:"#52525b", background:"#f4f4f5", padding:"10px 14px", borderRadius:8, lineHeight:1.5 }}>{aviso}</div>}
                {otpFallido && (
                  <div style={{ marginTop:6, display:"grid", gap:8 }}>
                    <div style={{ fontSize:11, color:"#a1a1aa", fontWeight:600, letterSpacing:"0.06em" }}>ACCESO RÁPIDO DISPONIBLE:</div>
                    <button className="login-btn-outline" style={{ ...S.btn(false), fontSize:13 }}
                      onClick={() => entrarDirectoRol("Administrador", "Laura Méndez", correo || "admin@gbsolution.mx")}>
                      Ingresar como Administrador
                    </button>
                    <button className="login-btn-outline" style={{ ...S.btn(false), fontSize:13 }}
                      onClick={() => entrarDirectoRol("Empleado", "Ing. Ana Torres", correo || "empleado@gbsolution.mx")}>
                      Ingresar como Empleado
                    </button>
                  </div>
                )}
              </div>
            )}
          </>)}

          {modo === "magic-enviado" && (
            <div style={{ textAlign:"center", padding:"20px 0", animation:"fadeIn .4s ease" }}>
              <div style={{ width:64, height:64, borderRadius:16, background:"#f4f4f5",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:32, margin:"0 auto 20px" }}>📬</div>
              <div style={{ fontWeight:800, fontSize:18, color:"#09090b", marginBottom:8, letterSpacing:"-0.02em" }}>Revisa tu correo</div>
              <div style={{ fontSize:14, color:"#71717a", lineHeight:1.7, marginBottom:28 }}>
                Enviamos un enlace de acceso a<br/>
                <strong style={{color:"#18181b", fontWeight:600}}>{correo}</strong>
              </div>
              <button className="login-btn" style={{ ...S.btn(true), width:"100%", padding:"12px", fontSize:14, borderRadius:10, marginBottom:12, transition:"all .18s ease" }}
                onClick={() => entrarDirectoRol("Administrador", "Laura Méndez", correo)}>
                Ingresar directo ahora →
              </button>
              <button style={{ border:"none", background:"none", color:"#a1a1aa",
                cursor:"pointer", fontSize:13, textDecoration:"none", fontFamily:"'Inter', system-ui, sans-serif" }}
                onClick={() => { setModo("inicio"); setAviso(""); }}>
                ← Usar otro método
              </button>
            </div>
          )}

          {modo === "sin-perfil" && (
            <div style={{ textAlign:"center", padding:"20px 0" }}>
              <div style={{ width:64, height:64, borderRadius:16, background:"#f4f4f5",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:32, margin:"0 auto 20px" }}>🔒</div>
              <div style={{ fontWeight:800, fontSize:18, color:"#09090b", marginBottom:8, letterSpacing:"-0.02em" }}>Sin perfil registrado</div>
              <div style={{ fontSize:14, color:"#71717a", lineHeight:1.7, marginBottom:28 }}>
                El correo <strong style={{ color:"#18181b" }}>{datosAuth?.email}</strong> aún no está registrado.
              </div>
              <button className="login-btn" style={{ ...S.btn(true), width:"100%", padding:"12px", fontSize:14, borderRadius:10, transition:"all .18s ease" }}
                onClick={() => entrarDirectoRol("Administrador", "Administrador GBS", datosAuth?.email || "admin@gbsolution.mx")}>
                Ingresar como Administrador →
              </button>
            </div>
          )}

          {modo === "primer-admin" && (
            <PrimerAdmin datosAuth={datosAuth} onCrear={async (u) => {
              await guardarUsuarios([u]); onEntrar(u);
            }} />
          )}

          <div style={{ marginTop:32, paddingTop:20, borderTop:"1px solid #f4f4f5",
            textAlign:"center", fontSize:11.5, color:"#d4d4d8", letterSpacing:"0.02em" }}>
            GBS Solutions · Sistema interno · v2.1-jul16
          </div>
        </div>
      </div>
    </div>
  );
}


function PrimerAdmin({ onCrear, datosAuth }) {
  const [f, setF] = useState({
    nombre: datosAuth?.nombre || "",
    correo: datosAuth?.email || "",
  });
  const ok = f.nombre.trim() && /.+@.+\..+/.test(f.correo);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ textAlign:"center", marginBottom:4 }}>
        <div style={{ fontSize:32, marginBottom:8 }}>👤</div>
        <div style={{ fontWeight:700, fontSize:15 }}>Crear cuenta de Administrador</div>
        <div style={{ fontSize:12, color:"#54606B", marginTop:4, lineHeight:1.5 }}>
          Eres el primer usuario del sistema. Solo el Administrador puede dar de alta a los demás.
        </div>
      </div>
      <Campo label="Nombre completo">
        <input style={S.input} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Ej. Evelyn Cantú" />
      </Campo>
      <Campo label="Correo">
        <input type="email" style={{ ...S.input, background: datosAuth?.email ? "#F3F4FA" : undefined }}
          value={f.correo} onChange={(e) => setF({ ...f, correo: e.target.value })}
          placeholder="nombre@empresa.com" readOnly={!!datosAuth?.email} />
        {datosAuth?.email && <div style={{ fontSize:11, color:"#6B7280", marginTop:3 }}>Correo de tu cuenta Google/Microsoft</div>}
      </Campo>
      <button style={S.btn(true)} disabled={!ok}
        onClick={() => onCrear({
          id: uid(), nombre: f.nombre.trim(),
          correo: f.correo.trim().toLowerCase(),
          rol: "Administrador", empresa: "", empresaId: "",
          departamento: "", departamentoId: "",
          ubicacion: "", ubicacionId: "", cc: "", activo: true,
          _authId: datosAuth?._authId,
        })}>
        Crear cuenta y entrar
      </button>
    </div>
  );
}

// ---------- lista ----------
function Lista({ solicitudes, usuario, onNueva, onNuevoReembolso, onNuevaCajaChica, onAbrir }) {
  const ahora = new Date();
  const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  // ── Estados de filtros ──
  const [filtroAnio,    setFiltroAnio]    = useState(ahora.getFullYear());
  const [filtroMes,     setFiltroMes]     = useState(ahora.getMonth());
  const [vistaAnio,     setVistaAnio]     = useState(false);
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroEstado,  setFiltroEstado]  = useState("");
  const [filtroTipo,    setFiltroTipo]    = useState("");  // viaje | reembolso | caja-chica
  const [filtroProy,    setFiltroProy]    = useState("");
  const [filtroPedido,  setFiltroPedido]  = useState("");
  const [filtroBusq,    setFiltroBusq]    = useState("");
  const [filtroEsp,     setFiltroEsp]     = useState(""); // filtros especiales
  const [panelFiltros,  setPanelFiltros]  = useState(false);

  // ── Listas únicas para selects ──
  const anios = [...new Set(solicitudes.map((s) => (s.fechaSolicitud||"").slice(0,4)).filter(Boolean))].sort().reverse();
  if (!anios.includes(String(ahora.getFullYear()))) anios.unshift(String(ahora.getFullYear()));
  const solicitantes = [...new Set(solicitudes.map((s) => s.solicitante).filter(Boolean))].sort();
  const proyectosU   = [...new Set(solicitudes.map((s) => s.proyecto).filter(Boolean))].sort();
  const pedidosU     = [...new Set(solicitudes.map((s) => s.pedido).filter(Boolean))].sort();

  // ── Lógica de filtrado ──
  const solsFiltradas = solicitudes.filter((s) => {
    const fecha   = s.fechaSolicitud || s.fechaInicio || "";
    const anioSol = Number(fecha.slice(0,4)), mesSol = Number(fecha.slice(5,7))-1;
    const tc = calcular(s);
    // Filtros especiales calculados
    const tieneReembolso   = tc.reembolso > 0 || tc.reembolsoClara > tc.reembolsoClaraAprobado;
    const saldoEnContra    = ((tc.rechazadosClara||0) + Math.max(0,(s.fondoEfectivo||0)+(tc.retirosClara||0)-tc.efectivo)) > 0.5 && s.estado === "CERRADA";
    const todoComprobado   = s.estado === "CERRADA" && tc.total > 0;
    const sinComprobar     = ["APROBADA","COMPROBACION"].includes(s.estado) && tc.total === 0;
    const sinFactura       = (s.movimientos||[]).some(m => !m.factura && m.total > 0);
    const ok = [
      vistaAnio ? anioSol===filtroAnio : (anioSol===filtroAnio && mesSol===filtroMes),
      !filtroUsuario || s.solicitante===filtroUsuario,
      !filtroEstado  || s.estado===filtroEstado,
      !filtroTipo    || (filtroTipo==="reembolso" ? s.tipo==="reembolso" : filtroTipo==="caja-chica" ? s.tipo==="caja-chica" : !s.tipo||s.tipo==="viaje"),
      !filtroProy    || s.proyecto===filtroProy,
      !filtroPedido  || s.pedido===filtroPedido,
      !filtroBusq    || [s.proyecto,s.cliente,s.pedido,s.solicitante,s.folio,s.objetivo].join(" ").toLowerCase().includes(filtroBusq.toLowerCase()),
      !filtroEsp     || (filtroEsp==="reembolso" && tieneReembolso)
                     || (filtroEsp==="saldo" && saldoEnContra)
                     || (filtroEsp==="comprobado" && todoComprobado)
                     || (filtroEsp==="sincomprobar" && sinComprobar)
                     || (filtroEsp==="sinfactura" && sinFactura),
    ];
    return ok.every(Boolean);
  });

  const nFiltros = [filtroUsuario,filtroEstado,filtroTipo,filtroProy,filtroPedido,filtroBusq,filtroEsp].filter(Boolean).length;
  const pendientes = solsFiltradas.filter((s) => s.estado==="ENVIADA").length;
  const limpiar = () => { setFiltroUsuario(""); setFiltroEstado(""); setFiltroTipo(""); setFiltroProy(""); setFiltroPedido(""); setFiltroBusq(""); setFiltroEsp(""); };

  // ── Totales del período filtrado ──
  const totalPresup = solsFiltradas.reduce((a,s)=>a+(calcular(s).presupuestoTotal||0),0);
  const totalComp   = solsFiltradas.reduce((a,s)=>a+(calcular(s).total||0),0);

  return (
    <div className="animate-in">
      {/* Header de sección */}
      <div style={{ marginBottom:20 }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div>
            <h2 style={{ margin:0, fontSize:22, color:"#09090b", fontWeight:800, letterSpacing:"-0.03em" }}>Expedientes</h2>
            <p style={{ margin:"4px 0 0", fontSize:13.5, color:"#71717a" }}>Viajes, reembolsos y caja chica de tu empresa</p>
          </div>
          {/* Botones de acción — visibles y claros */}
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            {puedeAprobar(usuario) && pendientes > 0 && (
              <div style={{ display:"flex", alignItems:"center", gap:6, background:"#f4f4f5",
                border:"1px solid #e4e4e7", borderRadius:8, padding:"6px 12px",
                fontSize:12.5, fontWeight:600, color:"#18181b" }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background:"#18181b", display:"inline-block" }} />
                {pendientes} pendiente{pendientes>1?"s":""} por aprobar
              </div>
            )}
            <button className="btn-outline-hover" style={{ ...S.btn(false), display:"flex", alignItems:"center", gap:6, padding:"9px 14px", transition:"all .15s ease" }} onClick={onNuevoReembolso}>
              <span style={{fontSize:14}}>🧾</span> Reembolso
            </button>
            <button className="btn-outline-hover" style={{ ...S.btn(false), display:"flex", alignItems:"center", gap:6, padding:"9px 14px", transition:"all .15s ease" }} onClick={onNuevaCajaChica}>
              <span style={{fontSize:14}}>💵</span> Caja Chica
            </button>
            <button className="action-btn" style={{ ...S.btn(true), display:"flex", alignItems:"center", gap:7, padding:"9px 18px" }} onClick={onNueva}>
              <span style={{fontSize:15}}>✈️</span> Nueva Solicitud
            </button>
          </div>
        </div>
      </div>

      {/* Barra de período + Búsqueda en una sola línea */}
      <div style={{ ...S.card, padding:"12px 16px", marginBottom:14, display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
        {/* Año */}
        <select style={{ ...S.input, width:84, padding:"6px 26px 6px 10px", fontSize:12.5 }} value={filtroAnio} onChange={(e)=>setFiltroAnio(Number(e.target.value))}>
          {anios.map((a)=><option key={a} value={a}>{a}</option>)}
        </select>
        {/* Meses — botones compactos */}
        <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
          <button className="month-btn" onClick={()=>setVistaAnio(!vistaAnio)}
            style={{ padding:"5px 10px", border:"1.5px solid", borderColor: vistaAnio ? "#18181b" : "#e4e4e7",
              borderRadius:7, fontSize:11.5, cursor:"pointer",
              background: vistaAnio ? "#18181b" : "transparent",
              color: vistaAnio ? "#fff" : "#71717a", fontWeight:600, fontFamily:"'Inter',system-ui,sans-serif" }}>
            Todo el año
          </button>
          {!vistaAnio && MESES.map((m,i)=>(
            <button key={i} className="month-btn" onClick={()=>setFiltroMes(i)}
              style={{ padding:"5px 9px", border:"1.5px solid", borderColor: filtroMes===i ? "#18181b" : "#e4e4e7",
                borderRadius:7, fontSize:11.5, cursor:"pointer",
                background: filtroMes===i ? "#18181b" : "transparent",
                color: filtroMes===i ? "#ffffff" : "#71717a",
                fontWeight: filtroMes===i ? 700 : 400, fontFamily:"'Inter',system-ui,sans-serif" }}>
              {m.slice(0,3)}
            </button>
          ))}
        </div>
        <div style={{ flex:1, minWidth:180 }}>
          <input style={{ ...S.input, padding:"7px 12px", fontSize:12.5 }}
            value={filtroBusq} onChange={(e)=>setFiltroBusq(e.target.value)}
            placeholder="🔍 Buscar proyecto, cliente, folio…" />
        </div>
      </div>

      {/* Filtros secundarios colapsables */}
      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:14, flexWrap:"wrap" }}>
        <select style={{ ...S.input, width:170, padding:"7px 26px 7px 10px", fontSize:12.5 }} value={filtroEstado} onChange={(e)=>setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="CAPTURA">Captura de gastos</option>
          <option value="ENVIADA">Pendiente aprobación</option>
          <option value="APROBADA">Aprobada</option>
          <option value="COMPROBACION">En comprobación</option>
          <option value="RECHAZADA">Rechazada</option>
          <option value="CERRADA">Cerrada</option>
        </select>
        <select style={{ ...S.input, width:150, padding:"7px 26px 7px 10px", fontSize:12.5 }} value={filtroTipo} onChange={(e)=>setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="viaje">Solicitud de viaje</option>
          <option value="reembolso">Reembolso</option>
          <option value="caja-chica">Caja chica</option>
        </select>
        <select style={{ ...S.input, width:190, padding:"7px 26px 7px 10px", fontSize:12.5 }} value={filtroEsp} onChange={(e)=>setFiltroEsp(e.target.value)}>
          <option value="">Filtros especiales</option>
          <option value="reembolso">Con reembolso pendiente</option>
          <option value="saldo">Saldo en contra</option>
          <option value="comprobado">Cerradas y comprobadas</option>
          <option value="sincomprobar">Aprobadas sin gastos</option>
          <option value="sinfactura">Con gastos sin factura</option>
        </select>
        <button onClick={()=>setPanelFiltros(!panelFiltros)}
          style={{ ...S.btn(false), padding:"7px 13px", fontSize:12.5, display:"flex", alignItems:"center", gap:5, transition:"all .15s ease" }}>
          <span>⚙</span> Más filtros {panelFiltros ? "▲" : "▼"}
        </button>
        {nFiltros>0 && (
          <button className="btn-outline-hover" onClick={limpiar}
            style={{ ...S.btn(false), padding:"7px 13px", fontSize:12.5, background:"#f4f4f5", display:"flex", alignItems:"center", gap:5, transition:"all .15s ease" }}>
            ✕ Limpiar ({nFiltros})
          </button>
        )}
        <span style={{ marginLeft:"auto", fontSize:12, color:"#a1a1aa", ...S.num, fontWeight:500 }}>
          {solsFiltradas.length} expediente{solsFiltradas.length!==1?"s":""} · {mxn(totalPresup)} presup. · {mxn(totalComp)} comp.
        </span>
      </div>

      {panelFiltros && (
        <div style={{ ...S.card, display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:14, padding:"14px 16px" }}>
          <Campo label="Solicitante">
            <select style={{ ...S.input, padding:"7px 26px 7px 10px" }} value={filtroUsuario} onChange={(e)=>setFiltroUsuario(e.target.value)}>
              <option value="">Todos los usuarios</option>
              {solicitantes.map((s)=><option key={s} value={s}>{s}</option>)}
            </select>
          </Campo>
          <Campo label="Proyecto">
            <select style={{ ...S.input, padding:"7px 26px 7px 10px" }} value={filtroProy} onChange={(e)=>setFiltroProy(e.target.value)}>
              <option value="">Todos los proyectos</option>
              {proyectosU.map((p)=><option key={p} value={p}>{p}</option>)}
            </select>
          </Campo>
          <Campo label="Pedido de venta">
            <select style={{ ...S.input, padding:"7px 26px 7px 10px" }} value={filtroPedido} onChange={(e)=>setFiltroPedido(e.target.value)}>
              <option value="">Todos los pedidos</option>
              {pedidosU.map((p)=><option key={p} value={p}>{p}</option>)}
            </select>
          </Campo>
        </div>
      )}

      {/* Tarjetas de expediente — diseño premium */}
      {solsFiltradas.length===0 ? (
        <div style={{ ...S.card, textAlign:"center", padding:"56px 24px" }}>
          <div style={{ fontSize:40, marginBottom:16 }}>🗂️</div>
          <div style={{ fontWeight:700, fontSize:16, color:"#18181b", marginBottom:6 }}>Sin expedientes</div>
          <div style={{ fontSize:13.5, color:"#a1a1aa", lineHeight:1.6 }}>
            {nFiltros>0 ? "No hay expedientes que coincidan con los filtros aplicados." : "Aún no hay expedientes en este período."}
          </div>
          {nFiltros>0 && <div style={{ marginTop:16 }}><button className="btn-outline-hover" style={{ ...S.btn(false), transition:"all .15s ease" }} onClick={limpiar}>Limpiar filtros</button></div>}
        </div>
      ) : (
        <div style={{ display:"grid", gap:8 }}>
          {solsFiltradas.map((s) => {
            const t = calcular(s);
            const compPct = t.presupuestoTotal>0 ? Math.round((t.total/t.presupuestoTotal)*100) : null;
            const excede  = compPct!==null && compPct>100;
            const tipoLabel = s.tipo==="reembolso" ? "Reembolso" : s.tipo==="caja-chica" ? "Caja Chica" : "Viaje";
            const tipoIcon  = s.tipo==="reembolso" ? "🧾" : s.tipo==="caja-chica" ? "💵" : "✈️";
            return (
              <div key={s.id} className="card-hover animate-in" style={{ background:"#ffffff", border:"1px solid #e4e4e7", borderRadius:12,
                padding:"16px 20px", display:"flex", alignItems:"center", gap:16,
                boxShadow:"0 1px 2px rgba(0,0,0,0.04)", transition:"all .18s ease" }}>
                {/* Icono tipo */}
                <div style={{ width:44, height:44, borderRadius:10, background:"#f4f4f5",
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>
                  {tipoIcon}
                </div>
                {/* Info principal */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3, flexWrap:"wrap" }}>
                    <Folio texto={s.folio} />
                    <span style={{ fontSize:11, fontWeight:600, color:"#71717a", background:"#f4f4f5",
                      padding:"2px 8px", borderRadius:6, border:"1px solid #e4e4e7" }}>{tipoLabel}</span>
                    <Chip estado={s.estado} />
                  </div>
                  <div style={{ fontWeight:700, fontSize:14.5, color:"#09090b", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", letterSpacing:"-0.01em" }}>
                    {s.proyecto || "—"}
                  </div>
                  <div style={{ fontSize:12.5, color:"#71717a", marginTop:3, display:"flex", gap:10, flexWrap:"wrap" }}>
                    {s.solicitante && <span>👤 {s.solicitante}</span>}
                    {s.cliente && <span>🏢 {s.cliente}</span>}
                    {s.fechaSolicitud && <span>📅 {s.fechaSolicitud}</span>}
                  </div>
                  {/* Barra de progreso */}
                  {t.presupuestoTotal>0 && (
                    <div style={{ marginTop:8, display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ flex:1, height:4, background:"#f4f4f5", borderRadius:99, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:Math.min(compPct,100)+"%",
                          background: excede ? "#09090b" : "#52525b", borderRadius:99, transition:"width .3s ease" }} />
                      </div>
                      <span style={{ fontSize:11.5, ...S.num, color: excede?"#09090b":"#a1a1aa", fontWeight: excede?700:500, whiteSpace:"nowrap" }}>
                        {mxn(t.total)} / {mxn(t.presupuestoTotal)} ({compPct}%)
                      </span>
                    </div>
                  )}
                </div>
                {/* CTA */}
                <button className="action-btn" style={{ ...S.btn(true), padding:"9px 16px", fontSize:13,
                  whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:6, flexShrink:0 }}
                  onClick={() => onAbrir(s.id)}>
                  Ver expediente <span>›</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- nueva solicitud ----------
function FormSolicitud({ usuario, empresa, todosUsuarios, onCancelar, onGuardar }) {
  const deptos = empresa?.departamentos || [];
  const ubics = empresa?.ubicaciones || [];
  // Empleados de la empresa (para selector de "quién viaja")
  const empleadosList = (todosUsuarios||[]).filter(u => u.empresaId === empresa?.id && u.activo !== false);
  const [viajeroId, setViajeroId] = useState(usuario.id); // por defecto el que crea
  const viajero = empleadosList.find(u => u.id === viajeroId) || usuario;

  const [f, setF] = useState({
    cliente: "", pedido: "", proyecto: "", objetivo: "", destino: "", origen: "",
    fechaInicio: hoy(), fechaFin: hoy(), montoClara: "", fondoEfectivo: "",
    departamentoId: deptos.find((d) => d.nombre.toLowerCase() === (usuario.depto || "").toLowerCase())?.id || deptos[0]?.id || "",
    ubicacionId: ubics[0]?.id || "",
    cc: "",
    presupuesto: Object.fromEntries(CATS.map((c) => [c, ""])),
  });
  const set = (k, v) => setF({ ...f, [k]: v });
  const presTotal = CATS.reduce((a, c) => a + (Number(f.presupuesto[c]) || 0), 0);
  const depto = deptos.find((d) => d.id === f.departamentoId);
  const politicas = empresa?.politicas || {};
  const nroRol = usuario?.rol || "Empleado";
  const limitesPorCat = (cat) => {
    const polRol = politicas[nroRol]?.[cat];
    const polGlobal = politicas["Global"]?.[cat];
    return polRol ?? polGlobal ?? null;
  };
  const violaciones = CATS.filter((c) => {
    const lim = limitesPorCat(c);
    return lim !== null && (Number(f.presupuesto[c]) || 0) > lim;
  });
  const ubic = ubics.find((u) => u.id === f.ubicacionId);
  const valido = f.cliente && f.proyecto && presTotal > 0 && f.objetivo.trim() && (deptos.length === 0 || f.departamentoId);

  const proyectos = empresa?.proyectos || [];
  const [proySel, setProyectoSel] = useState("");
  const aplicarProyecto = (id) => {
    const p = proyectos.find((x) => x.id === id);
    if (!p) { setProyectoSel(""); return; }
    setF((prev) => ({
      ...prev,
      cliente:    p.cliente   || prev.cliente,
      pedido:     "",           // se elige del selector de pedidos
      pedidoId:   "",
      proyecto:   p.nombre,
      proyectoId: p.id,
      objetivo:   p.objetivo  || prev.objetivo,
    }));
    setProyectoSel(id);
  };

  return (
    <div style={S.card}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18, borderBottom:"1px solid #e4e4e7", paddingBottom:14 }}>
        <div>
          <h2 style={{ marginTop: 0, fontSize: 17, color:"#18181b" }}>✈️ Nueva Solicitud de Viáticos</h2>
          <div style={{ fontSize:13, color:"#71717a" }}>{empresa?.nombre}</div>
        </div>
        <button style={{ ...S.btn(false), padding:"7px 14px", fontSize:13 }} onClick={onCancelar}>✕ Cancelar</button>
      </div>
      {proyectos.length === 0 && (
        <div style={{ background: "#f4f4f5", border:"1px solid #e4e4e7", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize:13, color:"#52525b" }}>
          ℹ️ No hay proyectos en el catálogo. Puedes continuar sin relacionar a un proyecto — asegúrate de llenar el campo Objetivo/Justificación con detalle.
        </div>
      )}
      {proyectos.length > 0 && (
        <div style={{ background: "#f4f4f5", borderRadius: 8, padding: "10px 14px", marginBottom: 14, border:"1px solid #e4e4e7" }}>
          <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#18181b" }}>🗂️ Relacionar con proyecto:</span>
            <ProyectoBuscador
              proyectos={proyectos.filter(p => p.activo !== false)}
              value={proySel}
              onChange={aplicarProyecto}
            />
            {proySel && (() => {
              const proy = proyectos.find((p) => p.id === proySel);
              const peds = proy?.pedidos || [];
              return peds.length > 0 ? (
                <select style={{ ...S.input, width: 200 }}
                  value={f.pedidoId || ""}
                  onChange={(e) => {
                    const ped  = peds.find((p) => p.id === e.target.value);
                    const proy = proyectos.find((p) => p.id === proySel);
                    setF((prev) => ({
                      ...prev,
                      pedidoId: e.target.value,
                      pedido:   ped?.numero   || prev.pedido,
                      cliente:  proy?.cliente || ped?.cliente || prev.cliente,
                    }));
                  }}>
                  <option value="">— selecciona pedido —</option>
                  {peds.map((p) => <option key={p.id} value={p.id}>{p.numero}{p.descripcion ? " — " + p.descripcion : ""}</option>)}
                </select>
              ) : <span style={{ fontSize: 12, color: "#71717a" }}>Sin pedidos.</span>;
            })()}
          </div>
          <div style={{ fontSize:11, color:"#71717a", marginTop:6 }}>Autocompleta cliente, pedido y objetivo. Los proyectos 📌 fijos aparecen primero.</div>
        </div>
      )}
      {/* Selector de empleado que viaja — visible si quien crea no es el empleado */}
      {(puedeAprobar(usuario) || esAdmin(usuario)) && empleadosList.length > 1 && (
        <div style={{ background:"#f4f4f5", border:"1px solid #e4e4e7", borderRadius:10, padding:"12px 16px", marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:13, color:"#18181b", marginBottom:8 }}>
            👤 Empleado que realiza el viaje
          </div>
          <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
            <select style={{ ...S.input, maxWidth:280, fontWeight:600 }}
              value={viajeroId} onChange={e => setViajeroId(e.target.value)}>
              {empleadosList.map(u => (
                <option key={u.id} value={u.id}>
                  {u.nombre} {u.id === usuario.id ? "(tú)" : ""} — {u.rol}
                </option>
              ))}
            </select>
            {viajeroId !== usuario.id && (
              <span style={{ fontSize:12, color:"#52525b" }}>
                La solicitud se creará en nombre de <b>{viajero.nombre}</b> — el empleado podrá hacer la comprobación.
              </span>
            )}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <Campo label="Departamento">
          {deptos.length ? (
            <select style={S.input} value={f.departamentoId} onChange={(e) => set("departamentoId", e.target.value)}>
              {deptos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          ) : <div style={{ fontSize: 12, color: "#B7791F", paddingTop: 8 }}>Da de alta departamentos en «⚙ Empresa y catálogo».</div>}
        </Campo>
        <Campo label="Ubicación / Oficina">
          {ubics.length ? (
            <select style={S.input} value={f.ubicacionId} onChange={(e) => set("ubicacionId", e.target.value)}>
              {ubics.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          ) : <div style={{ fontSize: 12, color: "#B7791F", paddingTop: 8 }}>Da de alta ubicaciones en «⚙ Empresa y catálogo».</div>}
        </Campo>
        <Campo label="Centro de costos">
          {(empresa?.centrosCostos || []).length ? (
            <select style={{ ...S.input, fontFamily: "ui-monospace,monospace" }} value={f.cc || depto?.cc || ""} onChange={(e) => set("cc", e.target.value)}>
              <option value="">— sin CC —</option>
              {empresa.centrosCostos.map((c) => <option key={c.clave} value={c.clave}>{c.clave}{c.nombre ? " — " + c.nombre : ""}</option>)}
            </select>
          ) : <div style={{ fontSize: 12, color: "#8A949C", paddingTop: 8 }}>Sin catálogo de CC (opcional).</div>}
          {depto?.encargado && <div style={{ fontSize: 11, color: "#54606B", marginTop: 4 }}>Encargado: <b>{depto.encargado}</b></div>}
        </Campo>
        <Campo label="Cliente" span={2}><input style={S.input} value={f.cliente} onChange={(e) => set("cliente", e.target.value)} /></Campo>
        <Campo label="Pedido de venta"><input style={S.input} value={f.pedido} onChange={(e) => set("pedido", e.target.value)} /></Campo>
        <Campo label="Proyecto" span={2}><input style={S.input} value={f.proyecto} onChange={(e) => set("proyecto", e.target.value)} /></Campo>
        <Campo label="Objetivo / Justificación del gasto *">
          <input style={{ ...S.input, borderColor: !f.objetivo.trim() ? "#B4443C" : undefined }}
            value={f.objetivo} onChange={(e) => set("objetivo", e.target.value)}
            placeholder="Describe el motivo o propósito del gasto" />
        </Campo>
        <Campo label="Origen"><input style={S.input} value={f.origen} onChange={(e) => set("origen", e.target.value)} /></Campo>
        <Campo label="Destino"><input style={S.input} value={f.destino} onChange={(e) => set("destino", e.target.value)} /></Campo>
        <div style={{ display: "flex", gap: 10 }}>
          <Campo label="Inicio"><input type="date" style={S.input} value={f.fechaInicio} onChange={(e) => set("fechaInicio", e.target.value)} /></Campo>
          <Campo label="Fin"><input type="date" style={S.input} value={f.fechaFin} onChange={(e) => set("fechaFin", e.target.value)} /></Campo>
        </div>
      </div>

      <h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.06em", color: "#54606B", marginTop: 26 }}>Presupuesto por categoría</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
        {CATS.map((c) => {
          const lim = limitesPorCat(c);
          const val = Number(f.presupuesto[c]) || 0;
          const excede = lim !== null && val > lim;
          return (
            <Campo key={c} label={c + (lim ? " (máx " + mxn(lim) + ")" : "")}>
              <input type="number" min="0"
                style={{ ...S.input, ...S.num, textAlign: "right", borderColor: excede ? "#B4443C" : undefined, background: excede ? "#FFF0EF" : "#fff" }}
                value={f.presupuesto[c]} onChange={(e) => setF({ ...f, presupuesto: { ...f.presupuesto, [c]: e.target.value } })} />
              {excede && <div style={{ fontSize: 11, color: "#B4443C", marginTop: 3 }}>⚠ Excede el límite de {mxn(lim)}</div>}
            </Campo>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 18 }}>
        <Campo label="Monto a asignar a tarjeta Clara"><input type="number" min="0" style={{ ...S.input, ...S.num, textAlign: "right" }} value={f.montoClara} onChange={(e) => set("montoClara", e.target.value)} /></Campo>
        <Campo label="Depósito en efectivo"><input type="number" min="0" style={{ ...S.input, ...S.num, textAlign: "right" }} value={f.fondoEfectivo} onChange={(e) => set("fondoEfectivo", e.target.value)} /></Campo>
        <div style={{ alignSelf: "end", textAlign: "right", ...S.num }}>
          <div style={{ fontSize: 11, ...S.label }}>Total presupuestado</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{mxn(presTotal)}</div>
        </div>
      </div>

      {violaciones.length > 0 && (
        <div style={{ background: "#f4f4f5", border: "1px solid #d4d4d8", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#52525b", fontWeight: 600 }}>
          ⚠️ Las categorías {violaciones.join(", ")} exceden los límites de política para tu rol ({nroRol}). El expediente se enviará pero el aprobador verá la alerta.
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginTop: 18, paddingTop:14, borderTop:"1px solid #e4e4e7" }}>
        <button style={{ ...S.btn(true), padding:"10px 22px" }} disabled={!valido} onClick={() => onGuardar({
          id: uid(), folio: "GV-" + new Date().getFullYear() + "-" + String(Date.now()).slice(-4),
          fechaSolicitud: hoy(),
          solicitanteId: viajeroId,
          solicitante: viajero.nombre,
          viajeroId: viajeroId,
          creadoPorId: usuario.id,
          creadoPorNombre: usuario.nombre,
          departamento: depto?.nombre || usuario.depto || "", encargado: depto?.encargado || "",
          ubicacion: ubic?.nombre || "", cc: f.cc || depto?.cc || "",
          ...f, montoClara: Number(f.montoClara) || 0, fondoEfectivo: Number(f.fondoEfectivo) || 0,
          presupuesto: Object.fromEntries(CATS.map((c) => [c, Number(f.presupuesto[c]) || 0])),
          estado: "ENVIADA", historial: [{ fecha: hoy(), quien: usuario.nombre, accion: "Solicitud enviada a aprobación" }],
          movimientos: [],
        })}>💾 Guardar y enviar a aprobación</button>
        <button style={{ ...S.btn(false), padding:"10px 18px" }} onClick={onCancelar}>✕ Cancelar</button>
        {!valido && <span style={{ alignSelf: "center", fontSize: 12, color: "#52525b" }}>Completa cliente, pedido, proyecto y al menos una categoría de presupuesto.</span>}
      </div>
    </div>
  );
}

// ---------- detalle ----------
function BotonEliminar({ folio, onConfirmar, onCancelar }) {
  const [paso, setPaso] = useState(0); // 0=btn, 1=motivo, 2=confirm
  const [motivo, setMotivo] = useState("");

  if (paso === 0) return (
    <button style={{ ...S.btn(false), fontSize:12 }}
      onClick={() => setPaso(1)}>
      🗑 Cancelar expediente
    </button>
  );

  if (paso === 1) return (
    <div style={{ display:"flex", gap:8, alignItems:"center", background:"#f4f4f5",
      border:"1px solid #e4e4e7", borderRadius:8, padding:"8px 12px", flexWrap:"wrap" }}>
      <span style={{ fontSize:12, color:"#18181b", fontWeight:700, whiteSpace:"nowrap" }}>Motivo (obligatorio):</span>
      <input style={{ flex:1, minWidth:180, border:"1px solid #d4d4d8", borderRadius:5, padding:"4px 8px", fontSize:12 }}
        value={motivo} onChange={e => setMotivo(e.target.value)}
        placeholder="Ej: Error de captura, viaje cancelado…" autoFocus />
      <button style={{ ...S.btn(true), padding:"4px 12px", fontSize:12 }}
        disabled={!motivo.trim()} onClick={() => setPaso(2)}>Siguiente</button>
      <button style={{ ...S.btn(false), padding:"4px 10px", fontSize:12 }}
        onClick={() => { setPaso(0); setMotivo(""); }}>Atrás</button>
    </div>
  );

  return (
    <div style={{ display:"flex", gap:8, alignItems:"center", background:"#FFF0EF",
      border:"1px solid #B4443C", borderRadius:8, padding:"8px 12px", flexWrap:"wrap" }}>
      <span style={{ fontSize:12, color:"#B4443C", fontWeight:700 }}>
        Confirmar cancelacion de {folio}: "{motivo}"
      </span>
      <button style={{ ...S.btn(true), background:"#B4443C", padding:"4px 12px", fontSize:12 }}
        onClick={() => onConfirmar(motivo)}>Si, cancelar</button>
      <button style={{ ...S.btn(false), padding:"4px 10px", fontSize:12 }}
        onClick={() => { setPaso(0); setMotivo(""); }}>No</button>
    </div>
  );
}

function Detalle({ sol, usuario, empresa, onVolver, onActualizar, onEliminar, onNuevoTicket }) {
  const [tab, setTab] = useState(sol.estado === "ENVIADA" && sol.tipo !== "reembolso" ? "solicitud" : "comprobacion");
  const [reporte, setReporte] = useState(null); // null | "solicitud" | "comprobacion"
  const t = calcular(sol);
  const registrar = (accion, cambios = {}) => {
    const nueva = { ...sol, ...cambios, historial: [...(sol.historial || []), { fecha: hoy(), quien: usuario.nombre, accion }] };
    onActualizar(nueva);
  };

  const exportarCSV = () => {
    const movs = (sol.movimientos || []).map((m) => ({
      Origen: m.origen === "clara" ? "Tarjeta Clara" : m.origen === "clara-reembolso" ? "Reembolso Clara" : "Externo", Fecha: m.fecha, Concepto: m.concepto,
      "Categoría": m.categoria, "Cuenta contable": cuentaDe(m, empresa, sol), "Centro de costos": sol.cc || "", Subtotal: m.subtotal, IVA: m.iva, Total: m.total,
      "¿Factura?": m.factura ? "Sí" : "No", "Folio Fiscal": m.uuid || "", "Forma de pago": m.formaPago,
      "¿Reembolso?": m.reembolso ? "Sí" : "No",
      "Aprobación Clara": m.aprobacionClara || "", "Comentarios": m.comentarioClara || "",
    }));
    const csv = Papa.unparse(movs);
    const blob = new Blob(["\uFEFF" + csv], { type:"text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = `${sol.folio}_comprobacion.csv`; a.click(); URL.revokeObjectURL(url);
  };

  if (!sol) return <div style={S.card}>Cargando expediente…</div>;
  if (reporte) return <Reporte sol={sol} t={t} tipo={reporte} empresa={empresa} onVolver={() => setReporte(null)} usuario={usuario} />;

  const tabs = [["solicitud", "Solicitud"], ["comprobacion", "Comprobación"], ["resumen", "Resumen"], ["historial", "Historial"]];
  return (
    <div>
      <button style={{ ...S.btn(false), marginBottom: 14 }} onClick={onVolver}>← Expedientes</button>
      {sol.estado === "CAPTURA" && (
        <div style={{ background:"#EEF4FF", border:"1px solid #3644AC", borderRadius:8, padding:"10px 16px", marginBottom:12, fontSize:12, color:"#1E3A8A", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          <span style={{ fontSize:16 }}>✏️</span>
          <span>Este expediente está en <b>borrador</b>. Para corregir el <b>proyecto, pedido, departamento o CC</b>, ve a la pestaña <b>"Solicitud"</b> (arriba) y usa los botones <b>✏ Editar</b>. En <b>Comprobación</b> agrega los gastos. Cuando esté listo, envíalo a aprobación.</span>
        </div>
      )}
      <div style={{ ...S.card, marginBottom: 14, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Folio texto={sol.folio} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{sol.proyecto}</div>
          <div style={{ fontSize: 12, color: "#54606B" }}>{sol.cliente} · Pedido {sol.pedido} · {sol.solicitante}</div>
        </div>
        <Chip estado={sol.estado} />
        {(sol.fechaPago || sol.saldoEstado === "recuperado") && (() => {
          const esCobrado2 = sol.saldoEstado === "recuperado" && !sol.fechaPago;
          return esCobrado2
            ? <div style={{ display:"flex", alignItems:"center", gap:6, background:"#FEE2E2", border:"2px solid #DC2626",
                borderRadius:8, padding:"4px 14px", fontWeight:800, fontSize:13, color:"#B91C1C", letterSpacing:"0.04em" }}>
                🔴 COBRADO
                <span style={{ fontSize:11, fontWeight:400, color:"#991B1B" }}>{sol.saldoFechaRecuperacion}{sol.saldoMetodo ? " · " + sol.saldoMetodo : ""}</span>
              </div>
            : <div style={{ display:"flex", alignItems:"center", gap:6, background:"#DCFCE7", border:"2px solid #16A34A",
                borderRadius:8, padding:"4px 14px", fontWeight:800, fontSize:13, color:"#15803D", letterSpacing:"0.04em" }}>
                ✅ PAGADO
                <span style={{ fontSize:11, fontWeight:400, color:"#166534" }}>{sol.fechaPago}{sol.pagadoPor ? " · " + sol.pagadoPor : ""}</span>
              </div>;
        })()}
        {/* Empleado no puede editar proyecto/pedido después de enviar */}
        {sol.tipo !== "reembolso" && sol.estado === "CAPTURA" && (
          <button style={S.btn(true)}
            onClick={() => registrar("Solicitud enviada a aprobación", { estado: "ENVIADA" })}>
            {"📤"} Enviar a aprobación
          </button>
        )}
        {sol.tipo === "reembolso" && sol.estado === "CAPTURA" && (
          <button style={S.btn(true)} disabled={!(sol.movimientos || []).length}
            title={!(sol.movimientos || []).length ? "Captura al menos un gasto en la pestaña Comprobación" : ""}
            onClick={() => registrar("Reembolso enviado a aprobación", { estado: "ENVIADA" })}>
            Enviar a aprobación {(sol.movimientos || []).length ? `(${mxn(calcular(sol).total)})` : ""}
          </button>
        )}
        {(sol.estado === "CERRADA" || sol.estado === "APROBADA") && !sol.enTesoreria && !sol.fechaPago &&
          (calcular(sol).reembolso > 0 || calcular(sol).rechazadosClara > 0 ||
           (sol.tipo === "reembolso" && sol.estado === "APROBADA")) &&
          (esContador(usuario) || esAdmin(usuario)) && (
          <button style={{ ...S.btn(true), background: "#0E7C66" }}
            onClick={() => registrar("Enviado a Tesorería para gestión de pago/cobro", {
              enTesoreria: true, fechaEnvioTesoreria: hoy(), enviadoPorTesoreria: usuario.nombre
            })}>
            🏦 Enviar a Tesorería
          </button>
        )}
        {sol.enTesoreria && !sol.fechaPago && (
          <div style={{ display:"flex", alignItems:"center", gap:8, background:"#EFF6FF",
            border:"1px solid #93C5FD", borderRadius:8, padding:"6px 14px",
            fontSize:13, color:"#1D4ED8", fontWeight:600 }}>
            🏦 En gestión de Tesorería
            <span style={{ fontSize:11, fontWeight:400, color:"#3B82F6" }}>
              desde {sol.fechaEnvioTesoreria || ""}
            </span>
          </div>
        )}
        {sol.estado === "ENVIADA" && puedeAprobar(usuario) && (
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...S.btn(true), background: "#0E7C66" }} onClick={() => registrar("Solicitud aprobada", { estado: "APROBADA", autorizador: usuario.nombre })}>Aprobar</button>
            <button style={{ ...S.btn(false), color: "#B4443C", borderColor: "#B4443C" }} onClick={() => registrar("Solicitud rechazada", { estado: "RECHAZADA", autorizador: usuario.nombre })}>Rechazar</button>
          </div>
        )}
        {sol.estado === "ENVIADA" && !puedeAprobar(usuario) && <span style={{ fontSize: 12, color: "#54606B" }}>Un aprobador debe entrar a la app para autorizarla.</span>}
        {(sol.estado === "APROBADA" || sol.estado === "COMPROBACION") && sol.tipo !== "reembolso" && (puedeAprobar(usuario) || esAdmin(usuario)) && (
          <button style={S.btn(false)} onClick={() => registrar("Expediente cerrado", { estado: "CERRADA" })}>Cerrar expediente</button>
        )}
        {sol.estado === "CERRADA" && esAdmin(usuario) && (() => {
          const tieneDescuento = sol.descuentoAplicado;
          const tienePago = !!sol.fechaPago && !sol.reembolsoEnProceso;
          const puedeReabrir = !tieneDescuento && !tienePago;
          return puedeReabrir
            ? <button style={{ ...S.btn(false), color:"#B7791F", borderColor:"#B7791F" }}
                onClick={() => registrar("Expediente reabierto por administrador", { estado: sol.tipo==="reembolso"?"APROBADA":"COMPROBACION" })}>
                ↩ Reabrir expediente
              </button>
            : <div style={{ fontSize:12, color:"#9CA3AF", padding:"6px 0" }}>
                🔒 No se puede reabrir — {tieneDescuento?"descuento de nómina ya aplicado":"pago ya registrado"}
              </div>;
        })()}
        {sol.estado === "RECHAZADA" && (sol.solicitanteId === usuario?.id || esAdmin(usuario)) && (
          <button style={{ ...S.btn(false), color: "#3644AC", borderColor: "#3644AC" }}
            onClick={() => registrar("Solicitud corregida y reenviada", { estado: "ENVIADA" })}>
            Reenviar a aprobación
          </button>
        )}
        {/* Revertir aprobación — solo Admin/Aprobador, con registro en historial */}
        {sol.estado === "APROBADA" && puedeAprobar(usuario) && (
          <button style={{ ...S.btn(false), color: "#B7791F", borderColor: "#B7791F", fontSize: 12 }}
            onClick={() => registrar("Aprobación revertida", { estado: "ENVIADA", autorizador: "" })}>
            ↩ Revertir aprobación
          </button>
        )}
        {/* Cancelar expediente — solo Admin, no si está en Tesorería, CERRADA o ya fue a aprobación */}
        {esAdmin(usuario) && !sol.enTesoreria && ["CAPTURA","RECHAZADA"].includes(sol.estado) && (
          <BotonEliminar folio={sol.folio} onConfirmar={async (motivo) => {
            // Archivar como CANCELADA con motivo — NO borrar de BD
            await onActualizar({ ...sol,
              estado: "CANCELADA",
              motivoCancelacion: motivo,
              canceladoPor: usuario.nombre,
              fechaCancelacion: hoy(),
              historial: [...(sol.historial||[]), {
                fecha: hoy(), quien: usuario.nombre,
                accion: "Expediente CANCELADO — Motivo: " + motivo
              }]
            });
            onVolver(); // Regresar a lista inmediatamente
          }} />
        )}
      </div>

      <div style={{ ...S.card, marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "10px 20px" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#54606B", textTransform: "uppercase", letterSpacing: "0.05em" }}>Reportes:</span>
        <button style={{ ...S.btn(false), fontSize: 13 }} onClick={() => setReporte("solicitud")}>PDF Solicitud</button>
        <button style={{ ...S.btn(false), fontSize: 13 }} onClick={() => setReporte("comprobacion")} disabled={!(sol.movimientos || []).length}>PDF Comprobación</button>
        <button style={{ ...S.btn(false), fontSize: 13 }} onClick={exportarCSV} disabled={!(sol.movimientos || []).length}>Exportar CSV</button>
        {onNuevoTicket && (
          <button style={{ ...S.btn(false), fontSize: 13, marginLeft: "auto", borderColor: "#3644AC", color: "#3644AC" }}
            onClick={() => {
              const ticket = {
                id: uid(),
                folio: `TK-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
                fecha: hoy(), autor: usuario.nombre, autorId: usuario.id,
                departamento: usuario.departamento || "", empresaId: sol.empresaId || "",
                asunto: `${sol.folio} — ${sol.proyecto || "Expediente"}: `,
                categoria: "Gastos / Viáticos", prioridad: "Media", descripcion: "",
                folioSolicitud: sol.folio, solicitudId: sol.id,
                asignadoId: "", asignadoNombre: "",
                estado: "Abierto",
                historial: [{ fecha: hoy(), quien: usuario.nombre, accion: `Ticket creado desde expediente ${sol.folio}` }],
                comentarios: [],
              };
              onNuevoTicket(ticket);
            }}>
            {"🎫"} Levantar ticket para este expediente
          </button>
        )}
        <button style={{ ...S.btn(false), fontSize: 13 }} onClick={() => {
          const t2 = calcular(sol);
          const cuerpo = encodeURIComponent(
`Estimado/a,

Se adjunta el ${tipo === "solicitud" ? "solicitud de viáticos" : "comprobación de gastos"} con folio ${sol.folio}.

Proyecto: ${sol.proyecto}
Cliente: ${sol.cliente} | Pedido: ${sol.pedido}
Responsable: ${sol.solicitante} | Departamento: ${sol.departamento || "—"}
Período: ${sol.fechaInicio} al ${sol.fechaFin}
Estado: ${ESTADOS[sol.estado]?.label || sol.estado}
${t2.total ? `Total comprobado: ${mxn(t2.total)}` : `Presupuesto: ${mxn(t2.presupuestoTotal)}`}
${t2.reembolso ? `Total a reembolsar: ${mxn(t2.reembolso)}` : ""}
${sol.autorizador ? `Autorizado por: ${sol.autorizador}` : "Pendiente de aprobación"}

Por favor descarga el reporte PDF de la aplicación y adjúntalo a este correo.

Saludos`);
          window.open(`mailto:${sol.autorizador ? "" : ""}?subject=Gastos ${sol.folio} — ${sol.proyecto}&body=${cuerpo}`);
        }}>{"📧"} Enviar expediente por correo</button>
        <span style={{ fontSize: 11, color: "#8A949C" }}>Descarga el PDF → se abre tu correo → adjunta PDF, XMLs y CSV del expediente.</span>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {tabs.map(([k, lbl]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: "8px 16px", border: "none", borderRadius: "8px 8px 0 0", fontWeight: 700, fontSize: 13, cursor: "pointer", background: tab === k ? "#fff" : "transparent", color: tab === k ? "#232D6B" : "#54606B", borderBottom: tab === k ? "3px solid #232D6B" : "3px solid transparent" }}>{lbl}</button>
        ))}
      </div>

      {tab === "solicitud" && <TabSolicitud sol={sol} t={t} empresa={empresa} usuario={usuario} onActualizar={onActualizar} />}
      {tab === "comprobacion" && <TabComprobacion sol={sol} usuario={usuario} empresa={empresa} registrar={registrar} />}
      {tab === "resumen" && <TabResumen sol={sol} t={t} usuario={usuario} />}
      {tab === "historial" && (
        <div style={S.card}>
          {(sol.historial || []).map((h, i) => (
            <div key={i} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid #EDEFF1", fontSize: 13 }}>
              <span style={{ ...S.num, color: "#54606B", minWidth: 90 }}>{h.fecha}</span>
              <span style={{ fontWeight: 600, minWidth: 160 }}>{h.quien}</span>
              <span>{h.accion}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabSolicitud({ sol, t, empresa, usuario, onActualizar }) {
  const esReembolso = sol.tipo === "reembolso";
  const proyectos = (empresa?.proyectos || []).filter(p => p.activo !== false);

  // Permisos de reasignación
  const puedeReasignar = (() => {
    if (sol.estado === "CERRADA") return false; // cerrado: Admin debe reabrir desde Comprobación
    if (["CAPTURA","ENVIADA"].includes(sol.estado)) return true;
    if (puedeAprobar(usuario) || esAdmin(usuario)) return true;
    return false;
  })();
  const necesitaNota = esAdmin(usuario) && sol.estado === "CERRADA";

  const [editando, setEditando] = useState(false);
  const [proyId, setProyId] = useState(sol.proyectoId || "");
  const [pedId, setPedId] = useState(sol.pedidoId || "");
  const [pedidoLibre, setPedidoLibre] = useState(sol.pedido || "");
  const [clienteLibre, setClienteLibre] = useState(sol.cliente || "");
  const [notaReasig, setNotaReasig] = useState("");

  // Fix #5: edición de departamento / CC después de crear
  const [editandoDepto, setEditandoDepto] = useState(false);
  const deptos = empresa?.departamentos || [];
  const ubics  = empresa?.ubicaciones   || [];
  const [deptoId, setDeptoId] = useState(sol.departamentoId || "");
  const [ubicId,  setUbicId]  = useState(sol.ubicacionId   || "");
  const [ccSel,   setCcSel]   = useState(sol.cc            || "");
  const puedeEditarDepto = sol.estado !== "CERRADA"
    && (puedeAprobar(usuario) || esAdmin(usuario) || sol.solicitanteId === usuario?.id);

  const guardarDepto = () => {
    const dep = deptos.find(d => d.id === deptoId);
    const ub  = ubics.find(u => u.id === ubicId);
    const ccFinal = ccSel || dep?.cc || "";
    onActualizar({
      ...sol,
      departamentoId: deptoId,
      departamento:   dep?.nombre    || sol.departamento,
      ubicacionId:    ubicId,
      ubicacion:      ub?.nombre     || sol.ubicacion,
      cc:             ccFinal,
      encargado:      dep?.encargado || sol.encargado,
      historial: [...(sol.historial||[]), { fecha: hoy(), quien: usuario.nombre,
        accion: `Depto. reasignado: ${dep?.nombre || "—"} · CC: ${ccFinal || "—"}` }]
    });
    setEditandoDepto(false);
  };

  const proySel = proyectos.find(p => p.id === proyId);
  const pedidosSel = proySel?.pedidos || [];
  const pedObj = pedidosSel.find(p => p.id === pedId);

  const guardar = () => {
    if (necesitaNota && !notaReasig.trim()) return;
    const accion = "Proyecto/pedido reasignado a: " + (proySel?.nombre || pedidoLibre || "Sin proyecto") + (pedObj ? " / " + pedObj.numero : "") + (necesitaNota ? " — Motivo: " + notaReasig : "");
    onActualizar({
      ...sol,
      proyectoId: proyId || "",
      pedidoId: pedId || "",
      proyecto: proySel ? proySel.nombre : (sol.proyecto || "Gasto de venta"),
      cliente: proySel ? (proySel.cliente || clienteLibre) : clienteLibre,
      pedido: pedObj ? pedObj.numero : pedidoLibre,
      historial: [...(sol.historial||[]), { fecha: hoy(), quien: usuario.nombre, accion }]
    });
    setEditando(false);
    setNotaReasig("");
  };

  const filas = [
    ["Objetivo", sol.objetivo],
    ["Ruta", (sol.origen || "—") + " → " + (sol.destino || "—")],
    ["Fechas", sol.fechaInicio + " al " + sol.fechaFin],
    ["Autorizador", sol.autorizador || "Pendiente"],
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <div style={S.card}>

        {/* Bloque proyecto/pedido — siempre visible, editable según permisos */}
        <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "2px solid #E3E6E9" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: "#232D6B", textTransform: "uppercase", letterSpacing: ".05em" }}>Proyecto</span>
            {puedeReasignar && !editando && (
              <button style={{ ...S.btn(false), padding: "3px 10px", fontSize: 11 }} onClick={() => setEditando(true)}>
                ✏ {sol.proyectoId || sol.pedido ? "Reasignar" : "Asignar proyecto/pedido"}
              </button>
            )}
            {!puedeReasignar && sol.estado === "CERRADA" && (
              <span style={{ fontSize: 11, color: "#8A949C" }}>Periodo cerrado</span>
            )}
          </div>

          {editando ? (
            <div style={{ display: "grid", gap: 10 }}>
              {necesitaNota && (
                <div style={{ background: "#FFF0EF", border: "1px solid #B4443C", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#B4443C", fontWeight: 600 }}>
                  ⚠ Estás reasignando un expediente <b>cerrado</b>. Esto afecta la bolsa presupuestaria. Se requiere una nota de auditoría.
                </div>
              )}
              {proyectos.length > 0 && (
                <Campo label="Proyecto del catálogo">
                  <select style={S.input} value={proyId} onChange={e => { setProyId(e.target.value); setPedId(""); }}>
                    <option value="">— sin proyecto (Gasto de venta) —</option>
                    {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre} — {p.cliente}</option>)}
                  </select>
                </Campo>
              )}
              {pedidosSel.length > 0 ? (
                <Campo label="Pedido">
                  <select style={S.input} value={pedId} onChange={e => setPedId(e.target.value)}>
                    <option value="">— sin pedido específico —</option>
                    {pedidosSel.map(p => <option key={p.id} value={p.id}>{p.numero}{p.descripcion ? " — " + p.descripcion : ""}{p.monto ? " (bolsa: " + mxn(p.monto) + ")" : ""}</option>)}
                  </select>
                </Campo>
              ) : (
                <Campo label="Número de pedido (libre)">
                  <input style={S.input} value={pedidoLibre} onChange={e => setPedidoLibre(e.target.value)} placeholder="Ej. PED-123 o déjalo vacío" />
                </Campo>
              )}
              {!proySel && (
                <Campo label="Cliente">
                  <input style={S.input} value={clienteLibre} onChange={e => setClienteLibre(e.target.value)} placeholder="Ej. Nombre del cliente" />
                </Campo>
              )}
              {necesitaNota && (
                <Campo label="Motivo de la reasignación (obligatorio para auditoría)">
                  <input style={{ ...S.input, borderColor: !notaReasig.trim() ? "#B4443C" : undefined }}
                    value={notaReasig} onChange={e => setNotaReasig(e.target.value)}
                    placeholder="Ej. Error de captura inicial, proyecto confirmado posteriormente..." />
                </Campo>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button style={S.btn(true)} onClick={guardar} disabled={necesitaNota && !notaReasig.trim()}>
                  Guardar asignación
                </button>
                <button style={S.btn(false)} onClick={() => { setEditando(false); setNotaReasig(""); }}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div>
              {[
                ["Cliente",       sol.cliente || <span style={{ color:"#8A949C", fontStyle:"italic" }}>Sin asignar</span>],
                ["Pedido de venta", sol.pedido  ? <span style={{ fontFamily:"ui-monospace,monospace", fontWeight:700, color:"#232D6B" }}>{sol.pedido}</span> : <span style={{ color:"#8A949C", fontStyle:"italic" }}>Sin asignar</span>],
                ["Proyecto",      sol.proyecto  || <span style={{ color:"#8A949C", fontStyle:"italic" }}>Sin proyecto — Gasto de venta</span>],
                ["Objetivo",      sol.objetivo],
              ].map(([a,b]) => (
                <div key={a} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid #EDEFF1", fontSize:13 }}>
                  <span style={{ color:"#54606B", fontWeight:600 }}>{a}</span><span>{b}</span>
                </div>
              ))}
              {!sol.proyectoId && !sol.pedido && (
                <div style={{ marginTop:8, fontSize:12, color:"#B7791F", background:"#FCF3E3", padding:"6px 10px", borderRadius:6 }}>
                  {"💡"} Este gasto no tiene proyecto/pedido asignado. {puedeReasignar ? 'Usa "Asignar proyecto/pedido" para ligarlo.' : "Pide a tu Gerente que lo asigne."}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bloque departamento / CC — editable */}
        <div style={{ marginBottom:14, paddingBottom:14, borderBottom:"2px solid #E3E6E9" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <span style={{ fontWeight:700, fontSize:12, color:"#232D6B", textTransform:"uppercase", letterSpacing:".05em" }}>Departamento</span>
            {puedeEditarDepto && !editandoDepto && (
              <button style={{ ...S.btn(false), padding:"3px 10px", fontSize:11 }} onClick={() => setEditandoDepto(true)}>✏ Editar</button>
            )}
          </div>
          {editandoDepto ? (
            <div style={{ display:"grid", gap:8 }}>
              {deptos.length > 0 && (
                <Campo label="Departamento">
                  <select style={S.input} value={deptoId} onChange={e => { setDeptoId(e.target.value); setCcSel(deptos.find(d=>d.id===e.target.value)?.cc||""); }}>
                    <option value="">— sin departamento —</option>
                    {deptos.map(d => <option key={d.id} value={d.id}>{d.nombre}{d.cc?" (CC: "+d.cc+")":""}</option>)}
                  </select>
                </Campo>
              )}
              {ubics.length > 0 && (
                <Campo label="Ubicación / Oficina">
                  <select style={S.input} value={ubicId} onChange={e => setUbicId(e.target.value)}>
                    <option value="">— sin ubicación —</option>
                    {ubics.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                  </select>
                </Campo>
              )}
              <Campo label="Centro de costos (CC)">
                <input style={{ ...S.input, fontFamily:"ui-monospace,monospace" }} value={ccSel}
                  onChange={e => setCcSel(e.target.value)} placeholder="Ej. ING-001" />
              </Campo>
              <div style={{ display:"flex", gap:8 }}>
                <button style={S.btn(true)} onClick={guardarDepto}>Guardar</button>
                <button style={S.btn(false)} onClick={() => setEditandoDepto(false)}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div>
              {[
                ["Departamento",   sol.departamento  || <span style={{ color:"#8A949C", fontStyle:"italic" }}>Sin asignar</span>],
                ["Ubicación",      sol.ubicacion     || <span style={{ color:"#8A949C", fontStyle:"italic" }}>Sin asignar</span>],
                ["Centro de costos", sol.cc          ? <span style={{ fontFamily:"ui-monospace,monospace", fontWeight:700 }}>{sol.cc}</span> : <span style={{ color:"#8A949C", fontStyle:"italic" }}>Sin CC</span>],
                ["Encargado",      sol.encargado     || "—"],
              ].map(([a, b]) => (
                <div key={a} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid #EDEFF1", fontSize:13 }}>
                  <span style={{ color:"#54606B", fontWeight:600 }}>{a}</span><span>{b}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resto de datos del viaje */}
        <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".05em", color:"#54606B", marginBottom:8 }}>Viaje</div>
        {filas.filter(([,v])=>v).map(([a, b]) => (
          <div key={a} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #EDEFF1", fontSize: 13 }}>
            <span style={{ color: "#54606B", fontWeight: 600 }}>{a}</span><span>{b}</span>
          </div>
        ))}
      </div>

      {esReembolso ? (
        <div style={{ ...S.card, color: "#54606B", fontSize: 13 }}>
          Solicitud de <b>reembolso directo</b>: no lleva presupuesto de viaje. El monto total sale de los gastos capturados en la pestaña Comprobación.
        </div>
      ) : (
        <div style={S.card}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={S.th}>Categoría</th><th style={{ ...S.th, textAlign: "right" }}>Presupuesto</th></tr></thead>
            <tbody>
              {CATS.map((c) => <tr key={c}><td style={S.td}>{c}</td><td style={{ ...S.td, ...S.num, textAlign: "right" }}>{mxn(t.porCat[c].presupuesto)}</td></tr>)}
              <tr><td style={{ ...S.td, fontWeight: 800 }}>TOTAL SOLICITADO</td><td style={{ ...S.td, ...S.num, textAlign: "right", fontWeight: 800 }}>{mxn(t.presupuestoTotal)}</td></tr>
            </tbody>
          </table>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:10, fontSize:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ color:"#54606B" }}>Monto a asignar a tarjeta Clara</span>
              <span style={S.num}>{mxn(sol.montoClara)}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ color:"#54606B" }}>Depósito en efectivo</span>
              <span style={S.num}>{mxn(sol.fondoEfectivo)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function TablaMovs({ movs, sol, empresa, soloLectura, onEliminarMov }) {
  const cuentaDe = (m) => {
    if (!empresa?.catalogo?.length) return "";
    const deptoMapa = (empresa.departamentos||[]).find(d => d.id === sol.departamentoId)?.mapa || {};
    return deptoMapa[m.categoria] || empresa.mapa?.[m.categoria] || "";
  };
  const grupos = [
    { label: "Tarjeta Clara (empresa)",          key: "clara",           items: movs.filter(m => m.origen === "clara" && !m.esRetiro && !m.esRechazado) },
    { label: "Retiros de efectivo Clara (fondo — se comprueba con gastos)", key: "retiros", items: movs.filter(m => m.esRetiro) },
    { label: "RECHAZADOS en Clara (a cargo del empleado — saldo en contra)", key: "rechazados", items: movs.filter(m => m.esRechazado && !m.esRetiro && !m.esComision) },
    { label: "Comisiones / cargos de servicio Clara (no son gasto del empleado)", key: "comisiones", items: movs.filter(m => m.esComision) },
    { label: "Reembolsos tramitados en Clara — ya pagados por Finanzas", key: "pagados-finanzas", items: movs.filter(m => m.aprobado && m.origen === "clara-reembolso") },

    { label: "Reembolsos tramitados en Clara",   key: "clara-reembolso", items: movs.filter(m => m.origen === "clara-reembolso" && !m.esRetiro && !m.esRechazado && !m.aprobado) },
    { label: "Gastos externos (fuera de Clara)", key: "manual",          items: movs.filter(m => m.origen !== "clara" && m.origen !== "clara-reembolso" && !m.esRetiro) },
  ].filter(g => g.items.length > 0);

  return (
    <div>
      {grupos.map(g => {
        const tot = {
          subtotal:    g.items.reduce((a,m) => a + (Number(m.subtotal)||0), 0),
          iva:         g.items.reduce((a,m) => a + (((Number(m.iva16)||0)+(Number(m.iva8)||0)) || (Number(m.iva)||0)), 0),
          isrRetenido: g.items.reduce((a,m) => a + (Number(m.isrRetenido)||0), 0),
          ivaRetenido: g.items.reduce((a,m) => a + (Number(m.ivaRetenido)||0), 0),
          ish:         g.items.reduce((a,m) => a + (Number(m.ish)||0), 0),
          propina:     g.items.reduce((a,m) => a + (Number(m.propina)||0), 0),
          totalCFDI:   g.items.reduce((a,m) => a + (Number(m.totalCFDI)||Number(m.total)||0), 0),
          total:       g.items.reduce((a,m) => a + (Number(m.total)||0), 0),
        };
        const tieneExtra = tot.isrRetenido > 0 || tot.ivaRetenido > 0 || tot.ish > 0 || tot.propina > 0 || g.items.some(m => m.tipoDiferencia);
        return (
          <div key={g.key} style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: ".05em", color: "#54606B", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
              <span>{g.label}</span>
              <span style={{ fontFamily: "ui-monospace,monospace", color: "#1D2554" }}>Total: {mxn(tot.total)}</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#F3F4FA" }}>
                    {["Fecha","Concepto","Cat.","Cta.","Subtotal","IVA",
                      ...(tieneExtra ? ["ISR ret.","IVA ret.","ISH","Propina","Total CFDI"] : []),
                      "Total","Fact.","Pago","Reimb.",""].map(h => (
                      <th key={h} style={{ ...S.th, fontSize: 10, padding: "6px 8px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {g.items.map(m => {
                    const ivaM = ((Number(m.iva16)||0) + (Number(m.iva8)||0)) || (Number(m.iva)||0);
                    // "pendiente XML" solo si tiene factura, no tiene UUID (nunca se cargó el XML) y es Clara
                    const sinXml = m.factura && !m.uuid && (m.origen === "clara" || m.origen === "clara-reembolso");
                    return (
                      <tr key={m.id} style={{ background: m.reembolso ? "#FCF3E3" : undefined }}>
                        <td style={{ ...S.td, fontSize: 11, whiteSpace: "nowrap" }}>{m.fecha}</td>
                        <td style={{ ...S.td, fontSize: 11, maxWidth: 180 }}>
                          <div style={{ fontWeight: 500 }}>{m.concepto}</div>
                          {m.emisor && <div style={{ fontSize: 9, color: "#8A949C" }}>{m.emisor}</div>}
                          {m.uuid && <div style={{ fontSize: 9, color: "#8A949C", fontFamily: "ui-monospace,monospace" }}>{m.uuid.slice(0,16) + "..."}</div>}
                          {m.archivoUrl && (
                            <a href={m.archivoUrl} target="_blank" rel="noreferrer"
                              style={{ fontSize:9, color:"#3644AC", fontWeight:600,
                                textDecoration:"none", display:"inline-block", marginTop:2 }}
                              title={m.archivoNombre||"Ver comprobante"}>
                              Ver comprobante
                            </a>
                          )}
                        </td>
                        <td style={{ ...S.td, fontSize: 11 }}>{m.categoria || "—"}</td>
                        <td style={{ ...S.td, fontSize: 10, fontFamily: "ui-monospace,monospace" }}>{cuentaDe(m) || "—"}</td>
                        <td style={{ ...S.td, ...S.num, textAlign: "right" }}>{mxn(m.subtotal || 0)}</td>
                        <td style={{ ...S.td, ...S.num, textAlign: "right" }}>
                          {sinXml
                            ? <span style={{ color: "#B7791F", fontSize: 10 }} title="Sube el XML para ver el IVA real del CFDI">pendiente XML</span>
                            : mxn(ivaM)}
                        </td>
                        {tieneExtra && (
                          <>
                            <td style={{ ...S.td, ...S.num, textAlign: "right", color: "#B4443C" }}>{m.isrRetenido > 0 ? "-" + mxn(m.isrRetenido) : "—"}</td>
                            <td style={{ ...S.td, ...S.num, textAlign: "right", color: "#B4443C" }}>{m.ivaRetenido > 0 ? "-" + mxn(m.ivaRetenido) : "—"}</td>
                            <td style={{ ...S.td, ...S.num, textAlign: "right", color: "#5B3AD4" }}>{m.ish > 0 ? mxn(m.ish) : "—"}</td>
                            <td style={{ ...S.td, ...S.num, textAlign: "right", color: "#B7791F" }}>
                              {m.propina > 0 ? mxn(m.propina)
                               : m.tipoDiferencia ? (
                                <span style={{ fontSize:9, fontWeight:700, color:"#8A5A12" }}>
                                  {m.tipoDiferencia==="propina"?"Propina":m.tipoDiferencia==="cargo_servicio"?"C.Serv.":m.tipoDiferencia==="sin_factura"?"S/Fact.":"Cargo"}
                                  {" "}{mxn(m.total)}
                                </span>
                               ) : "—"}
                            </td>
                            <td style={{ ...S.td, ...S.num, textAlign: "right" }}>{mxn(m.totalCFDI || m.total || 0)}</td>
                          </>
                        )}
                        <td style={{ ...S.td, ...S.num, textAlign: "right", fontWeight: 700 }}>{mxn(m.total || 0)}</td>
                        <td style={{ ...S.td, textAlign: "center" }}>{m.factura ? "✓" : <span style={{ color: "#B4443C" }}>No</span>}</td>
                        <td style={{ ...S.td, fontSize: 10 }}>{m.formaPago || "—"}</td>
                        <td style={{ ...S.td, textAlign: "center" }}>{m.reembolso ? <span style={{ color: "#B7791F", fontWeight: 700 }}>✓</span> : "—"}</td>
                        <td style={S.td}>
                          {!soloLectura && m.origen !== "clara" && onEliminarMov && (
                            <button style={{ border: "none", background: "none", color: "#B4443C", cursor: "pointer", fontSize: 13 }}
                              onClick={e => { e.stopPropagation(); onEliminarMov(m); }}>
                              {"🗑"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#2A3580", color: "#fff" }}>
                    <td colSpan={4} style={{ padding: "7px 10px", fontWeight: 700, fontSize: 12 }}>
                      TOTAL
                    </td>
                    <td style={{ ...S.td, ...S.num, textAlign: "right", fontWeight: 700, color: "#6EE7B7" }}>{mxn(tot.subtotal)}</td>
                    <td style={{ ...S.td, ...S.num, textAlign: "right", fontWeight: 700, color: "#6EE7B7" }}>{mxn(tot.iva)}</td>
                    {tieneExtra && (
                      <>
                        <td style={{ ...S.td, ...S.num, textAlign: "right", color: "#FCA5A5" }}>{tot.isrRetenido > 0 ? "-" + mxn(tot.isrRetenido) : "—"}</td>
                        <td style={{ ...S.td, ...S.num, textAlign: "right", color: "#FCA5A5" }}>{tot.ivaRetenido > 0 ? "-" + mxn(tot.ivaRetenido) : "—"}</td>
                        <td style={{ ...S.td, ...S.num, textAlign: "right", color: "#C4B5FD" }}>{tot.ish > 0 ? mxn(tot.ish) : "—"}</td>
                        <td style={{ ...S.td, ...S.num, textAlign: "right", color: "#FCD34D" }}>{tot.propina > 0 ? mxn(tot.propina) : "—"}</td>
                        <td style={{ ...S.td, ...S.num, textAlign: "right", color: "#fff" }}>{mxn(tot.totalCFDI)}</td>
                      </>
                    )}
                    <td style={{ ...S.td, ...S.num, textAlign: "right", fontWeight: 800, fontSize: 13, color: "#fff" }}>{mxn(tot.total)}</td>
                    <td colSpan={4}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TabComprobacion({ sol, registrar, usuario, empresa }) {
  const movs = sol.movimientos || [];
  // Bloqueado si: expediente CERRADO, o ya PAGADO/COBRADO (saldo recuperado)
  // Solo Admin puede desbloquear reabriendo el expediente
  const yaPagado    = !!sol.fechaPago;
  const yaRecuperado = sol.saldoEstado === "recuperado";
  const bloqueada = sol.estado === "CERRADA" || yaPagado || yaRecuperado;
  const gestionadoTesoreria = (yaPagado || yaRecuperado) && sol.estado === "CERRADA";
  const motivoBloqueo = sol.estado === "CERRADA" && gestionadoTesoreria
    ? "CERRADO y gestionado en Tesoreria"
    : sol.estado === "CERRADA" ? "CERRADO"
    : yaPagado    ? "PAGADO el " + sol.fechaPago
    : yaRecuperado ? "COBRADO al empleado"
    : "";

  // ── Estado del importador ──────────────────────────────────
  const [panel, setPanel]       = useState(false); // panel de importación abierto
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso]       = useState("");
  const [xmlPendientes, setXmlPendientes] = useState([]); // XMLs listos para confirmar
  const refInput = useRef(null);

  const t = calcular(sol);

  const guardarMovs = (nuevos, accion) => {
    registrar(accion, {
      movimientos: nuevos,
      estado: sol.estado === "APROBADA" ? "COMPROBACION" : sol.estado
    });
  };

  // ── Procesar cualquier archivo subido ─────────────────────
  const procesarArchivos = async (archivos) => {
    setCargando(true);
    setAviso("");
    const lista = Array.from(archivos);
    const xmls  = lista.filter(f => f.name.endsWith(".xml"));
    const zips  = lista.filter(f => f.name.endsWith(".zip"));
    const csvs  = lista.filter(f => f.name.endsWith(".csv"));

    try {
      // ZIP de Clara
      if (zips.length > 0) {
        await procesarZip(zips[0]);
        setCargando(false); return;
      }
      // Múltiples XMLs
      if (xmls.length > 0) {
        await procesarXmls(xmls);
        setCargando(false); return;
      }
      // CSV de Clara (tarjeta o reembolsos)
      if (csvs.length > 0) {
        await procesarCsv(csvs[0]);
        setCargando(false); return;
      }
      setAviso("Tipo de archivo no reconocido.");
    } catch(e) {
      setAviso("Error: " + e.message);
    }
    setCargando(false);
  };

  // ── ZIP de Clara ──────────────────────────────────────────
  const procesarZip = async (file) => {
    setAviso("Cargando JSZip…");
    // Subir ZIP original a Storage en paralelo
    const zipUrlPromise = subirArchivoStorage(sol.empresaId, sol.id, file, file.name);
    await cargarScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js", "jszip-script", () => window.JSZip);
    const zip = await window.JSZip.loadAsync(file);
    // Leer CSV
    const csvNombre = Object.keys(zip.files).find(n => n.endsWith(".csv") && !n.includes("/"));
    let csvRows = [];
    if (csvNombre) {
      const txt = await zip.files[csvNombre].async("string");
      const { data } = Papa.parse(txt, { header: true, skipEmptyLines: true });
      csvRows = data;
    }
    // Leer XMLs
    const xmlDatos = {};
    for (const [nombre, entrada] of Object.entries(zip.files)) {
      if (!nombre.endsWith(".xml")) continue;
      const txt = await entrada.async("string");
      const info = parsearXML(txt);
      if (info) xmlDatos[nombre.split("/").slice(0,-1).join("/")] = info;
    }
    // Cruzar
    const get = (r,...keys) => { for (const k of keys) if (r[k] !== undefined && String(r[k]).trim()) return String(r[k]).trim(); return ""; };
    const nuevos = [];
    csvRows.forEach(r => {
      const fecha = (get(r,"Fecha del gasto","Fecha de Transacción","Fecha") || "").replace(/\//g,"-").slice(0,10);
      if (!fecha) return;
      const estado = get(r,"Estado","Estado de aprobación");
      const fechaPagoClara = get(r,"Fecha del pago","Fecha de pago") || "";
      // RECHAZADO = rechazado por gerente → saldo en contra
      // FINANCE_REJECTED sin fecha pago = rechazado por finanzas → saldo en contra  
      // FINANCE_REJECTED con fecha pago = finanzas lo pagó manualmente → aprobado
      const esRechazadoClara = /rechaz/i.test(estado) || 
        (/FINANCE_REJECTED/i.test(estado) && !fechaPagoClara.trim());
      const yaFuePagadoPorFinanzas = /FINANCE_REJECTED/i.test(estado) && !!fechaPagoClara.trim();
      const ruta = get(r,"Ruta de archivo","ruta") || "";
      const xml = xmlDatos[ruta] || {};
      const monto = parseFloat(get(r,"Monto","Monto en MXN","Total")) || xml.total || 0;
      const cat = detectarCategoria(get(r,"Comercio","Transacción","Descripción"), get(r,"Categoria","Categoría de Compra"));
      nuevos.push({
        id: uid(), origen: "clara-reembolso", fecha,
        concepto: xml.concepto || get(r,"Comercio","Transacción","Descripción") || "Reembolso Clara",
        categoria: cat,
        subtotal: xml.subtotal || monto,
        iva:      xml.iva  || 0,
        iva16:    xml.iva16 || 0,
        iva8:     xml.iva8  || 0,
        ivaRetenido: xml.ivaRetenido || 0,
        isrRetenido: xml.isrRetenido || 0,
        ish:      xml.ish   || 0,
        propina:  xml.propina || 0,
        total: xml.total || monto,
        factura: !!xml.uuid,
        uuid: xml.uuid || get(r,"Folio Fiscal","UUID") || null,
        rfcEmisor: xml.rfcEmisor || "",
        emisor: xml.emisor || get(r,"Comercio","Transacción") || "",
        formaPago: yaFuePagadoPorFinanzas ? "Pagado por Finanzas" : "Reembolso Clara",
        reembolso: !esRechazadoClara && !yaFuePagadoPorFinanzas, // pendiente de pagar
        aprobado: yaFuePagadoPorFinanzas,  // ya fue pagado, no queda pendiente
        esRechazado: esRechazadoClara,
        aprobacionClara: estado || "",
        banco: get(r,"Nombre del banco") || "",
        cuenta: get(r,"Número de cuenta") || "",
      });
    });
    const zipUrl = await zipUrlPromise;
    if (zipUrl) console.log("[Storage] ZIP guardado:", zipUrl);
    const sinReemb = movs.filter(m => m.origen !== "clara-reembolso");
    // Asociar URL del ZIP a cada movimiento importado
    const nuevosConUrl = nuevos.map(m => ({ ...m, archivoUrl: zipUrl||null, archivoNombre: file.name }));
    guardarMovs([...sinReemb, ...nuevosConUrl], "ZIP Clara: " + nuevos.length + " reembolsos con datos fiscales");
    setPanel(false);
    setAviso("✓ " + nuevos.length + " reembolsos importados del ZIP" + (zipUrl ? " y archivo guardado." : "."));
  };

  // ── Múltiples XMLs ────────────────────────────────────────
  const procesarXmls = async (archivos) => {
    const pendientes = [];
    for (const f of archivos) {
      const txt = await leerArchivo(f, "utf-8");
      const info = parsearXML(txt);
      if (!info) continue;
      // Subir XML a Storage en paralelo con el procesamiento
      const archivoUrlPromise = subirArchivoStorage(sol.empresaId, sol.id, f, f.name);
      // Buscar movimiento existente: primero por UUID, luego por total aproximado (±1 MXN) en Clara
      const existente = movs.find(m => m.uuid && m.uuid === info.uuid)
        || movs.find(m => !m.uuid && (m.origen === "clara" || m.origen === "clara-reembolso")
            && Math.abs((Number(m.total)||0) - info.total) <= 1);
      // Si hay movimiento existente, pasar su total a parsearXML para detectar propina
      const totalClara = existente ? (Number(existente.total)||0) : null;
      const infoConPropina = totalClara !== null ? parsearXML(txt, totalClara) || info : info;
      const archivoUrl = await archivoUrlPromise;
      pendientes.push({
        id: uid(),
        nombre: f.name,
        ...infoConPropina,
        origen: "manual",
        formaPago: "Por definir",
        reembolso: false,
        factura: true,
        categoria: detectarCategoria(infoConPropina.concepto, ""),
        enriquece: existente?.id || null,
        totalClara: totalClara,
        archivoUrl: archivoUrl || null,
        archivoNombre: f.name,
      });
    }
    if (pendientes.length === 0) { setAviso("No se pudo leer ningún XML válido."); return; }
    setXmlPendientes(pendientes);
    setPanel(false);
    setAviso(pendientes.length + " XML(s) listos para revisar y confirmar.");
  };

  // Confirmar XMLs pendientes
  const confirmarXmls = () => {
    const nuevos = [...movs];
    let difMovsCreados = 0;

    const labelDif = {
      propina:        "Propina",
      cargo_servicio: "Cargo por servicio",
      sin_factura:    "Gasto sin factura",
      otro_cargo:     "Cargo adicional",
    };

    xmlPendientes.forEach(p => {
      // Calcular la diferencia real
      const difBruta = p.totalClara && p.totalClara > p.total
        ? Math.round((p.totalClara - p.total) * 100) / 100 : 0;
      const tipoDif = p.tipoDiferencia || "propina";
      const registrarDif = difBruta > 0.01 && tipoDif !== "ignorar";

      if (p.enriquece) {
        // Enriquecer movimiento existente con datos del XML (IVA SIEMPRE del XML)
        const idx = nuevos.findIndex(m => m.id === p.enriquece);
        if (idx >= 0) {
          nuevos[idx] = { ...nuevos[idx],
            subtotal: p.subtotal,
            iva: p.iva,          // IVA real del XML
            iva16: p.iva16||0, iva8: p.iva8||0,
            ivaRetenido: p.ivaRetenido||0, isrRetenido: p.isrRetenido||0,
            ish: p.ish||0,
            propina: 0,          // la propina va en movimiento separado
            total: p.total,      // total = exactamente el del CFDI
            uuid: p.uuid, rfcEmisor: p.rfcEmisor, emisor: p.emisor,
            factura: true, categoria: p.categoria,
            archivoUrl: p.archivoUrl || nuevos[idx].archivoUrl || null,
            archivoNombre: p.archivoNombre || nuevos[idx].archivoNombre || null };
        }
      } else {
        // Nuevo movimiento con datos exactos del XML
        nuevos.push({ id: p.id, origen: sol.tipo === "reembolso" ? "clara-reembolso" : "manual", fecha: p.fecha || hoy(),
          concepto: p.concepto, categoria: p.categoria,
          subtotal: p.subtotal, iva: p.iva,
          iva16: p.iva16||0, iva8: p.iva8||0,
          ivaRetenido: p.ivaRetenido||0, isrRetenido: p.isrRetenido||0,
          ish: p.ish||0, propina: 0,
          total: p.total,
          factura: true, uuid: p.uuid, rfcEmisor: p.rfcEmisor,
          emisor: p.emisor, formaPago: p.formaPago || "Por definir", reembolso: false,
          archivoUrl: p.archivoUrl || null, archivoNombre: p.archivoNombre || null });
      }

      // Crear movimiento separado para la diferencia con cuenta no deducible
      if (registrarDif) {
        // La diferencia se cargó a la tarjeta: hereda el origen del movimiento Clara relacionado
        const movRelacionado = p.enriquece ? nuevos.find(m => m.id === p.enriquece) : null;
        const origenDif = movRelacionado?.origen
          || (sol.tipo === "reembolso" ? "clara-reembolso" : (p.totalClara ? "clara" : "manual"));
        nuevos.push({
          id: uid(),
          origen: origenDif,
          fecha: p.fecha || hoy(),
          concepto: `${labelDif[tipoDif] || "Diferencia"} — ${p.emisor || p.concepto?.slice(0,25) || ""}`,
          categoria: "Otros",
          subtotal: difBruta,
          iva: 0, iva16: 0, iva8: 0,
          total: difBruta,
          factura: false,         // no deducible — no tiene CFDI propio
          uuid: null,
          formaPago: "Tarjeta Clara",
          reembolso: false,
          tipoDiferencia: tipoDif,
          refUUID: p.uuid,        // referencia al CFDI del gasto principal
        });
        difMovsCreados++;
      }
    });

    const msg = `${xmlPendientes.length} XML(s) importados${difMovsCreados ? ` + ${difMovsCreados} diferencia(s) registradas como no deducibles` : ""}`;
    guardarMovs(nuevos, msg);
    setXmlPendientes([]);
    setAviso(`✓ ${msg}`);
  };

  // ── CSV de Clara ──────────────────────────────────────────
  const procesarCsv = async (file) => {
    const txt = await leerArchivo(file, "utf-8");
    const { data, errors } = Papa.parse(txt, { header: true, skipEmptyLines: true });
    if (!data.length) { setAviso("CSV vacío o sin encabezados reconocibles."); return; }
    const get = (r,...keys) => { for (const k of keys) if (r[k] !== undefined && String(r[k]).trim()) return String(r[k]).trim(); return ""; };
    const headers = Object.keys(data[0] || {}).join("|").toLowerCase();
    const esReembolso = headers.includes("reembolso") || headers.includes("clabe")
      || headers.includes("nombre del banco") || headers.includes("número de cuenta") || headers.includes("numero de cuenta")
      || headers.includes("fecha creación de la solicitud") || headers.includes("fecha creacion de la solicitud")
      || headers.includes("método de pago") || headers.includes("metodo de pago")
      || get(data[0],"Tipo de reembolso","Tipo reembolso") !== ""
      || sol.tipo === "reembolso";
    const nuevos = []; let rechazados = 0;
    data.forEach(r => {
      let fecha = (get(r,"Fecha de Transacción","Fecha del gasto","Fecha") || "").trim();
      // Clara exporta DD/MM/YYYY — normalizar a YYYY-MM-DD
      const mFec = fecha.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
      if (mFec) fecha = `${mFec[3]}-${mFec[2]}-${mFec[1]}`;
      else fecha = fecha.replace(/\//g,"-").slice(0,10);
      if (!fecha) return;
      const estadoAprob = get(r,"Estado de aprobación","Estado");
      const fechaPagoCsv = get(r,"Fecha del pago","Fecha de pago") || "";
      const estadoCuenta = get(r, "Estado de Cuenta", "Estado de cuenta") || "";
      // Sin "Estado de Cuenta" (periodo) + Estado Rechazada = intento bloqueado por la tarjeta
      // El cargo NUNCA se aplicó → NO es saldo en contra, se descarta
      const esIntentoFallido = !estadoCuenta.trim() && /rechaz/i.test(get(r,"Estado","") );
      if (esIntentoFallido) { rechazados++; return; } // skip silencioso
      const esRechazadoClara = /rechaz/i.test(estadoAprob) ||
        (/FINANCE_REJECTED/i.test(estadoAprob) && !fechaPagoCsv.trim());
      const yaFuePagadoCsv = /FINANCE_REJECTED/i.test(estadoAprob) && !!fechaPagoCsv.trim();
      const esRechazado = esRechazadoClara;
      if (esRechazadoClara) rechazados++;
      const sub = parseFloat(get(r,"IA - Subtotal","Subtotal"));
      const iva = parseFloat(get(r,"IA - IVA $","IVA"));
      const total = parseFloat(get(r,"Monto en MXN","Monto","Total")) || 0;
      const factura = get(r,"Factura Electrónica","Factura") === "Sí";
      nuevos.push({
        id: uid(),
        origen: esReembolso ? "clara-reembolso" : "clara",
        esRechazado,
        aprobacionClara: estadoAprob || "",
        // Comisiones Clara: cargos de servicio/intereses/IVA sobre comisiones — NO son gastos del empleado
        esComision: /comisi[oó]n|cargo.*atm|atm.*cargo|iva sobre|inter[eé]s|annual.*fee|cuota.*clara|cargo.*uso.*atm/i.test(
          get(r,"Transacción","Comercio","Descripción") || ""
        ),
        // Retiro de efectivo (ATM/disposición): es fondo entregado, no gasto
        esRetiro: /retiro de efectivo|cash withdrawal|disposici[oó]n/i.test(
          (get(r,"Transacción","Comercio","Descripción") || "") + " " + (get(r,"Categoría de Compra","Categoría") || "")
        ),
        fecha,
        concepto: get(r,"Transacción","Comercio","Descripción") || "Gasto Clara",
        categoria: detectarCategoria(get(r,"Transacción","Comercio","Descripción"), get(r,"Categoría de Compra","Categoría")),
        subtotal: factura && !isNaN(sub) ? sub : total,
        iva: factura && !isNaN(iva) ? iva : 0,
        total, factura,
        uuid: (get(r,"Folio Fiscal","UUID") || "").split("|")[0].trim() || null,
        formaPago: esReembolso ? "Reembolso Clara" : "Tarjeta Clara",
        reembolso: esReembolso && !esRechazadoClara && !yaFuePagadoCsv,
        aprobado: yaFuePagadoCsv,
        aprobacionClara: get(r,"Estado de aprobación","Estado") || "",
        comentarioClara: get(r,"Descripción","Etiquetas") || "",
      });
    });
    const origen = esReembolso ? "clara-reembolso" : "clara";
    const otros = movs.filter(m => m.origen !== origen);
    guardarMovs([...otros, ...nuevos], `CSV Clara: ${nuevos.length} movimientos (${rechazados} rechazados omitidos)`);
    setPanel(false);
    setAviso((() => { const aprobados = nuevos.filter(m => !m.esRechazado).length; const pagados = nuevos.filter(m => m.aprobado).length; return `✓ ${aprobados} tramitados (${pagados} ya pagados por finanzas) + ${rechazados} rechazados (saldo en contra).`; })());
  };

  // ── Helpers ───────────────────────────────────────────────
  const parsearXML = (txt, totalClara = null) => {
    try {
      const doc = new DOMParser().parseFromString(txt, "text/xml");
      const comp = doc.querySelector("Comprobante");
      if (!comp) return null;
      const tfd  = doc.querySelector("TimbreFiscalDigital");
      const n    = (sel, attr) => parseFloat(doc.querySelector(sel)?.getAttribute(attr)) || 0;

      // Impuestos trasladados — SOLO los del resumen del comprobante.
      // Los CFDI traen los mismos impuestos 2 veces: por concepto y en el resumen;
      // sumar todos duplicaba el IVA. Se filtran los que están dentro de <Concepto>.
      let iva16 = 0, iva8 = 0, iva0 = 0;
      let nodosTras = Array.from(doc.querySelectorAll("Traslado")).filter(t => !t.closest("Concepto"));
      if (!nodosTras.length) nodosTras = Array.from(doc.querySelectorAll("Traslado")); // CFDIs sin resumen
      nodosTras.forEach(t => {
        const tasa = parseFloat(t.getAttribute("TasaOCuota")) || 0;
        const imp  = parseFloat(t.getAttribute("Importe")) || 0;
        if (Math.abs(tasa - 0.16) < 0.001) iva16 += imp;
        else if (Math.abs(tasa - 0.08) < 0.001) iva8 += imp;
        else iva0 += imp;
      });
      iva16 = Math.round(iva16 * 100) / 100;
      iva8  = Math.round(iva8  * 100) / 100;
      const ivaTotal = Math.round((iva16 + iva8) * 100) / 100;

      // Retenciones — mismo filtro anti-duplicado
      let ivaRetenido = 0, isrRetenido = 0;
      let nodosRet = Array.from(doc.querySelectorAll("Retencion")).filter(r => !r.closest("Concepto"));
      if (!nodosRet.length) nodosRet = Array.from(doc.querySelectorAll("Retencion"));
      nodosRet.forEach(r => {
        const imp = parseFloat(r.getAttribute("Importe")) || 0;
        const tipo = r.getAttribute("Impuesto") || "";
        if (tipo === "002") ivaRetenido += imp;
        else if (tipo === "001") isrRetenido += imp;
      });
      ivaRetenido = Math.round(ivaRetenido * 100) / 100;
      isrRetenido = Math.round(isrRetenido * 100) / 100;

      // Impuestos locales (ISH, etc)
      let ish = 0;
      doc.querySelectorAll("ImpuestosLocales TrasladosLocales").forEach(l => {
        ish += parseFloat(l.getAttribute("Importe")) || 0;
      });

      const subtotal  = parseFloat(comp.getAttribute("SubTotal")) || 0;
      const totalCFDI = parseFloat(comp.getAttribute("Total")) || 0;

      // Propina: diferencia entre lo que cobró Clara y el total del CFDI
      const propina = totalClara && totalClara > totalCFDI ? Math.round((totalClara - totalCFDI) * 100) / 100 : 0;

      return {
        uuid:        tfd?.getAttribute("UUID") || "",
        subtotal,
        total:       totalCFDI,
        totalConPropina: totalClara || totalCFDI,
        iva:         ivaTotal,
        iva16,
        iva8,
        iva0,
        ivaRetenido,
        isrRetenido,
        ish,
        propina,
        rfcEmisor:   doc.querySelector("Emisor")?.getAttribute("Rfc") || "",
        emisor:      doc.querySelector("Emisor")?.getAttribute("Nombre") || "",
        concepto:    doc.querySelector("Concepto")?.getAttribute("Descripcion") || "",
        fecha:       (comp.getAttribute("Fecha") || "").slice(0,10),
        formaPago:   comp.getAttribute("FormaPago") || "",
        metodoPago:  comp.getAttribute("MetodoPago") || "",
        usoCFDI:     doc.querySelector("Receptor")?.getAttribute("UsoCFDI") || "",
        rfcReceptor: doc.querySelector("Receptor")?.getAttribute("Rfc") || "",
      };
    } catch { return null; }
  };

  const leerArchivo = (file, enc="utf-8") => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => { try { res(new TextDecoder(enc).decode(r.result)); } catch { res(new TextDecoder("iso-8859-1").decode(r.result)); } };
    r.onerror = rej;
    r.readAsArrayBuffer(file);
  });

  const leerArchivoBinary = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(new Uint8Array(r.result));
    r.onerror = rej;
    r.readAsArrayBuffer(file);
  });

  const cargarScript = (src2, id, check) => new Promise((res, rej) => {
    if (check && check()) { res(); return; }
    if (document.getElementById(id)) { res(); return; }
    const s = document.createElement("script");
    s.id = id; s.src = src2;
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });

  // Fix #7: cierre de período
  const fechaCorte = empresa?.fechaCorte || null;
  const fechaBloqueada = (fecha) => {
    if (!fechaCorte || esAdmin(usuario)) return false;
    return fecha < fechaCorte;
  };

  // ── Estados de bloqueo — lógica central ─────────────────
  // SIEMPRE antes de cualquier return (regla de hooks React)
  const [motivoReapertura, setMotivoReapertura] = useState("");
  const [pedirMotivo, setPedirMotivo]           = useState(false);
  const [confirmAprobar, setConfirmAprobar]     = useState(false);
  const [confirmRechazar, setConfirmRechazar]   = useState(false);
  const [notaRechazo, setNotaRechazo]           = useState("");
  const [motivoAdmin, setMotivoAdmin]           = useState("");  // cuando Admin interviene
  const [pedirMotivoAdmin, setPedirMotivoAdmin] = useState(false);

  const esElEmpleado = sol.solicitanteId === usuario?.id;
  const esElAprobador = sol.aprobadorId === usuario?.id || puedeAprobar(usuario);
  const enGestionTesoreria = !!sol.enTesoreria || !!sol.reembolsoEnProceso;

  // Bloqueo por estado — quién puede editar la COMPROBACIÓN según estado
  // CANCELADA / CERRADA → nadie, sin excepción (ni Admin)
  const siempreBloqueado = ["CANCELADA", "CERRADA"].includes(sol.estado);
  // CAPTURA → solo el empleado (o quien tenga permiso de crear en su nombre)
  const puedeEditarCaptura = sol.estado === "CAPTURA" && (esElEmpleado || esAdmin(usuario));
  // COMPROBACION → solo el empleado
  const puedeEditarComp = sol.estado === "COMPROBACION" && esElEmpleado;
  // Admin puede intervenir en CUALQUIER estado editable, pero debe dar motivo
  const adminPuedeIntervenir = esAdmin(usuario) && !siempreBloqueado && !enGestionTesoreria;
  // ¿El usuario actual puede editar la comprobación?
  const puedeEditarAhora = puedeEditarCaptura || puedeEditarComp || adminPuedeIntervenir;
  // Bloqueo final para mostrar el formulario
  const bloqueadaPorEstado = siempreBloqueado || (!puedeEditarAhora && !enGestionTesoreria && sol.estado !== "CAPTURA")
    || (enGestionTesoreria && !esAdmin(usuario) && !esTesoreria(usuario));

  // ── Gasto manual ─────────────────────────────────────────
  const [gastoM, setGastoM] = useState({ fecha: hoy(), concepto: "", categoria: "Transporte", subtotal: "", iva: "", propina: "", factura: false, formaPago: "Efectivo", reembolso: false, uuid: null, rfcEmisor: "", emisor: "" });
  const [xmlGastoM, setXmlGastoM] = useState(null); // info del XML cargado en el gasto manual
  const refXmlGastoM = useRef(null);
  const totGasto = (parseFloat(gastoM.subtotal)||0) + (parseFloat(gastoM.iva)||0) + (parseFloat(gastoM.propina)||0);
  const agregarGasto = () => {
    if (!gastoM.concepto.trim() || !parseFloat(gastoM.subtotal)) { setAviso("Escribe el concepto y el subtotal."); return; }
    if (fechaBloqueada(gastoM.fecha)) { setAviso(`⚠ Fecha bloqueada: el período anterior al ${fechaCorte} está cerrado. Contacta al Administrador.`); return; }
    guardarMovs([...movs, { id: uid(), origen: "manual", ...gastoM,
      subtotal: parseFloat(gastoM.subtotal)||0, iva: parseFloat(gastoM.iva)||0,
      propina: parseFloat(gastoM.propina)||0,
      total: totGasto,
      uuid: gastoM.uuid || null, rfcEmisor: gastoM.rfcEmisor || "", emisor: gastoM.emisor || "" }],
      "Gasto agregado: " + gastoM.concepto);
    setGastoM({ fecha: hoy(), concepto: "", categoria: "Transporte", subtotal: "", iva: "", propina: "", factura: false, formaPago: "Efectivo", reembolso: false, uuid: null, rfcEmisor: "", emisor: "" });
    setXmlGastoM(null);
    setAviso("");
  };

  // ── Render ────────────────────────────────────────────────
  if (bloqueadaPorEstado) return (
    <div style={{ ...S.card, color: "#54606B", fontSize: 14 }}>
      <div style={{ fontWeight:700, color: sol.estado==="CANCELADA"?"#991B1B":enGestionTesoreria?"#0E7C66":"#B7791F", marginBottom:8 }}>
        {sol.estado === "CANCELADA" ? "Expediente CANCELADO"
          : enGestionTesoreria ? "En gestion de Tesoreria"
          : "Expediente en " + (ESTADOS[sol.estado]?.label || sol.estado)}
      </div>
      <div style={{ marginBottom:12 }}>
        {sol.estado === "CANCELADA"
          ? ("Cancelado por " + (sol.canceladoPor||"Admin") + " el " + (sol.fechaCancelacion||"") + " — Motivo: " + (sol.motivoCancelacion||""))
          : enGestionTesoreria
          ? "Este expediente está siendo gestionado por Tesorería. No se pueden modificar los gastos hasta que se complete o revierta la gestión."
          : "El expediente ya fue enviado a aprobación. No puedes modificar los gastos en este estado."}
      </div>
      {movs.length > 0 && <TablaMovs movs={movs} sol={sol} empresa={empresa} soloLectura />}
    </div>
  );

  if (bloqueada) return (
    <div style={{ ...S.card, color: "#54606B", fontSize: 14 }}>
      {/* Modal motivo reapertura */}
      {pedirMotivo && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"#fff", borderRadius:12, padding:24, maxWidth:400, width:"90%", boxShadow:"0 8px 40px rgba(0,0,0,.18)" }}>
            <div style={{ fontWeight:800, fontSize:15, color:"#1D2554", marginBottom:12 }}>Motivo de reapertura</div>
            <input style={{ ...S.input, marginBottom:14 }} value={motivoReapertura} onChange={e => setMotivoReapertura(e.target.value)} placeholder="Describe el motivo..." autoFocus />
            <div style={{ display:"flex", gap:10 }}>
              <button style={{ ...S.btn(true), flex:1 }} disabled={!motivoReapertura.trim()} onClick={() => {
                registrar("Expediente REABIERTO — Motivo: " + motivoReapertura.trim(), { estado:"COMPROBACION", fechaPago:null, saldoEstado:null, saldoFechaRecuperacion:null });
                setPedirMotivo(false); setMotivoReapertura("");
              }}>Confirmar reapertura</button>
              <button style={{ ...S.btn(false), flex:1 }} onClick={() => setPedirMotivo(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap", marginBottom:12 }}>
        <span style={{ fontWeight:700, color:"#232D6B", fontSize:15 }}>
          Expediente {motivoBloqueo}
        </span>
        {gestionadoTesoreria && (
          <span style={{ fontSize:12, color:"#6B7280", background:"#F3F4F6", padding:"3px 10px", borderRadius:999 }}>
            {sol.saldoMetodo || sol.pagadoPor ? "Via " + (sol.saldoMetodo || sol.pagadoPor||"") : ""}
            {sol.saldoFechaRecuperacion || sol.fechaPago ? " · " + (sol.saldoFechaRecuperacion || sol.fechaPago) : ""}
          </span>
        )}
        {(esAdmin(usuario) || esTesoreria(usuario)) && (
          <button style={{ ...S.btn(false), borderColor:"#B7791F", color:"#B7791F", fontSize:12 }}
            onClick={() => setPedirMotivo(true)}>
            Reabrir expediente
          </button>
        )}
      </div>
      {!(esAdmin(usuario) || esTesoreria(usuario)) && (
        <div style={{ fontSize:12, marginBottom:12, color:"#6B7280" }}>
          Si necesitas corregir algo, pide al Administrador o Tesorería que reabra el expediente.
        </div>
      )}
      {movs.length > 0 && <TablaMovs movs={movs} sol={sol} empresa={empresa} soloLectura />}
    </div>
  );

  // Banner de aprobación de comprobación

  const ejecutarAprobarComp = () => {
    const tc = calcular(sol);
    // Detectar si hay monto pendiente — incluir fallback para expedientes sin movimientos en Supabase
    const montoReembolso = (tc.reembolsoClaraAprobado||0) + (tc.reembolso||0)
      || (sol.tipo === "reembolso" ? (Number(sol.montoSolicitado)||0) || (Number(sol.montoClara)||0) : 0);
    const montoContra = (tc.rechazadosClara||0)
      || (sol.tipo !== "reembolso" && (Number(sol.montoClara)||0) > 0 ? Number(sol.montoClara) : 0);
    const tieneReembolso   = montoReembolso > 0.5;
    const tieneSaldoContra = montoContra > 0.5;
    const irTesoreria = tieneReembolso || tieneSaldoContra;
    registrar("Comprobacion aprobada por " + usuario.nombre + (irTesoreria ? " — enviado a Tesoreria" : " — sin movimientos pendientes"), {
      estado: "CERRADA",
      autorizador: usuario.nombre,
      enTesoreria: irTesoreria || undefined,
      fechaEnvioTesoreria: irTesoreria ? hoy() : undefined,
      enviadoPorTesoreria: irTesoreria ? usuario.nombre : undefined,
    });
    setConfirmAprobar(false);
  };

  // Banner para el EMPLEADO — enviar comprobación a revisión
  const bannerEnviarRevision = sol.estado === "COMPROBACION" && esElEmpleado && movs.length > 0 && (
    <div style={{ background:"#EDE9FE", border:"1px solid #7C3AED", borderRadius:8, padding:"12px 16px",
      display:"flex", gap:12, alignItems:"center", flexWrap:"wrap", marginBottom:14 }}>
      <div style={{ flex:1, fontSize:13, color:"#5B21B6", fontWeight:600 }}>
        Comprobacion lista. Total capturado: <b>{mxn(t.total)}</b> — Enviala al aprobador para revision.
      </div>
      <button style={{ ...S.btn(true), background:"#7C3AED" }}
        onClick={() => registrar("Comprobacion enviada a revision por " + usuario.nombre, { estado:"COMP_REVISION" })}>
        Enviar a revision
      </button>
    </div>
  );
  // Banner Admin — puede enviar a revisión en nombre del empleado si ya intervino con motivo
  const bannerEnviarRevisionAdmin = sol.estado === "COMPROBACION" && esAdmin(usuario) && !esElEmpleado && movs.length > 0 && motivoAdmin && (
    <div style={{ background:"#FFF7ED", border:"1px solid #FDE68A", borderRadius:8, padding:"12px 16px",
      display:"flex", gap:12, alignItems:"center", flexWrap:"wrap", marginBottom:14 }}>
      <div style={{ flex:1, fontSize:13, color:"#92400E", fontWeight:600 }}>
        (Admin) Enviar comprobacion a revision en nombre de {sol.solicitante}.
      </div>
      <button style={{ ...S.btn(true), background:"#B7791F" }}
        onClick={() => registrar("Comprobacion enviada a revision por ADMIN " + usuario.nombre + " (intervencion: " + motivoAdmin + ")", { estado:"COMP_REVISION" })}>
        Enviar a revision (Admin)
      </button>
    </div>
  );

  // Banner para el APROBADOR — revisar y aprobar/rechazar
  const bannerAprobacion = (sol.estado === "ENVIADA" || sol.estado === "COMP_REVISION") && puedeAprobar(usuario) && (
    <div>
      {/* Modal confirmación aprobar */}
      {confirmAprobar && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"#fff", borderRadius:12, padding:28, maxWidth:420, width:"90%", boxShadow:"0 8px 40px rgba(0,0,0,.2)" }}>
            <div style={{ fontWeight:800, fontSize:16, color:"#1D2554", marginBottom:8 }}>Confirmar aprobación</div>
            <div style={{ fontSize:13, color:"#374151", marginBottom:6 }}>Expediente: <b>{sol.folio}</b> — {sol.solicitante}</div>
            <div style={{ fontSize:13, color:"#374151", marginBottom:16 }}>Total comprobado: <b>{mxn(t.total)}</b></div>
            <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#92400E", marginBottom:20 }}>
              Al aprobar, la comprobación quedará cerrada y los montos pendientes pasarán automáticamente a Tesorería para gestión de pago o cobro.
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button style={{ ...S.btn(true), flex:1, background:"#0E7C66" }} onClick={ejecutarAprobarComp}>Confirmar aprobación</button>
              <button style={{ ...S.btn(false), flex:1 }} onClick={() => setConfirmAprobar(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal confirmación rechazar */}
      {confirmRechazar && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"#fff", borderRadius:12, padding:28, maxWidth:420, width:"90%", boxShadow:"0 8px 40px rgba(0,0,0,.2)" }}>
            <div style={{ fontWeight:800, fontSize:16, color:"#B91C1C", marginBottom:12 }}>Rechazar comprobación</div>
            <Campo label="Motivo del rechazo (obligatorio)">
              <input style={S.input} value={notaRechazo} onChange={e => setNotaRechazo(e.target.value)}
                placeholder="Indica qué debe corregir el empleado..." autoFocus />
            </Campo>
            <div style={{ display:"flex", gap:10, marginTop:14 }}>
              <button style={{ ...S.btn(true), flex:1, background:"#B91C1C" }}
                disabled={!notaRechazo.trim()}
                onClick={() => {
                  registrar("Comprobacion rechazada por " + usuario.nombre + " — " + notaRechazo.trim(), { estado:"COMPROBACION", notaRechazo: notaRechazo.trim() });
                  setConfirmRechazar(false); setNotaRechazo("");
                }}>
                Confirmar rechazo
              </button>
              <button style={{ ...S.btn(false), flex:1 }} onClick={() => setConfirmRechazar(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ background:"#E4F3EF", border:"1px solid #0E7C66", borderRadius:8, padding:"12px 16px",
        display:"flex", gap:12, alignItems:"center", flexWrap:"wrap", marginBottom:14 }}>
        <div style={{ flex:1, fontSize:13, color:"#0E7C66", fontWeight:600 }}>
          {sol.estado === "COMP_REVISION" ? "Comprobación enviada por el empleado para tu revisión." : "Pendiente de revisión."} Total: <b>{mxn(t.total)}</b>
        </div>
        <button style={{ ...S.btn(true), background:"#0E7C66" }} onClick={() => setConfirmAprobar(true)}>
          Aprobar comprobación
        </button>
        <button style={{ ...S.btn(false), color:"#B4443C", borderColor:"#B4443C" }} onClick={() => setConfirmRechazar(true)}>
          Rechazar
        </button>
      </div>
    </div>
  );

  return (
    <div>
      {bannerEnviarRevision}
      {bannerEnviarRevisionAdmin}
      {bannerAprobacion}

      {/* Botón único de importación — solo si puede editar ahora */}
      {puedeEditarComp && !enGestionTesoreria && (
        <div style={{ marginBottom:14 }}>
          <button style={{ ...S.btn(true), fontSize:13, padding:"8px 18px" }}
            onClick={() => setPanel(!panel)}>
            {"📂"} {panel ? "Cerrar importador" : "Importar de Clara"}
          </button>
          {aviso && <span style={{ marginLeft:12, fontSize:12, color: aviso.startsWith("✓") ? "#0E7C66" : "#B4443C", fontWeight:600 }}>{aviso}</span>}
        </div>
      )}

      {/* Panel de importación */}
      {panel && (
        <div style={{ ...S.card, marginBottom:14, background:"#F4F7FF", border:"1px solid #3644AC" }}>
          <div style={{ fontWeight:700, color:"#3644AC", marginBottom:10, fontSize:13 }}>
            {"📂"} Importar comprobantes
          </div>
          {cargando && <div style={{ color:"#3644AC", marginBottom:10 }}>Procesando…</div>}

          {/* Zona de drop */}
          <div
            style={{ border:"2px dashed #3644AC", borderRadius:8, padding:"24px", textAlign:"center", cursor:"pointer", marginBottom:12, background:"#fff" }}
            onClick={() => refInput.current.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); procesarArchivos(e.dataTransfer.files); }}>
<div style={{ fontSize:28, marginBottom:6 }}>{"📁"}</div>
            <div style={{ fontWeight:700, color:"#3644AC" }}>Arrastra archivos aquí o clic para seleccionar</div>
            <div style={{ fontSize:12, color:"#54606B", marginTop:4 }}>
              ZIP de Clara · XMLs (uno o varios) · CSV de tarjeta/reembolsos
            </div>
            <input ref={refInput} type="file" hidden multiple
              accept=".zip,.xml,.csv"
              onChange={e => { procesarArchivos(e.target.files); e.target.value=""; }} />
          </div>

          {/* Guía rápida */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, fontSize:12, color:"#54606B" }}>
            {[
              ["📦 ZIP de Clara","Exporta el ZIP de reembolsos desde Clara — incluye CSV + XMLs automáticamente"],
              ["📄 XML(s)","Sube uno o varios CFDI. Puedes asignar categoría a cada uno antes de confirmar"],
              ["📊 CSV Clara","El reporte de tarjeta o reembolsos descargado desde Clara"],
              ["📋 CSV","Formato seguro para movimientos y catálogos"],
            ].map(([t,d]) => (
              <div key={t} style={{ background:"#fff", borderRadius:6, padding:"8px 10px" }}>
                <div style={{ fontWeight:700 }}>{t}</div>
                <div>{d}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* XMLs pendientes de confirmar */}
      {xmlPendientes.length > 0 && (
        <div style={{ ...S.card, marginBottom:14, border:"1px solid #B7791F", background:"#FCF3E3" }}>
          <div style={{ fontWeight:700, color:"#B7791F", marginBottom:10 }}>
            Revisar y confirmar {xmlPendientes.length} XML(s)
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse", marginBottom:10 }}>
            <thead><tr>{["Archivo","Emisor","Concepto","Subtotal","IVA (XML)","Total CFDI","Clara cobró","Diferencia — clasificar","Categoría","¿Enriquece?"].map(h=><th key={h} style={{ ...S.th, fontSize:10 }}>{h}</th>)}</tr></thead>
            <tbody>
              {xmlPendientes.map((p,i) => {
                const difBruta = p.totalClara && p.totalClara > p.total
                  ? Math.round((p.totalClara - p.total) * 100) / 100 : (p.propina || 0);
                const hayDif = difBruta > 0.01;
                const tipoDif = p.tipoDiferencia || "propina";
                return (
                  <tr key={p.id} style={{ background: hayDif ? "#FFF8ED" : undefined }}>
                    <td style={{ ...S.td, fontSize:10, fontFamily:"ui-monospace,monospace" }}>{p.nombre}</td>
                    <td style={{ ...S.td, fontSize:10 }}>{p.emisor || "—"}</td>
                    <td style={{ ...S.td, fontSize:11 }}>{p.concepto?.slice(0,28) || "—"}</td>
                    <td style={{ ...S.td, ...S.num, textAlign:"right" }}>{mxn(p.subtotal)}</td>
                    <td style={{ ...S.td, ...S.num, textAlign:"right", color:"#0E7C66", fontWeight:600 }}>{mxn(p.iva)}</td>
                    <td style={{ ...S.td, ...S.num, textAlign:"right", fontWeight:700 }}>{mxn(p.total)}</td>
                    <td style={{ ...S.td, ...S.num, textAlign:"right", color: hayDif ? "#B7791F" : "#54606B" }}>
                      {p.totalClara ? mxn(p.totalClara) : "—"}
                    </td>
                    <td style={{ ...S.td, minWidth:190 }}>
                      {hayDif ? (
                        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                          <div style={{ fontWeight:700, color:"#B7791F", fontSize:11 }}>{mxn(difBruta)} a clasificar:</div>
                          <select style={{ ...S.input, padding:"2px 6px", fontSize:11 }}
                            value={tipoDif}
                            onChange={e => setXmlPendientes(prev => prev.map((x,j) => j===i
                              ? {...x, tipoDiferencia:e.target.value, propina: e.target.value!=="ignorar" ? difBruta : 0}
                              : x))}>
                            <option value="propina">{"🍽"} Propina (no deducible)</option>
                            <option value="cargo_servicio">{"💰"} Cargo por servicio (no deducible)</option>
                            <option value="sin_factura">{"🧾"} Gasto sin factura (no deducible)</option>
                            <option value="otro_cargo">{"📌"} Otro cargo relacionado</option>
                            <option value="ignorar">✕ Ignorar diferencia</option>
                          </select>
                        </div>
                      ) : <span style={{ color:"#8A949C", fontSize:11 }}>Sin diferencia</span>}
                    </td>
                    <td style={S.td}>
                      <select style={{ ...S.input, padding:"3px 6px", fontSize:11 }}
                        value={p.categoria}
                        onChange={e => setXmlPendientes(prev => prev.map((x,j) => j===i ? {...x, categoria:e.target.value} : x))}>
                        {CATS.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{ ...S.td, fontSize:10, color: p.enriquece ? "#0E7C66" : "#54606B" }}>
                      {p.enriquece ? "✓ Enriquece mov." : "Nuevo mov."}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {xmlPendientes.some(p => (p.totalClara||0) > p.total) && (
            <div style={{ fontSize:11, color:"#8A5A12", background:"#FFF8ED", border:"1px solid #B7791F", borderRadius:6, padding:"6px 10px", marginBottom:8 }}>
              {"💡"} La columna <b>Propina</b> muestra diferencias entre lo que cobró Clara y el total del CFDI. Marca la casilla para registrarla como propina no deducible.
            </div>
          )}
          <div style={{ display:"flex", gap:10 }}>
            <button style={{ ...S.btn(true) }} onClick={confirmarXmls}>
              ✓ Confirmar {xmlPendientes.length} comprobante(s)
            </button>
            <button style={S.btn(false)} onClick={() => setXmlPendientes([])}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Gasto manual — bloqueado si en Tesorería */}
      {/* Bloqueo con motivo claro por estado */}
      {(siempreBloqueado || enGestionTesoreria || (!puedeEditarComp && !puedeEditarCaptura)) && (
        <div style={{ background: sol.estado==="CANCELADA" ? "#FEE2E2"
            : enGestionTesoreria ? "#EFF6FF"
            : sol.estado==="CERRADA" ? "#F3F4F6"
            : "#FEF3C7",
          border:"1.5px solid " + (sol.estado==="CANCELADA" ? "#FCA5A5"
            : enGestionTesoreria ? "#93C5FD"
            : sol.estado==="CERRADA" ? "#D1D5DB"
            : "#B7791F"),
          borderRadius:10, padding:"12px 16px", marginBottom:14, fontSize:13, display:"flex", alignItems:"center", gap:14,
          color: sol.estado==="CANCELADA" ? "#991B1B"
            : enGestionTesoreria ? "#1D4ED8"
            : sol.estado==="CERRADA" ? "#374151"
            : "#92400E" }}>
          <div style={{ flex:1 }}>
            {sol.estado === "CANCELADA"
              ? "Expediente CANCELADO — " + (sol.motivoCancelacion||"") + " (por " + (sol.canceladoPor||"") + " el " + (sol.fechaCancelacion||"") + ")"
              : sol.estado === "CERRADA"
              ? "Expediente CERRADO. Los gastos no pueden modificarse."
              : enGestionTesoreria
              ? "En gestion de Tesoreria — sin modificaciones hasta que Tesoreria devuelva o cierre."
              : sol.estado === "COMP_REVISION"
              ? "Comprobacion enviada a revision — esperando al aprobador. No se pueden agregar gastos hasta que la revise."
              : sol.estado === "ENVIADA"
              ? "Solicitud enviada a aprobacion. No se pueden modificar datos hasta que el aprobador responda."
              : sol.estado === "APROBADA"
              ? "Solicitud aprobada. El empleado debe iniciar la comprobacion al regresar del viaje."
              : "Solo el empleado asignado puede agregar gastos en este expediente."}
          </div>
          {/* Admin puede reabrir con motivo — solo estados reversibles */}
          {esAdmin(usuario) && !siempreBloqueado && !enGestionTesoreria && (
            <button style={{ ...S.btn(false), fontSize:12, borderColor:"#B7791F", color:"#B7791F", padding:"4px 12px", whiteSpace:"nowrap" }}
              onClick={() => setPedirMotivoAdmin(true)}>
              Intervenir (Admin)
            </button>
          )}
          {(esAdmin(usuario) || esTesoreria(usuario)) && enGestionTesoreria && (
            <button style={{ ...S.btn(false), fontSize:12, borderColor:"#93C5FD", color:"#1D4ED8", padding:"4px 12px", whiteSpace:"nowrap" }}
              onClick={() => setPedirMotivo(true)}>
              Reabrir desde Tesoreria
            </button>
          )}
        </div>
      )}

      {/* Modal intervención Admin */}
      {pedirMotivoAdmin && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"#fff", borderRadius:12, padding:28, maxWidth:440, width:"90%", boxShadow:"0 8px 40px rgba(0,0,0,.2)" }}>
            <div style={{ fontWeight:800, fontSize:15, color:"#B7791F", marginBottom:8 }}>Intervencion de Administrador</div>
            <div style={{ fontSize:12, color:"#6B7280", marginBottom:14 }}>
              Estas a punto de editar el expediente <b>{sol.folio}</b> de <b>{sol.solicitante}</b> en estado <b>{sol.estado}</b>.
              Esta accion quedara registrada en el historial y se notificara al aprobador.
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={S.label}>Motivo de la intervencion (obligatorio)</label>
              <input style={S.input} value={motivoAdmin} onChange={e => setMotivoAdmin(e.target.value)}
                placeholder="Ej: Error de captura del empleado, correccion solicitada por gerencia…" autoFocus />
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button style={{ ...S.btn(true), flex:1, background:"#B7791F" }}
                disabled={!motivoAdmin.trim()}
                onClick={() => {
                  registrar("INTERVENCION ADMIN: " + motivoAdmin.trim(), {});
                  setPedirMotivoAdmin(false); setMotivoAdmin("");
                }}>
                Continuar
              </button>
              <button style={{ ...S.btn(false), flex:1 }} onClick={() => { setPedirMotivoAdmin(false); setMotivoAdmin(""); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Formulario de gasto — solo si puede editar ahora */}
      {(puedeEditarComp || (adminPuedeIntervenir && motivoAdmin)) && !enGestionTesoreria && <div style={{ ...S.card, marginBottom:14 }}>
        {esAdmin(usuario) && !esElEmpleado && (
          <div style={{ background:"#FFF7ED", border:"1px solid #FDE68A", borderRadius:6, padding:"6px 12px", marginBottom:10, fontSize:11, color:"#92400E" }}>
            Intervencion Admin — {motivoAdmin} · Cambios registrados en historial
          </div>
        )}
        <div style={{ fontWeight:700, fontSize:13, marginBottom:10, color:"#232D6B" }}>Agregar gasto externo (fuera de Clara)</div>
        <div style={{ display:"grid", gridTemplateColumns:"120px 1fr 130px 90px 70px 70px 110px auto auto", gap:8, alignItems:"end" }}>
          <Campo label="Fecha"><input type="date" style={S.input} value={gastoM.fecha} onChange={e=>setGastoM({...gastoM,fecha:e.target.value})} /></Campo>
          <Campo label="Concepto"><input style={S.input} value={gastoM.concepto} onChange={e=>setGastoM({...gastoM,concepto:e.target.value})} placeholder="Taxi, propina, estacionamiento…" /></Campo>
          <Campo label="Categoría">
            <select style={S.input} value={gastoM.categoria} onChange={e=>setGastoM({...gastoM,categoria:e.target.value})}>
              {CATS.map(c=><option key={c}>{c}</option>)}
            </select>
          </Campo>
          <Campo label="Subtotal"><input type="number" style={{ ...S.input,...S.num,textAlign:"right" }} value={gastoM.subtotal} onChange={e=>setGastoM({...gastoM,subtotal:e.target.value})} /></Campo>
          <Campo label="IVA"><input type="number" style={{ ...S.input,...S.num,textAlign:"right",background:"#F3F4FA" }} value={gastoM.iva} onChange={e=>setGastoM({...gastoM,iva:e.target.value})} /></Campo>
          <Campo label="Propina (efectivo)">
            <input type="number" min="0" step="0.01"
              style={{ ...S.input,...S.num,textAlign:"right", background: gastoM.propina ? "#FFFBEB" : "#fff", borderColor: gastoM.propina ? "#B7791F" : undefined }}
              value={gastoM.propina} placeholder="0"
              onChange={e=>setGastoM({...gastoM,propina:e.target.value})} />
          </Campo>
          <Campo label="Forma de pago">
            <select style={S.input} value={gastoM.formaPago} onChange={e=>setGastoM({...gastoM,formaPago:e.target.value})}>
              {["Efectivo","Tarjeta personal","Transferencia","Otro"].map(f=><option key={f}>{f}</option>)}
            </select>
          </Campo>
          <Campo label="Total"><div style={{ ...S.num, fontSize:14, fontWeight:700, paddingTop:8, textAlign:"right" }}>{mxn(totGasto)}</div></Campo>
          <Campo label=" "><button style={{ ...S.btn(true), whiteSpace:"nowrap" }} onClick={agregarGasto}>Agregar</button></Campo>
        </div>
        <div style={{ display:"flex", gap:16, marginTop:8, fontSize:13 }}>
          <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
            <input type="checkbox" checked={gastoM.factura} onChange={e=>{ setGastoM({...gastoM,factura:e.target.checked}); if(!e.target.checked){ setXmlGastoM(null); setGastoM(g=>({...g,uuid:null,rfcEmisor:"",emisor:"",factura:false})); }}} />
            Tiene factura (CFDI)
          </label>
          <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
            <input type="checkbox" checked={!!gastoM.tieneRecibo} onChange={e=>setGastoM({...gastoM,tieneRecibo:e.target.checked,archivoUrl:e.target.checked?gastoM.archivoUrl:null,archivoNombre:e.target.checked?gastoM.archivoNombre:null})} />
            Tiene recibo/foto
          </label>
          {gastoM.factura && (
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <input ref={refXmlGastoM} type="file" accept=".xml" hidden onChange={async e => {
                const f = e.target.files?.[0]; if (!f) return;
                const txt = await leerArchivo(f, "utf-8");
                const info = parsearXML(txt);
                if (!info) { setAviso("No se pudo leer el XML. Verifica que sea un CFDI válido."); return; }
                setXmlGastoM(info);
                setGastoM(g => ({
                  ...g,
                  concepto:   g.concepto || info.concepto || "",
                  categoria:  detectarCategoria(info.concepto, "") || g.categoria,
                  subtotal:   String(info.subtotal || ""),
                  iva:        String(info.iva || ""),
                  fecha:      info.fecha?.slice(0,10) || g.fecha,
                  factura:    true,
                  uuid:       info.uuid || null,
                  rfcEmisor:  info.rfcEmisor || "",
                  emisor:     info.emisor || "",
                }));
                setAviso("");
                e.target.value = "";
              }} />
              {!xmlGastoM
                ? <button style={{ ...S.btn(false), fontSize:12, padding:"4px 12px", color:"#3644AC", borderColor:"#3644AC" }}
                    onClick={() => refXmlGastoM.current?.click()}>
                    📎 Subir XML para autocompletar
                  </button>
                : <div style={{ display:"flex", alignItems:"center", gap:8, background:"#ECFDF5", border:"1px solid #86EFAC", borderRadius:6, padding:"4px 10px", fontSize:12 }}>
                    <span style={{ color:"#15803D", fontWeight:700 }}>✓ XML cargado</span>
                    <span style={{ color:"#166534" }}>{xmlGastoM.emisor?.slice(0,30)}</span>
                    <span style={{ fontFamily:"ui-monospace,monospace", fontSize:10, color:"#6B7280" }}>{xmlGastoM.uuid?.slice(0,16)}…</span>
                    <button style={{ border:"none", background:"none", color:"#B4443C", cursor:"pointer", fontSize:13 }}
                      onClick={() => { setXmlGastoM(null); setGastoM(g=>({...g,uuid:null,rfcEmisor:"",emisor:""})); }}>×</button>
                  </div>
              }
            </div>
          )}
          <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
            <input type="checkbox" checked={gastoM.reembolso} onChange={e=>setGastoM({...gastoM,reembolso:e.target.checked})} />
            <span style={{ color:"#B7791F", fontWeight:600 }}>Solicita reembolso</span>
          </label>
        </div>
        {aviso && !aviso.startsWith("✓") && <div style={{ fontSize:12, color:"#B4443C", marginTop:6 }}>{aviso}</div>}
      </div>}

      {/* Controles de movimientos */}
      {movs.length > 0 && (
        <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap", alignItems:"center" }}>
          <span style={{ fontSize:12, color:"#54606B", fontWeight:700 }}>{movs.length} movimiento{movs.length!==1?"s":""}</span>
          <span style={{ fontSize:12, color:"#54606B" }}>·</span>
          {["clara","clara-reembolso","manual"].map(origen => {
            const n = movs.filter(m=>m.origen===origen).length;
            if (!n) return null;
            const labels = { "clara":"Tarjeta Clara", "clara-reembolso":"Reembolsos Clara", "manual":"Gastos externos" };
            return (
              <button key={origen} style={{ ...S.btn(false), fontSize:11, padding:"3px 10px", color:"#B4443C", borderColor:"#B4443C" }}
                onClick={() => guardarMovs(movs.filter(m=>m.origen!==origen), "Movimientos eliminados: " + labels[origen])}>
                ✕ Limpiar {labels[origen]} ({n})
              </button>
            );
          })}
        </div>
      )}


      {/* Nota propina */}
      {(parseFloat(gastoM.propina)||0) > 0 && (
        <div style={{ background:"#FFFBEB", border:"1px solid #B7791F", borderRadius:8, padding:"8px 14px", marginBottom:10, fontSize:12, color:"#8A5A12" }}>
          Propina registrada como <b>gasto no deducible</b>. Asegurate de tener el comprobante de la comida/servicio que avale la operacion (no es necesario CFDI de la propina).
        </div>
      )}

      {/* Tabla de movimientos */}
      {movs.length > 0 && (
        <TablaMovs movs={movs} sol={sol} empresa={empresa}
          onEliminarMov={(m) => guardarMovs(movs.filter(x=>x.id!==m.id), "Gasto eliminado: " + m.concepto)} />
      )}
      {movs.length === 0 && (
        <div style={{ ...S.card, textAlign:"center", color:"#8A949C", padding:32 }}>
          Sin movimientos aún. Importa desde Clara o agrega gastos externos arriba.
        </div>
      )}
    </div>
  );
}


function TabResumen({ sol, t, usuario }) {
  const kpis = [
    ["Comprobado con Clara (pagado por la empresa)", t.clara],
    ["Comprobado fuera de Clara", t.manual],
    ["Reembolsos tramitados en Clara", t.reembolsoClara],
    ["— de los cuales ya aprobados en Clara", t.reembolsoClaraAprobado, "#0E7C66"],
    ["Reembolsos por pagar fuera de Clara", t.reembolso, "#B7791F"],
    ["Fondo en efectivo entregado", sol.fondoEfectivo],
    ["Retiros de efectivo de tarjeta Clara (fondo)", t.retirosClara || 0, "#3644AC"],
    ["Gastos RECHAZADOS en Clara (a cargo del empleado)", t.rechazadosClara || 0, "#B4443C"],
    ["Gastos en efectivo comprobados", t.efectivo],
    ["Saldo del fondo (negativo = a favor del empleado)", (sol.fondoEfectivo || 0) + (t.retirosClara || 0) - t.efectivo],
    ["Gastos NO DEDUCIBLES — sin CFDI, IVA no acreditable", t.sinFactura, "#B4443C"],
  ];
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {[["Subtotal", t.subtotal], ["IVA", t.iva], ["Total comprobado", t.total]].map(([lbl, v]) => (
          <div key={lbl} style={{ ...S.card, textAlign: "center" }}>
            <div style={S.label}>{lbl}</div>
            <div style={{ ...S.num, fontSize: 24, fontWeight: 800 }}>{mxn(v)}</div>
          </div>
        ))}
      </div>
      <div style={S.card}>
        <h3 style={{ marginTop: 0, fontSize: 14 }}>Presupuesto vs comprobado</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Categoría", "Presupuestado", "Comprobado", "Variación $", "Variación %"].map((h, i) => (
            <th key={h} style={{ ...S.th, textAlign: i ? "right" : "left" }}>{h}</th>))}</tr></thead>
          <tbody>
            {CATS.map((c) => {
              const p = t.porCat[c]; const dif = p.presupuesto - p.comprobado;
              return (
                <tr key={c}>
                  <td style={S.td}>{c}</td>
                  <td style={{ ...S.td, ...S.num, textAlign: "right" }}>{mxn(p.presupuesto)}</td>
                  <td style={{ ...S.td, ...S.num, textAlign: "right" }}>{mxn(p.comprobado)}</td>
                  <td style={{ ...S.td, ...S.num, textAlign: "right", color: dif < 0 ? "#B4443C" : "#1D2554" }}>{mxn(dif)}</td>
                  <td style={{ ...S.td, ...S.num, textAlign: "right" }}>{p.presupuesto ? ((dif / p.presupuesto) * 100).toFixed(1) + "%" : "—"}</td>
                </tr>
              );
            })}
            <tr>
              <td style={{ ...S.td, fontWeight: 800 }}>TOTAL</td>
              <td style={{ ...S.td, ...S.num, textAlign: "right", fontWeight: 800 }}>{mxn(t.presupuestoTotal)}</td>
              <td style={{ ...S.td, ...S.num, textAlign: "right", fontWeight: 800 }}>{mxn(t.total)}</td>
              <td style={{ ...S.td, ...S.num, textAlign: "right", fontWeight: 800, color: t.presupuestoTotal - t.total < 0 ? "#B4443C" : "#1D2554" }}>{mxn(t.presupuestoTotal - t.total)}</td>
              <td style={{ ...S.td, ...S.num, textAlign: "right", fontWeight: 800 }}>{t.presupuestoTotal ? (((t.presupuestoTotal - t.total) / t.presupuestoTotal) * 100).toFixed(1) + "%" : "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={S.card}>
        <h3 style={{ marginTop: 0, fontSize: 14 }}>Cierre financiero</h3>
        {kpis.map(([lbl, v, color]) => (
          <div key={lbl} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #EDEFF1", fontSize: 13 }}>
            <span style={{ color: "#54606B", fontWeight: 600 }}>{lbl}</span>
            <span style={{ ...S.num, fontWeight: 700, color: color || "#1D2554" }}>{mxn(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- reporte imprimible (Guardar como PDF desde el navegador) ----------
function Reporte({ sol, t, tipo, empresa, onVolver, usuario }) {
  const refPagina = useRef(null);
  const [descargado, setDescargado] = useState(false);
  const [mostrarCorreo, setMostrarCorreo] = useState(false);
  const [correoState, setCorreoState] = useState({ para: "", cc: "", mensaje: "" });
  const movs = sol.movimientos || [];
  const clara = movs.filter((m) => m.origen === "clara");
  const reembClara = movs.filter((m) => m.origen === "clara-reembolso");
  const externos = movs.filter((m) => m.origen !== "clara" && m.origen !== "clara-reembolso");

  const generarPDF = async () => {
    try {
      // Cargar librerías desde CDN
      const cargar = (src, id, check) => new Promise((res, rej) => {
        if (check()) { res(); return; }
        if (document.getElementById(id)) {
          const t0 = setInterval(() => { if (check()) { clearInterval(t0); res(); } }, 100);
          setTimeout(() => { clearInterval(t0); check() ? res() : rej(new Error("timeout " + id)); }, 8000);
          return;
        }
        const s = document.createElement("script");
        s.id = id; s.src = src;
        s.onload = () => res(); s.onerror = () => rej(new Error("no cargó " + id));
        document.head.appendChild(s);
      });
      await cargar("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js", "h2c-script", () => window.html2canvas);
      await cargar("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", "jspdf-script", () => window.jspdf?.jsPDF);

      const nodo = refPagina.current;
      if (!nodo) throw new Error("No se encontró la página del reporte");

      // Capturar el HTML tal cual se ve — escala 2 para nitidez
      const canvas = await window.html2canvas(nodo, {
        scale: 2, useCORS: true, backgroundColor: "#ffffff",
        windowWidth: nodo.scrollWidth,
      });

      // Carta: 216 × 279.4 mm con margen de 10mm
      const jsPDF = window.jspdf.jsPDF;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
      const margen = 8;
      const anchoPag = 216 - margen * 2;
      const altoPag  = 279.4 - margen * 2;

      const imgW = anchoPag;
      const imgH = (canvas.height * imgW) / canvas.width;

      // Paginar: recortar el canvas en franjas de altura de página
      const pxPorMm = canvas.width / imgW;
      const altoPagPx = Math.floor(altoPag * pxPorMm);
      let yPx = 0, primera = true;

      while (yPx < canvas.height) {
        const franjaAlto = Math.min(altoPagPx, canvas.height - yPx);
        const franja = document.createElement("canvas");
        franja.width = canvas.width;
        franja.height = franjaAlto;
        franja.getContext("2d").drawImage(canvas, 0, yPx, canvas.width, franjaAlto, 0, 0, canvas.width, franjaAlto);
        const franjaH = franjaAlto / pxPorMm;
        if (!primera) doc.addPage();
        doc.addImage(franja.toDataURL("image/jpeg", 0.92), "JPEG", margen, margen, imgW, franjaH);
        yPx += franjaAlto;
        primera = false;
      }

      doc.save(`${sol.folio}_${tipo}.pdf`);
      setDescargado(true);
    } catch(e) { console.error(e); alert("Error al generar PDF: " + e.message); }
  };

  const abrirPanelCorreo = () => {
    const totalTexto = t.total ? `Total comprobado: ${mxn(t.total)}` : `Presupuesto solicitado: ${mxn(t.presupuestoTotal)}`;
    const reembolsoTexto = t.reembolso > 0 ? `\nTotal a reembolsar: ${mxn(t.reembolso)}` : "";
    const estado = ESTADOS[sol.estado]?.label || sol.estado;
    setCorreoState({
      para: "",
      cc: sol.solicitante || "",
      mensaje:
`Estimado/a,

Por medio del presente le comparto ${titulo.toLowerCase()} con folio ${sol.folio}.

Datos del expediente:
• Proyecto: ${sol.proyecto || sol.objetivo || "—"}
• Cliente: ${sol.cliente || "—"} | Pedido: ${sol.pedido || "—"}
• Responsable: ${sol.solicitante} | Departamento: ${sol.departamento || "—"}
• Período: ${sol.fechaInicio} al ${sol.fechaFin}
• Estado: ${estado}
• ${totalTexto}${reembolsoTexto}
${sol.autorizador ? `• Autorizado por: ${sol.autorizador}` : "• Pendiente de aprobación"}

Favor de revisar el reporte PDF adjunto.

Quedo a sus órdenes.

${usuario?.nombre || sol.solicitante}
${empresa?.nombre || ""}`,
    });
    setMostrarCorreo(true);
  };

  const enviarCorreo = () => {
    const asunto = encodeURIComponent(`${titulo} — ${sol.folio} — ${sol.proyecto || sol.objetivo || ""}`);
    const para = encodeURIComponent(correoState.para);
    const cc = encodeURIComponent(correoState.cc);
    const body = encodeURIComponent(correoState.mensaje);
    window.open(`mailto:${para}?cc=${cc}&subject=${asunto}&body=${body}`);
  };

  const P = {
    pagina: { background: "#fff", color: "#111", maxWidth: 820, margin: "0 auto", padding: "36px 44px", fontFamily: "'Avenir Next','Segoe UI',system-ui,sans-serif", fontSize: 12 },
    h: { display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "3px solid #232D6B", paddingBottom: 8, marginBottom: 16 },
    sec: { fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#232D6B", borderBottom: "1px solid #232D6B", margin: "18px 0 8px", paddingBottom: 3 },
    fila: { display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px dotted #D5D9DC" },
    th: { textAlign: "left", padding: "5px 6px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", borderBottom: "1.5px solid #232D6B" },
    td: { padding: "4px 6px", fontSize: 11, borderBottom: "1px solid #E8EAEC", verticalAlign: "top" },
    num: { fontVariantNumeric: "tabular-nums", textAlign: "right" },
    firma: { textAlign: "center", fontSize: 11, paddingTop: 42 },
  };
  const Dato = ({ a, b }) => <div style={P.fila}><span style={{ fontWeight: 700, color: "#3C4852" }}>{a}</span><span>{b || "—"}</span></div>;
  const esReembolso = sol.tipo === "reembolso";
  const titulo = esReembolso
    ? (tipo === "solicitud" ? "SOLICITUD DE REEMBOLSO" : "COMPROBACIÓN DE REEMBOLSO")
    : (tipo === "solicitud" ? "SOLICITUD DE VIÁTICOS" : "COMPROBACIÓN DE GASTOS DE VIAJE");

  return (
    <div>
      <style>{`@media print { .no-imprimir { display: none !important; } body { background: #fff; } }`}</style>

      {/* Barra de acciones */}
      <div className="no-imprimir" style={{ ...S.card, marginBottom: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "12px 18px" }}>
        <button style={S.btn(false)} onClick={onVolver}>← Volver</button>
        <button style={S.btn(true)} onClick={generarPDF}>⬇ Descargar PDF</button>
        <button style={{ ...S.btn(false), color: "#3644AC", borderColor: "#3644AC" }} onClick={abrirPanelCorreo}>{"📧"} Enviar este PDF por correo</button>
        {descargado && <span style={{ fontSize: 12, color: "#0E7C66", fontWeight: 700 }}>✓ PDF descargado</span>}
      </div>

      {/* Panel de correo */}
      {mostrarCorreo && (
        <div className="no-imprimir" style={{ ...S.card, marginBottom: 14, border: "1px solid #3644AC" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: "#3644AC" }}>{"📧"} Redactar correo</h3>
            <button style={{ border: "none", background: "none", cursor: "pointer", fontSize: 18, color: "#54606B" }} onClick={() => setMostrarCorreo(false)}>×</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <Campo label="Para (correos separados por coma)">
              <input style={S.input} value={correoState.para} onChange={(e) => setCorreoState({ ...correoState, para: e.target.value })} placeholder="autorizador@empresa.com" />
            </Campo>
            <Campo label="CC">
              <input style={S.input} value={correoState.cc} onChange={(e) => setCorreoState({ ...correoState, cc: e.target.value })} placeholder="contabilidad@empresa.com" />
            </Campo>
          </div>
          <Campo label="Mensaje (editable)">
            <textarea style={{ ...S.input, height: 220, resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }}
              value={correoState.mensaje} onChange={(e) => setCorreoState({ ...correoState, mensaje: e.target.value })} />
          </Campo>
          <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
            <button style={S.btn(true)} onClick={enviarCorreo}>Abrir en mi correo</button>
            <span style={{ fontSize: 12, color: "#54606B" }}>Se abre tu cliente de correo con este mensaje. Adjunta el reporte descargado antes de enviar.</span>
          </div>
        </div>
      )}

      <div ref={refPagina} style={{ ...P.pagina, position:"relative" }}>
      {/* Sello PAGADO/COBRADO en PDF */}
      {(sol.fechaPago || sol.saldoEstado === "recuperado") && (() => {
        const esCobrado = sol.saldoEstado === "recuperado" && !sol.fechaPago;
        const color = esCobrado ? "#B91C1C" : "#15803D";
        const texto = esCobrado ? "COBRADO" : "PAGADO";
        return (
          <div style={{ position:"absolute", top:"40%", left:"50%",
            transform:"translate(-50%,-50%) rotate(-28deg)",
            border:`5px solid ${color}`, borderRadius:6,
            padding:"8px 24px", color, fontSize:56, fontWeight:900,
            opacity:0.18, letterSpacing:"0.12em",
            pointerEvents:"none", userSelect:"none", whiteSpace:"nowrap", zIndex:10,
            fontFamily:"Arial,sans-serif", textShadow:`0 0 1px ${color}` }}>
            {texto}
          </div>
        );
      })()}
        <div style={P.h}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {empresa?.logo && <img src={empresa.logo} alt="logo" style={{ height: 44, objectFit: "contain" }} />}
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#232D6B" }}>{titulo}</div>
              <div style={{ fontSize: 11, color: "#54606B" }}>{empresa?.nombre || ""}{empresa?.rfc ? " · RFC " + empresa.rfc : ""}{sol.departamento ? " · " + sol.departamento : ""}</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "ui-monospace,monospace", fontWeight: 800, fontSize: 14, border: "1.5px solid #232D6B", padding: "2px 10px", borderRadius: 4 }}>{sol.folio}</div>
            <div style={{ fontSize: 10, color: "#54606B", marginTop: 3 }}>Fecha de solicitud: {sol.fechaSolicitud}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 30px" }}>
          <div>
            <div style={P.sec}>Proyecto</div>
            <Dato a="Cliente" b={sol.cliente} />
            <Dato a="Pedido de venta" b={sol.pedido} />
            <Dato a="Proyecto" b={sol.proyecto} />
            <Dato a="Objetivo" b={sol.objetivo} />
          </div>
          <div>
            <div style={P.sec}>Viaje</div>
            <Dato a="Responsable" b={sol.solicitante} />
            <Dato a="Ruta" b={(sol.origen || "—") + " → " + (sol.destino || "—")} />
            <Dato a="Fechas" b={sol.fechaInicio + " al " + sol.fechaFin} />
            <Dato a="Departamento / Ubicación" b={(sol.departamento || "—") + " / " + (sol.ubicacion || "—")} />
            <Dato a="Centro de costos" b={sol.cc} />
            <Dato a="Encargado de departamento" b={sol.encargado} />
            <Dato a="Autorizador" b={sol.autorizador || "Pendiente"} />
          </div>
        </div>

        {tipo === "solicitud" && (
          <>
            <div style={P.sec}>Presupuesto solicitado</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={P.th}>Categoría</th><th style={{ ...P.th, textAlign: "right" }}>Monto</th></tr></thead>
              <tbody>
                {CATS.map((c) => <tr key={c}><td style={P.td}>{c}</td><td style={{ ...P.td, ...P.num }}>{mxn(t.porCat[c].presupuesto)}</td></tr>)}
                <tr><td style={{ ...P.td, fontWeight: 800 }}>TOTAL SOLICITADO</td><td style={{ ...P.td, ...P.num, fontWeight: 800 }}>{mxn(t.presupuestoTotal)}</td></tr>
              </tbody>
            </table>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 30px", marginTop: 10 }}>
              <Dato a="Monto a asignar a tarjeta Clara" b={mxn(sol.montoClara)} />
              <Dato a="Depósito en efectivo" b={mxn(sol.fondoEfectivo)} />
            </div>
          </>
        )}

        {tipo === "comprobacion" && (
          <>
            {[["Gastos pagados con tarjeta Clara", clara], ["Reembolsos tramitados en Clara", reembClara], ["Gastos externos", externos]].map(([tit, lista]) => lista.length > 0 && (
              <div key={tit}>
                <div style={P.sec}>{tit}</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    <th style={P.th}>Fecha</th><th style={P.th}>Concepto</th><th style={P.th}>Categoría</th><th style={P.th}>Cuenta</th>
                    <th style={{ ...P.th, textAlign: "right" }}>Subtotal</th><th style={{ ...P.th, textAlign: "right" }}>IVA</th>
                    <th style={{ ...P.th, textAlign: "right" }}>Total</th><th style={P.th}>Factura</th><th style={P.th}>Reemb.</th>
                  </tr></thead>
                  <tbody>
                    {lista.map((m) => (
                      <tr key={m.id}>
                        <td style={{ ...P.td, whiteSpace: "nowrap" }}>{m.fecha}</td>
                        <td style={P.td}>{m.concepto}
                        {m.uuid && <div style={{ fontSize: 8.5, color: "#7A848C", fontFamily: "ui-monospace,monospace" }}>{m.uuid}</div>}
                        {m.comentarioClara && <div style={{ fontSize: 9, color: "#3644AC", fontStyle: "italic" }}>{m.comentarioClara}</div>}
                        {m.aprobacionClara && <div style={{ fontSize: 9, fontWeight: 700 }}>Clara: {m.aprobacionClara}</div>}
                      </td>
                        <td style={P.td}>{m.categoria}</td>
                        <td style={{ ...P.td, fontFamily: "ui-monospace,monospace", fontSize: 10 }}>{cuentaDe(m, empresa, sol) || "—"}</td>
                        <td style={{ ...P.td, ...P.num }}>{mxn(m.subtotal)}</td>
                        <td style={{ ...P.td, ...P.num }}>{mxn(m.iva)}</td>
                        <td style={{ ...P.td, ...P.num, fontWeight: 700 }}>{mxn(m.total)}</td>
                        <td style={P.td}>{m.factura ? "Sí" : "No"}</td>
                        <td style={P.td}>{m.reembolso ? "Sí" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            <div style={P.sec}>Presupuesto vs comprobado</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={P.th}>Categoría</th><th style={{ ...P.th, textAlign: "right" }}>Presupuestado</th>
                <th style={{ ...P.th, textAlign: "right" }}>Comprobado</th><th style={{ ...P.th, textAlign: "right" }}>Variación</th>
              </tr></thead>
              <tbody>
                {CATS.map((c) => (
                  <tr key={c}>
                    <td style={P.td}>{c}</td>
                    <td style={{ ...P.td, ...P.num }}>{mxn(t.porCat[c].presupuesto)}</td>
                    <td style={{ ...P.td, ...P.num }}>{mxn(t.porCat[c].comprobado)}</td>
                    <td style={{ ...P.td, ...P.num }}>{mxn(t.porCat[c].presupuesto - t.porCat[c].comprobado)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ ...P.td, fontWeight: 800 }}>TOTAL</td>
                  <td style={{ ...P.td, ...P.num, fontWeight: 800 }}>{mxn(t.presupuestoTotal)}</td>
                  <td style={{ ...P.td, ...P.num, fontWeight: 800 }}>{mxn(t.total)}</td>
                  <td style={{ ...P.td, ...P.num, fontWeight: 800 }}>{mxn(t.presupuestoTotal - t.total)}</td>
                </tr>
              </tbody>
            </table>

            <div style={P.sec}>Cierre financiero</div>
            <Dato a="Subtotal comprobado" b={mxn(t.subtotal)} />
            <Dato a="IVA comprobado" b={mxn(t.iva)} />
            <Dato a="Total comprobado" b={mxn(t.total)} />
            <Dato a="Pagado con tarjeta Clara (empresa)" b={mxn(t.clara)} />
            <Dato a="Gastos externos" b={mxn(t.manual)} />
            <Dato a="Reembolsos tramitados en Clara" b={mxn(t.reembolsoClara)} />
            <Dato a="— de los cuales ya aprobados en Clara" b={mxn(t.reembolsoClaraAprobado)} />
            <Dato a="Reembolsos por pagar fuera de Clara" b={mxn(t.reembolso)} />
            <Dato a="Fondo en efectivo entregado" b={mxn(sol.fondoEfectivo)} />
            <Dato a="Saldo del fondo (negativo = a favor del empleado)" b={mxn((sol.fondoEfectivo || 0) - t.efectivo)} />
            <Dato a="Gastos NO DEDUCIBLES (sin CFDI, IVA no acreditable)" b={mxn(t.sinFactura)} />
            {t.ivaRetenido>0 && <Dato a="IVA retenido" b={mxn(t.ivaRetenido)} />}
            {t.isrRetenido>0 && <Dato a="ISR retenido" b={mxn(t.isrRetenido)} />}
            {t.ish>0 && <Dato a="ISH (Impuesto sobre hospedaje)" b={mxn(t.ish)} />}
            {t.propinas>0 && <Dato a="Propinas (no deducibles)" b={mxn(t.propinas)} />}
            {/* Saldos: en contra Y a favor, con compensación si aplica */}
            {(() => {
              const saldoEfectivo = Math.max(0, (sol.fondoEfectivo||0) + (t.retirosClara||0) - t.efectivo);
              const saldoRechazados = t.rechazadosClara || 0;
              const totalSaldoContra = saldoEfectivo + saldoRechazados;
              const totalSaldoFavor = t.reembolsoClaraAprobado || 0;
              const montoCruce = Math.min(sol.montoCruceContra||0, sol.montoCruceReemb||0);
              const totalSaldo = totalSaldoContra; // para compatibilidad
              const tieneContra = totalSaldoContra > 0.5;
              const tieneFavor = totalSaldoFavor > 0.5;
              if (!tieneContra && !tieneFavor) return null;
              const netoFinal = totalSaldoFavor - totalSaldoContra;
              return (
                <div style={{ marginTop:12, display:"grid", gap:8 }}>
                  {tieneFavor && (
                    <div style={{ padding:"10px 14px", background:"#F0FDF4", border:"1.5px solid #86EFAC", borderRadius:6 }}>
                      <div style={{ fontWeight:800, color:"#15803D", fontSize:12, marginBottom:6, textTransform:"uppercase", letterSpacing:".05em" }}>
                        ✓ Saldo a favor del empleado — A pagar por la empresa
                      </div>
                      <Dato a="Reembolsos aprobados pendientes de pago" b={<b style={{color:"#15803D"}}>{mxn(totalSaldoFavor)}</b>} />
                    </div>
                  )}
                  {tieneContra && (
                    <div style={{ padding:"10px 14px", background:"#FFF1F2", border:"1.5px solid #F87171", borderRadius:6 }}>
                      <div style={{ fontWeight:800, color:"#B91C1C", fontSize:12, marginBottom:6, textTransform:"uppercase", letterSpacing:".05em" }}>
                        ⚠ Saldo en contra — A cargo del empleado
                      </div>
                      {saldoRechazados > 0 && <Dato a="Gastos rechazados en Clara (a devolver)" b={<b style={{color:"#B91C1C"}}>{mxn(saldoRechazados)}</b>} />}
                      {saldoEfectivo > 0 && <Dato a="Efectivo no comprobado (a devolver)" b={<b style={{color:"#B91C1C"}}>{mxn(saldoEfectivo)}</b>} />}
                    </div>
                  )}
                  {tieneContra && tieneFavor && (
                    <div style={{ padding:"10px 14px", background:"#F8FAFF", border:"1.5px solid #C6D0E8", borderRadius:6 }}>
                      <div style={{ fontWeight:800, fontSize:12, marginBottom:6, textTransform:"uppercase", letterSpacing:".05em", color:"#232D6B" }}>
                        Posición neta
                      </div>
                      <Dato a="Saldo a favor" b={mxn(totalSaldoFavor)} />
                      <Dato a="Saldo en contra" b={mxn(totalSaldoContra)} />
                      <div style={{ display:"flex", justifyContent:"space-between", fontWeight:800,
                        borderTop:"1px solid #C6D0E8", paddingTop:4, marginTop:4,
                        color: netoFinal >= 0 ? "#15803D" : "#B91C1C" }}>
                        <span>{netoFinal >= 0 ? "NETO A PAGAR AL EMPLEADO" : "NETO A COBRAR AL EMPLEADO"}</span>
                        <span>{mxn(Math.abs(netoFinal))}</span>
                      </div>
                      {montoCruce > 0 && (
                        <div style={{ marginTop:6, fontSize:11, color:"#6B7280" }}>
                          Compensación registrada: {mxn(montoCruce)} · {sol.saldoFechaRecuperacion||""}
                        </div>
                      )}
                    </div>
                  )}
                  {!tieneFavor && tieneContra && (
                    <div style={{ display:"flex", justifyContent:"space-between", fontWeight:800,
                      padding:"6px 14px", color:"#B91C1C" }}>
                      <span>TOTAL A DEVOLVER</span><span>{mxn(totalSaldoContra)}</span>
                    </div>
                  )}
                  {!tieneContra && tieneFavor && (
                    <div style={{ display:"flex", justifyContent:"space-between", fontWeight:800,
                      padding:"6px 14px", color:"#15803D" }}>
                      <span>TOTAL A PAGAR AL EMPLEADO</span><span>{mxn(totalSaldoFavor)}</span>
                    </div>
                  )}
                </div>
              );
            })()}
            {/* Datos bancarios de reembolso — aplica si hay reembolso manual O reembolso Clara sin aprobar */}
            {(t.reembolso > 0 || t.reembolsoClara > t.reembolsoClaraAprobado) && (() => {
              const totalReemb = t.reembolso + Math.max(0, t.reembolsoClara - t.reembolsoClaraAprobado);
              // Buscar datos del solicitante (puede ser otro usuario, no el usuario actual)
              const solicitanteUser = usuario?.id === sol.solicitanteId ? usuario : null;
              const tieneBanco = solicitanteUser?.banco && solicitanteUser?.clabe;
              return (
                <div style={{ marginTop:16, padding:"12px 14px", background:"#E9EEF8", borderRadius:8, border:"1px solid #3644AC" }}>
                  <div style={{ fontWeight:700, fontSize:12, color:"#3644AC", marginBottom:4 }}>
                    {"💳"} Datos bancarios para reembolso
                  </div>
                  <div style={{ fontSize:12, color:"#3644AC", marginBottom:8 }}>
                    {t.reembolso > 0 && <span>Gastos de bolsillo a reembolsar: <b>{mxn(t.reembolso)}</b></span>}
                    {t.reembolso > 0 && t.reembolsoClara > t.reembolsoClaraAprobado && <span> · </span>}
                    {t.reembolsoClara > t.reembolsoClaraAprobado && <span>Reembolsos Clara pendientes: <b>{mxn(t.reembolsoClara - t.reembolsoClaraAprobado)}</b></span>}
                    <span style={{ marginLeft:8, fontWeight:800 }}>Total: {mxn(totalReemb)}</span>
                  </div>
                  {tieneBanco ? (
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4px 20px", fontSize:12 }}>
                      <Dato a="Banco" b={solicitanteUser.banco} />
                      <Dato a="Titular" b={solicitanteUser.titularCuenta} />
                      <Dato a="CLABE" b={<span style={{ fontFamily:"ui-monospace,monospace" }}>{solicitanteUser.clabe}</span>} />
                      {solicitanteUser.cuentaBanco && <Dato a="No. cuenta" b={solicitanteUser.cuentaBanco} />}
                      {solicitanteUser.rfc && <Dato a="RFC" b={solicitanteUser.rfc} />}
                    </div>
                  ) : (
                    <div style={{ color:"#B4443C", fontSize:12, fontWeight:700 }}>
                      ⚠ {sol.solicitante} no tiene datos bancarios registrados en Mi Perfil. Debe completarlos para que finanzas pueda procesar el reembolso.
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        )}

        {/* Datos bancarios para reembolso — solo en comprobación */}
        {tipo === "comprobacion" && sol.datosBancarios?.clabe && (
          <div style={{ marginTop: 16, padding: "8px 14px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 6, fontSize: 10 }}>
            <b style={{ color: "#15803D" }}>DATOS BANCARIOS PARA REEMBOLSO: </b>
            Banco: {sol.datosBancarios.banco||"—"} · CLABE: {sol.datosBancarios.clabe} · Titular: {sol.datosBancarios.titularCuenta||sol.solicitante}
            {sol.datosBancarios.cuentaBanco ? " · Cta: " + sol.datosBancarios.cuentaBanco : ""}
            {sol.notaTesoreria ? " · Ref pago: " + sol.notaTesoreria : ""}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 30 }}>
          {/* Solicitante — sello cuando ya envió a aprobación (cualquier tipo) */}
          <div style={P.firma}>
            {["ENVIADA","APROBADA","COMPROBACION","CERRADA"].includes(sol.estado) && sol.solicitante
              ? <div style={{ border: "2px solid #3644AC", borderRadius: 8, padding: "6px 20px", color: "#3644AC", fontWeight: 800, fontSize: 13, display: "inline-block", transform: "rotate(-2deg)", marginBottom: 8 }}>
                  ✓ {sol.solicitante}
                </div>
              : <span>_______________________________</span>}
            <br />{sol.solicitante}<br /><b>{tipo === "solicitud" ? "Solicitante" : "Responsable de la comprobación"}</b>
          </div>
          {/* Autorizador — sello solo cuando realmente está aprobado */}
          <div style={P.firma}>
            {["APROBADA","CERRADA"].includes(sol.estado) && sol.autorizador ? (
              <div style={{ border: "2px solid #0E7C66", borderRadius: 8, padding: "6px 20px", color: "#0E7C66", fontWeight: 800, fontSize: 13, display: "inline-block", transform: "rotate(2deg)", marginBottom: 8 }}>
                ✓ {sol.autorizador}
              </div>
            ) : (
              <span>_______________________________</span>
            )}
            <br />{sol.autorizador || "Pendiente de aprobación"}<br /><b>Autorizador</b>
            {sol.fechaPago && <div style={{ fontSize: 10, color: "#0E7C66", marginTop: 4 }}>Pagado: {sol.fechaPago}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// MÓDULO DE TICKETS
// ================================================================
const PRIORIDADES = { Alta: "#B4443C", Media: "#B7791F", Baja: "#0E7C66" };
const CATEGORIAS_TICKET = ["Gastos / Viáticos", "Tarjeta Clara", "Reembolso", "Catálogo de cuentas", "Acceso / Usuarios", "Otro"];
const EST_TICKET = {
  Abierto:     { color: "#B4443C", bg: "#F9E9E7" },
  "En proceso":{ color: "#B7791F", bg: "#FCF3E3" },
  Resuelto:    { color: "#0E7C66", bg: "#E4F3EF" },
  Cerrado:     { color: "#54606B", bg: "#EDEFF1" },
};

function TicketChip({ estado }) {
  const e = EST_TICKET[estado] || EST_TICKET.Abierto;
  return <span style={{ fontSize: 12, fontWeight: 700, color: e.color, background: e.bg, padding: "2px 10px", borderRadius: 999 }}>{estado}</span>;
}

// ---------- lista de tickets ----------
function ListaTickets({ tickets, usuario, onNuevo, onAbrir }) {
  const [filtro, setFiltro] = useState("todos");
  const lista = tickets.filter((t) => filtro === "todos" || t.estado === filtro);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Tickets de soporte</h2>
        <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
          {["todos", "Abierto", "En proceso", "Resuelto"].map((f) => (
            <button key={f} onClick={() => setFiltro(f)}
              style={{ padding: "4px 12px", borderRadius: 999, border: "1px solid #C9CFD4", fontSize: 12, fontWeight: filtro === f ? 700 : 400, background: filtro === f ? "#232D6B" : "#fff", color: filtro === f ? "#fff" : "#54606B", cursor: "pointer" }}>
              {f === "todos" ? "Todos" : f}
            </button>
          ))}
        </div>
        {(!esContador(usuario) || esAdmin(usuario)) && <button style={{ ...S.btn(true), marginLeft: "auto" }} onClick={onNuevo}>+ Nuevo ticket</button>}
      </div>
      {lista.length === 0
        ? <div style={{ ...S.card, textAlign: "center", color: "#54606B", padding: 48 }}>No hay tickets {filtro !== "todos" ? "con estado «" + filtro + "»" : ""}.</div>
        : <div style={{ display: "grid", gap: 10 }}>
            {lista.map((t) => (
              <div key={t.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 14, cursor: "pointer", padding: "13px 18px" }} onClick={() => onAbrir(t.id)}>
                <div style={{ minWidth: 8, height: 8, borderRadius: "50%", background: PRIORIDADES[t.prioridad] || "#ccc" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{t.asunto}</div>
                  <div style={{ fontSize: 12, color: "#54606B" }}>
                    {t.categoria} · {t.autor} · {t.fecha}
                    {t.asignadoNombre ? ` · Para: ${t.asignadoNombre}` : ""}
                    {t.folioSolicitud && <span style={{ marginLeft:6, background:"#E9EEF8", color:"#3644AC", borderRadius:4, padding:"0 6px", fontWeight:700, fontFamily:"ui-monospace,monospace" }}>{"📋"} {t.folioSolicitud}</span>}
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: PRIORIDADES[t.prioridad], whiteSpace: "nowrap" }}>{t.prioridad}</span>
                <TicketChip estado={t.estado} />
              </div>
            ))}
          </div>}
    </div>
  );
}

// ---------- nuevo ticket ----------
function FormTicket({ usuario, empresa, todosUsuarios, onCancelar, onGuardar }) {
  const [f, setF] = useState({ asunto: "", categoria: CATEGORIAS_TICKET[0], prioridad: "Media", descripcion: "" });
  // Todos los usuarios activos de la empresa pueden recibir tickets
  const agentes = todosUsuarios.filter((u) => u.empresaId === empresa?.id && u.activo !== false);
  const [asignadoId, setAsignadoId] = useState(
    agentes.find(u => ["Administrador","Aprobador"].includes(u.rol))?.id || agentes[0]?.id || ""
  );
  const [preview, setPreview] = useState(false);
  const ok = f.asunto.trim() && f.descripcion.trim();
  const agente = agentes.find((u) => u.id === asignadoId);
  const correoDestino = agente?.correo || empresa?.correoNotificacion || "";
  const asuntoCorreo = `[Ticket] ${f.categoria} — ${f.asunto}`;
  const cuerpoCorreo = `Nuevo ticket de soporte — ${empresa?.nombre || ""}\n\nCategoría: ${f.categoria}\nPrioridad: ${f.prioridad}\nAbierto por: ${usuario.nombre}${usuario.departamento ? " · " + usuario.departamento : ""}\nFecha: ${hoy()}\nAsignado a: ${agente?.nombre || "sin asignar"}\n\n──────────────────────────────\n${f.descripcion}\n──────────────────────────────\n\nIngresa al sistema de viáticos para atender este ticket.`;

  const guardarYEnviar = () => {
    const nuevoTicket = {
      id: uid(), folio: `TK-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      fecha: hoy(), autor: usuario.nombre, autorId: usuario.id,
      departamento: usuario.departamento || "", empresaId: empresa?.id || "", ...f,
      asignadoId: asignadoId || "", asignadoNombre: agente?.nombre || "",
      estado: "Abierto",
      historial: [{ fecha: hoy(), quien: usuario.nombre, accion: "Ticket creado" }],
      comentarios: [],
    };
    onGuardar(nuevoTicket);
    if (correoDestino) {
      window.open(`mailto:${encodeURIComponent(correoDestino)}?subject=${encodeURIComponent(asuntoCorreo)}&body=${encodeURIComponent(cuerpoCorreo)}`);
    }
    setPreview(false);
  };

  return (
    <div style={S.card}>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>Nuevo ticket de soporte</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <Campo label="Asunto" span={3}>
          <input style={S.input} value={f.asunto} onChange={(e) => setF({ ...f, asunto: e.target.value })} placeholder="Describe brevemente el problema" />
        </Campo>
        <Campo label="Categoría">
          <select style={S.input} value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
            {CATEGORIAS_TICKET.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Campo>
        <Campo label="Prioridad">
          <select style={S.input} value={f.prioridad} onChange={(e) => setF({ ...f, prioridad: e.target.value })}>
            {Object.keys(PRIORIDADES).map((p) => <option key={p}>{p}</option>)}
          </select>
        </Campo>
        <Campo label="Asignar a — quién lo atiende">
          <select style={S.input} value={asignadoId} onChange={(e) => setAsignadoId(e.target.value)}>
            <option value="">— sin asignar —</option>
            {agentes.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} · {ROLES[u.rol]?.label || u.rol}{u.correo ? " ✉" : ""}
              </option>
            ))}
          </select>
          {agente && !agente.correo && (
            <div style={{ fontSize:10, color:"#B7791F", marginTop:3 }}>⚠ Sin correo registrado — no se enviará notificación. Agrégalo en Configuración → Usuarios.</div>
          )}
          {agente?.correo && <div style={{ fontSize:10, color:"#0E7C66", marginTop:3 }}>✓ Se notificará a {agente.correo}</div>}
          {agentes.length === 0 && <div style={{ fontSize:10, color:"#B4443C", marginTop:3 }}>Sin usuarios. Ve a Configuración → Usuarios.</div>}
        </Campo>
        <Campo label="Descripción" span={3}>
          <textarea style={{ ...S.input, height: 110, resize: "vertical" }} value={f.descripcion}
            onChange={(e) => setF({ ...f, descripcion: e.target.value })}
            placeholder="Describe con detalle el problema o solicitud. Incluye pasos para reproducir el error si aplica." />
        </Campo>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button style={S.btn(true)} disabled={!ok} onClick={() => correoDestino ? setPreview(true) : guardarYEnviar()}>
          {correoDestino ? "👁 Vista previa y enviar" : "Enviar ticket"}
        </button>
        <button style={S.btn(false)} onClick={onCancelar}>Cancelar</button>
      </div>

      {/* Modal preview */}
      {preview && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:9000, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setPreview(false); }}>
          <div style={{ background:"#fff", borderRadius:12, padding:28, maxWidth:580, width:"90%", boxShadow:"0 20px 60px rgba(0,0,0,.3)", maxHeight:"85vh", overflowY:"auto" }}>
            <h3 style={{ margin:"0 0 16px" }}>Vista previa — Ticket y notificación</h3>
            <div style={{ background:"#F3F4FA", borderRadius:8, padding:"12px 16px", marginBottom:14, fontSize:13 }}>
              <div style={{ display:"flex", gap:8, marginBottom:6 }}>
                <span style={{ fontWeight:700 }}>{f.categoria}</span>
                <span style={{ background:"#FCF3E3", color:"#B7791F", borderRadius:4, padding:"0 8px", fontSize:12, fontWeight:700 }}>{f.prioridad}</span>
              </div>
              <div style={{ fontWeight:700, fontSize:15, marginBottom:6 }}>{f.asunto}</div>
              <div style={{ color:"#54606B", lineHeight:1.6, whiteSpace:"pre-wrap" }}>{f.descripcion}</div>
              <div style={{ marginTop:8, fontSize:12, color:"#8A949C" }}>
                De: {usuario.nombre}{usuario.departamento ? " · " + usuario.departamento : ""}
                {agente ? <span> · Para: <b>{agente.nombre}</b></span> : <span style={{ color:"#B7791F" }}> · Sin asignar</span>}
              </div>
            </div>
            <div style={{ border:"1px solid #D5D9DC", borderRadius:8, overflow:"hidden", marginBottom:16 }}>
              <div style={{ background:"#2A3580", color:"#fff", padding:"8px 14px", fontSize:12 }}>{"📧"} Correo de notificación</div>
              <div style={{ padding:"12px 14px", fontSize:12 }}>
                <div style={{ marginBottom:4 }}><b>Para:</b> {correoDestino}</div>
                <div style={{ marginBottom:10 }}><b>Asunto:</b> {asuntoCorreo}</div>
                <pre style={{ margin:0, fontFamily:"inherit", fontSize:11, lineHeight:1.6, background:"#F9FAFB", padding:"10px 12px", borderRadius:6, whiteSpace:"pre-wrap", color:"#1D2554" }}>{cuerpoCorreo}</pre>
              </div>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button style={S.btn(true)} onClick={guardarYEnviar}>✓ Guardar y abrir correo</button>
              <button style={S.btn(false)} onClick={() => setPreview(false)}>← Editar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ---------- detalle del ticket ----------
function DetalleTicket({ ticket, usuario, todosUsuarios, onVolver, onActualizar }) {
  const [comentario, setComentario] = useState("");
  const agentes = todosUsuarios.filter((u) => u.empresaId === ticket.empresaId && u.activo !== false);
  const puedeGestionar = puedeAprobar(usuario) || esAdmin(usuario);

  const act = (cambios, accion) => onActualizar({
    ...ticket, ...cambios,
    historial: [...(ticket.historial || []), { fecha: hoy(), quien: usuario.nombre, accion }],
  });

  const enviarComentario = () => {
    if (!comentario.trim()) return;
    onActualizar({
      ...ticket,
      comentarios: [...(ticket.comentarios || []), { id: uid(), fecha: hoy(), autor: usuario.nombre, texto: comentario.trim(), interno: false }],
    });
    setComentario("");
  };

  return (
    <div>
      <button style={{ ...S.btn(false), marginBottom: 14 }} onClick={onVolver}>← Tickets</button>
      <div style={{ ...S.card, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
              <span style={{ fontFamily: "ui-monospace,monospace", fontWeight: 800, fontSize: 13, border: "1.5px solid #232D6B", borderRadius: 4, padding: "2px 8px" }}>{ticket.folio}</span>
              <TicketChip estado={ticket.estado} />
              <span style={{ fontSize: 12, fontWeight: 700, color: PRIORIDADES[ticket.prioridad] }}>Prioridad: {ticket.prioridad}</span>
            </div>
            <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>{ticket.asunto}</h2>
            <div style={{ fontSize: 12, color: "#54606B" }}>{ticket.categoria} · Creado por {ticket.autor} · {ticket.fecha}{ticket.departamento ? " · " + ticket.departamento : ""}
            </div>
            {ticket.folioSolicitud && (
              <div style={{ marginTop:6, display:"inline-flex", alignItems:"center", gap:6, background:"#E9EEF8", borderRadius:6, padding:"4px 10px", fontSize:12, color:"#3644AC", fontWeight:700 }}>
                {"📋"} Expediente relacionado: <span style={{ fontFamily:"ui-monospace,monospace" }}>{ticket.folioSolicitud}</span>
              </div>
            )}
          </div>
          {puedeGestionar && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["Abierto","En proceso","Resuelto","Cerrado"].map((e) => (
                <button key={e} style={{ ...S.btn(false), fontSize: 12, padding: "5px 12px", fontWeight: ticket.estado === e ? 800 : 400, borderColor: ticket.estado === e ? "#232D6B" : "#C9CFD4" }}
                  onClick={() => act({ estado: e }, "Estado → " + e)}>
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 16, padding: "14px", background: "#F3F4FA", borderRadius: 8, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{ticket.descripcion}</div>

        {puedeGestionar && (
          <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "end" }}>
            <Campo label="Asignado a">
              <select style={{ ...S.input, width: 240 }} value={ticket.asignadoId || ""}
                onChange={(e) => { const u = agentes.find((x) => x.id === e.target.value); act({ asignadoId: e.target.value, asignadoNombre: u?.nombre || "" }, `Asignado a ${u?.nombre || "nadie"}`); }}>
                <option value="">— sin asignar —</option>
                {agentes.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </Campo>
          </div>
        )}
      </div>

      {/* Comentarios */}
      <div style={S.card}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Conversación ({(ticket.comentarios || []).length})</h3>
        {(ticket.comentarios || []).length === 0
          ? <div style={{ color: "#8A949C", fontSize: 13, textAlign: "center", padding: "20px 0" }}>Aún no hay comentarios. Sé el primero en responder.</div>
          : <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
              {ticket.comentarios.map((c) => {
                const esPropio = c.autor === usuario.nombre;
                return (
                  <div key={c.id} style={{ display: "flex", flexDirection: "column", alignItems: esPropio ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "80%", background: esPropio ? "#232D6B" : "#EDEFF1", color: esPropio ? "#fff" : "#1D2554", borderRadius: esPropio ? "12px 12px 2px 12px" : "12px 12px 12px 2px", padding: "10px 14px", fontSize: 13 }}>
                      {c.texto}
                    </div>
                    <div style={{ fontSize: 11, color: "#8A949C", marginTop: 3 }}>{c.autor} · {c.fecha}</div>
                  </div>
                );
              })}
            </div>
        }
        <div style={{ display: "flex", gap: 10 }}>
          <textarea style={{ ...S.input, flex: 1, height: 72, resize: "none" }} value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarComentario(); } }}
            placeholder="Escribe una respuesta… (Enter para enviar)" />
          <button style={{ ...S.btn(true), alignSelf: "flex-end", padding: "10px 18px" }} onClick={enviarComentario} disabled={!comentario.trim()}>Enviar</button>
        </div>
      </div>

      {/* Historial */}
      <div style={{ ...S.card, marginTop: 14 }}>
        <h3 style={{ marginTop: 0, fontSize: 14, color: "#54606B" }}>Historial</h3>
        {(ticket.historial || []).map((h, i) => (
          <div key={i} style={{ display: "flex", gap: 12, padding: "5px 0", borderBottom: "1px solid #EDEFF1", fontSize: 12 }}>
            <span style={{ color: "#8A949C", minWidth: 90 }}>{h.fecha}</span>
            <span style={{ fontWeight: 600 }}>{h.quien}</span>
            <span style={{ color: "#54606B" }}>{h.accion}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- solicitud de reembolso directo (sin viaje previo) ----------
function FormReembolso({ usuario, empresa, onCancelar, onGuardar }) {
  const deptos = empresa?.departamentos || [];
  const ubics = empresa?.ubicaciones || [];
  const proyectos = (empresa?.proyectos || []).filter((p) => p.activo !== false);
  const [f, setF] = useState({
    motivo: "", cliente: "", pedido: "", proyectoId: "", pedidoId: "",
    departamentoId: usuario.departamentoId || deptos[0]?.id || "",
    ubicacionId: usuario.ubicacionId || ubics[0]?.id || "",
    cc: "",
  });
  const set = (k, v) => setF((prev) => ({ ...prev, [k]: v }));
  const depto = deptos.find((d) => d.id === f.departamentoId);
  const ubic = ubics.find((u) => u.id === f.ubicacionId);
  const proySel = proyectos.find((p) => p.id === f.proyectoId);
  const pedidosSel = proySel?.pedidos || [];
  const pedidoObj = pedidosSel.find((p) => p.id === f.pedidoId);
  const valido = f.motivo.trim().length > 2;

  const aplicarProyecto = (id) => {
    const p = proyectos.find((x) => x.id === id);
    if (!p) { set("proyectoId", ""); return; }
    setF((prev) => ({ ...prev, proyectoId: id, pedidoId: "", cliente: p.cliente || prev.cliente }));
  };

  return (
    <div style={S.card}>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>Solicitud de reembolso — {empresa?.nombre}</h2>
      <div style={{ fontSize: 13, color: "#54606B", marginBottom: 16 }}>
        Para gastos que ocurrieron <b>sin una solicitud de viaje previa</b>. Primero capturas los gastos (a mano, con XML de factura o con el CSV de reembolsos de Clara) y después envías el expediente a aprobación.
      </div>

      {/* Selector de proyecto/pedido */}
      {proyectos.length === 0 && (
        <div style={{ background: "#FCF3E3", border:"1px solid #B7791F", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize:13, color:"#8A5A12" }}>
          ⚠ No hay proyectos en el catálogo. Puedes continuar sin relacionar a un proyecto — asegúrate de llenar el campo Objetivo/Justificación con detalle.
        </div>
      )}
      {proyectos.length > 0 && (
        <div style={{ background: "#E9EEF8", borderRadius: 8, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#3644AC" }}>{"🗂️"} Relacionar con proyecto:</span>
          <ProyectoBuscador
            proyectos={proyectos}
            value={f.proyectoId}
            onChange={aplicarProyecto}
            placeholder="— sin proyecto —"
          />
          {pedidosSel.length > 0 && (
            <select style={{ ...S.input, width: 200 }} value={f.pedidoId} onChange={(e) => set("pedidoId", e.target.value)}>
              <option value="">— selecciona pedido —</option>
              {pedidosSel.map((p) => <option key={p.id} value={p.id}>{p.numero}{p.descripcion ? " — " + p.descripcion : ""}</option>)}
            </select>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <Campo label="Motivo del gasto" span={2}>
          <input style={S.input} value={f.motivo} onChange={(e) => set("motivo", e.target.value)} placeholder="Ej. Comida con cliente, material urgente de obra, mensajería…" />
        </Campo>
        <Campo label="Departamento">
          {deptos.length ? (
            <select style={S.input} value={f.departamentoId} onChange={(e) => { set("departamentoId", e.target.value); set("cc", deptos.find((d) => d.id === e.target.value)?.cc || ""); }}>
              <option value="">— selecciona —</option>
              {deptos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          ) : (
            <input style={S.input} value={f.deptoLibre || usuario.departamento || ""} onChange={(e) => set("deptoLibre", e.target.value)} placeholder="Escribe el departamento" />
          )}
        </Campo>
        <Campo label="Ubicación / Oficina">
          {ubics.length ? (
            <select style={S.input} value={f.ubicacionId} onChange={(e) => set("ubicacionId", e.target.value)}>
              <option value="">— selecciona —</option>
              {ubics.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          ) : (
            <input style={S.input} value={usuario.ubicacion || ""} disabled />
          )}
        </Campo>
        <Campo label="Centro de costos">
          {(empresa?.centrosCostos || []).length ? (
            <select style={{ ...S.input, fontFamily: "ui-monospace,monospace" }} value={f.cc || depto?.cc || usuario.cc || ""} onChange={(e) => set("cc", e.target.value)}>
              <option value="">— sin CC —</option>
              {empresa.centrosCostos.map((c) => <option key={c.clave} value={c.clave}>{c.clave}{c.nombre ? " — " + c.nombre : ""}</option>)}
            </select>
          ) : <div style={{ fontSize: 12, color: "#8A949C", paddingTop: 8 }}>Sin catálogo de CC (opcional).</div>}
        </Campo>
        <Campo label={proySel ? "Cliente (del proyecto)" : "Cliente (opcional)"}>
          <input style={S.input} value={proySel ? (proySel.cliente || "") : f.cliente} disabled={!!proySel}
            onChange={(e) => set("cliente", e.target.value)} placeholder="Si el gasto es atribuible a un cliente" />
        </Campo>
        <Campo label="Pedido de venta (opcional)">
          {pedidosSel.length > 0 ? (
            <input style={S.input} value={pedidoObj?.numero || ""} disabled />
          ) : (
            <input style={S.input} value={f.pedido} onChange={(e) => set("pedido", e.target.value)} placeholder="Opcional" />
          )}
        </Campo>
      </div>

      {/* Aviso datos bancarios */}
      {!usuario.clabe && (
        <div style={{ background:"#FFF0EF", border:"1px solid #B4443C", borderRadius:8, padding:"10px 14px", fontSize:13, color:"#B4443C", marginBottom:14 }}>
          ⚠ No tienes datos bancarios registrados. Ve a <b>Mi perfil</b> y llena tu CLABE antes de enviar este reembolso, para que finanzas pueda procesarlo.
        </div>
      )}
      {usuario.clabe && (
        <div style={{ background:"#E4F3EF", border:"1px solid #0E7C66", borderRadius:8, padding:"10px 14px", fontSize:13, marginBottom:14 }}>
          <div style={{ fontWeight:700, color:"#0E7C66", marginBottom:4 }}>✓ El reembolso se depositará a:</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"2px 16px", color:"#54606B" }}>
            <span><b>Banco:</b> {usuario.banco}</span>
            <span><b>Titular:</b> {usuario.titularCuenta}</span>
            <span style={{ fontFamily:"ui-monospace,monospace" }}><b>CLABE:</b> {usuario.clabe}</span>
            {usuario.cuentaBanco && <span><b>Cuenta:</b> {usuario.cuentaBanco}</span>}
          </div>
          <div style={{ fontSize:12, color:"#0E7C66", marginTop:6, fontWeight:700 }}>
            ¿Los datos son correctos? Si cambiaron ve a Mi perfil antes de continuar.
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginTop: 22, alignItems: "center" }}>
        <button style={S.btn(true)} disabled={!valido} onClick={() => onGuardar({
          id: uid(), tipo: "reembolso",
          folio: `RB-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
          fechaSolicitud: hoy(), solicitante: usuario.nombre, solicitanteId: usuario.id,
          departamento: depto?.nombre || f.deptoLibre || usuario.departamento || "",
          encargado: depto?.encargado || "",
          ubicacion: ubic?.nombre || usuario.ubicacion || "",
          cc: f.cc || depto?.cc || usuario.cc || "",
          cliente: proySel?.cliente || f.cliente || "",
          pedido: pedidoObj?.numero || f.pedido || "",
          proyectoId: f.proyectoId || "", pedidoId: f.pedidoId || "",
          proyecto: proySel ? `${proySel.nombre}${f.motivo ? " — " + f.motivo : ""}` : f.motivo,
          objetivo: f.motivo,
          origen: "", destino: "", fechaInicio: hoy(), fechaFin: hoy(),
          montoClara: 0, fondoEfectivo: 0,
          presupuesto: Object.fromEntries(CATS.map((c) => [c, 0])),
          estado: "CAPTURA",
          datosBancarios: { banco: usuario.banco||"", clabe: usuario.clabe||"", titularCuenta: usuario.titularCuenta||"", cuentaBanco: usuario.cuentaBanco||"", rfc: usuario.rfc||"" },
          historial: [{ fecha: hoy(), quien: usuario.nombre, accion: "Solicitud de reembolso creada" }],
          movimientos: [],
        })}>Crear y capturar gastos</button>
        <button style={S.btn(false)} onClick={onCancelar}>Cancelar</button>
        {!valido && <span style={{ fontSize: 12, color: "#B4443C" }}>Describe el motivo del gasto (mínimo 3 caracteres).</span>}
      </div>
    </div>
  );
}

// ================================================================
// CATÁLOGO DE PROYECTOS Y POLÍTICAS DE VIÁTICOS
// ================================================================
// ================================================================
// CATÁLOGO DE PROYECTOS Y POLÍTICAS DE VIÁTICOS
// ================================================================
// ================================================================
// CATÁLOGO DE PROYECTOS Y POLÍTICAS — con campos completos para
// integración futura con API de Clara y envío por correo
// ================================================================

const TIPOS_PROYECTO = ["Externo — cliente","Interno","Mantenimiento","Licitación","Otro"];
const ESTATUS_PROYECTO = ["Prospecto","En negociación","Activo","En pausa","Cerrado","Cancelado"];
const TIPOS_PEDIDO = ["Servicio","Material","Mixto","Mantenimiento","Otro"];

function CatalogoProyectos({ empresa, onGuardar, usuario, solicitudes = [] }) {
  const [tab, setTab] = useState("proyectos");
  const proyectos = empresa?.proyectos || [];
  const politicas = empresa?.politicas || {};
  const actEmp = (cambios) => onGuardar([{ ...empresa, ...cambios }]);
  const rolesParam = ["Global", ...Object.keys(ROLES)];

  const vacio = {
    nombre:"", cliente:"", clienteContacto:"", clienteTel:"", clienteCorreo:"",
    objetivo:"", responsable:"", tipo:"Externo — cliente", estatus:"Activo",
    presupuesto:"", presupuestoViaticos:"", contrato:"", ubicacion:"",
    fechaInicio:"", fechaFin:"", notas:"", fijo:false,
    // Campos para integración futura con Clara y correo
    claraProyectoId:"", correoNotificacion:"", correoCC:""
  };
  const [nuevo, setNuevo] = useState(vacio);
  const [editId, setEditId] = useState(null);
  const [pedidoAbierto, setPedidoAbierto] = useState(null);
  const [nuevoPed, setNuevoPed] = useState({ numero:"", descripcion:"", monto:"", tipo:"Servicio", fechaEntrega:"", avance:"", facturaCliente:"" });
  const [expandido, setExpandido] = useState({});

  return (
    <div>
      <h2 style={{ margin:"0 0 16px", fontSize:20 }}>Catálogo de proyectos y políticas</h2>
      <div style={{ display:"flex", gap:4, marginBottom:14 }}>
        {[["proyectos","🗂️ Proyectos"],["bolsa","📊 Bolsa presupuestaria"],["rentabilidad","📈 Rentabilidad"],["politicas","📏 Políticas de viáticos"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{ padding:"8px 18px", border:"none", borderRadius:"8px 8px 0 0", fontWeight:700, fontSize:13, cursor:"pointer",
              background:tab===k?"#fff":"transparent", color:tab===k?"#232D6B":"#54606B",
              borderBottom:tab===k?"3px solid #232D6B":"3px solid transparent" }}>{l}</button>
        ))}
      </div>

      {/* TAB PROYECTOS */}
      {tab === "proyectos" && (
        <div style={{ display:"grid", gap:14 }}>
          {/* Alta de proyecto */}
          <div style={S.card}>
            <h3 style={{ marginTop:0, fontSize:15 }}>Agregar proyecto</h3>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
              <Campo label="Nombre / Número de proyecto" span={2}>
                <input style={S.input} value={nuevo.nombre} onChange={(e)=>setNuevo({...nuevo,nombre:e.target.value})} placeholder="Ej. 26001 — Instalación planta MTY" />
              </Campo>
              <Campo label="Tipo">
                <select style={S.input} value={nuevo.tipo} onChange={(e)=>setNuevo({...nuevo,tipo:e.target.value})}>
                  {TIPOS_PROYECTO.map(t=><option key={t}>{t}</option>)}
                </select>
              </Campo>
              <Campo label="Proyecto fijo / permanente">
                <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, cursor:"pointer", paddingTop:6 }}>
                  <input type="checkbox" checked={!!nuevo.fijo} onChange={e=>setNuevo({...nuevo,fijo:e.target.checked})} />
                  Aparece siempre arriba en el selector
                </label>
                <div style={{ fontSize:11, color:"#6B7280", marginTop:3 }}>Útil para "Gastos Admin 2026", "Gastos Venta 2026", etc.</div>
              </Campo>
              <Campo label="Cliente">
                <input style={S.input} value={nuevo.cliente} onChange={(e)=>setNuevo({...nuevo,cliente:e.target.value})} placeholder="Razón social" />
              </Campo>
              <Campo label="Contacto del cliente">
                <input style={S.input} value={nuevo.clienteContacto} onChange={(e)=>setNuevo({...nuevo,clienteContacto:e.target.value})} placeholder="Nombre" />
              </Campo>
              <Campo label="Teléfono cliente">
                <input style={S.input} value={nuevo.clienteTel} onChange={(e)=>setNuevo({...nuevo,clienteTel:e.target.value})} />
              </Campo>
              <Campo label="Correo cliente">
                <input type="email" style={S.input} value={nuevo.clienteCorreo} onChange={(e)=>setNuevo({...nuevo,clienteCorreo:e.target.value})} />
              </Campo>
              <Campo label="Responsable interno">
                <input style={S.input} value={nuevo.responsable} onChange={(e)=>setNuevo({...nuevo,responsable:e.target.value})} />
              </Campo>
              <Campo label="Ubicación / Obra">
                <input style={S.input} value={nuevo.ubicacion} onChange={(e)=>setNuevo({...nuevo,ubicacion:e.target.value})} placeholder="Ciudad, dirección" />
              </Campo>
              <Campo label="No. contrato / licitación">
                <input style={S.input} value={nuevo.contrato} onChange={(e)=>setNuevo({...nuevo,contrato:e.target.value})} />
              </Campo>
              <Campo label="Objetivo del proyecto">
                <input style={S.input} value={nuevo.objetivo} onChange={(e)=>setNuevo({...nuevo,objetivo:e.target.value})} />
              </Campo>
              <Campo label="Presupuesto total del proyecto">
                <input type="number" style={{ ...S.input, textAlign:"right" }} value={nuevo.presupuesto} onChange={(e)=>setNuevo({...nuevo,presupuesto:e.target.value})} />
              </Campo>
              <Campo label="Bolsa de viáticos del proyecto">
                <input type="number" style={{ ...S.input, textAlign:"right" }} value={nuevo.presupuestoViaticos} onChange={(e)=>setNuevo({...nuevo,presupuestoViaticos:e.target.value})} />
              </Campo>
              <Campo label="Fecha inicio">
                <input type="date" style={S.input} value={nuevo.fechaInicio} onChange={(e)=>setNuevo({...nuevo,fechaInicio:e.target.value})} />
              </Campo>
              <Campo label="Fecha fin estimada">
                <input type="date" style={S.input} value={nuevo.fechaFin} onChange={(e)=>setNuevo({...nuevo,fechaFin:e.target.value})} />
              </Campo>
              <Campo label="Estatus">
                <select style={S.input} value={nuevo.estatus} onChange={(e)=>setNuevo({...nuevo,estatus:e.target.value})}>
                  {ESTATUS_PROYECTO.map(s=><option key={s}>{s}</option>)}
                </select>
              </Campo>
            </div>
            {/* Campos para integración futura */}
            <details style={{ marginTop:12 }}>
              <summary style={{ fontSize:12, color:"#3644AC", cursor:"pointer", fontWeight:700 }}>
                {"⚙️"} Configuración de integración (API Clara / Correo) — para activar en la versión desplegada
              </summary>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginTop:10, padding:12, background:"#E9EEF8", borderRadius:8 }}>
                <Campo label="ID de proyecto en Clara (futuro)">
                  <input style={{ ...S.input, fontFamily:"ui-monospace,monospace", background:"#fff" }} value={nuevo.claraProyectoId}
                    onChange={(e)=>setNuevo({...nuevo,claraProyectoId:e.target.value})} placeholder="Se llenará automático con la API" />
                </Campo>
                <Campo label="Correo de notificaciones (aprobador)">
                  <input type="email" style={S.input} value={nuevo.correoNotificacion}
                    onChange={(e)=>setNuevo({...nuevo,correoNotificacion:e.target.value})} placeholder="gerente@empresa.com" />
                </Campo>
                <Campo label="CC en correos (contabilidad)">
                  <input type="email" style={S.input} value={nuevo.correoCC}
                    onChange={(e)=>setNuevo({...nuevo,correoCC:e.target.value})} placeholder="contabilidad@empresa.com" />
                </Campo>
              </div>
            </details>
            <Campo label="Notas / Observaciones" span={3}>
              <textarea style={{ ...S.input, height:60, resize:"vertical", marginTop:10 }} value={nuevo.notas}
                onChange={(e)=>setNuevo({...nuevo,notas:e.target.value})} placeholder="Información adicional relevante del proyecto" />
            </Campo>
            <button style={{ ...S.btn(true), marginTop:12 }} disabled={!nuevo.nombre.trim()}
              onClick={()=>{
                actEmp({ proyectos:[...proyectos,{ id:uid(),...nuevo,pedidos:[],
                  presupuesto:Number(nuevo.presupuesto)||0,
                  presupuestoViaticos:Number(nuevo.presupuestoViaticos)||0,
                  activo:true, fechaAlta:hoy() }] });
                setNuevo(vacio);
              }}>Agregar proyecto</button>
          </div>

          {/* Lista de proyectos */}
          <div style={S.card}>
            <h3 style={{ marginTop:0, fontSize:15 }}>Proyectos ({proyectos.length})</h3>
            {proyectos.length===0 ? (
              <div style={{ color:"#8A949C", fontSize:13, textAlign:"center", padding:20 }}>Sin proyectos. Agrega el primero arriba.</div>
            ) : proyectos.map((p)=>(
              <div key={p.id} style={{ border:"1px solid #E3E6E9", borderRadius:10, marginBottom:12, overflow:"hidden", opacity:p.activo===false?0.55:1 }}>
                {/* Header tarjeta de proyecto — badge fijo si aplica */}
                    {p.fijo && <span style={{ fontSize:10, fontWeight:800, background:"#FEF3C7", color:"#92400E", padding:"2px 7px", borderRadius:999, border:"1px solid #FCD34D", letterSpacing:"0.05em" }}>📌 FIJO</span>}
                <div style={{ background:"#F3F4FA", padding:"10px 16px", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:800, fontSize:15 }}>{p.nombre}</div>
                    <div style={{ fontSize:12, color:"#54606B" }}>
                      {[p.tipo, p.cliente, p.responsable, p.ubicacion].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, padding:"2px 10px", borderRadius:999,
                    color: p.estatus==="Activo"?"#0E7C66":p.estatus==="Cerrado"?"#54606B":p.estatus==="Cancelado"?"#B4443C":"#B7791F",
                    background: p.estatus==="Activo"?"#E4F3EF":p.estatus==="Cerrado"?"#EDEFF1":p.estatus==="Cancelado"?"#F9E9E7":"#FCF3E3" }}>
                    {p.estatus}
                  </span>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    <button style={{ ...S.btn(false), padding:"3px 10px", fontSize:11 }}
                      onClick={()=>setExpandido(prev=>({...prev,[p.id]:!prev[p.id]}))}>
                      {expandido[p.id]?"▲ Menos":"▼ Ver detalle"}
                    </button>
                    <button style={{ ...S.btn(false), padding:"3px 10px", fontSize:11 }}
                      onClick={()=>setEditId(editId===p.id?null:p.id)}>
                      {editId===p.id?"✓ Listo":"Editar"}
                    </button>
                    <button style={{ border:"none", background:"none", cursor:"pointer", fontSize:11,
                      color:p.activo!==false?"#B4443C":"#0E7C66" }}
                      onClick={()=>actEmp({proyectos:proyectos.map(x=>x.id===p.id?{...x,activo:x.activo===false}:x)})}>
                      {p.activo!==false?"Desactivar":"Activar"}
                    </button>
                    <button style={{ border:"none", background:"none", cursor:"pointer", fontSize:11, color:"#3644AC" }}
                      onClick={()=>setPedidoAbierto(pedidoAbierto===p.id?null:p.id)}>
                      {"🗂"} Pedidos ({(p.pedidos||[]).length})
                    </button>
                  </div>
                </div>

                {/* Detalle expandible del proyecto */}
                {expandido[p.id] && (
                  <div style={{ padding:"12px 16px", display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, fontSize:13 }}>
                    {[
                      ["Objetivo",p.objetivo],["Contrato",p.contrato],["Ubicación",p.ubicacion],
                      ["Contacto cliente",p.clienteContacto],[" Teléfono",p.clienteTel],["Correo cliente",p.clienteCorreo],
                      ["Fechas",p.fechaInicio&&p.fechaFin?`${p.fechaInicio} → ${p.fechaFin}`:p.fechaInicio||"—"],
                      ["Presupuesto total",p.presupuesto?mxn(p.presupuesto):"—"],
                      ["Bolsa viáticos",p.presupuestoViaticos?mxn(p.presupuestoViaticos):"—"],
                      ["Correo aprobador",p.correoNotificacion||"—"],["CC contabilidad",p.correoCC||"—"],
                      ["ID Clara",p.claraProyectoId||"Pendiente de integración"],
                    ].map(([k,v])=>v&&v!=="—"?(
                      <div key={k}><span style={{ fontWeight:700, color:"#54606B", fontSize:11, display:"block" }}>{k}</span><span>{v}</span></div>
                    ):null)}
                    {p.notas && <div style={{ gridColumn:"span 3" }}><span style={{ fontWeight:700, color:"#54606B", fontSize:11, display:"block" }}>Notas</span><span>{p.notas}</span></div>}
                  </div>
                )}

                {/* Formulario de edición */}
                {editId===p.id && (
                  <div style={{ padding:"12px 16px", background:"#FFF9F0", borderTop:"1px solid #E3E6E9" }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                      {[
                        ["nombre","Nombre","text"],["cliente","Cliente","text"],["responsable","Responsable","text"],
                        ["contrato","No. contrato","text"],["ubicacion","Ubicación","text"],["clienteContacto","Contacto cliente","text"],
                        ["clienteTel","Teléfono","text"],["clienteCorreo","Correo cliente","email"],
                        ["presupuesto","Presupuesto total","number"],["presupuestoViaticos","Bolsa viáticos","number"],
                        ["fechaInicio","Fecha inicio","date"],["fechaFin","Fecha fin","date"],
                        ["correoNotificacion","Correo aprobador","email"],["correoCC","CC contabilidad","email"],
                        ["claraProyectoId","ID en Clara","text"],
                      ].map(([campo,lbl,tipo])=>(
                        <Campo key={campo} label={lbl}>
                          <input type={tipo} style={{ ...S.input, padding:"5px 8px" }} value={p[campo]||""}
                            onChange={(e)=>actEmp({proyectos:proyectos.map(x=>x.id===p.id?{...x,[campo]:e.target.value}:x)})} />
                        </Campo>
                      ))}
                      <Campo label="Tipo">
                        <select style={S.input} value={p.tipo||"Externo — cliente"}
                          onChange={(e)=>actEmp({proyectos:proyectos.map(x=>x.id===p.id?{...x,tipo:e.target.value}:x)})}>
                          {TIPOS_PROYECTO.map(t=><option key={t}>{t}</option>)}
                        </select>
                      </Campo>
                      <Campo label="Estatus">
                        <select style={S.input} value={p.estatus||"Activo"}
                          onChange={(e)=>actEmp({proyectos:proyectos.map(x=>x.id===p.id?{...x,estatus:e.target.value}:x)})}>
                          {ESTATUS_PROYECTO.map(s=><option key={s}>{s}</option>)}
                        </select>
                      </Campo>
                    </div>
                    <Campo label="Notas">
                      <textarea style={{ ...S.input, height:50, resize:"vertical", marginTop:8, width:"100%", boxSizing:"border-box" }}
                        value={p.notas||""}
                        onChange={(e)=>actEmp({proyectos:proyectos.map(x=>x.id===p.id?{...x,notas:e.target.value}:x)})} />
                    </Campo>
                  </div>
                )}

                {/* Panel de pedidos */}
                {pedidoAbierto===p.id && (
                  <PanelPedidos
                    proyecto={p} nuevoPed={nuevoPed} setNuevoPed={setNuevoPed}
                    onAgregar={(ped)=>actEmp({proyectos:proyectos.map(x=>x.id===p.id?{...x,pedidos:[...(x.pedidos||[]),ped]}:x)})}
                    onEliminar={(pedId)=>actEmp({proyectos:proyectos.map(x=>x.id===p.id?{...x,pedidos:x.pedidos.filter(q=>q.id!==pedId)}:x)})}
                    onActualizar={(pedId,cambios)=>actEmp({proyectos:proyectos.map(x=>x.id===p.id?{...x,pedidos:x.pedidos.map(q=>q.id===pedId?{...q,...cambios}:q)}:x)})}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB BOLSA PRESUPUESTARIA */}
      {tab === "bolsa" && (
        <BolsaPresupuestaria proyectos={proyectos} solicitudes={solicitudes} />
      )}

      {/* TAB RENTABILIDAD */}
      {tab === "rentabilidad" && (
        <div style={{ ...S.card, textAlign:"center", color:"#6B7280", padding:40 }}>
          <div style={{ fontSize:24, marginBottom:8 }}>📊</div>
          <div style={{ fontWeight:700 }}>Rentabilidad por proyecto</div>
          <div style={{ fontSize:13, marginTop:4 }}>Próximamente disponible</div>
        </div>
      )}

      {/* TAB POLÍTICAS */}
      {tab === "politicas" && (
        <div style={S.card}>
          <h3 style={{ marginTop:0, fontSize:15 }}>Montos máximos por categoría y rol</h3>
          <div style={{ fontSize:13, color:"#54606B", marginBottom:16, lineHeight:1.6 }}>
            Define cuánto puede solicitar cada rol por categoría. <b>Global</b> aplica a todos los roles sin límite específico.
            Al crear una solicitud el sistema avisará si se excede — el expediente se envía igual pero el aprobador verá la alerta.
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr>
                  <th style={S.th}>Categoría</th>
                  {rolesParam.map(r=><th key={r} style={S.th}>{r==="Global"?"Global (todos)":ROLES[r]?.label||r}</th>)}
                </tr>
              </thead>
              <tbody>
                {CATS.map((cat)=>(
                  <tr key={cat}>
                    <td style={{ ...S.td, fontWeight:700 }}>{cat}</td>
                    {rolesParam.map((rol)=>(
                      <td key={rol} style={S.td}>
                        <input type="number" min="0"
                          style={{ ...S.input, padding:"4px 8px", textAlign:"right", width:100, ...S.num }}
                          value={politicas[rol]?.[cat]??""} placeholder="sin límite"
                          onChange={(e)=>{
                            const val=e.target.value===""?undefined:Number(e.target.value);
                            const np={...politicas,[rol]:{...(politicas[rol]||{}),[cat]:val}};
                            if(val===undefined) delete np[rol][cat];
                            actEmp({politicas:np});
                          }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize:12, color:"#8A949C", marginTop:12 }}>Los cambios se guardan automáticamente al escribir.</div>
        </div>
      )}
    </div>
  );
}

// ─── Bolsa presupuestaria separada ───────────────────────────────
// ================================================================
// BOLSA PRESUPUESTARIA — diseño final aprobado
// ================================================================
function BolsaPresupuestaria({ proyectos, solicitudes }) {
  const [busq, setBusq]         = useState("");
  const [filtro, setFiltro]     = useState("activos"); // "activos" | "cerrados" | "todos"
  const [abiertos, setAbiertos] = useState({});        // { [proyId]: bool }

  const toggle = (id) => setAbiertos(prev => ({ ...prev, [id]: !prev[id] }));

  const todos = proyectos.filter(p => {
    const coincide = !busq || p.nombre?.toLowerCase().includes(busq.toLowerCase())
                           || p.cliente?.toLowerCase().includes(busq.toLowerCase());
    if (!coincide) return false;
    if (filtro === "activos")  return p.activo !== false;
    if (filtro === "cerrados") return p.activo === false;
    return true;
  });

  if (!proyectos.length) return (
    <div style={{ ...S.card, textAlign:"center", color:"#8A949C", padding:40 }}>
      Sin proyectos. Agrégalos en la pestaña Proyectos.
    </div>
  );

  return (
    <div style={{ display:"grid", gap:12 }}>
      {/* Toolbar */}
      <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
        {[["activos","🟢 Activos"],["cerrados","🔴 Cerrados"],["todos","Todos"]].map(([k,l]) => (
          <button key={k} style={{ ...S.btn(filtro===k), padding:"6px 14px", fontSize:12 }}
            onClick={() => setFiltro(k)}>{l} ({
              proyectos.filter(p => k==="activos" ? p.activo!==false : k==="cerrados" ? p.activo===false : true).length
            })</button>
        ))}
        <input style={{ ...S.input, width:220 }} value={busq}
          onChange={e => setBusq(e.target.value)} placeholder="🔍 Buscar proyecto o cliente…" />
        <button style={{ ...S.btn(false), fontSize:11, padding:"6px 12px", marginLeft:"auto" }}
          onClick={() => {
            const todosAbiertos = todos.every(p => abiertos[p.id]);
            const next = {};
            todos.forEach(p => { next[p.id] = !todosAbiertos; });
            setAbiertos(next);
          }}>
          {todos.every(p => abiertos[p.id]) ? "⊟ Colapsar todos" : "⊞ Expandir todos"}
        </button>
      </div>

      {todos.length === 0 && (
        <div style={{ ...S.card, textAlign:"center", color:"#8A949C", padding:30, fontSize:13 }}>
          Sin proyectos que coincidan con los filtros.
        </div>
      )}

      {/* Lista colapsable */}
      {todos.map((p) => {
        const abierto = !!abiertos[p.id];
        // Mini-resumen para la cabecera colapsada
        const expProy = solicitudes.filter(s =>
          s.proyectoId === p.id || s.proyecto === p.nombre || (s.proyecto||"").startsWith(p.nombre)
        );
        const bolsa = p.presupuestoViaticos || p.presupuesto || 0;
        const totalComp = expProy.filter(s => s.estado==="CERRADA").reduce((a,s) => a+(calcular(s).total||0), 0);
        const totalSol  = expProy.filter(s => ["ENVIADA","APROBADA","COMPROBACION"].includes(s.estado))
                                  .reduce((a,s) => { const c=calcular(s); return a+(c.total||c.presupuestoTotal||0); }, 0);
        const totalUsado = totalComp + totalSol;
        const disponible = bolsa - totalUsado;
        const pctComp = bolsa > 0 ? Math.min(Math.round((totalComp/bolsa)*100),100) : 0;
        const pctSol  = bolsa > 0 ? Math.min(Math.round((totalSol/bolsa)*100),100-pctComp) : 0;
        const excede  = bolsa > 0 && totalUsado > bolsa;

        return (
          <div key={p.id} style={{ border:"1px solid #D5D9DC", borderRadius:10, overflow:"hidden",
                                   opacity: p.activo===false ? 0.75 : 1 }}>
            {/* Cabecera siempre visible — clic para expandir */}
            <button onClick={() => toggle(p.id)} style={{ width:"100%", textAlign:"left", border:"none",
              background: p.activo===false ? "#F3F4FA" : "#2A3580", cursor:"pointer",
              padding:"14px 18px", display:"flex", alignItems:"center", gap:14 }}>
              <span style={{ fontSize:16, color:"#fff", minWidth:20 }}>{abierto ? "▼" : "▶"}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"baseline", gap:10, flexWrap:"wrap" }}>
                  <span style={{ fontWeight:800, fontSize:15, color:"#fff" }}>{p.nombre}</span>
                  {p.cliente && <span style={{ fontSize:12, color:"#A9B4E8" }}>{p.cliente}</span>}
                  {p.activo===false && <span style={{ fontSize:11, background:"#54606B", color:"#fff", borderRadius:4, padding:"1px 7px" }}>Cerrado</span>}
                </div>
                {/* Mini barra de progreso */}
                {bolsa > 0 && (
                  <div style={{ marginTop:6, height:5, background:"rgba(255,255,255,.15)", borderRadius:3, overflow:"hidden", position:"relative", maxWidth:320 }}>
                    <div style={{ position:"absolute", height:"100%", width:pctComp+"%", background:"#34D399", borderRadius:3 }} />
                    <div style={{ position:"absolute", height:"100%", left:pctComp+"%", width:pctSol+"%", background:"#FBBF24" }} />
                  </div>
                )}
              </div>
              {/* KPIs compactos */}
              <div style={{ display:"flex", gap:16, flexShrink:0 }}>
                {bolsa > 0 && (
                  <>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:10, color:"#A9B4E8" }}>Bolsa</div>
                      <div style={{ fontSize:13, fontWeight:700, color:"#fff" }}>{mxn(bolsa)}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:10, color:"#A9B4E8" }}>Disponible</div>
                      <div style={{ fontSize:13, fontWeight:700, color: excede?"#F87171":"#34D399" }}>{mxn(disponible)}</div>
                    </div>
                  </>
                )}
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:10, color:"#A9B4E8" }}>Expedientes</div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#fff" }}>{expProy.length}</div>
                </div>
              </div>
            </button>

            {/* Cuerpo expandible */}
            {abierto && <TarjetaBolsa p={p} solicitudes={solicitudes} />}
          </div>
        );
      })}
    </div>
  );
}

function TarjetaBolsa({ p, solicitudes }) {
  const bolsa = p.presupuestoViaticos || p.presupuesto || 0;

  // Expedientes relacionados al proyecto
  const expProy = solicitudes.filter(s =>
    s.proyectoId === p.id || s.proyecto === p.nombre || (s.proyecto||"").startsWith(p.nombre)
  );
  const expComprobado  = expProy.filter(s => s.estado === "CERRADA");
  const expSolicitado  = expProy.filter(s => ["ENVIADA","APROBADA","COMPROBACION"].includes(s.estado));
  const totalComp  = expComprobado.reduce((a,s) => a + (calcular(s).total||0), 0);
  const totalSol   = expSolicitado.reduce((a,s) => a + (calcular(s).presupuestoTotal||calcular(s).total||0), 0);
  const totalUsado = totalComp + totalSol;
  const disponible = bolsa - totalUsado;
  const excede     = totalUsado > bolsa && bolsa > 0;
  const pctComp    = bolsa > 0 ? Math.min(Math.round((totalComp/bolsa)*100), 100) : 0;
  const pctSol     = bolsa > 0 ? Math.min(Math.round((totalSol/bolsa)*100), 100 - pctComp) : 0;

  // Pedidos con desglose
  const pedidos = (p.pedidos||[]).map(ped => {
    const exps   = expProy.filter(s => s.pedido === ped.numero || s.pedidoId === ped.id);
    const comp   = exps.filter(s => s.estado === "CERRADA").reduce((a,s) => a+(calcular(s).total||0), 0);
    const sol    = exps.filter(s => ["ENVIADA","APROBADA","COMPROBACION"].includes(s.estado))
                       .reduce((a,s) => { const c = calcular(s); return a + (c.total > 0 ? c.total : c.presupuestoTotal||0); }, 0);
    const total  = comp + sol;
    // Gasto por departamento en este pedido
    const depPed = {};
    exps.forEach(s => {
      const d = s.departamento || "Sin depto";
      if (!depPed[d]) depPed[d] = { comp:0, sol:0 };
      const calc = calcular(s);
      const t = calc.total || 0;
      const pres = calc.presupuestoTotal || 0;
      if (s.estado === "CERRADA") {
        depPed[d].comp += t;
      } else {
        // Para expedientes en proceso usar el presupuesto si no hay comprobado aún
        depPed[d].sol += t > 0 ? t : pres;
      }
    });
    return { ...ped, comp, sol, total, depPed, exps };
  });

  // Departamentos del proyecto completo
  const depProyecto = {};
  expProy.forEach(s => {
    const d = s.departamento || "Sin depto";
    if (!depProyecto[d]) depProyecto[d] = { comp:0, sol:0 };
    const calc = calcular(s);
    const t = calc.total || 0;
    const pres = calc.presupuestoTotal || 0;
    if (s.estado === "CERRADA") {
      depProyecto[d].comp += t;
    } else {
      depProyecto[d].sol += t > 0 ? t : pres;
    }
  });
  const depsOrdenados = Object.entries(depProyecto).sort((a,b) => (b[1].comp+b[1].sol) - (a[1].comp+a[1].sol));

  const barra = (comp, sol, total, w="100%") => {
    const base = total > 0 ? total : (bolsa || 1);
    const pC = Math.min(Math.round((comp/base)*100), 100);
    const pS = Math.min(Math.round((sol/base)*100), 100 - pC);
    return (
      <div style={{ height:6, background:"var(--surface-0,#EDEFF1)", borderRadius:3, overflow:"hidden", position:"relative", width:w }}>
        <div style={{ position:"absolute", height:"100%", width:pC + "%", background:"#0E7C66" }} />
        <div style={{ position:"absolute", height:"100%", left:pC + "%", width:pS + "%", background:"#B7791F" }} />
      </div>
    );
  };

  return (
    <div>

      {/* ── Cuerpo: KPIs + pedidos + departamentos ── */}
      {/* KPIs rápidos */}
      {bolsa > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:0, borderBottom:"1px solid #E3E6E9" }}>
          {[
            ["Bolsa viáticos", mxn(bolsa),     "#1D2554"],
            ["Solicitado",     mxn(totalSol),   "#B7791F"],
            ["Comprobado",     mxn(totalComp),  "#0E7C66"],
            ["Total usado",    mxn(totalUsado), "#232D6B"],
            ["Disponible",     mxn(disponible), excede ? "#B4443C" : "#0E7C66"],
          ].map(([l,v,c]) => (
            <div key={l} style={{ textAlign:"center", padding:"10px 8px", borderRight:"1px solid #E3E6E9" }}>
              <div style={{ fontSize:10, color:"#8A949C", marginBottom:3, textTransform:"uppercase", letterSpacing:".04em" }}>{l}</div>
              <div style={{ fontSize:14, fontWeight:700, color:c }}>{v}</div>
            </div>
          ))}
        </div>
      )}
      {bolsa === 0 && (
        <div style={{ padding:"10px 16px", fontSize:12, color:"#8A949C", borderBottom:"1px solid #E3E6E9" }}>
          Sin bolsa de viáticos definida. Configúrala en Proyectos → presupuesto de viáticos.
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:0 }}>

        {/* Columna pedidos */}
        <div style={{ padding:"14px 16px", borderRight:"1px solid #3D4A9E" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#A9B4E8", textTransform:"uppercase", letterSpacing:".08em", marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ display:"inline-block", width:3, height:12, background:"#5B9BD5", borderRadius:2 }} />
            Pedidos ({pedidos.length})
          </div>

          {pedidos.length === 0 && (
            <div style={{ fontSize:12, color:"var(--text-muted)" }}>
              Sin pedidos. Agrégalos en la pestaña Proyectos → {"🗂"} Pedidos.
            </div>
          )}

          {pedidos.map(ped => {
            const excPed  = ped.monto > 0 && ped.total > ped.monto;
            const pctPedC = ped.monto > 0 ? Math.min(Math.round((ped.comp/ped.monto)*100),100) : 0;
            const pctPedS = ped.monto > 0 ? Math.min(Math.round((ped.sol/ped.monto)*100), 100-pctPedC) : 0;
            const depsEntries = Object.entries(ped.depPed).sort((a,b)=>(b[1].comp+b[1].sol)-(a[1].comp+a[1].sol));
            const maxDep = depsEntries.reduce((a,[,v])=>Math.max(a,v.comp+v.sol),0)||1;

            return (
              <div key={ped.id} style={{ marginBottom:16, paddingBottom:16, borderBottom:"1px solid #E3E6E9", position:"relative" }}>
                {/* Header pedido */}
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <div>
                    <span style={{ fontFamily:"var(--font-mono)", fontWeight:500, fontSize:13 }}>{ped.numero}</span>
                    {ped.tipo && <span style={{ fontSize:10, color:"var(--text-muted)", marginLeft:6 }}>{ped.tipo}</span>}
                    {ped.descripcion && <div style={{ fontSize:11, color:"var(--text-secondary)", marginTop:1 }}>{ped.descripcion}</div>}
                  </div>
                  <div style={{ textAlign:"right", fontSize:12 }}>
                    {ped.monto > 0 ? (
                      <>
                        <div style={{ fontWeight:500, color: excPed ? "#B4443C" : "var(--text-success,#0E7C66)" }}>
                          {mxn(ped.total)} / {mxn(ped.monto)}
                        </div>
                        <div style={{ fontSize:10, color: excPed ? "#B4443C" : "var(--text-muted)", fontWeight: excPed ? 500 : 400 }}>
                          {excPed ? `⚠ Excedido ${mxn(ped.total-ped.monto)}` : `${pctPedC+pctPedS}% utilizado`}
                        </div>
                      </>
                    ) : (
                      <span style={{ color:"var(--text-muted)", fontSize:11 }}>Sin bolsa — {mxn(ped.total)} gastado</span>
                    )}
                  </div>
                </div>

                {/* Barra del pedido */}
                {ped.monto > 0 && (
                  <>
                    <div style={{ height:6, background:"var(--surface-0,#EDEFF1)", borderRadius:3, overflow:"hidden", position:"relative", marginBottom:4 }}>
                      <div style={{ position:"absolute", height:"100%", width:pctPedC + "%", background: excPed?"#B4443C":"#0E7C66" }} />
                      <div style={{ position:"absolute", height:"100%", left:pctPedC + "%", width:pctPedS + "%", background:"#B7791F" }} />
                    </div>
                    <div style={{ display:"flex", gap:10, fontSize:10, color:"var(--text-muted)", marginBottom:8 }}>
                      <span>{"🟢"} {mxn(ped.comp)} comprobado</span>
                      <span>{"🟡"} {mxn(ped.sol)} solicitado</span>
                    </div>
                  </>
                )}

                {/* Depto dentro del pedido */}
                {depsEntries.length > 0 && (
                  <div style={{ background:"var(--surface-1)", borderRadius:8, padding:10 }}>
                    <div style={{ fontSize:10, fontWeight:500, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:".05em", marginBottom:7 }}>
                      Gasto por depto en este pedido
                    </div>
                    {depsEntries.map(([dep, vals], i) => {
                      const tot = vals.comp + vals.sol;
                      const pctC = Math.round((vals.comp/maxDep)*100);
                      const pctS = Math.round((vals.sol/maxDep)*100);
                      const colors = ["#3987e5","#1baf7a","#eda100","#4a3aa7","#e34948"];
                      return (
                        <div key={dep} style={{ marginBottom: i < depsEntries.length-1 ? 10 : 0 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:3 }}>
                            <span style={{ color:"var(--text-secondary)", fontWeight:500 }}>{dep}</span>
                            <span style={{ fontWeight:500 }}>{mxn(tot)}</span>
                          </div>
                          {/* Barra comprobado */}
                          {vals.comp > 0 && (
                            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                              <div style={{ flex:1, height:5, background:"var(--surface-0,#EDEFF1)", borderRadius:2, overflow:"hidden" }}>
                                <div style={{ height:"100%", width:pctC + "%", background: colors[i%colors.length] }} />
                              </div>
                              <span style={{ fontSize:10, color: colors[i%colors.length], fontWeight:600, minWidth:80, textAlign:"right" }}>
                                {mxn(vals.comp)} comp.
                              </span>
                            </div>
                          )}
                          {/* Barra solicitado — siempre visible si hay monto, con etiqueta clara */}
                          {vals.sol > 0 && (
                            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                              <div style={{ flex:1, height:5, background:"var(--surface-0,#EDEFF1)", borderRadius:2, overflow:"hidden" }}>
                                <div style={{ height:"100%", width:pctS + "%", background:"#B7791F" }} />
                              </div>
                              <span style={{ fontSize:10, color:"#B7791F", fontWeight:600, minWidth:80, textAlign:"right" }}>
                                {mxn(vals.sol)} solic.
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Entrega / avance */}
                {(ped.fechaEntrega || ped.avance) && (
                  <div style={{ display:"flex", gap:10, fontSize:10, color:"var(--text-muted)", marginTop:6 }}>
                    {ped.fechaEntrega && <span>{"📅"} Entrega: {ped.fechaEntrega}</span>}
                    {ped.avance && <span>{"📈"} Avance: {ped.avance}%</span>}
                    {ped.facturaCliente && <span style={{ fontFamily:"var(--font-mono)" }}>{"🧾"} {ped.facturaCliente}</span>}
                  </div>
                )}
              </div>
            );
          })}

          {/* Expedientes sin pedido — con su propio desglose por departamento */}
          {(() => {
            const sinPed = expProy.filter(s => !s.pedidoId && !(p.pedidos||[]).some(ped => s.pedido===ped.numero));
            if (!sinPed.length) return null;
            // Calcular deptos de estos expedientes
            const depSinPed = {};
            sinPed.forEach(s => {
              const d = s.departamento || "Sin depto";
              if (!depSinPed[d]) depSinPed[d] = { comp:0, sol:0 };
              const calc = calcular(s);
              const t = calc.total || 0;
              const pres = calc.presupuestoTotal || 0;
              if (s.estado === "CERRADA") depSinPed[d].comp += t;
              else depSinPed[d].sol += t > 0 ? t : pres;
            });
            const maxDep2 = Object.values(depSinPed).reduce((a,v)=>Math.max(a,v.comp+v.sol),0)||1;
            return (
              <div style={{ marginTop:14, paddingTop:12, borderTop:"0.5px dashed var(--border)" }}>
                <div style={{ fontSize:11, fontWeight:500, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:".05em", marginBottom:8 }}>
                  Sin pedido asignado ({sinPed.length} expediente{sinPed.length!==1?"s":""})
                </div>
                <div style={{ background:"var(--surface-1)", borderRadius:8, padding:10 }}>
                  <div style={{ fontSize:10, fontWeight:500, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:".05em", marginBottom:7 }}>
                    Gasto por depto
                  </div>
                  {Object.entries(depSinPed).sort((a,b)=>(b[1].comp+b[1].sol)-(a[1].comp+a[1].sol)).map(([dep, vals], i) => {
                    const colors = ["#3987e5","#1baf7a","#eda100","#4a3aa7","#e34948"];
                    const pctC = Math.round((vals.comp/maxDep2)*100);
                    const pctS = Math.round((vals.sol/maxDep2)*100);
                    return (
                      <div key={dep} style={{ marginBottom:8 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:3 }}>
                          <span style={{ color:"var(--text-secondary)", fontWeight:500 }}>{dep}</span>
                          <span style={{ fontWeight:500 }}>{mxn(vals.comp+vals.sol)}</span>
                        </div>
                        {vals.comp > 0 && (
                          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                            <div style={{ flex:1, height:5, background:"var(--surface-0,#EDEFF1)", borderRadius:2, overflow:"hidden" }}>
                              <div style={{ height:"100%", width:pctC + "%", background:colors[i%colors.length] }} />
                            </div>
                            <span style={{ fontSize:10, color:colors[i%colors.length], fontWeight:600, minWidth:80, textAlign:"right" }}>{mxn(vals.comp)} comp.</span>
                          </div>
                        )}
                        {vals.sol > 0 && (
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <div style={{ flex:1, height:5, background:"var(--surface-0,#EDEFF1)", borderRadius:2, overflow:"hidden" }}>
                              <div style={{ height:"100%", width:pctS + "%", background:"#B7791F" }} />
                            </div>
                            <span style={{ fontSize:10, color:"#B7791F", fontWeight:600, minWidth:80, textAlign:"right" }}>{mxn(vals.sol)} solic.</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Columna departamentos del proyecto */}
        <div style={{ padding:"14px 16px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#A9B4E8", textTransform:"uppercase", letterSpacing:".08em", marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ display:"inline-block", width:3, height:12, background:"#34D399", borderRadius:2 }} />
            Por departamento
          </div>

          {depsOrdenados.length === 0 ? (
            <div style={{ fontSize:12, color:"var(--text-muted)" }}>Sin expedientes registrados aún.</div>
          ) : depsOrdenados.map(([dep, vals]) => {
            const tot = vals.comp + vals.sol;
            const pctC = totalUsado > 0 ? Math.min(Math.round((vals.comp/totalUsado)*100), 100) : 0;
            const pctS = totalUsado > 0 ? Math.min(Math.round((vals.sol/totalUsado)*100), 100-pctC) : 0;
            return (
              <div key={dep} style={{ marginBottom:14, paddingBottom:14, borderBottom:"1px dashed #E3E6E9" }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:5 }}>
                  <span style={{ fontWeight:600 }}>{dep}</span>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:12 }}>
                    {mxn(tot)} <span style={{ fontSize:10, color:"var(--text-muted)" }}>({pctC+pctS}% del proyecto)</span>
                  </span>
                </div>
                {/* Fila comprobado */}
                {vals.comp > 0 && (
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:11, color:"#0E7C66", fontWeight:600, minWidth:90 }}>{"🟢"} Comprobado</span>
                    <div style={{ flex:1, height:6, background:"var(--surface-0,#EDEFF1)", borderRadius:3, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:pctC + "%", background:"#0E7C66" }} />
                    </div>
                    <span style={{ fontSize:11, fontFamily:"var(--font-mono)", minWidth:72, textAlign:"right", color:"#0E7C66", fontWeight:600 }}>{mxn(vals.comp)}</span>
                  </div>
                )}
                {/* Fila solicitado — siempre visible si tiene monto */}
                {vals.sol > 0 && (
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                    <span style={{ fontSize:11, color:"#B7791F", fontWeight:600, minWidth:90 }}>{"🟡"} Solicitado</span>
                    <div style={{ flex:1, height:6, background:"var(--surface-0,#EDEFF1)", borderRadius:3, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:pctS + "%", background:"#B7791F" }} />
                    </div>
                    <span style={{ fontSize:11, fontFamily:"var(--font-mono)", minWidth:72, textAlign:"right", color:"#B7791F", fontWeight:600 }}>{mxn(vals.sol)}</span>
                  </div>
                )}
                {/* Si solo hay solicitado (sin comprobado aún) aclarar */}
                {vals.comp === 0 && vals.sol > 0 && (
                  <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:2, paddingLeft:98 }}>
                    Pendiente de comprobación
                  </div>
                )}
              </div>
            );
          })}

          {/* Leyenda */}
          <div style={{ marginTop:16, paddingTop:12, borderTop:"0.5px solid var(--border)" }}>
            <div style={{ fontSize:10, fontWeight:500, color:"var(--text-muted)", marginBottom:8 }}>Referencia de colores</div>
            <div style={{ display:"flex", flexDirection:"column", gap:5, fontSize:11, color:"var(--text-secondary)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:14, height:6, background:"#0E7C66", borderRadius:2 }}></div>
                Comprobado (expedientes cerrados)
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:14, height:6, background:"#B7791F", borderRadius:2 }}></div>
                Solicitado (en proceso de aprobación)
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:14, height:6, background:"#B4443C", borderRadius:2 }}></div>
                Excedido
              </div>
            </div>
          </div>

          {/* Todos los expedientes */}
          {expProy.length > 0 && (
            <details style={{ marginTop:12 }}>
              <summary style={{ fontSize:12, color:"var(--text-accent,#3644AC)", cursor:"pointer", fontWeight:500 }}>
                Ver todos los expedientes ({expProy.length})
              </summary>
              <table style={{ width:"100%", borderCollapse:"collapse", marginTop:8, fontSize:11 }}>
                <thead>
                  <tr>{["Folio","Tipo","Solicitante","Pedido","Total","Estado"].map(h => (
                    <th key={h} style={{ ...S.th, fontSize:9 }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {expProy.map(s => (
                    <tr key={s.id}>
                      <td style={{ ...S.td, fontSize:10, fontFamily:"var(--font-mono)" }}>{s.folio}</td>
                      <td style={{ ...S.td, fontSize:10 }}>{s.tipo==="reembolso"?"Reimb.":s.tipo==="caja-chica"?"C.Chica":"Viaje"}</td>
                      <td style={{ ...S.td, fontSize:10 }}>{s.solicitante}</td>
                      <td style={{ ...S.td, fontSize:10, fontFamily:"var(--font-mono)" }}>{s.pedido||"—"}</td>
                      <td style={{ ...S.td, fontSize:10, textAlign:"right", ...S.num }}>{mxn(calcular(s).total)}</td>
                      <td style={S.td}><Chip estado={s.estado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}


// ── PanelPedidos ─────────────────────────────────────────────
function PanelPedidos({ proyecto, nuevoPed, setNuevoPed, onAgregar, onEliminar, onActualizar }) {
  if (!proyecto) return null;
  const [editId, setEditId] = useState(null);
  const TIPOS = ["Servicio","Material","Mixto","Mantenimiento","Otro"];

  return (
    <div style={{ margin:"8px 16px 16px", border:"1px solid #3644AC", borderRadius:8, overflow:"hidden" }}>
      <div style={{ background:"#3644AC", color:"#fff", padding:"8px 14px", fontWeight:700, fontSize:13 }}>
        Pedidos de {proyecto.nombre}
      </div>
      <div style={{ padding:14 }}>
        <div style={{ display:"grid", gridTemplateColumns:"140px 1fr 120px 110px 120px", gap:8, marginBottom:10, alignItems:"end" }}>
          <Campo label="Numero *">
            <input style={{ ...S.input, fontFamily:"ui-monospace,monospace" }}
              value={nuevoPed.numero} onChange={e => setNuevoPed({...nuevoPed, numero:e.target.value})}
              placeholder="PED-001" />
          </Campo>
          <Campo label="Descripcion">
            <input style={S.input} value={nuevoPed.descripcion}
              onChange={e => setNuevoPed({...nuevoPed, descripcion:e.target.value})} />
          </Campo>
          <Campo label="Tipo">
            <select style={S.input} value={nuevoPed.tipo||"Servicio"}
              onChange={e => setNuevoPed({...nuevoPed, tipo:e.target.value})}>
              {TIPOS.map(t => <option key={t}>{t}</option>)}
            </select>
          </Campo>
          <Campo label="Bolsa del pedido">
            <input type="number" style={{ ...S.input, textAlign:"right" }}
              value={nuevoPed.monto} onChange={e => setNuevoPed({...nuevoPed, monto:e.target.value})}
              placeholder="0.00" />
          </Campo>
          <Campo label=" ">
            <button style={{ ...S.btn(true), width:"100%" }}
              disabled={!nuevoPed.numero.trim()}
              onClick={() => {
                onAgregar({ id:uid(), ...nuevoPed, monto:Number(nuevoPed.monto)||0, fecha:hoy() });
                setNuevoPed({ numero:"", descripcion:"", monto:"", tipo:"Servicio", fechaEntrega:"", avance:"", facturaCliente:"" });
              }}>
              + Agregar pedido
            </button>
          </Campo>
        </div>

        {(proyecto.pedidos||[]).length === 0 ? (
          <div style={{ color:"#8A949C", fontSize:12, padding:"8px 0" }}>
            Sin pedidos aun. Llena el formulario arriba y clic en "+ Agregar pedido".
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>{["Numero","Descripcion","Tipo","Bolsa","Fecha alta",""].map(h => (
                <th key={h} style={{ ...S.th, fontSize:10 }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {(proyecto.pedidos||[]).map(ped => (
                editId === ped.id ? (
                  <tr key={ped.id}>
                    <td style={S.td}><input style={{ ...S.input, padding:"3px 6px", fontFamily:"ui-monospace,monospace" }} value={ped.numero} onChange={e => onActualizar(ped.id, {numero:e.target.value})} /></td>
                    <td style={S.td}><input style={{ ...S.input, padding:"3px 6px" }} value={ped.descripcion||""} onChange={e => onActualizar(ped.id, {descripcion:e.target.value})} /></td>
                    <td style={S.td}><select style={{ ...S.input, padding:"3px 6px" }} value={ped.tipo||"Servicio"} onChange={e => onActualizar(ped.id, {tipo:e.target.value})}>{TIPOS.map(t=><option key={t}>{t}</option>)}</select></td>
                    <td style={S.td}><input type="number" style={{ ...S.input, padding:"3px 6px", textAlign:"right" }} value={ped.monto||""} onChange={e => onActualizar(ped.id, {monto:Number(e.target.value)||0})} /></td>
                    <td style={S.td}>{ped.fecha}</td>
                    <td style={S.td}><button style={{ ...S.btn(true), padding:"3px 8px", fontSize:11 }} onClick={() => setEditId(null)}>Listo</button></td>
                  </tr>
                ) : (
                  <tr key={ped.id}>
                    <td style={{ ...S.td, fontFamily:"ui-monospace,monospace", fontWeight:700 }}>{ped.numero}</td>
                    <td style={{ ...S.td, fontSize:12 }}>{ped.descripcion||"—"}</td>
                    <td style={{ ...S.td, fontSize:12 }}>{ped.tipo||"—"}</td>
                    <td style={{ ...S.td, textAlign:"right" }}>{ped.monto ? mxn(ped.monto) : "—"}</td>
                    <td style={{ ...S.td, fontSize:11 }}>{ped.fecha}</td>
                    <td style={S.td}>
                      <div style={{ display:"flex", gap:6 }}>
                        <button style={{ ...S.btn(false), padding:"2px 8px", fontSize:11 }} onClick={() => setEditId(ped.id)}>Editar</button>
                        <button style={{ border:"none", background:"none", color:"#B4443C", cursor:"pointer", fontSize:12 }} onClick={() => onEliminar(ped.id)}>Quitar</button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ================================================================
// MÓDULO SALDOS EN CONTRA
// ================================================================
function SaldosEnContra({ solicitudes, empresa, onActualizar, onActualizarBatch, usuario, onIrExpediente }) {
  const [tab, setTab]             = useState("resumen");   // resumen | cobrar | pagar | proceso | historial
  const [busq, setBusq]           = useState("");
  const [mesFiltro, setMesFiltro] = useState("");          // "2026-07" o "" para todos
  const [cruceActivo, setCruceActivo]   = useState(null);
  const [pagoActivo, setPagoActivo]     = useState(null);  // { sol, tipo }
  const [metodoPago, setMetodoPago]     = useState("");
  const [notaTesor, setNotaTesor]       = useState("");
  const [empExpandido, setEmpExpandido] = useState({});    // id -> bool
  const [confirm, setConfirm]           = useState(null);  // { msg, onOk }

  // ── Calcular posición de cada empleado ──────────────────────
  const posicionPorEmpleado = {};
  solicitudes.forEach(s => {
    const t  = calcular(s);
    const id = s.solicitanteId;
    if (!posicionPorEmpleado[id]) posicionPorEmpleado[id] = {
      nombre: s.solicitante || id, id,
      porCobrar: [], porPagar: [], enProceso: [], enRHPendiente: [],
      historialNomina: [], historial: []
    };
    const emp = posicionPorEmpleado[id];

    // Saldo en contra
    // Si no hay movimientos pero hay enTesoreria:true, usar fondoEfectivo directamente
    const sinMovsContra = (s.movimientos||[]).length === 0;
    const fondoFallback = sinMovsContra && s.enTesoreria && s.tipo !== "reembolso"
      ? (Number(s.fondoEfectivo)||0)
      : 0;
    const enContraBruto = Math.max(0, (s.fondoEfectivo||0) + (t.retirosClara||0) - t.efectivo)
                        + (t.rechazadosClara || 0) + fondoFallback;
    const yaRecuperadoPorCruce  = s.montoCruceContra || 0;
    const yaRecuperadoDirecto   = (s.saldoEstado === "recuperado" && !Number(s.montoCruceContra) && !Number(s.montoCruceReemb))
                                  ? enContraBruto : 0;
    const enContra = Math.max(0, enContraBruto - yaRecuperadoPorCruce - yaRecuperadoDirecto);
    // Si ya se envió a RH para descuento, va a enRHPendiente, no a porCobrar
    if (enContra > 0.5 && !s.enRH && !s.descuentoAplicado) emp.porCobrar.push({ sol: s, t, monto: enContra, tipo: "saldo_contra" });

    // Reembolso pendiente
    const claraAprobadoBruto = t.reembolsoClaraAprobado || 0;
    // Fallback: si hay enTesoreria:true pero sin movimientos, usar montoClara o montoSolicitado
    const sinMovimientos = (s.movimientos||[]).length === 0;
    // Fallback para expedientes en Tesorería sin movimientos en Supabase
    const montoFallback = sinMovimientos && s.enTesoreria
      ? (Number(s.montoClara)||0) || (Number(s.montoSolicitado)||0)
      : 0;
    const manualBruto = (s.tipo === "reembolso" && (s.estado === "APROBADA" || s.estado === "CERRADA" || s.estado === "ENVIADA" || s.enTesoreria) ? (Number(s.montoSolicitado)||0) : 0)
                      + (s.estado === "CERRADA" && t.reembolso > 0 ? t.reembolso : 0)
                      + montoFallback;
    const reembBruto  = claraAprobadoBruto + manualBruto;
    const yaPagadoReembCruce   = s.montoCruceReemb || 0;
    const yaPagadoReembDirecto = (s.fechaPago && !s.montoCruceReemb) ? reembBruto : 0;
    const reemb = Math.max(0, reembBruto - yaPagadoReembCruce - yaPagadoReembDirecto);
    // Si ya fue a nómina, va a enRHPendiente — no a porPagar
    const yaEnNomina = s.enRH && !s.descuentoAplicado;
    if (reemb > 0.5 && !s.reembolsoEnProceso && !yaEnNomina) emp.porPagar.push({ sol: s, t, monto: reemb, tipo: "reembolso" });
    if (s.reembolsoEnProceso && !s.fechaPago && !yaEnNomina) emp.enProceso.push({ sol: s, t, monto: Math.max(0, reembBruto-(s.montoCruceReemb||0)), info: s.reembolsoEnProceso });
    if (yaEnNomina) emp.enRHPendiente.push({ sol: s, monto: (reembBruto||0) || (t.rechazadosClara||0), fecha: s.fechaEnvioRH||"", por: s.enviadoRHPor||"" });
    if (s.descuentoAplicado) emp.historialNomina.push({ sol: s, monto: t.rechazadosClara||0, fecha: s.fechaDescuentoNomina||"", por: s.descuentoConfirmadoPor||"" });

    // Historial de movimientos ya gestionados
    if (s.saldoEstado === "recuperado" || s.fechaPago || s.montoCruceContra || s.montoCruceReemb) {
      const montoCobrado = s.montoCruceContra || Math.max(0,(s.fondoEfectivo||0)+(t.retirosClara||0)-t.efectivo)+(t.rechazadosClara||0);
      const montoPagado  = s.montoCruceReemb  || t.reembolso || s.montoSolicitado || 0;
      const esCruce = !!(s.montoCruceContra || s.montoCruceReemb);
      const esCobro = s.saldoEstado === "recuperado" || s.montoCruceContra > 0;
      const fechaRef = s.saldoFechaRecuperacion || s.fechaPago || s.fechaSolicitud || "";
      emp.historial.push({ sol: s, t, esCobro, esCruce, montoCobrado, montoPagado, fechaRef,
        texto: esCobro
          ? (esCruce ? "Compensado" : "Cobrado") + " " + mxn(montoCobrado)
            + (s.saldoMetodo && !esCruce ? " via " + s.saldoMetodo : "")
            + " · " + fechaRef
          : (esCruce ? "Compensado" : "Pagado") + " " + mxn(montoPagado)
            + (s.pagadoPor && !esCruce ? " via " + (s.reembolsoEnProceso?.metodo || s.pagadoPor || "") : "")
            + " · " + (s.fechaPago||"") });
    }
  });

  const empleados = Object.values(posicionPorEmpleado).map(emp => {
    const totalCobrar = emp.porCobrar.reduce((a,x) => a+x.monto, 0);
    const totalPagar  = emp.porPagar.reduce((a,x)  => a+x.monto, 0);
    const cruceEfectivo = Math.max(
      emp.porPagar.reduce((a,x)  => a+(Number(x.sol?.montoCruceReemb)||0),  0),
      emp.porCobrar.reduce((a,x) => a+(Number(x.sol?.montoCruceContra)||0), 0)
    );
    const cobrarReal = Math.max(0, totalCobrar - cruceEfectivo);
    const pagarReal  = Math.max(0, totalPagar  - cruceEfectivo);
    const neto = pagarReal - cobrarReal;
    return { ...emp, totalCobrar, totalPagar, cobrarReal, pagarReal, neto };
  }).filter(e => e.totalCobrar>0 || e.totalPagar>0 || e.historial.length>0 || (e.enProceso||[]).length>0 || (e.enRHPendiente||[]).length>0);

  // Filtro por búsqueda
  const filtrados = empleados.filter(e => !busq || e.nombre.toLowerCase().includes(busq.toLowerCase()));

  // Totales globales
  const totCobrar = empleados.reduce((a,e) => a+e.totalCobrar, 0);
  const totPagar  = empleados.reduce((a,e) => a+e.totalPagar,  0);
  const totEnProceso = empleados.reduce((a,e) => a+(e.enProceso||[]).reduce((b,x) => b+x.monto, 0), 0);
  const totRH     = empleados.reduce((a,e) => a+(e.enRHPendiente||[]).reduce((b,x) => b+x.monto, 0), 0);

  // ── Acciones ─────────────────────────────────────────────────
  const METODOS_COBRO = ["Deposito bancario del empleado", "Descuento en nomina", "Efectivo en caja", "Compensacion con reembolso"];
  const METODOS_PAGO  = ["Transferencia bancaria", "Deposito en nomina", "Efectivo en caja", "Compensacion con saldo en contra"];

  const registrarMovimiento = async () => {
    if (!pagoActivo || !metodoPago) return;
    const { sol, tipo } = pagoActivo;
    const esDeposito     = /deposito|transfer|nómina|nomina/i.test(metodoPago);
    const esCompensacion = /compensac/i.test(metodoPago);
    const esNomina       = /nómina|nomina/i.test(metodoPago);

    const fechaOp = pagoActivo.fechaOp || hoy();
    const bancoOrigen = pagoActivo.bancoOrigen || "";
    const clabeDestino = pagoActivo.clabeDestino || "";
    const refCompleta = [notaTesor, bancoOrigen ? "Banco: "+bancoOrigen : "", clabeDestino ? "CLABE: "+clabeDestino : ""].filter(Boolean).join(" · ");

    if (tipo === "reembolso") {
      const yaPagado = !esDeposito || esCompensacion;
      const infoNomina = esNomina ? {
        metodo: metodoPago, periodo: pagoActivo.periodoNomina||hoy().slice(0,7),
        fechaCorte: pagoActivo.fechaCorteNomina||fechaOp,
        folioMicrosip: pagoActivo.folioMicrosip||"",
        por: usuario.nombre, fecha: fechaOp
      } : null;
      await onActualizar({ ...sol,
        fechaPago: yaPagado ? fechaOp : null,
        pagadoPor: yaPagado ? usuario.nombre : null,
        enTesoreria: !yaPagado && !esNomina,
        enRH: esNomina || undefined,
        fechaEnvioRH: esNomina ? fechaOp : undefined,
        enviadoRHPor: esNomina ? usuario.nombre : undefined,
        infoRH: infoNomina || sol.infoRH,
        reembolsoEnProceso: esDeposito && !esCompensacion ? {
          metodo: metodoPago, fecha: fechaOp, por: usuario.nombre,
          nota: refCompleta, referencia: notaTesor,
          bancoOrigen, clabeDestino
        } : null,
        notaTesoreria: refCompleta,
        estado: (yaPagado && !esNomina) ? "CERRADA" : sol.estado,
        historial: [...(sol.historial||[]), {
          fecha: fechaOp, quien: usuario.nombre,
          accion: "Reembolso " + (esNomina?"enviado a RH para descuento en nomina": yaPagado?"pagado":"en proceso") +
            " via " + metodoPago + (refCompleta?" · "+refCompleta:"") +
            (infoNomina?.periodo ? " · Periodo: "+infoNomina.periodo : "") +
            (infoNomina?.fechaCorte ? " · Corte: "+infoNomina.fechaCorte : "") +
            (infoNomina?.folioMicrosip ? " · Referencia interna: "+infoNomina.folioMicrosip : "")
        }]
      });
    } else {
      const cerrarAuto = !esNomina && sol.estado !== "CERRADA";
      await onActualizar({ ...sol,
        saldoEstado: esNomina ? "pendiente" : "recuperado",
        saldoMetodo: metodoPago,
        saldoFechaRecuperacion: esNomina ? null : fechaOp,
        notaTesoreria: refCompleta,
        estado: cerrarAuto ? "CERRADA" : sol.estado,
        enRH: esNomina || undefined,
        fechaEnvioRH: esNomina ? fechaOp : undefined,
        enviadoRHPor: esNomina ? usuario.nombre : undefined,
        historial: [...(sol.historial||[]), {
          fecha: fechaOp, quien: usuario.nombre,
          accion: "Cobro: " + metodoPago + (esNomina?" — enviado a RH":"") + (cerrarAuto?" — CERRADO":"") + (refCompleta?" · "+refCompleta:"")
        }]
      });
    }
    setPagoActivo(null); setMetodoPago(""); setNotaTesor("");
  };

  const confirmarDescuentoNomina = async (sol) => {
    const t = calcular(sol);
    const monto = t.rechazadosClara || 0;
    await onActualizar({ ...sol,
      descuentoAplicado: true,
      descuentoConfirmadoPor: usuario.nombre,
      fechaDescuentoNomina: hoy(),
      saldoEstado: "recuperado",
      saldoFechaRecuperacion: hoy(),
      estado: "CERRADA",
      historial: [...(sol.historial||[]), { fecha: hoy(), quien: usuario.nombre, accion: "Descuento en nomina aplicado " + mxn(monto) + " — expediente CERRADO" }]
    });
  };

  const revertirMovimiento = async (sol) => {
    await onActualizar({ ...sol,
      saldoEstado: "pendiente", saldoMetodo: null, saldoFechaRecuperacion: null,
      montoCruceContra: null, montoCruceReemb: null,
      fechaPago: null, pagadoPor: null, reembolsoEnProceso: null,
      enTesoreria: true,
      historial: [...(sol.historial||[]), { fecha: hoy(), quien: usuario.nombre, accion: "Movimiento de Tesoreria revertido" }]
    });
  };

  const compensarSaldos = async (solContra, solReemb, montoCruce) => {
    const t1 = calcular(solContra);
    const t2 = calcular(solReemb);
    const saldoContraTotal = Math.max(0,(solContra.fondoEfectivo||0)+(t1.retirosClara||0)-t1.efectivo)+(t1.rechazadosClara||0);
    const reembTotal       = t2.reembolsoClaraAprobado || t2.reembolso || solReemb.montoSolicitado || 0;
    const yaCompContra = Number(solContra.montoCruceContra) || 0;
    const yaCompReemb  = Number(solReemb.montoCruceReemb)  || 0;
    const maxCruce = Math.min(saldoContraTotal - yaCompContra, reembTotal - yaCompReemb);
    if (montoCruce > maxCruce + 0.01) {
      setConfirm({ msg: "El monto a compensar (" + mxn(montoCruce) + ") excede el saldo disponible (" + mxn(Math.max(0,maxCruce)) + ")", onOk: null });
      return;
    }
    const nuevoContra  = yaCompContra + montoCruce;
    const nuevoReemb   = yaCompReemb  + montoCruce;
    const contraRest   = Math.max(0, saldoContraTotal - nuevoContra);
    const reembRest    = Math.max(0, reembTotal - nuevoReemb);

    if (solContra.id === solReemb.id) {
      const ambos = contraRest < 0.5 && reembRest < 0.5;
      await onActualizar({ ...solContra,
        saldoEstado: contraRest < 0.5 ? "recuperado" : "pendiente",
        saldoMetodo: "Compensacion interna", estado: ambos ? "CERRADA" : solContra.estado,
        montoCruceContra: nuevoContra, montoCruceReemb: nuevoReemb,
        fechaPago: reembRest < 0.5 ? hoy() : null,
        pagadoPor: reembRest < 0.5 ? "Compensacion interna" : null,
        saldoFechaRecuperacion: contraRest < 0.5 ? hoy() : solContra.saldoFechaRecuperacion,
        historial: [...(solContra.historial||[]), { fecha:hoy(), quien:usuario.nombre,
          accion: "Compensacion interna " + mxn(montoCruce) + ": cobro " + (contraRest<0.5?"liquidado":"restante "+mxn(contraRest)) + ", pago " + (reembRest<0.5?"liquidado":"restante "+mxn(reembRest)) + (ambos?" — CERRADO":"") }]
      });
    } else {
      const solContraActual = { ...solContra,
        saldoEstado: contraRest < 0.5 ? "recuperado" : "pendiente",
        saldoMetodo: "Compensacion con " + solReemb.folio,
        estado: contraRest < 0.5 ? "CERRADA" : solContra.estado,
        montoCruceContra: nuevoContra,
        saldoFechaRecuperacion: contraRest < 0.5 ? hoy() : solContra.saldoFechaRecuperacion,
        historial: [...(solContra.historial||[]), { fecha:hoy(), quien:usuario.nombre,
          accion: "Compensado " + mxn(montoCruce) + " con " + solReemb.folio + (contraRest>0.5?" — restante "+mxn(contraRest):" — liquidado y CERRADO") }]
      };
      const solReembActual = { ...solReemb,
        fechaPago: reembRest < 0.5 ? hoy() : null,
        pagadoPor: reembRest < 0.5 ? "Compensacion con " + solContra.folio : null,
        estado: reembRest < 0.5 ? "CERRADA" : solReemb.estado,
        montoCruceReemb: nuevoReemb,
        historial: [...(solReemb.historial||[]), { fecha:hoy(), quien:usuario.nombre,
          accion: "Compensado " + mxn(montoCruce) + " con " + solContra.folio + (reembRest>0.5?" — restante "+mxn(reembRest):" — liquidado y CERRADO") }]
      };
      if (onActualizarBatch) await onActualizarBatch([solContraActual, solReembActual]);
      else { await onActualizar(solContraActual); await onActualizar(solReembActual); }
    }
    setCruceActivo(null);
  };

  // ── Helpers de UI ─────────────────────────────────────────────
  const toggleEmp = (id) => setEmpExpandido(p => ({ ...p, [id]: !p[id] }));

  function TabBtn({ id, label, badge, color }) {
    const activo = tab === id;
    return (
      <button onClick={() => setTab(id)}
        style={{ padding:"9px 16px", border:"none", borderBottom: activo ? "2.5px solid " + (color||"#232D6B") : "2.5px solid transparent",
          background:"transparent", color: activo ? (color||"#232D6B") : "#6B7280",
          fontWeight: activo ? 700 : 500, fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }}>
        {label}
        {badge > 0 && <span style={{ background: color||"#232D6B", color:"#fff", borderRadius:999, fontSize:10, fontWeight:800, padding:"1px 6px" }}>{badge}</span>}
      </button>
    );
  }

  function FolioBtn({ sol }) {
    return (
      <button style={{ fontFamily:"ui-monospace,monospace", fontSize:11, fontWeight:700, color:"#3644AC",
        background:"none", border:"1.5px solid #C6D0E8", borderRadius:4, padding:"2px 7px", cursor:"pointer" }}
        onClick={() => onIrExpediente && onIrExpediente(sol.id)}>
        {sol.folio}
      </button>
    );
  }

  function CardEmpleado({ emp }) {
    const expandido = empExpandido[emp.id];
    const tieneAccion = emp.porCobrar.length > 0 || emp.porPagar.length > 0;
    const tieneHistorial = emp.historial.length > 0;
    const color = emp.neto > 0 ? "#15803D" : emp.neto < 0 ? "#B91C1C" : "#6B7280";
    const bgColor = emp.neto > 0 ? "#F0FDF4" : emp.neto < 0 ? "#FEF2F2" : "#F9FAFB";

    return (
      <div style={{ border:"1.5px solid #E3E6E9", borderRadius:10, overflow:"hidden", marginBottom:10,
        boxShadow: tieneAccion ? "0 1px 4px rgba(0,0,0,.07)" : "none" }}>
        {/* Header del empleado — siempre visible */}
        <div onClick={() => toggleEmp(emp.id)} style={{ display:"flex", alignItems:"center", gap:12,
          padding:"12px 16px", background: expandido ? "#F7F8FF" : "#fff", cursor:"pointer",
          borderBottom: expandido ? "1px solid #E3E6E9" : "none" }}>
          <div style={{ width:34, height:34, borderRadius:"50%", background:"#E9EEF8",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:15, fontWeight:700, color:"#3644AC", flexShrink:0 }}>
            {emp.nombre.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:700, fontSize:14, color:"#1D2554", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{emp.nombre}</div>
            <div style={{ fontSize:11, color:"#6B7280", marginTop:1 }}>
              {emp.porCobrar.length > 0 && <span style={{ color:"#B91C1C", marginRight:10 }}>Por cobrar: {mxn(emp.totalCobrar)}</span>}
              {emp.porPagar.length  > 0 && <span style={{ color:"#15803D", marginRight:10 }}>Por pagar: {mxn(emp.totalPagar)}</span>}
              {(emp.enProceso||[]).length > 0 && <span style={{ color:"#B7791F", marginRight:10 }}>En proceso: {(emp.enProceso||[]).length}</span>}
              {(emp.enRHPendiente||[]).length > 0 && <span style={{ color:"#065F46", marginRight:10 }}>RH pendiente: {(emp.enRHPendiente||[]).length}</span>}
              {!tieneAccion && tieneHistorial && <span style={{ color:"#6B7280" }}>Sin pendientes</span>}
            </div>
            {/* Datos bancarios del empleado — visibles para quien gestiona pagos */}
            {(puedeActuarTesoreria(usuario) || esAdmin(usuario)) && (() => {
              // Buscar datos bancarios de cualquier solicitud del empleado
              const solConDB = emp.porPagar.concat(emp.enProceso||[]).find(x => x.sol?.datosBancarios?.clabe || x.sol?.datosBancarios?.banco);
              const db = solConDB?.sol?.datosBancarios || {};
              if (!db.banco && !db.clabe) return null;
              return (
                <div style={{ fontSize:10, color:"#3644AC", marginTop:3, fontFamily:"ui-monospace,monospace" }}>
                  Banco: {db.banco||"—"} · CLABE: {db.clabe||"—"} · Titular: {db.titularCuenta||emp.nombre}
                </div>
              );
            })()}
          </div>
          {/* Posición neta */}
          <div style={{ textAlign:"right", flexShrink:0 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#6B7280", marginBottom:2 }}>Posición neta</div>
            <div style={{ fontSize:16, fontWeight:800, color, background: bgColor, padding:"3px 10px", borderRadius:6 }}>
              {emp.neto === 0 ? "Saldado" : (emp.neto > 0 ? "A favor " : "Adeuda ") + mxn(Math.abs(emp.neto))}
            </div>
          </div>
          <div style={{ fontSize:18, color:"#9CA3AF", transform: expandido ? "rotate(90deg)" : "none", transition:"transform .2s" }}>›</div>
        </div>

        {/* Contenido expandible */}
        {expandido && (
          <div style={{ padding:"14px 16px", background:"#FAFBFF" }}>

            {/* Saldos en contra — POR COBRAR */}
            {emp.porCobrar.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#B91C1C", textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>
                  Por cobrar al empleado
                </div>
                {emp.porCobrar.map(({ sol, monto }, i) => (
                  <div key={sol.id + "c" + i} style={{ display:"flex", alignItems:"center", gap:10,
                    padding:"9px 12px", background:"#FEF2F2", borderRadius:8, marginBottom:6, flexWrap:"wrap" }}>
                    <FolioBtn sol={sol} />
                    <span style={{ fontSize:12, flex:1, minWidth:120 }}>{sol.proyecto || sol.tipo || "Expediente"}</span>
                    <span style={{ fontSize:11, color:"#6B7280" }}>{sol.fechaSolicitud||""}</span>
                    <span style={{ fontWeight:800, color:"#B91C1C", fontSize:14 }}>{mxn(monto)}</span>
                    {(puedeActuarTesoreria(usuario) || esAdmin(usuario)) && (
                      <button style={{ ...S.btn(false), padding:"5px 12px", fontSize:12, borderColor:"#FECACA", color:"#B91C1C" }}
                        onClick={() => { setPagoActivo({ sol, monto, tipo:"cobro" }); setMetodoPago(""); setNotaTesor(""); }}>
                        Registrar cobro
                      </button>
                    )}
                    {(esAdmin(usuario) || esTesoreria(usuario)) && (
                      <button style={{ ...S.btn(false), padding:"5px 12px", fontSize:12, borderColor:"#E3E6E9", color:"#6B7280" }}
                        onClick={() => setConfirm({ msg:"Devolver el expediente " + sol.folio + " a comprobación. El empleado podrá corregir o completar la información.", onOk: async () => {
                          await onActualizar({ ...sol,
                            enTesoreria: false, fechaEnvioTesoreria: null, enviadoPorTesoreria: null,
                            estado: "COMPROBACION",
                            historial: [...(sol.historial||[]), { fecha:hoy(), quien:usuario.nombre, accion:"Devuelto a comprobación desde Tesorería" }]
                          });
                        }})}>
                        Devolver
                      </button>
                    )}
                    {/* Compensar si hay reembolso pendiente del mismo empleado */}
                    {emp.porPagar.length > 0 && (puedeActuarTesoreria(usuario) || esAdmin(usuario)) && (
                      <button style={{ ...S.btn(false), padding:"5px 12px", fontSize:12, borderColor:"#BFDBFE", color:"#1D4ED8" }}
                        onClick={() => {
                          const solReemb = emp.porPagar[0].sol;
                          const montoDisponContra = monto;
                          const montoDisponReemb  = emp.porPagar[0].monto;
                          setCruceActivo({ solContra: sol, solReemb, totalContra: montoDisponContra, totalReemb: montoDisponReemb, montoCruce: Math.min(montoDisponContra, montoDisponReemb), nombre: emp.nombre });
                        }}>
                        Compensar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Reembolsos pendientes — POR PAGAR */}
            {emp.porPagar.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#15803D", textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>
                  Por pagar al empleado
                </div>
                {emp.porPagar.map(({ sol, monto }, i) => {
                  const db = sol.datosBancarios || {};
                  const tieneDB = db.clabe || db.banco || sol.pagadoPor;
                  return (
                    <div key={sol.id + "p" + i} style={{ border:"1px solid #BBF7D0", borderRadius:8, marginBottom:6, overflow:"hidden" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", background:"#F0FDF4", flexWrap:"wrap" }}>
                        <FolioBtn sol={sol} />
                        <div style={{ flex:1, minWidth:120 }}>
                          <div style={{ fontSize:12, fontWeight:600 }}>{sol.proyecto || sol.tipo || "Expediente"} {sol.objetivo ? "— " + sol.objetivo : ""}</div>
                          <div style={{ fontSize:10, color:"#374151" }}>{sol.fechaInicio||""}{sol.fechaFin ? " al " + sol.fechaFin : ""} · {sol.solicitante||""}</div>
                        </div>
                        <span style={{ fontSize:11, color:"#6B7280" }}>{sol.fechaSolicitud||""}</span>
                        <span style={{ fontWeight:800, color:"#15803D", fontSize:14 }}>{mxn(monto)}</span>
                        {(puedeActuarTesoreria(usuario) || esAdmin(usuario)) && (
                          <button style={{ ...S.btn(false), padding:"5px 12px", fontSize:12, borderColor:"#BBF7D0", color:"#15803D" }}
                            onClick={() => {
                              const db = sol.datosBancarios || {};
                              setPagoActivo({ sol, monto, tipo:"reembolso", clabeDestino: db.clabe||"", bancoOrigen:"" });
                              setMetodoPago("Transferencia bancaria");
                              setNotaTesor("");
                            }}>
                            Registrar pago
                          </button>
                        )}
                        {(esAdmin(usuario) || esTesoreria(usuario)) && (
                          <button style={{ ...S.btn(false), padding:"5px 12px", fontSize:12, borderColor:"#FDE68A", color:"#B7791F" }}
                            onClick={() => setConfirm({ msg:"Devolver el expediente " + sol.folio + " a comprobacion. El empleado podra corregir o agregar informacion.", onOk: async () => {
                              await onActualizar({ ...sol,
                                enTesoreria: false, fechaEnvioTesoreria: null, enviadoPorTesoreria: null,
                                estado: "COMPROBACION",
                                historial: [...(sol.historial||[]), { fecha:hoy(), quien:usuario.nombre, accion:"Devuelto a comprobacion desde Tesoreria — pendiente de correccion" }]
                              });
                            }})}>
                            Devolver
                          </button>
                        )}
                      </div>
                      {/* Datos bancarios completos */}
                      {(db.banco || db.clabe) && (
                        <div style={{ padding:"8px 12px", background:"#ECFDF5", borderTop:"1px solid #BBF7D0", fontSize:11 }}>
                          <span style={{ color:"#065F46", fontWeight:700, marginRight:8 }}>Datos para transferencia:</span>
                          <span style={{ fontFamily:"ui-monospace,monospace" }}>
                            {db.banco||"—"} · Titular: {db.titularCuenta||sol.solicitante||"—"} · CLABE: {db.clabe||"—"}
                            {db.cuentaBanco ? " · Cuenta: " + db.cuentaBanco : ""}
                          </span>
                        </div>
                      )}
                      {!db.banco && !db.clabe && (
                        <div style={{ padding:"6px 12px", background:"#FFFBEB", borderTop:"1px solid #FDE68A", fontSize:11, color:"#92400E" }}>
                          Sin datos bancarios — pedir al empleado que los registre en Mi perfil
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* En proceso de deposito */}
            {(emp.enProceso||[]).length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#B7791F", textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>En proceso de deposito</div>
                {(emp.enProceso||[]).map(({ sol, monto, info }, i) => (
                  <div key={sol.id + "ep" + i} style={{ display:"flex", alignItems:"center", gap:10,
                    padding:"9px 12px", background:"#FFFBEB", borderRadius:8, marginBottom:6, flexWrap:"wrap" }}>
                    <FolioBtn sol={sol} />
                    <div style={{ flex:1, minWidth:120 }}>
                      <div style={{ fontSize:12 }}>{info.metodo}</div>
                      <div style={{ fontSize:10, color:"#B7791F" }}>Iniciado: {info.fecha} por {info.por}{info.nota ? " · " + info.nota : ""}</div>
                    </div>
                    <span style={{ fontWeight:800, color:"#B7791F" }}>{mxn(monto)}</span>
                    {(puedeActuarTesoreria(usuario) || esAdmin(usuario)) && (
                      <button style={{ ...S.btn(true), padding:"5px 12px", fontSize:12, background:"#15803D" }}
                        onClick={() => {
                          const info = sol.reembolsoEnProceso || {};
                          onActualizar({ ...sol,
                            fechaPago: hoy(),
                            pagadoPor: usuario.nombre,
                            reembolsoEnProceso: null,
                            enTesoreria: false,
                            saldoEstado: "recuperado",
                            estado: "CERRADA",
                            historial: [...(sol.historial||[]), {
                              fecha: hoy(), quien: usuario.nombre,
                              accion: "Deposito confirmado y CERRADO — metodo: " + (info.metodo||"") +
                                (info.referencia ? " · ref: " + info.referencia : "") +
                                (info.clabeDestino ? " · CLABE: " + info.clabeDestino : "") +
                                " · por: " + usuario.nombre
                            }]
                          });
                        }}>
                        Confirmar deposito
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* RH pendientes */}
            {(emp.enRHPendiente||[]).length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#065F46", textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>Pendiente en RH — descuento en nomina</div>
                {(emp.enRHPendiente||[]).map(({ sol, monto, fecha, por }, i) => {
                  const rhKey = sol.id + "rh" + i;
                  return (
                    <div key={rhKey} style={{ border:"1.5px solid #6EE7B7", borderRadius:8, marginBottom:8, overflow:"hidden" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10,
                        padding:"9px 12px", background:"#ECFDF5", flexWrap:"wrap" }}>
                        <FolioBtn sol={sol} />
                        <div style={{ flex:1, minWidth:120 }}>
                          <div style={{ fontSize:12, fontWeight:600 }}>{sol.solicitante} — {sol.proyecto || sol.tipo || "Viaje"}</div>
                          <div style={{ fontSize:10, color:"#065F46" }}>Enviado: {fecha} por {por} · Monto: <b>{mxn(monto)}</b></div>
                        </div>
                        <span style={{ fontWeight:800, color:"#065F46", fontSize:15 }}>{mxn(monto)}</span>
                      </div>
                      {/* Formulario de captura para RH */}
                      {(esRH(usuario) || esAdmin(usuario)) && (
                        <div style={{ padding:"10px 14px", background:"#F0FDF9", borderTop:"1px solid #6EE7B7" }}>
                          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:10, marginBottom:10 }}>
                            <Campo label="Período de nómina">
                              <input type="month" style={{ ...S.input, fontSize:12, fontFamily:"ui-monospace,monospace" }}
                                defaultValue={hoy().slice(0,7)}
                                id={"rh-periodo-" + rhKey} />
                            </Campo>
                            <Campo label="Fecha de corte">
                              <input type="date" style={{ ...S.input, fontSize:12 }}
                                defaultValue={hoy()}
                                id={"rh-corte-" + rhKey} />
                            </Campo>
                            <Campo label="Referencia interna (opcional)">
                              <input style={{ ...S.input, fontSize:12, fontFamily:"ui-monospace,monospace" }}
                                placeholder="Ej: NOM-001"
                                id={"rh-folio-" + rhKey} />
                            </Campo>
                            <Campo label="Observaciones">
                              <input style={{ ...S.input, fontSize:12 }}
                                placeholder="Nota adicional…"
                                id={"rh-obs-" + rhKey} />
                            </Campo>
                          </div>
                          <button style={{ ...S.btn(true), background:"#065F46", fontSize:12, padding:"6px 16px" }}
                            onClick={() => {
                              const periodo = document.getElementById("rh-periodo-" + rhKey)?.value || hoy().slice(0,7);
                              const corte   = document.getElementById("rh-corte-"   + rhKey)?.value || hoy();
                              const folio   = document.getElementById("rh-folio-"   + rhKey)?.value || "";
                              const obs     = document.getElementById("rh-obs-"     + rhKey)?.value || "";
                              setConfirm({
                                msg: "Confirmar descuento en nómina de " + mxn(monto) + " para " + emp.nombre +
                                     " · Período: " + periodo + " · Corte: " + corte +
                                     (folio ? " · Referencia interna: " + folio : "") +
                                     ". Esto cerrará el expediente.",
                                onOk: () => {
                                  const infoRH = { periodo, fechaCorte: corte, folioMicrosip: folio, obs, aplicadoPor: usuario.nombre };
                                  onActualizar({ ...sol,
                                    descuentoAplicado: true,
                                    descuentoConfirmadoPor: usuario.nombre,
                                    fechaDescuentoNomina: corte,
                                    infoRH,
                                    saldoEstado: "recuperado",
                                    saldoFechaRecuperacion: corte,
                                    estado: "CERRADA",
                                    historial: [...(sol.historial||[]), {
                                      fecha: hoy(), quien: usuario.nombre,
                                      accion: "Descuento en nomina aplicado " + mxn(monto) +
                                              " · Periodo: " + periodo + " · Corte: " + corte +
                                              (folio ? " · Referencia interna: " + folio : "") +
                                              (obs ? " · " + obs : "") + " — CERRADO"
                                    }]
                                  });
                                }
                              });
                            }}>
                            Confirmar descuento aplicado
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Historial de esta persona */}
            {emp.historial.length > 0 && (
              <div style={{ borderTop:"1px solid #E3E6E9", paddingTop:10 }}>
                <div style={{ fontSize:11, color:"#6B7280", fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  Historial de movimientos
                  {(esAdmin(usuario) || esTesoreria(usuario)) && (
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      <button style={{ fontSize:11, border:"1px solid #E3E6E9", background:"#fff", color:"#9CA3AF", cursor:"pointer", borderRadius:5, padding:"2px 8px" }}
                        onClick={() => {
                          const sinBloqueo = emp.historial.filter(({ sol }) => !(empresa?.fechaCorte && (sol.fechaSolicitud||"") < empresa.fechaCorte));
                          if (!sinBloqueo.length) { setConfirm({ msg:"Todos los expedientes están en periodo bloqueado. Primero desbloquea el periodo en Configuracion.", onOk:null }); return; }
                          setConfirm({ msg:"Revertir todos los movimientos de Tesoreria de " + emp.nombre + " del periodo abierto. Los expedientes quedaran pendientes.", onOk:() => sinBloqueo.forEach(({ sol }) => revertirMovimiento(sol)) });
                        }}>
                        Revertir todo
                      </button>
                    </div>
                  )}
                </div>
                {emp.historial.map(({ sol, texto, esCobro }, i) => {
                  const periodoBloqueo = empresa?.fechaCorte && (sol.fechaSolicitud||"") < empresa.fechaCorte;
                  return (
                    <div key={sol.id + "h" + i} style={{ display:"flex", alignItems:"center", gap:8,
                      padding:"6px 10px", background: esCobro ? "#FFF1F2" : "#F0FDF4", borderRadius:6, marginBottom:4 }}>
                      <FolioBtn sol={sol} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, color:"#374151", fontWeight:600 }}>{texto}</div>
                        {sol.notaTesoreria && <div style={{ fontSize:10, color:"#6B7280", marginTop:2 }}>Ref: {sol.notaTesoreria}</div>}
                        {sol.infoRH && (
                          <div style={{ fontSize:10, color:"#065F46", marginTop:2 }}>
                            Nomina: {(sol.infoRH?.periodo||"")} · Corte: {(sol.infoRH?.fechaCorte||"")}
                            {sol.infoRH?.folioMicrosip ? " · Referencia interna: " + sol.infoRH.folioMicrosip : ""}
                          </div>
                        )}
                        {/* Últimas 3 acciones del historial del expediente */}
                        {(sol.historial||[]).slice(-3).map((h, hi) => (
                          <div key={hi} style={{ fontSize:10, color:"#9CA3AF", marginTop:1 }}>
                            {h.fecha} · {h.quien}: {h.accion}
                          </div>
                        ))}
                      </div>
                      {(esAdmin(usuario) || esTesoreria(usuario)) && !periodoBloqueo && (
                        <button style={{ fontSize:11, border:"1px solid #FCA5A5", background:"#FFF1F2", color:"#B91C1C", cursor:"pointer", borderRadius:5, padding:"2px 8px", whiteSpace:"nowrap" }}
                          onClick={() => setConfirm({ msg:"Reabrir la gestion de Tesoreria de " + sol.folio + ". El expediente quedara como pendiente.", onOk:() => revertirMovimiento(sol) })}>
                          Reabrir
                        </button>
                      )}
                      {periodoBloqueo && <span style={{ fontSize:10, color:"#9CA3AF", padding:"2px 6px", background:"#F3F4F6", borderRadius:4 }}>Periodo cerrado</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Render principal ─────────────────────────────────────────
  return (
    <div style={{ display:"grid", gap:14, maxWidth:1100 }}>
      {/* Modal de confirmacion */}
      {confirm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"#fff", borderRadius:12, padding:28, maxWidth:440, width:"90%", boxShadow:"0 8px 40px rgba(0,0,0,.18)" }}>
            <div style={{ fontSize:15, color:"#1D2554", marginBottom:20, lineHeight:1.5 }}>{confirm.msg}</div>
            <div style={{ display:"flex", gap:10 }}>
              {confirm.onOk && (
                <button style={{ ...S.btn(true), flex:1 }} onClick={() => { confirm.onOk(); setConfirm(null); }}>
                  Confirmar
                </button>
              )}
              <button style={{ ...S.btn(false), flex:1 }} onClick={() => setConfirm(null)}>
                {confirm.onOk ? "Cancelar" : "Cerrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal registrar pago/cobro — campos completos */}
      {pagoActivo && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"#fff", borderRadius:12, padding:28, maxWidth:500, width:"95%", boxShadow:"0 8px 40px rgba(0,0,0,.18)", maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ fontWeight:800, fontSize:16, color:"#1D2554", marginBottom:4 }}>
              {pagoActivo.tipo === "reembolso" ? "Registrar pago al empleado" : "Registrar cobro al empleado"}
            </div>
            <div style={{ fontSize:12, color:"#6B7280", marginBottom:16 }}>
              Expediente: <b>{pagoActivo.sol.folio}</b> · {pagoActivo.sol.solicitante} · Monto: <b style={{ color: pagoActivo.tipo==="reembolso"?"#15803D":"#B91C1C" }}>{mxn(pagoActivo.monto||0)}</b>
            </div>
            {/* Datos bancarios del empleado si existen */}
            {pagoActivo.tipo === "reembolso" && (() => {
              const db = pagoActivo.sol.datosBancarios || {};
              if (!db.clabe && !db.banco) return (
                <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:8, padding:"8px 14px", fontSize:12, color:"#92400E", marginBottom:14 }}>
                  El empleado no tiene datos bancarios registrados. Solicítale que los capture en Mi Perfil.
                </div>
              );
              return (
                <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:8, padding:"10px 14px", fontSize:12, marginBottom:14 }}>
                  <div style={{ fontWeight:700, color:"#15803D", marginBottom:4 }}>Cuenta destino del empleado</div>
                  <div style={{ fontFamily:"ui-monospace,monospace", color:"#166534" }}>
                    {db.banco||"—"} · CLABE: {db.clabe||"—"} · Titular: {db.titularCuenta||pagoActivo.sol.solicitante||"—"}
                    {db.cuentaBanco ? " · Cta: " + db.cuentaBanco : ""}
                  </div>
                </div>
              );
            })()}
            <div style={{ display:"grid", gap:12, marginBottom:16 }}>
              <Campo label="Método de pago *">
                <select style={S.input} value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
                  <option value="">— selecciona —</option>
                  {(pagoActivo.tipo === "reembolso" ? METODOS_PAGO : METODOS_COBRO).map(m => <option key={m}>{m}</option>)}
                </select>
              </Campo>
              <Campo label="Fecha de operación *">
                <input type="date" style={S.input} value={pagoActivo.fechaOp||hoy()}
                  onChange={e => setPagoActivo({...pagoActivo, fechaOp: e.target.value})} />
              </Campo>
              <Campo label="Número de referencia / transferencia">
                <input style={{ ...S.input, fontFamily:"ui-monospace,monospace" }} value={notaTesor}
                  onChange={e => setNotaTesor(e.target.value)} placeholder="Ej: 12345678901234" />
              </Campo>
              {/transfer|deposito|bancari/i.test(metodoPago) && pagoActivo.tipo === "reembolso" && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <Campo label="Banco origen (de SECOVI)">
                    <input style={S.input} value={pagoActivo.bancoOrigen||""}
                      onChange={e => setPagoActivo({...pagoActivo, bancoOrigen: e.target.value})} placeholder="BBVA, BANAMEX…" />
                  </Campo>
                  <Campo label="CLABE destino empleado">
                    <input style={{ ...S.input, fontFamily:"ui-monospace,monospace" }} value={pagoActivo.clabeDestino||""}
                      onChange={e => setPagoActivo({...pagoActivo, clabeDestino: e.target.value})}
                      placeholder="18 dígitos" />
                  </Campo>
                </div>
              )}
              {/nomina/i.test(metodoPago) && pagoActivo.tipo === "reembolso" && (
                <div style={{ background:"#F0FDF9", border:"1px solid #6EE7B7", borderRadius:8, padding:"10px 14px" }}>
                  <div style={{ fontSize:12, color:"#065F46", fontWeight:600, marginBottom:6 }}>Descuento en nómina — se enviará a RH</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    <Campo label="Período de nómina">
                      <input type="month" style={{ ...S.input, fontFamily:"ui-monospace,monospace" }}
                        value={pagoActivo.periodoNomina||hoy().slice(0,7)}
                        onChange={e => setPagoActivo({...pagoActivo, periodoNomina: e.target.value})} />
                    </Campo>
                    <Campo label="Fecha de corte">
                      <input type="date" style={S.input}
                        value={pagoActivo.fechaCorteNomina||hoy()}
                        onChange={e => setPagoActivo({...pagoActivo, fechaCorteNomina: e.target.value})} />
                    </Campo>
                    <Campo label="Referencia interna (opcional)">
                      <input style={{ ...S.input, fontFamily:"ui-monospace,monospace" }}
                        value={pagoActivo.folioMicrosip||""}
                        onChange={e => setPagoActivo({...pagoActivo, folioMicrosip: e.target.value})}
                        placeholder="NOM-001" />
                    </Campo>
                  </div>
                </div>
              )}
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button style={{ ...S.btn(true), flex:1, background: pagoActivo.tipo==="reembolso" ? "#15803D" : "#B91C1C" }}
                disabled={!metodoPago} onClick={registrarMovimiento}>
                Confirmar
              </button>
              <button style={{ ...S.btn(false), flex:1 }} onClick={() => setPagoActivo(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal compensacion */}
      {cruceActivo && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"#fff", borderRadius:12, padding:28, maxWidth:460, width:"90%", boxShadow:"0 8px 40px rgba(0,0,0,.18)" }}>
            <div style={{ fontWeight:800, fontSize:16, color:"#1D2554", marginBottom:16 }}>Compensar saldos — {cruceActivo.nombre}</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              <div style={{ background:"#FEF2F2", borderRadius:8, padding:"10px 14px" }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#B91C1C" }}>Por cobrar</div>
                <div style={{ fontSize:14, fontWeight:800 }}>{mxn(cruceActivo.totalContra)}</div>
                <div style={{ fontSize:10, color:"#6B7280" }}>{cruceActivo.solContra.folio}</div>
              </div>
              <div style={{ background:"#F0FDF4", borderRadius:8, padding:"10px 14px" }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#15803D" }}>Por pagar</div>
                <div style={{ fontSize:14, fontWeight:800 }}>{mxn(cruceActivo.totalReemb)}</div>
                <div style={{ fontSize:10, color:"#6B7280" }}>{cruceActivo.solReemb.folio}</div>
              </div>
            </div>
            <Campo label="Monto a compensar">
              <input type="number" style={{ ...S.input, fontFamily:"ui-monospace,monospace", fontSize:15,
                borderColor: cruceActivo.montoCruce > Math.min(cruceActivo.totalContra, cruceActivo.totalReemb) ? "#B91C1C" : undefined }}
                value={cruceActivo.montoCruce}
                onChange={e => setCruceActivo({ ...cruceActivo, montoCruce: Number(e.target.value)||0 })}
                min={0} max={Math.min(cruceActivo.totalContra, cruceActivo.totalReemb)} step={0.01} />
            </Campo>
            {cruceActivo.montoCruce > Math.min(cruceActivo.totalContra, cruceActivo.totalReemb) && (
              <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:6, padding:"8px 12px", fontSize:12, color:"#B91C1C", marginTop:6 }}>
                El monto excede el disponible. Máximo a compensar: <b>{mxn(Math.min(cruceActivo.totalContra, cruceActivo.totalReemb))}</b>
              </div>
            )}
            <div style={{ marginTop:14, display:"flex", gap:10 }}>
              <button style={{ ...S.btn(true), flex:1 }}
                disabled={!cruceActivo.montoCruce || cruceActivo.montoCruce > Math.min(cruceActivo.totalContra, cruceActivo.totalReemb)}
                onClick={() => compensarSaldos(cruceActivo.solContra, cruceActivo.solReemb, cruceActivo.montoCruce)}>
                Compensar
              </button>
              <button style={{ ...S.btn(false), flex:1 }} onClick={() => setCruceActivo(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Header con resumen */}
      <div style={{ ...S.card, background:"#1D2554", color:"#fff", padding:"18px 22px" }}>
        <h2 style={{ margin:"0 0 14px", fontSize:20, color:"#fff" }}>Tesoreria</h2>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:10 }}>
          {[
            { label:"Por cobrar", val: totCobrar, color:"#FCA5A5", bg:"rgba(185,28,28,.18)" },
            { label:"Por pagar",  val: totPagar,  color:"#86EFAC", bg:"rgba(21,128,61,.18)" },
            { label:"En proceso", val: totEnProceso, color:"#FDE68A", bg:"rgba(183,121,31,.18)" },
            { label:"RH pendiente", val: totRH,  color:"#6EE7B7", bg:"rgba(6,95,70,.18)" },
          ].map(({ label, val, color, bg }) => (
            <div key={label} style={{ background:bg, borderRadius:8, padding:"10px 14px" }}>
              <div style={{ fontSize:10, fontWeight:700, color, textTransform:"uppercase", letterSpacing:".06em" }}>{label}</div>
              <div style={{ fontSize:18, fontWeight:800, color, marginTop:2 }}>{mxn(val)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Barra de pestanas + filtros */}
      <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
        {/* Pestanas */}
        <div style={{ display:"flex", borderBottom:"1px solid #E3E6E9", background:"#fff", overflowX:"auto" }}>
          <TabBtn id="resumen"   label="Resumen" badge={filtrados.filter(e => e.totalCobrar>0||e.totalPagar>0).length} />
          <TabBtn id="cobrar"    label="Por cobrar" badge={filtrados.reduce((a,e)=>a+e.porCobrar.length,0)} color="#B91C1C" />
          <TabBtn id="pagar"     label="Por pagar"  badge={filtrados.reduce((a,e)=>a+e.porPagar.length,0)}  color="#15803D" />
          <TabBtn id="proceso"   label="En proceso" badge={filtrados.reduce((a,e)=>a+(e.enProceso||[]).length+(e.enRHPendiente||[]).length,0)} color="#B7791F" />
          <TabBtn id="historial" label="Historial"  badge={0} color="#6B7280" />
        </div>

        {/* Barra de busqueda y filtro mes */}
        <div style={{ padding:"12px 16px", background:"#F9FAFB", borderBottom:"1px solid #E3E6E9", display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <input style={{ ...S.input, maxWidth:260 }} placeholder="Buscar empleado…"
            value={busq} onChange={e => setBusq(e.target.value)} />
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <label style={{ ...S.label, margin:0, whiteSpace:"nowrap" }}>Mes:</label>
            <input type="month" style={{ ...S.input, width:160, fontFamily:"ui-monospace,monospace" }}
              value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} />
            {mesFiltro && <button style={{ border:"none", background:"none", color:"#B4443C", cursor:"pointer", fontSize:12 }} onClick={() => setMesFiltro("")}>x Limpiar</button>}
          </div>
          <span style={{ fontSize:12, color:"#9CA3AF", marginLeft:"auto" }}>{filtrados.length} empleado{filtrados.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Contenido de la pestaña */}
        <div style={{ padding:16 }}>
          {filtrados.length === 0 && (
            <div style={{ textAlign:"center", color:"#9CA3AF", padding:"40px 0", fontSize:13 }}>
              No hay movimientos pendientes.
            </div>
          )}

          {/* RESUMEN — todos los empleados con pendientes */}
          {tab === "resumen" && filtrados.map(emp => <CardEmpleado key={emp.id} emp={emp} />)}

          {/* POR COBRAR — solo empleados con saldo en contra */}
          {tab === "cobrar" && filtrados.filter(e => {
            if (!mesFiltro) return e.porCobrar.length > 0;
            return e.porCobrar.some(x => (x.sol.fechaSolicitud||"").startsWith(mesFiltro));
          }).map(emp => <CardEmpleado key={emp.id} emp={{ ...emp,
            porCobrar: mesFiltro ? emp.porCobrar.filter(x => (x.sol.fechaSolicitud||"").startsWith(mesFiltro)) : emp.porCobrar,
            porPagar: [], enProceso: [], enRHPendiente: [], historial: [] }} />)}

          {/* POR PAGAR — solo empleados con reembolsos */}
          {tab === "pagar" && filtrados.filter(e => {
            if (!mesFiltro) return e.porPagar.length > 0;
            return e.porPagar.some(x => (x.sol.fechaSolicitud||"").startsWith(mesFiltro));
          }).map(emp => <CardEmpleado key={emp.id} emp={{ ...emp,
            porCobrar: [], porPagar: mesFiltro ? emp.porPagar.filter(x => (x.sol.fechaSolicitud||"").startsWith(mesFiltro)) : emp.porPagar,
            enProceso: [], enRHPendiente: [], historial: [] }} />)}

          {/* EN PROCESO — depositos y RH */}
          {tab === "proceso" && filtrados.filter(e => (e.enProceso||[]).length > 0 || (e.enRHPendiente||[]).length > 0).map(emp => (
            <CardEmpleado key={emp.id} emp={{ ...emp, porCobrar: [], porPagar: [], historial: [] }} />
          ))}

          {/* HISTORIAL — movimientos ya gestionados, filtrable por mes */}
          {tab === "historial" && (() => {
            const empsFiltrados = filtrados.map(emp => ({
              ...emp,
              porCobrar: [], porPagar: [], enProceso: [], enRHPendiente: [],
              historial: mesFiltro
                ? emp.historial.filter(h => (h.sol.fechaSolicitud||h.fechaRef||"").startsWith(mesFiltro))
                : emp.historial
            })).filter(e => e.historial.length > 0);
            if (!empsFiltrados.length) return <div style={{ textAlign:"center", color:"#9CA3AF", padding:"40px 0", fontSize:13 }}>Sin historial {mesFiltro ? "en el mes seleccionado" : ""}.</div>;
            return empsFiltrados.map(emp => <CardEmpleado key={emp.id} emp={emp} />);
          })()}
        </div>
      </div>
    </div>
  );
}

function MisPendientes({ solicitudes, usuario, empresa, onIrExpediente, todosUsuarios, onActualizar }) {
  const nombreUser = (id) => todosUsuarios.find(u => u.id === id)?.nombre || id;

  const grupos = [
    {
      titulo: "Por aprobar",
      icono: "⏳",
      color: "#B7791F",
      bg: "#FFFBEB",
      visible: puedeAprobar(usuario),
      items: solicitudes
        .filter(s => s.estado === "ENVIADA")
        .sort((a, b) => (b.fechaSolicitud || "").localeCompare(a.fechaSolicitud || "")),
      render: (s) => `${s.folio} · ${nombreUser(s.solicitanteId)} · $${(s.montoSolicitado || 0).toLocaleString("es-MX")}`,
    },
    {
      titulo: "Esperando tu comprobación",
      icono: "📎",
      color: "#2563EB",
      bg: "#EFF6FF",
      visible: true,
      items: solicitudes
        .filter(s => s.solicitanteId === usuario.id && (s.estado === "COMPROBACION" || s.estado === "APROBADA"))
        .sort((a, b) => (b.fechaSolicitud || "").localeCompare(a.fechaSolicitud || "")),
      render: (s) => `${s.folio} · ${s.concepto || s.tipo || "Solicitud"} · $${(s.montoSolicitado || 0).toLocaleString("es-MX")}`,
    },
    {
      titulo: "Listas para contabilizar",
      icono: "📤",
      color: "#065F46",
      bg: "#ECFDF5",
      visible: esContador(usuario) || esAdmin(usuario),
      items: solicitudes
        .filter(s => s.estado === "CERRADA" && !s.folioPóliza)
        .sort((a, b) => (b.fechaSolicitud || "").localeCompare(a.fechaSolicitud || "")),
      render: (s) => `${s.folio} · ${nombreUser(s.solicitanteId)} · $${(s.montoSolicitado || 0).toLocaleString("es-MX")}`,
    },
    {
      titulo: "Reembolsos pendientes de pagar",
      icono: "💳",
      color: "#065F46",
      bg: "#F0FDF4",
      visible: esContador(usuario) || esAdmin(usuario),
      items: solicitudes
        .filter(s => {
          const t = calcular(s);
          const tieneReembolso = (s.tipo === "reembolso" && s.estado === "APROBADA") ||
            (s.estado === "CERRADA" && t.reembolso > 0 && !s.fechaPago);
          return tieneReembolso;
        })
        .sort((a, b) => (a.fechaSolicitud || "").localeCompare(b.fechaSolicitud || "")),
      render: (s) => `${s.folio} · ${nombreUser(s.solicitanteId)} · ${mxn(calcular(s).reembolso || s.montoSolicitado || 0)}`,
    },
    {
      titulo: "Tickets sin atender asignados a ti",
      icono: "🎫",
      color: "#6B21A8",
      bg: "#FAF5FF",
      visible: true,
      items: [],
      render: () => "",
    },
    {
      titulo: "Descuentos de nómina — pendientes de aplicar",
      icono: "💼",
      color: "#065F46",
      bg: "#ECFDF5",
      visible: esRH(usuario) || esAdmin(usuario),
      items: solicitudes.filter(s => s.enRH && !s.descuentoAplicado),
      render: (s) => `${s.folio} · ${nombreUser(s.solicitanteId)} · ${mxn(calcular(s).rechazadosClara||0)} · Enviado por ${s.enviadoRHPor||"Tesorería"} el ${s.fechaEnvioRH||""}`,
      accion: "descuento_nomina",
    },
    {
      titulo: "Pendientes de gestión en Tesorería",
      icono: "🏦",
      color: "#0369A1",
      bg: "#EFF6FF",
      visible: esTesoreria(usuario) || esAdmin(usuario),
      items: solicitudes.filter(s => s.enTesoreria && !s.fechaPago && (s.saldoEstado||"pendiente")==="pendiente"),
      render: (s) => { const tc=calcular(s); const r=tc.reembolsoClaraAprobado||tc.reembolso||0; const c=tc.rechazadosClara||0; return `${s.folio} · ${nombreUser(s.solicitanteId)} · ${r>0?`Pagar ${mxn(r)}`:""}${c>0?` Cobrar ${mxn(c)}`:""}` },
      accion: null,
    },
    {
      titulo: "Reembolsos en proceso de depósito",
      icono: "🔄",
      color: "#0369A1",
      bg: "#EFF6FF",
      visible: esTesoreria(usuario) || esAdmin(usuario),
      items: solicitudes.filter(s => s.reembolsoEnProceso && !s.fechaPago),
      render: (s) => `${s.folio} · ${nombreUser(s.solicitanteId)} · ${mxn(calcular(s).reembolsoClaraAprobado||s.montoSolicitado||0)} — confirmar en Tesorería`,
      accion: null,
    },
  ].filter(g => g.visible);

  const total = grupos.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 860 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>✅ Mis pendientes</h2>
        {total === 0 && <span style={{ fontSize: 13, color: "#16A34A", fontWeight: 700, background: "#DCFCE7", padding: "3px 10px", borderRadius: 999 }}>¡Todo al día!</span>}
        {total > 0  && <span style={{ fontSize: 13, color: "#B91C1C", fontWeight: 700, background: "#FEE2E2", padding: "3px 10px", borderRadius: 999 }}>{total} pendiente{total !== 1 ? "s" : ""}</span>}
      </div>

      {grupos.map((g) => (
        <div key={g.titulo} style={{ ...S.card, borderLeft: `4px solid ${g.color}`, background: g.bg }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: g.color, marginBottom: g.items.length ? 10 : 0 }}>
            {g.icono} {g.titulo}
            {g.items.length > 0 && <span style={{ marginLeft: 8, background: g.color, color: "#fff", borderRadius: 999, fontSize: 11, padding: "1px 8px" }}>{g.items.length}</span>}
          </div>
          {g.items.length === 0 && <div style={{ fontSize: 12, color: "#6B7280" }}>Sin pendientes en esta categoría.</div>}
          {g.items.map((s) => {
            const t = calcular(s);
            const montoNomina = t.rechazadosClara || 0;
            const esNomina = g.accion === "descuento_nomina";
            return (
              <div key={s.id}
                style={{ padding: "8px 10px", borderRadius: 6, background: "rgba(255,255,255,.7)",
                  marginBottom: 6, border: "1px solid rgba(0,0,0,.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: esNomina ? "default" : "pointer" }}
                  onClick={() => !esNomina && onIrExpediente(s.id)}
                  onMouseEnter={e => { if(!esNomina) e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,.1)"; }}
                  onMouseLeave={e => e.currentTarget.style.boxShadow="none"}>
                  <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 12, color: g.color, fontWeight: 700, whiteSpace: "nowrap" }}>{s.folio}</span>
                  <span style={{ fontSize: 13, flex: 1 }}>{s.concepto || s.tipo || "Sin concepto"}</span>
                  <span style={{ fontSize: 12, color: "#6B7280", whiteSpace: "nowrap" }}>{nombreUser(s.solicitanteId)}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
                    {esNomina ? mxn(montoNomina) : `$${(s.montoSolicitado||0).toLocaleString("es-MX",{minimumFractionDigits:2})}`}
                  </span>
                  {!esNomina && <span style={{ fontSize: 11, color: "#6B7280" }}>→</span>}
                </div>
                {esNomina && (
                  <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontSize: 12, color: "#54606B" }}>
                      Descuento por nómina registrado {s.saldoFechaRecuperacion ? `el ${s.saldoFechaRecuperacion}` : ""}
                      {s.notaTesoreria ? ` · ${s.notaTesoreria}` : ""}
                    </div>
                    <button style={{ ...S.btn(true), fontSize: 11, padding: "4px 12px", background: "#065F46" }}
                      onClick={() => onActualizar({ ...s,
                        descuentoAplicado: true,
                        fechaDescuentoNomina: hoy(),
                        descuentoConfirmadoPor: usuario.nombre,
                        saldoEstado: "recuperado",  // ciclo cerrado
                        saldoFechaRecuperacion: hoy(),
                        enRH: false,
                        historial: [...(s.historial||[]), {
                          fecha: hoy(), quien: usuario.nombre,
                          accion: `Descuento de nómina confirmado — ${mxn(montoNomina)} aplicado en nómina por ${usuario.nombre}`
                        }]
                      })}>
                      ✓ Confirmar aplicado en nómina
                    </button>
                    <button style={{ ...S.btn(false), fontSize: 11, padding: "4px 10px" }}
                      onClick={() => onIrExpediente(s.id)}>
                      Ver expediente →
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// EXPORTACIÓN CONTABLE INTERNA
// ══════════════════════════════════════════════════════════════════
function ExportacionContable({ solicitudes, empresa, usuario, onActualizar }) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [soloNoContab, setSoloNoContab] = useState(true);
  const [selIds, setSelIds] = useState([]);
  const [folioPol, setFolioPol] = useState("");
  const [aviso, setAviso] = useState(null);
  const [preview, setPreview] = useState(null);

  const ctas = empresa?.ctasPuente || {};
  const tieneCuentas = ctas.clara || ctas.ivaAcreditable || ctas.deudores;

  // Filtrar solicitudes contabilizables: cerradas y NO canceladas
  const candidatas = solicitudes.filter(s => {
    if (s.estado !== "CERRADA" || s.motivoCancelacion) return false;
    if (soloNoContab && s.folioPóliza) return false;
    if (desde && s.fechaSolicitud < desde) return false;
    if (hasta && s.fechaSolicitud > hasta) return false;
    return true;
  }).sort((a, b) => (a.fechaSolicitud || "").localeCompare(b.fechaSolicitud || ""));

  const toggleSel = (id) => setSelIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleTodos = () => setSelIds(prev => prev.length === candidatas.length ? [] : candidatas.map(s => s.id));

  // Construir líneas de póliza para una solicitud
  const construirPoliza = (sol, numPol) => {
    const fecha = sol.fechaSolicitud || new Date().toISOString().slice(0, 10);
    const [y, m, d] = fecha.split("-");
    const fechaMx = `${d}/${m}/${y}`;
    const concepto = `VIATICOS ${sol.folio} ${(sol.concepto || "").toUpperCase().slice(0, 40)}`;
    const folio = sol.folio || sol.id.slice(0, 8);
    const movs = Array.isArray(sol.movimientos) ? sol.movimientos : [];

    let lineas = [];
    lineas.push(`|1|"6",${fechaMx},"1",${numPol},"${concepto}"`);

    // Agrupar movimientos por tipo
    const conCFDI    = movs.filter(m => m.factura && m.uuid && !m.esRetiro && !m.esRechazado);
    const sinCFDI    = movs.filter(m => !m.factura && !m.esRetiro && !m.esRechazado && !m.esComision);
    const retiros    = movs.filter(m => m.esRetiro && !m.esRechazado);
    const rechazados = movs.filter(m => m.esRechazado);

    // 1. Gastos con CFDI → gasto deducible + IVA acreditable
    for (const m of conCFDI) {
      const subtotal = Number(m.subtotal) || Math.max(0, Number(m.total||0) - Number(m.iva||0));
      const iva      = Number(m.iva16||0) + Number(m.iva8||0) || Number(m.iva||0);
      const total    = Number(m.total) || subtotal + iva;
      const cta      = m.cuentaContable || (empresa?.mapa?.[m.categoria] || "");
      if (cta && subtotal > 0) {
        lineas.push(`|1.1|"${cta}","GRAL","C",${subtotal.toFixed(2)},"${folio}",""`);
      }
      if (ctas.ivaAcreditable && iva > 0) {
        lineas.push(`|1.1|"${ctas.ivaAcreditable}","GRAL","C",${iva.toFixed(2)},"${folio}",""`);
      }
      if (m.uuid) {
        lineas.push(`|1.1.1|"${m.uuid}"`);
      }
      // Abono según origen
      const ctaAbono = m.reembolso || m.origen === "clara-reembolso" ? (ctas.deudores || "") : (ctas.clara || "");
      if (ctaAbono && total > 0) {
        lineas.push(`|1.1|"${ctaAbono}","GRAL","A",${total.toFixed(2)},"${folio}",""`);
      }
    }

    // 2. Gastos aprobados sin CFDI → gasto NO deducible
    for (const m of sinCFDI) {
      const monto = Number(m.total || 0);
      const ctaND = ctas.noDeducibles || "";
      if (ctaND && monto > 0) {
        lineas.push(`|1.1|"${ctaND}","GRAL","C",${monto.toFixed(2)},"${folio}",""`);
        const ctaAbono = m.reembolso || m.origen === "clara-reembolso" ? (ctas.deudores || "") : (ctas.clara || "");
        if (ctaAbono) lineas.push(`|1.1|"${ctaAbono}","GRAL","A",${monto.toFixed(2)},"${folio}",""`);
      }
    }

    // 3. Comisiones Clara
    const comisiones = movs.filter(m => m.esComision);
    for (const m of comisiones) {
      const monto = Number(m.total || 0);
      if (ctas.comisiones && monto > 0) {
        lineas.push(`|1.1|"${ctas.comisiones}","GRAL","C",${monto.toFixed(2)},"${folio}",""`);
        if (ctas.clara) lineas.push(`|1.1|"${ctas.clara}","GRAL","A",${monto.toFixed(2)},"${folio}",""`);
      }
    }

    // 4. No comprobados → deudor del trabajador
    for (const m of rechazados) {
      const monto = Number(m.total || 0);
      if (ctas.deudores && monto > 0) {
        lineas.push(`|1.1|"${ctas.deudores}","GRAL","C",${monto.toFixed(2)},"${folio}",""`);
        if (ctas.clara) lineas.push(`|1.1|"${ctas.clara}","GRAL","A",${monto.toFixed(2)},"${folio}",""`);
      }
    }

    // 5. Retiros: la parte no comprobada → deudor
    for (const m of retiros) {
      const totalRetiro   = Number(m.total || 0);
      const comprobado    = Number(m.montoComprobado || 0);
      const noComprobado  = Math.max(0, totalRetiro - comprobado);
      if (ctas.deudores && noComprobado > 0) {
        lineas.push(`|1.1|"${ctas.deudores}","GRAL","C",${noComprobado.toFixed(2)},"${folio}",""`);
        if (ctas.clara) lineas.push(`|1.1|"${ctas.clara}","GRAL","A",${noComprobado.toFixed(2)},"${folio}",""`);
      }
    }

    // Si no hay movimientos detallados, usar monto total como fallback
    if (lineas.length === 1) {
      const total = parseFloat(sol.montoSolicitado || 0);
      const ctaGasto = empresa?.mapa?.["Gastos / Viáticos"] || "";
      if (ctaGasto && total > 0) {
        lineas.push(`|1.1|"${ctaGasto}","GRAL","C",${total.toFixed(2)},"${folio}",""`);
      }
      if (ctas.clara && total > 0) {
        lineas.push(`|1.1|"${ctas.clara}","GRAL","A",${total.toFixed(2)},"${folio}",""`);
      }
    }

    return lineas.join("\r\n");
  };

  const generarTXT = () => {
    const seleccionadas = candidatas.filter(s => selIds.includes(s.id));
    if (!seleccionadas.length) { setAviso("Selecciona al menos un expediente."); return; }
    const bloques = seleccionadas.map((s, i) => construirPoliza(s, i + 1));
    const contenido = bloques.join("\r\n");
    setPreview(contenido);

    const blob = new Blob([contenido], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `lote_contable_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const marcarContabilizados = async () => {
    const seleccionadas = candidatas.filter(s => selIds.includes(s.id));
    if (!seleccionadas.length || !folioPol.trim()) { setAviso("Necesitas seleccionar expedientes y capturar el folio interno del lote."); return; }
    const actualizadas = seleccionadas.map(s => ({ ...s, folioPóliza: folioPol.trim(), fechaContabilizacion: new Date().toISOString().slice(0, 10), contabilizadoPor: usuario.nombre }));
    await onActualizar(actualizadas);
    setSelIds([]);
    setFolioPol("");
    setPreview(null);
    setAviso(`✅ ${actualizadas.length} expediente(s) marcados con folio ${folioPol.trim()}.`);
  };

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 980 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>📤 Exportación contable</h2>
        <span style={{ fontSize: 12, color: "#54606B" }}>Genera un TXT interno con muchas facturas; no realiza conexiones externas</span>
      </div>

      {!tieneCuentas && (
        <div style={{ background: "#FFFBEB", border: "1px solid #D97706", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#92400E" }}>
          ⚠️ <strong>Configura las cuentas contables</strong> antes de generar el lote. Ve a <strong>Configuración → Cuentas contables</strong>.
        </div>
      )}

      {/* Filtros */}
      <div style={{ ...S.card, display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
        <Campo label="Desde"><input type="date" style={{ ...S.input, fontFamily: "ui-monospace,monospace" }} value={desde} onChange={e => setDesde(e.target.value)} /></Campo>
        <Campo label="Hasta"><input type="date" style={{ ...S.input, fontFamily: "ui-monospace,monospace" }} value={hasta} onChange={e => setHasta(e.target.value)} /></Campo>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", paddingBottom: 6 }}>
          <input type="checkbox" checked={soloNoContab} onChange={e => setSoloNoContab(e.target.checked)} />
          Solo no contabilizados
        </label>
        <div style={{ fontSize: 12, color: "#54606B", paddingBottom: 6 }}>
          {candidatas.length} expediente(s) encontrado(s)
        </div>
      </div>

      {/* Tabla de selección */}
      {candidatas.length > 0 && (
        <div style={S.card}>
          <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center" }}>
            <button style={S.btn(false)} onClick={toggleTodos}>
              {selIds.length === candidatas.length ? "Deseleccionar todos" : "Seleccionar todos"}
            </button>
            <span style={{ fontSize: 12, color: "#54606B" }}>{selIds.length} seleccionado(s)</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F1F3F9" }}>
                  <th style={{ ...S.th, width: 36 }}></th>
                  <th style={S.th}>Folio</th>
                  <th style={S.th}>Solicitante</th>
                  <th style={S.th}>Concepto</th>
                  <th style={S.th}>Fecha</th>
                  <th style={{ ...S.th, textAlign: "right" }}>Monto</th>
                  <th style={S.th}>Póliza</th>
                </tr>
              </thead>
              <tbody>
                {candidatas.map((s) => (
                  <tr key={s.id} onClick={() => toggleSel(s.id)}
                    style={{ cursor: "pointer", background: selIds.includes(s.id) ? "#EFF6FF" : "transparent",
                      borderBottom: "1px solid #E3E6E9" }}
                    onMouseEnter={e => { if (!selIds.includes(s.id)) e.currentTarget.style.background = "#F8FAFF"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = selIds.includes(s.id) ? "#EFF6FF" : "transparent"; }}>
                    <td style={{ ...S.td, textAlign: "center" }}>
                      <input type="checkbox" checked={selIds.includes(s.id)} onChange={() => toggleSel(s.id)} onClick={e => e.stopPropagation()} />
                    </td>
                    <td style={{ ...S.td, fontFamily: "ui-monospace,monospace", fontWeight: 700, color: "#232D6B" }}>{s.folio}</td>
                    <td style={S.td}>{s.solicitante || s.solicitanteId?.slice(0, 8)}</td>
                    <td style={S.td}>{(s.concepto || s.tipo || "—").slice(0, 40)}</td>
                    <td style={{ ...S.td, fontFamily: "ui-monospace,monospace" }}>{s.fechaSolicitud || "—"}</td>
                    <td style={{ ...S.td, textAlign: "right", fontWeight: 700 }}>${(s.montoSolicitado || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                    <td style={S.td}>
                      {s.folioPóliza
                        ? <span style={{ fontSize: 11, background: "#DCFCE7", color: "#15803D", padding: "2px 8px", borderRadius: 999, fontFamily: "ui-monospace,monospace" }}>{s.folioPóliza}</span>
                        : <span style={{ fontSize: 11, color: "#9CA3AF" }}>pendiente</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Acciones */}
      {selIds.length > 0 && (
        <div style={{ ...S.card, background: "#F0F9FF", border: "1px solid #BAE6FD" }}>
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>Acciones para {selIds.length} expediente(s) seleccionado(s)</div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <button style={S.btn(true)} onClick={generarTXT}>
              ⬇ Generar y descargar TXT contable
            </button>
            <Campo label="Folio interno del lote exportado">
              <input style={{ ...S.input, fontFamily: "ui-monospace,monospace", width: 200 }}
                placeholder="Ej. CXP-2026-0042"
                value={folioPol} onChange={e => setFolioPol(e.target.value)} />
            </Campo>
            <button style={{ ...S.btn(false), borderColor: "#15803D", color: "#15803D" }}
              disabled={!folioPol.trim()} onClick={marcarContabilizados}>
              ✅ Marcar como exportados
            </button>
          </div>
        </div>
      )}

      {aviso && (
        <div style={{ background: aviso.startsWith("✅") ? "#DCFCE7" : "#FEE2E2",
          border: `1px solid ${aviso.startsWith("✅") ? "#86EFAC" : "#FCA5A5"}`,
          borderRadius: 8, padding: "10px 14px", fontSize: 13,
          color: aviso.startsWith("✅") ? "#15803D" : "#B91C1C" }}>
          {aviso}
          <button style={{ float: "right", border: "none", background: "none", cursor: "pointer", color: "inherit" }} onClick={() => setAviso(null)}>×</button>
        </div>
      )}

      {/* Preview del TXT */}
      {preview && (
        <div style={S.card}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Vista previa del archivo generado</div>
          <pre style={{ background: "#1E1E2E", color: "#A6E3A1", padding: 16, borderRadius: 6, fontSize: 11,
            fontFamily: "ui-monospace,monospace", overflow: "auto", maxHeight: 360, lineHeight: 1.6 }}>
            {preview}
          </pre>
        </div>
      )}

      {candidatas.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", color: "#6B7280", padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
          <div style={{ fontWeight: 700 }}>Sin expedientes pendientes de contabilizar</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Ajusta los filtros o revisa que existan expedientes en estado Cerrado.</div>
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════
// BUSCADOR DE PROYECTOS — fijos arriba, búsqueda por texto
// ══════════════════════════════════════════════════════════════════
function ProyectoBuscador({ proyectos, value, onChange, placeholder = "— selecciona un proyecto —" }) {
  const [query, setQuery] = useState("");
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  // Fijos primero, luego el resto ordenado por nombre
  const fijos   = proyectos.filter(p => p.fijo);
  const normales = proyectos.filter(p => !p.fijo);
  const todos   = [...fijos, ...normales];

  const filtrados = query.trim()
    ? todos.filter(p =>
        p.nombre.toLowerCase().includes(query.toLowerCase()) ||
        (p.cliente || "").toLowerCase().includes(query.toLowerCase())
      )
    : todos;

  const seleccionado = todos.find(p => p.id === value);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", minWidth: 260 }}>
      {/* Campo de búsqueda / trigger */}
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        <input
          style={{ ...S.input, flex: 1, borderRadius: abierto ? "6px 6px 0 0" : 6,
            borderBottom: abierto ? "1px solid #C6D0E8" : undefined }}
          value={abierto ? query : (seleccionado ? seleccionado.nombre + (seleccionado.cliente ? " — " + seleccionado.cliente : "") : "")}
          placeholder={placeholder}
          onClick={() => { setQuery(""); setAbierto(true); }}
          onChange={e => { setQuery(e.target.value); setAbierto(true); }}
          onFocus={() => { setQuery(""); setAbierto(true); }}
        />
        {value && (
          <button onClick={() => { onChange(""); setQuery(""); }}
            style={{ border: "none", background: "none", color: "#B4443C", cursor: "pointer",
              fontSize: 16, padding: "0 6px", lineHeight: 1 }} title="Quitar proyecto">×</button>
        )}
      </div>

      {/* Dropdown */}
      {abierto && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
          background: "#fff", border: "1px solid #C6D0E8", borderTop: "none",
          borderRadius: "0 0 6px 6px", boxShadow: "0 4px 16px rgba(0,0,0,.1)",
          maxHeight: 280, overflowY: "auto" }}>
          {!query.trim() && fijos.length > 0 && (
            <div style={{ padding: "6px 10px 2px", fontSize: 10, fontWeight: 700,
              color: "#92400E", textTransform: "uppercase", letterSpacing: "0.06em",
              background: "#FFFBEB", borderBottom: "1px solid #FDE68A" }}>
              📌 Proyectos fijos
            </div>
          )}
          {filtrados.length === 0 && (
            <div style={{ padding: "10px 12px", fontSize: 13, color: "#6B7280" }}>Sin resultados para "{query}"</div>
          )}
          {filtrados.map((p, i) => {
            const esSeparador = !query.trim() && i === fijos.length && fijos.length > 0;
            return (
              <div key={p.id}>
                {esSeparador && (
                  <div style={{ padding: "4px 10px 2px", fontSize: 10, fontWeight: 700,
                    color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em",
                    background: "#F8FAFF", borderTop: "1px solid #E3E6E9", borderBottom: "1px solid #E3E6E9" }}>
                    Otros proyectos
                  </div>
                )}
                <div onClick={() => { onChange(p.id); setAbierto(false); setQuery(""); }}
                  style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13,
                    background: p.id === value ? "#EFF6FF" : "transparent",
                    display: "flex", alignItems: "center", gap: 6 }}
                  onMouseEnter={e => e.currentTarget.style.background = p.id === value ? "#EFF6FF" : "#F8FAFF"}
                  onMouseLeave={e => e.currentTarget.style.background = p.id === value ? "#EFF6FF" : "transparent"}>
                  {p.fijo && <span style={{ fontSize: 11 }}>📌</span>}
                  <div>
                    <div style={{ fontWeight: p.id === value ? 700 : 400 }}>{p.nombre}</div>
                    {p.cliente && <div style={{ fontSize: 11, color: "#6B7280" }}>{p.cliente}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// MÓDULO EQUIPO
// ══════════════════════════════════════════════════════════════════
function ModuloEquipo({ usuario, empresa, empresas, todosUsuarios, onGuardarUsuarios }) {
  const [tab, setTab]           = useState("equipo"); // equipo | roles | miPerfil
  const [busq, setBusq]         = useState("");
  const [filtroDep, setFiltroDep] = useState("");
  const [filtroUbic, setFiltroUbic] = useState("");
  const [editId, setEditId]     = useState(null);
  const [editPermisos, setEditPermisos] = useState(null);

  const perms = getPermisos(usuario);
  const esAdminLocal = esAdmin(usuario) || perms.gestionarUsuarios;
  const deptos = empresa?.departamentos || [];
  const ubics  = empresa?.ubicaciones  || [];

  // Filtrar equipo visible según rol
  const miEquipo = todosUsuarios.filter(u => {
    if (u.empresaId !== empresa?.id) return false;
    if (esAdminLocal) return true;
    if (puedeAprobar(usuario)) return u.aprobadorId === usuario.id ||
      deptos.filter(d => d.aprobadorId === usuario.id).some(d => d.id === u.departamentoId);
    return u.id === usuario.id; // empleado solo se ve a sí mismo
  });

  const filtrados = miEquipo.filter(u => {
    if (busq && !u.nombre.toLowerCase().includes(busq.toLowerCase()) &&
        !u.correo.toLowerCase().includes(busq.toLowerCase())) return false;
    if (filtroDep && u.departamentoId !== filtroDep) return false;
    if (filtroUbic && u.ubicacionId !== filtroUbic) return false;
    return true;
  });

  const actualizar = (id, cambios) => {
    onGuardarUsuarios(todosUsuarios.map(u => {
      if (u.id !== id) return u;
      return { ...u, ...cambios,
        departamento: deptos.find(d=>d.id===(cambios.departamentoId||u.departamentoId))?.nombre || u.departamento,
        ubicacion: ubics.find(x=>x.id===(cambios.ubicacionId||u.ubicacionId))?.nombre || u.ubicacion,
      };
    }));
  };

  // ── Tabla comparativa de roles ───────────────────────────────
  const TablaRoles = () => (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <thead>
          <tr style={{ background:"#1D2554", color:"#fff" }}>
            <th style={{ ...S.th, background:"#1D2554", color:"#fff", textAlign:"left", width:200 }}>Permiso</th>
            {Object.keys(PERMISOS_BASE).map(rol => (
              <th key={rol} style={{ ...S.th, background:"#1D2554", color:"#fff", textAlign:"center" }}>{rol}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISOS_DISPONIBLES.map((p, i) => (
            <tr key={p.key} style={{ background: i%2===0 ? "#F8FAFF" : "#fff" }}>
              <td style={{ ...S.td, fontWeight:600 }}>
                <div>{p.label}</div>
                <div style={{ fontSize:11, color:"#9CA3AF" }}>{p.grupo}</div>
              </td>
              {Object.entries(PERMISOS_BASE).map(([rol, permisos]) => (
                <td key={rol} style={{ ...S.td, textAlign:"center" }}>
                  {permisos[p.key]
                    ? <span style={{ color:"#15803D", fontSize:16 }}>✓</span>
                    : <span style={{ color:"#D1D5DB", fontSize:16 }}>—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ display:"grid", gap:14, maxWidth:1100 }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
        <div>
          <h2 style={{ margin:0, fontSize:20 }}>👥 Equipo</h2>
          <div style={{ fontSize:12, color:"#54606B", marginTop:2 }}>
            {esAdminLocal ? `${miEquipo.length} usuarios en ${empresa?.nombre}` : "Tu información y configuración"}
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {["equipo","roles"].map(t => (
            <button key={t} style={{ ...S.btn(tab===t), fontSize:12, padding:"6px 14px" }}
              onClick={() => setTab(t)}>
              {t === "equipo" ? "👥 Equipo" : "📊 Comparativa de roles"}
            </button>
          ))}
        </div>
      </div>

      {/* ── PESTAÑA EQUIPO ── */}
      {tab === "equipo" && (<>
        {/* Filtros — solo para Admin/Aprobador */}
        {(esAdminLocal || puedeAprobar(usuario)) && (
          <div style={{ ...S.card, display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end", padding:"12px 16px" }}>
            <Campo label="Buscar">
              <input style={{ ...S.input, width:220 }} value={busq} onChange={e=>setBusq(e.target.value)}
                placeholder="Nombre o correo…" />
            </Campo>
            <Campo label="Departamento">
              <select style={S.input} value={filtroDep} onChange={e=>setFiltroDep(e.target.value)}>
                <option value="">Todos</option>
                {deptos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            </Campo>
            <Campo label="Ubicación">
              <select style={S.input} value={filtroUbic} onChange={e=>setFiltroUbic(e.target.value)}>
                <option value="">Todas</option>
                {ubics.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </Campo>
            <div style={{ fontSize:12, color:"#54606B", paddingBottom:6 }}>
              {filtrados.length} de {miEquipo.length} usuario(s)
            </div>
          </div>
        )}

        {/* Tabla de equipo */}
        <div style={S.card}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:"#F1F3F9" }}>
                  {["Usuario","Correo","Rol","Departamento","Ubicación","CC","Aprobador","Estado",
                    ...(esAdminLocal ? ["Permisos",""] : [])
                  ].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtrados.map(u => {
                  const aprobador = todosUsuarios.find(a => a.id === u.aprobadorId);
                  const permExtra = Object.keys(u.permisosExtra||{}).length;
                  const esYo = u.id === usuario.id;
                  return (
                    <tr key={u.id} style={{ background: esYo ? "#EFF6FF" : "transparent",
                      opacity: u.activo===false ? 0.45 : 1, borderBottom:"1px solid #E3E6E9" }}>
                      <td style={S.td}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <div style={{ width:30, height:30, borderRadius:"50%", background:"#2A3580",
                            color:"#fff", display:"flex", alignItems:"center", justifyContent:"center",
                            fontSize:12, fontWeight:700, flexShrink:0 }}>
                            {u.nombre.split(" ").map(p=>p[0]).slice(0,2).join("")}
                          </div>
                          <div>
                            <div style={{ fontWeight: esYo ? 700 : 500 }}>{u.nombre}{esYo && " (tú)"}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...S.td, fontSize:12, color:"#54606B" }}>{u.correo}</td>
                      <td style={S.td}>
                        {editId === u.id && esAdminLocal
                          ? <select style={{ ...S.input, padding:"2px 6px", fontSize:12 }} value={u.rol}
                              onChange={e=>actualizar(u.id,{rol:e.target.value})}>
                              {Object.keys(PERMISOS_BASE).map(r=><option key={r}>{r}</option>)}
                            </select>
                          : <RolChip rol={u.rol} />}
                      </td>
                      <td style={S.td}>
                        {editId === u.id && esAdminLocal
                          ? <select style={{ ...S.input, padding:"2px 6px", fontSize:12 }} value={u.departamentoId||""}
                              onChange={e=>actualizar(u.id,{departamentoId:e.target.value})}>
                              <option value="">—</option>
                              {deptos.map(d=><option key={d.id} value={d.id}>{d.nombre}</option>)}
                            </select>
                          : u.departamento || "—"}
                      </td>
                      <td style={S.td}>
                        {editId === u.id && esAdminLocal
                          ? <select style={{ ...S.input, padding:"2px 6px", fontSize:12 }} value={u.ubicacionId||""}
                              onChange={e=>actualizar(u.id,{ubicacionId:e.target.value})}>
                              <option value="">—</option>
                              {ubics.map(x=><option key={x.id} value={x.id}>{x.nombre}</option>)}
                            </select>
                          : u.ubicacion || "—"}
                      </td>
                      <td style={{ ...S.td, fontFamily:"ui-monospace,monospace", fontSize:11 }}>{u.cc||"—"}</td>
                      <td style={S.td}>
                        {editId === u.id && esAdminLocal
                          ? <select style={{ ...S.input, padding:"2px 6px", fontSize:12 }} value={u.aprobadorId||""}
                              onChange={e=>actualizar(u.id,{aprobadorId:e.target.value})}>
                              <option value="">— del depto —</option>
                              {todosUsuarios.filter(a=>puedeAprobar(a)&&a.id!==u.id)
                                .map(a=><option key={a.id} value={a.id}>{a.nombre}</option>)}
                            </select>
                          : aprobador
                            ? <span style={{ fontSize:12 }}>{aprobador.nombre}</span>
                            : <span style={{ fontSize:11, color:"#9CA3AF" }}>del depto</span>}
                      </td>
                      <td style={S.td}>
                        <span style={{ fontSize:12, fontWeight:700,
                          color: u.activo!==false ? "#15803D" : "#B4443C" }}>
                          {u.activo!==false ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      {esAdminLocal && (<>
                        <td style={S.td}>
                          <button style={{ border:"none", background:"none", color:permExtra>0?"#3644AC":"#9CA3AF",
                            cursor:"pointer", fontSize:11, fontWeight:permExtra>0?700:400 }}
                            onClick={()=>setEditPermisos(editPermisos===u.id?null:u.id)}>
                            {permExtra>0 ? `⚙ ${permExtra} custom` : "⚙ base"}
                          </button>
                        </td>
                        <td style={S.td}>
                          <div style={{ display:"flex", gap:4 }}>
                            {editId === u.id
                              ? <button style={{ ...S.btn(true), padding:"3px 10px", fontSize:11 }}
                                  onClick={()=>setEditId(null)}>✓ Guardar</button>
                              : <button style={{ ...S.btn(false), padding:"3px 10px", fontSize:11 }}
                                  onClick={()=>setEditId(u.id)}>Editar</button>}
                            <button style={{ border:"none", background:"none", fontSize:11, cursor:"pointer",
                              color: u.activo!==false?"#B4443C":"#15803D" }}
                              onClick={()=>actualizar(u.id,{activo:u.activo===false})}>
                              {u.activo!==false?"Desactivar":"Activar"}
                            </button>
                          </div>
                        </td>
                      </>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Panel de permisos expandible */}
          {editPermisos && (() => {
            const u = todosUsuarios.find(x => x.id === editPermisos);
            if (!u) return null;
            const base = PERMISOS_BASE[u.rol] || PERMISOS_BASE.Empleado;
            const extra = u.permisosExtra || {};
            const grupos = [...new Set(PERMISOS_DISPONIBLES.map(p => p.grupo))];
            return (
              <div style={{ marginTop:16, background:"#F8FAFF", border:"1.5px solid #C6D0E8", borderRadius:10, padding:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <div>
                    <span style={{ fontWeight:800, fontSize:14, color:"#232D6B" }}>⚙ Permisos — {u.nombre}</span>
                    <span style={{ fontSize:11, color:"#54606B", marginLeft:8 }}>Rol: {u.rol} · overrides en negrita</span>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button style={{ ...S.btn(false), fontSize:11, padding:"4px 10px", color:"#B4443C" }}
                      onClick={()=>actualizar(u.id,{permisosExtra:{}})}>Restaurar rol base</button>
                    <button style={{ border:"none", background:"none", cursor:"pointer", fontSize:16 }}
                      onClick={()=>setEditPermisos(null)}>✕</button>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))", gap:10 }}>
                  {grupos.map(grupo => (
                    <div key={grupo} style={{ background:"#fff", borderRadius:8, padding:"10px 14px", border:"1px solid #E3E6E9" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"#54606B", textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>{grupo}</div>
                      {PERMISOS_DISPONIBLES.filter(p=>p.grupo===grupo).map(p => {
                        const valorBase = base[p.key];
                        const valorExtra = extra[p.key];
                        const valorActual = valorExtra !== undefined ? valorExtra : valorBase;
                        const sobrescrito = valorExtra !== undefined;
                        return (
                          <label key={p.key} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, cursor:"pointer" }}>
                            <input type="checkbox" checked={!!valorActual}
                              onChange={e => {
                                const nuevo = e.target.checked;
                                const nuevosExtra = { ...extra };
                                if (nuevo === valorBase) delete nuevosExtra[p.key];
                                else nuevosExtra[p.key] = nuevo;
                                actualizar(u.id, { permisosExtra: nuevosExtra });
                              }} />
                            <span style={{ fontSize:13, fontWeight:sobrescrito?700:400,
                              color:sobrescrito?"#232D6B":"#6B7280" }}>{p.label}</span>
                            {sobrescrito && (
                              <span style={{ fontSize:10, marginLeft:"auto", padding:"1px 6px", borderRadius:999,
                                background:valorActual?"#DCFCE7":"#FEE2E2", color:valorActual?"#15803D":"#B91C1C" }}>
                                {valorActual?"✓ extra":"✗ bloq."}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </>)}

      {/* ── PESTAÑA COMPARATIVA DE ROLES ── */}
      {tab === "roles" && (
        <div style={S.card}>
          <div style={{ marginBottom:14 }}>
            <h3 style={{ margin:0, fontSize:15 }}>📊 Comparativa de roles</h3>
            <div style={{ fontSize:12, color:"#54606B", marginTop:4 }}>
              Permisos base por rol — los permisos individuales pueden sobrescribir cualquiera de estos.
            </div>
          </div>
          <TablaRoles />
          <div style={{ marginTop:16, padding:"10px 14px", background:"#FFFBEB", borderRadius:8, fontSize:12, color:"#92400E" }}>
            💡 <b>Nota:</b> Un usuario con rol Empleado puede recibir permisos adicionales como "Aprobar expedientes" 
            sin cambiar su rol. Los cambios individuales se muestran en la columna "Permisos" de la tabla de equipo.
          </div>
        </div>
      )}
    </div>
  );
}
