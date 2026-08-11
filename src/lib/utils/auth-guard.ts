import 'server-only'

/**
 * Shared authorization helper for Server Actions.
 * PRD Section 7.1: "These access rules must be enforced at the database
 * level, not the frontend." RLS is the real boundary — this is a fast,
 * friendly app-layer check so actions fail with a clear message instead
 * of a raw Postgres RLS error.
 */

import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'

export type AuthorizationResult =
  | { authorized: true }
  | { authorized: false; error: string }

/** Verify the current session belongs to an active staff member with one of the given roles. */
export async function requireRole(...roles: UserRole[]): Promise<AuthorizationResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { authorized: false, error: 'Not authenticated' }
  }

  const { data: staff } = await supabase
    .from('staff')
    .select('role, active')
    .eq('id', user.id)
    .single()

  if (!staff || !staff.active) {
    return { authorized: false, error: 'Account inactive' }
  }

  if (!roles.includes(staff.role as UserRole)) {
    return { authorized: false, error: 'Insufficient permissions' }
  }

  return { authorized: true }
}

/** Verify the current session belongs to an admin. Used by all Admin Dashboard actions (PRD Section 3.4). */
export async function requireAdmin(): Promise<AuthorizationResult> {
  return requireRole('admin')
}