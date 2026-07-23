'use client'

import { useEffect, useState, useCallback } from 'react'
import { Gasto } from '@/types'
import { apiClient } from '@/lib/api'

export function useGastos(usuarioId?: string) {
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchGastos = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await apiClient.getGastos(usuarioId)
    if (res.success && res.data) {
      setGastos(res.data)
    } else {
      setError(res.error || 'Error al cargar gastos')
    }
    setLoading(false)
  }, [usuarioId])

  useEffect(() => {
    fetchGastos()
  }, [fetchGastos])

  const addGasto = async (nuevoGasto: Partial<Gasto>) => {
    const res = await apiClient.createGasto(nuevoGasto)
    if (res.success && res.data) {
      setGastos((prev) => [res.data!, ...prev])
      return res.data
    } else {
      throw new Error(res.error || 'Error al agregar gasto')
    }
  }

  const updateGasto = async (id: string, cambios: Partial<Gasto>) => {
    const res = await apiClient.updateGasto(id, cambios)
    if (res.success && res.data) {
      setGastos((prev) => prev.map((g) => (g.id === id ? res.data! : g)))
      return res.data
    } else {
      throw new Error(res.error || 'Error al actualizar gasto')
    }
  }

  const deleteGasto = async (id: string) => {
    const res = await apiClient.deleteGasto(id)
    if (res.success) {
      setGastos((prev) => prev.filter((g) => g.id !== id))
    } else {
      throw new Error(res.error || 'Error al eliminar gasto')
    }
  }

  return { gastos, loading, error, refetch: fetchGastos, addGasto, updateGasto, deleteGasto }
}
