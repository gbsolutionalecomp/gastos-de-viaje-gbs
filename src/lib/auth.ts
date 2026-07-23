import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export interface AuthUser {
  id: string
  email: string
  role?: string
}

export interface AuthCheckResult {
  user: AuthUser | null
  errorResponse?: NextResponse
}

/**
 * Checks authentication for API routes.
 * Supports both Bearer authorization headers and Supabase session cookies.
 */
export async function checkAuth(
  req: NextRequest,
  requiredRole?: string
): Promise<AuthCheckResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // In local development fallback or mock mode if env vars are missing
    console.warn('[AUTH WARNING] Supabase environment variables not configured.')
    return {
      user: { id: 'mock-user-id', email: 'user@gbsolutions.com', role: 'admin' },
    }
  }

  // 1. Check Bearer Token in Authorization header
  const authHeader = req.headers.get('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim()
    if (token) {
      const client = createClient(supabaseUrl, supabaseAnonKey)
      const { data: { user }, error } = await client.auth.getUser(token)
      if (user && !error) {
        const userRole = user.app_metadata?.role || user.user_metadata?.role || 'usuario'
        if (requiredRole && userRole !== requiredRole && userRole !== 'admin') {
          console.warn(`[AUTH FORBIDDEN] User ${user.email} lacks required role ${requiredRole}`)
          return {
            user: null,
            errorResponse: NextResponse.json(
              { success: false, error: 'Forbidden: Insufficient privileges', timestamp: new Date().toISOString() },
              { status: 403 }
            ),
          }
        }
        return { user: { id: user.id, email: user.email || '', role: userRole } }
      }
    }
  }

  // 2. Check Cookie Session
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll() {},
    },
  })

  const {
    data: { user },
    error: sessionError,
  } = await supabase.auth.getUser()

  if (sessionError || !user) {
    console.warn(`[AUTH UNAUTHORIZED] Failed authentication attempt from IP: ${req.headers.get('x-forwarded-for') || 'unknown'}`)
    return {
      user: null,
      errorResponse: NextResponse.json(
        { success: false, error: 'Unauthorized: Session missing or expired', timestamp: new Date().toISOString() },
        { status: 401 }
      ),
    }
  }

  const userRole = user.app_metadata?.role || user.user_metadata?.role || 'usuario'
  if (requiredRole && userRole !== requiredRole && userRole !== 'admin') {
    console.warn(`[AUTH FORBIDDEN] User ${user.email} lacks required role ${requiredRole}`)
    return {
      user: null,
      errorResponse: NextResponse.json(
        { success: false, error: 'Forbidden: Insufficient privileges', timestamp: new Date().toISOString() },
        { status: 403 }
      ),
    }
  }

  return {
    user: {
      id: user.id,
      email: user.email || '',
      role: userRole,
    },
  }
}
