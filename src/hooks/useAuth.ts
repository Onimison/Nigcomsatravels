'use client'

/**
 * Custom hook to get the current authenticated user and their role.
 * PRD Section 2.2 — Role Detection & Enforcement
 *
 * Usage:
 *   const { user, role, isLoading } = useAuth()
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types/database'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  role: UserRole | null
  isLoading: boolean
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    role: null,
    isLoading: true,
  })

  useEffect(() => {
    const supabase = createClient()

    async function getUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          setState({ user: null, role: null, isLoading: false })
          return
        }

        // Fetch role from staff table
        const { data: staff } = await supabase
          .from('staff')
          .select('role')
          .eq('id', user.id)
          .single()

        setState({
          user,
          role: (staff?.role as UserRole) ?? null,
          isLoading: false,
        })
      } catch {
        setState({ user: null, role: null, isLoading: false })
      }
    }

    getUser()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session?.user) {
          setState({ user: null, role: null, isLoading: false })
        } else {
          // Re-fetch role on auth change
          getUser()
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return state
}
