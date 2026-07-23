'use client'

import React, { useState } from 'react'
import { GastoSchema } from '@/lib/schemas/gasto.schema'
import { Gasto, CategoriaGasto } from '@/types'

interface GastoFormProps {
  usuarioId: string
  onSubmit?: (gasto: Partial<Gasto>) => void
}

const CATEGORIAS: CategoriaGasto[] = [
  'Alimentación',
  'Hospedaje',
  'Transporte',
  'Gasolina',
  'Peajes',
  'Vuelos',
  'Entretenimiento',
  'Otros',
]

export function GastoForm({ usuarioId, onSubmit }: GastoFormProps) {
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [categoria, setCategoria] = useState<CategoriaGasto>('Alimentación')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const payload = {
      usuarioId,
      concepto,
      monto: Number(monto),
      categoria,
      fecha,
      notas,
      estado: 'Pendiente' as const,
    }

    try {
      const parsed = GastoSchema.parse(payload)
      if (onSubmit) {
        onSubmit(parsed as any)
      }
      setSuccess('Gasto registrado con éxito')
      setConcepto('')
      setMonto('')
      setNotas('')
    } catch (err: any) {
      if (err.errors && err.errors[0]) {
        setError(err.errors[0].message)
      } else {
        setError(err.message || 'Error al validar el gasto')
      }
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Formulario de Gasto"
      className="max-w-lg mx-auto bg-white p-6 rounded-xl shadow-md border border-gray-100"
    >
      <h3 className="text-xl font-bold text-gray-800 mb-4">Registrar Nuevo Gasto</h3>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-200">
          {success}
        </div>
      )}

      <div className="mb-4">
        <label htmlFor="concepto" className="block text-sm font-medium text-gray-700 mb-1">
          Concepto del Gasto
        </label>
        <input
          id="concepto"
          type="text"
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          placeholder="Ej. Comida de negocios con cliente"
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="monto" className="block text-sm font-medium text-gray-700 mb-1">
            Monto ($ MXN)
          </label>
          <input
            id="monto"
            type="number"
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="categoria" className="block text-sm font-medium text-gray-700 mb-1">
            Categoría
          </label>
          <select
            id="categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as CategoriaGasto)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {CATEGORIAS.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="fecha" className="block text-sm font-medium text-gray-700 mb-1">
          Fecha del Gasto
        </label>
        <input
          id="fecha"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      <div className="mb-6">
        <label htmlFor="notas" className="block text-sm font-medium text-gray-700 mb-1">
          Notas adicionales
        </label>
        <textarea
          id="notas"
          rows={3}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Observaciones o detalles..."
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      <button
        type="submit"
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow transition duration-200"
      >
        Guardar Gasto
      </button>
    </form>
  )
}
