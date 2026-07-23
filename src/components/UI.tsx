// src/components/UI.tsx
import React from 'react'
import { S, ESTADOS, ROLES } from '../lib/constantes'

export function Campo({ label, children, span }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  )
}

export function Chip({ estado }: { estado: string }) {
  const e = ESTADOS[estado] || ESTADOS.ENVIADA
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: e.color, background: e.bg, padding: "3px 10px", borderRadius: 4, border: "1px solid #d4d4d8", letterSpacing:"0.03em" }}>
      {e.label}
    </span>
  )
}

export function Folio({ texto }: { texto: string }) {
  return (
    <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 12, fontWeight: 700, color: "#18181b", border: "1.5px solid #18181b", borderRadius: 4, padding: "2px 8px", letterSpacing: "0.04em", background:"#f4f4f5" }}>
      {texto}
    </span>
  )
}

export function RolChip({ rol }: { rol: string }) {
  const r = ROLES[rol] || ROLES.Empleado
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: r.color, background: r.bg, padding: "2px 8px", borderRadius: 4, border: "1px solid #d4d4d8" }}>
      {r.label}
    </span>
  )
}
