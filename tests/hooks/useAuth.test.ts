import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useAuth } from '@/hooks/useAuth'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            user: {
              id: 'user-mock-123',
              email: 'mock@gbsolutions.com',
              app_metadata: { role: 'admin' },
            },
          },
        },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}))

describe('useAuth Hook', () => {
  it('loads user session on mount', async () => {
    const { result } = renderHook(() => useAuth())

    // Wait until loading finishes
    await vi.waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.user).toEqual({
      id: 'user-mock-123',
      email: 'mock@gbsolutions.com',
      role: 'admin',
    })
  })
})
