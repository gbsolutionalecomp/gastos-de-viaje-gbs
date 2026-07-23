'use client'

import React, { useState } from 'react'
import { LoginSchema } from '@/lib/schemas/usuario.schema'

interface LoginFormProps {
  onLogin?: (email: string, pass: string) => Promise<void>
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const result = LoginSchema.safeParse({ email, password })
    if (!result.success) {
      setError(result.error.issues[0]?.message || 'Datos de inicio de sesión no válidos')
      return
    }

    try {
      setLoading(true)
      if (onLogin) {
        await onLogin(email, password)
      }
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Formulario de Inicio de Sesión"
      className="max-w-sm mx-auto bg-white p-8 rounded-xl shadow-lg border border-gray-100"
    >
      <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">Iniciar Sesión</h2>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Correo Electrónico
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="usuario@gbsolutions.com"
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      <div className="mb-6">
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow transition duration-200 disabled:opacity-50"
      >
        {loading ? 'Entrando...' : 'Ingresar'}
      </button>
    </form>
  )
}
