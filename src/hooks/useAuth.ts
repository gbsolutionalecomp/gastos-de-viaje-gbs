'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AuthUser } from '@/lib/auth'

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function checkUser() {
      try {
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession()
        if (sessionErr) throw sessionErr

        if (session?.user) {
          if (mounted) {
            setUser({
              id: session.user.id,
              email: session.user.email || '',
              role: session.user.app_metadata?.role || session.user.user_metadata?.role || 'empleado',
            })
          }
        } else {
          if (mounted) setUser(null)
        }
      } catch (err: any) {
        if (mounted) setError(err.message || 'Error al obtener sesión')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          role: session.user.app_metadata?.role || session.user.user_metadata?.role || 'empleado',
        })
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const login = async (email: string, password?: string) => {
    setLoading(true)
    setError(null)
    try {
      if (password) {
        const { data, error: loginErr } = await supabase.auth.signInWithPassword({ email, password })
        if (loginErr) throw loginErr
        return data
      }
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    setLoading(true)
    try {
      await supabase.auth.signOut()
      setUser(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return { user, loading, error, login, logout }
}
