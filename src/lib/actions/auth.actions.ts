'use server'

/**
 * Authentication Server Actions.
 * PRD Section 2.1 — OTP Login Mechanism
 * PRD Section 2.3 — Account Status check
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { ROLE_DASHBOARD_PATHS } from '@/lib/utils/constants'
import type { UserRole } from '@/types/database'

export interface AuthActionResult {
  success: boolean
  error?: string
}

async function logAuthAttempt(email: string, success: boolean) {
  const admin = createAdminClient()
  const headersList = await headers()
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    'unknown'

  await admin.from('auth_audit_log').insert({ email, success, ip_address: ip })
}

export async function sendOtp(rawEmail: string): Promise<AuthActionResult> {
  const email = rawEmail?.trim().toLowerCase()
  if (!email) return { success: false, error: 'Email is required' }

  const admin = createAdminClient()

  const { data: staffRecord } = await admin
    .from('staff')
    .select('id, active')
    .eq('email', email)
    .maybeSingle()

  const eligible = !!staffRecord && staffRecord.active === true
  await logAuthAttempt(email, eligible)

  if (!eligible) {
    return { success: false, error: 'Unable to send a code to this email.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  })

  if (error) {
    // TEMPORARY DEBUG LOGGING — remove once the real cause is found
    console.error('=== signInWithOtp FULL ERROR ===')
    console.error('name:', error.name)
    console.error('status:', error.status)
    console.error('code:', error.code)
    console.error('message:', error.message)
    console.error('full object:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    console.error('================================')

    return { success: false, error: error.message || 'Unknown error — check server logs' }
  }

  return { success: true }
}

export async function verifyOtp(rawEmail: string, token: string): Promise<AuthActionResult> {
  const email = rawEmail?.trim().toLowerCase()

  if (!email || !token) {
    return { success: false, error: 'Email and OTP code are required' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })

  await logAuthAttempt(email, !error)

  if (error) return { success: false, error: error.message }

  const { data: staff } = await supabase
    .from('staff')
    .select('role, active')
    .eq('email', email)
    .maybeSingle()

  if (!staff || !staff.active) {
    await supabase.auth.signOut()
    return { success: false, error: 'Account is inactive. Contact your administrator.' }
  }

  const role = staff.role as UserRole
  redirect(ROLE_DASHBOARD_PATHS[role])
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}