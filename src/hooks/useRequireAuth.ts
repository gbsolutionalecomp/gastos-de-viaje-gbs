'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './useAuth'

export function useRequireAuth(redirectTo: string = '/login') {
  const { user, loading, error } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push(redirectTo)
    }
  }, [user, loading, router, redirectTo])

  return { user, loading, error }
}
