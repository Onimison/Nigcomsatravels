'use server'

/**
 * Authentication Server Actions.
 * PRD Section 2.1 — OTP Login Mechanism
 * PRD Section 2.3 — Account Status check + auth_audit_log
 *
 * Implementation: Supabase signInWithOtp() / verifyOtp()
 */

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ROLE_DASHBOARD_PATHS } from '@/lib/utils/constants'
import {
  sendOtpSchema,
  verifyOtpSchema,
  type SendOtpInput,
  type VerifyOtpInput,
} from '@/lib/validations/auth.schema'
import { redirect } from 'next/navigation'
import type { UserRole } from '@/types/database'

// ============================================================
// Types
// ============================================================

export interface AuthActionResult {
  success: boolean
  error?: string
}

export interface VerifyOtpResult extends AuthActionResult {
  /** Dashboard path to navigate to on success (PRD 2.2 — role-based routing). */
  redirectTo?: string
}

// ============================================================
// Audit logging (PRD 2.3 — "every login attempt, success and failure")
// ============================================================

/**
 * Writes to `auth_audit_log`. Uses the admin client because there is no
 * INSERT policy on that table for anon/authenticated roles (by design —
 * only admins can read it, and only the server should ever write to it).
 *
 * We log:
 * - `sendOtp` rejections (unknown email, deactivated account, provider
 *   error) — these are the "someone was turned away at the door" signal.
 * - Every `verifyOtp` outcome, success or failure — this is the actual
 *   authentication attempt the PRD is asking us to audit.
 * We do NOT log a row for a successful `sendOtp`, since requesting a code
 * isn't itself an attempt to authenticate.
 */
async function logAuthAttempt(email: string, success: boolean): Promise<void> {
  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip') || null

  const admin = createAdminClient()
  await admin.from('auth_audit_log').insert({ email, success, ip_address: ip })
}

// ============================================================
// Actions
// ============================================================

/**
 * Send a 6-digit OTP to the user's email.
 * PRD: "6-digit numeric OTP sent to the user's official email."
 * PRD 2.3: "Login checks staff.active = true. Deactivated staff cannot log in."
 */
export async function sendOtp(input: SendOtpInput): Promise<AuthActionResult> {
  const parsed = sendOtpSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Please enter a valid email address' }
  }
  const { email } = parsed.data

  // Pre-auth: the caller has no session yet, so RLS on `staff` (own-row-only)
  // would block this read entirely. Admin client is required here, not a
  // shortcut around security — this check IS the security boundary.
  const admin = createAdminClient()
  const { data: staff } = await admin
    .from('staff')
    .select('active')
    .eq('email', email)
    .maybeSingle()

  if (!staff) {
    await logAuthAttempt(email, false)
    return { success: false, error: 'This email is not registered. Contact your administrator.' }
  }

  if (!staff.active) {
    await logAuthAttempt(email, false)
    return { success: false, error: 'This account has been deactivated. Contact your administrator.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false, // Only existing staff can log in
    },
  })

  if (error) {
    await logAuthAttempt(email, false)
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Verify the OTP code entered by the user and resolve where to send them.
 * PRD: "Verification via verifyOtp() with type='email'."
 *
 * Does NOT call redirect() itself — the verify-otp page shows a brief
 * "Verification Successful" state before navigating, so the caller
 * (a Client Component) does the navigation once it has `redirectTo`.
 */
export async function verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult> {
  const parsed = verifyOtpSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Enter the 6-digit code' }
  }
  const { email, token } = parsed.data

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })

  if (error || !data.user) {
    await logAuthAttempt(email, false)
    return { success: false, error: error?.message ?? 'Invalid or expired code. Please try again.' }
  }

  // Re-check role + active status now that we have a session. Re-checking
  // `active` here (not just at sendOtp) closes the gap where an admin
  // deactivates someone in the ~10 minutes between them requesting and
  // entering a code.
  const { data: staff } = await supabase
    .from('staff')
    .select('role, active')
    .eq('id', data.user.id)
    .single()

  if (!staff || !staff.active) {
    await logAuthAttempt(email, false)
    await supabase.auth.signOut()
    return { success: false, error: 'This account has been deactivated. Contact your administrator.' }
  }

  await logAuthAttempt(email, true)

  const role = staff.role as UserRole
  return { success: true, redirectTo: ROLE_DASHBOARD_PATHS[role] }
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
