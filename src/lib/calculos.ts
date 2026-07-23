// src/lib/calculos.ts
// Funciones de cálculo financiero, detección de categorías y utilidades de formato

import { CATS, MAPA_CLARA } from "./constantes"

export const mxn = (n: number | null | undefined): string =>
  n == null || isNaN(n) ? "—" : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n)

export const hoy = (): string => new Date().toISOString().slice(0, 10)

export const uid = (): string => {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
  } catch {}
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export const detectarCategoria = (concepto = "", categoria = ""): string => {
  if (categoria && categoria !== "Otros" && MAPA_CLARA[categoria]) return MAPA_CLARA[categoria]
  const texto = (concepto + " " + categoria).toLowerCase()
  if (/gasolina|combustible|gas|peaje|caseta|autopista|fonadin|fondo nacional|taxi|uber|didi|cabify|aerol|vuelo|autobus|ado|estacionamiento|parking|renta.*auto/i.test(texto))
    return "Transporte"
  if (/hotel|hospedaje|airbnb|motel|hostal/i.test(texto)) return "Hospedaje"
  if (/restaurant|comida|alimento|café|cafe|cafeteria|starbucks|mcdonald|domino|pizza|super|abarrote/i.test(texto))
    return "Alimentos"
  if (/papeler|office|staples|ferret|home depot|material|herramienta/i.test(texto)) return "Materiales"
  return MAPA_CLARA[categoria] || "Otros"
}

export interface TotalesExpediente {
  clara: number
  manual: number
  reembolsoClara: number
  reembolsoClaraAprobado: number
  subtotal: number
  iva: number
  ivaRetenido: number
  isrRetenido: number
  ish: number
  propinas: number
  total: number
  retirosClara: number
  comisionesClara: number
  rechazadosClara: number
  rechazadosReemb: number
  reembolso: number
  efectivo: number
  sinFactura: number
  presupuestoTotal: number
  porCat: Record<string, { presupuesto: number; comprobado: number }>
}

export function calcular(sol: any): TotalesExpediente {
  const movs = sol.movimientos || []
  const retiros = movs.filter((m: any) => m.esRetiro)
  const rechazadosC = movs.filter((m: any) => m.esRechazado && !m.esRetiro && !m.esComision)
  const comisiones = movs.filter((m: any) => m.esComision)
  const rechazadosReemb: any[] = []
  const activos = movs.filter((m: any) => !m.esRechazado)
  const clara = activos.filter((m: any) => m.origen === "clara" && !m.esRetiro)
  const reembClara = activos.filter((m: any) => m.origen === "clara-reembolso" && !m.esRetiro)
  const manuales = activos.filter((m: any) => m.origen !== "clara" && m.origen !== "clara-reembolso" && !m.esRetiro)
  const suma = (arr: any[], campo: string) => arr.reduce((a, m) => a + (Number(m[campo]) || 0), 0)

  const ivaReal = (m: any) => {
    if (m.iva16 !== undefined || m.iva8 !== undefined) return (Number(m.iva16) || 0) + (Number(m.iva8) || 0)
    return Number(m.iva) || 0
  }
  const subtotalReal = (m: any) => Number(m.subtotal) || (Number(m.total) || 0) - ivaReal(m)

  const movsGasto = movs.filter((m: any) => !m.esRetiro && !m.esRechazado)
  const ivaTotal = movsGasto.reduce((a: number, m: any) => a + ivaReal(m), 0)
  const subtotalTot = movsGasto.reduce((a: number, m: any) => a + subtotalReal(m), 0)
  const ivaRetenido = suma(movs, "ivaRetenido")
  const isrRetenido = suma(movs, "isrRetenido")
  const ish = suma(movs, "ish")
  const propinas = suma(movs, "propina")

  const porCat: Record<string, { presupuesto: number; comprobado: number }> = {}
  CATS.forEach((c) => {
    porCat[c] = {
      presupuesto: Number(sol.presupuesto?.[c]) || 0,
      comprobado: suma(
        movsGasto.filter((m: any) => m.categoria === c),
        "total"
      ),
    }
  })

  return {
    clara: suma(clara, "total"),
    manual: suma(manuales, "total"),
    reembolsoClara: suma(reembClara, "total"),
    reembolsoClaraAprobado: suma(
      reembClara.filter((m: any) => String(m.aprobacionClara || "").toLowerCase().includes("aprob") || !!m.aprobado),
      "total"
    ),
    subtotal: subtotalTot,
    iva: ivaTotal,
    ivaRetenido,
    isrRetenido,
    ish,
    propinas,
    total: suma(movsGasto, "total"),
    retirosClara: suma(retiros, "total"),
    comisionesClara: suma(comisiones, "total"),
    rechazadosClara: suma(rechazadosC, "total"),
    rechazadosReemb: suma(rechazadosReemb, "total"),
    reembolso: suma(
      manuales.filter((m: any) => m.reembolso),
      "total"
    ),
    efectivo: suma(
      manuales.filter((m: any) => m.formaPago === "Efectivo"),
      "total"
    ),
    sinFactura: suma(
      movsGasto.filter((m: any) => !m.factura),
      "total"
    ),
    presupuestoTotal: CATS.reduce((a, c) => a + porCat[c].presupuesto, 0),
    porCat,
  }
}
