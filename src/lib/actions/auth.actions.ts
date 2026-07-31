'use server'

/**
 * Authentication Server Actions.
 * PRD Section 2.1 — OTP Login Mechanism
 * PRD Section 2.3 — Account Status check
 *
 * Implementation: Supabase signInWithOtp() / verifyOtp()
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ROLE_DASHBOARD_PATHS } from '@/lib/utils/constants'
import type { UserRole } from '@/types/database'

// ============================================================
// Types
// ============================================================

export interface AuthActionResult {
  success: boolean
  error?: string
}

// ============================================================
// Actions
// ============================================================

/**
 * Send a 6-digit OTP to the user's email.
 * PRD: "6-digit numeric OTP sent to the user's official email."
 *
 * TODO (Sprint 1):
 * 1. Validate email exists in staff table and staff.active = true
 * 2. Call supabase.auth.signInWithOtp({ email })
 * 3. Log attempt to auth_audit_log (via admin client)
 * 4. Return success/error
 */
export async function sendOtp(formData: FormData): Promise<AuthActionResult> {
  const email = formData.get('email') as string

  if (!email) {
    return { success: false, error: 'Email is required' }
  }

  const supabase = await createClient()

  // TODO: Check staff.active = true before sending OTP
  // TODO: Log to auth_audit_log

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false, // Only existing staff can log in
    },
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Verify the OTP code entered by the user.
 * PRD: "Verification via verifyOtp() with type='email'."
 *
 * TODO (Sprint 1):
 * 1. Verify OTP via supabase.auth.verifyOtp()
 * 2. Fetch user role from staff table
 * 3. Log success to auth_audit_log
 * 4. Redirect to role-specific dashboard
 */
export async function verifyOtp(formData: FormData): Promise<AuthActionResult> {
  const email = formData.get('email') as string
  const token = formData.get('token') as string

  if (!email || !token) {
    return { success: false, error: 'Email and OTP code are required' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })

  if (error) {
    return { success: false, error: error.message }
  }

  // Fetch user role and redirect to appropriate dashboard
  const { data: staff } = await supabase
    .from('staff')
    .select('role')
    .single()

  const role = (staff?.role as UserRole) ?? 'staff'
  redirect(ROLE_DASHBOARD_PATHS[role])
}

/**
 * Sign out the current user.
 * PRD Section 2.1: "Mandatory logout button; no persistent 'remember me'."
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
