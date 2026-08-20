'use server'
/**
 * Staff Management Server Actions.
 * PRD Section 3.4 — System Admin Dashboard
 *
 * These actions use the Admin client (service role key) because
 * staff CRUD requires bypassing RLS to create auth users and
 * manage staff records.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/utils/auth-guard'
import {
  createStaffSchema,
  updateStaffSchema,
  deactivateStaffSchema,
  type CreateStaffInput,
  type UpdateStaffInput,
} from '@/lib/validations/staff.schema'
import { revalidatePath } from 'next/cache'

export interface ActionResult {
  success: boolean
  error?: string
}

/**
 * Add a new staff member.
 * PRD Section 3.4: "Add, edit, deactivate staff (Name, Email, Role, Department, Level)."
 */
export async function addStaff(input: CreateStaffInput): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) return { success: false, error: auth.error }

  const parsed = createStaffSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.message }
  }

  const admin = createAdminClient()

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    email_confirm: true, // no confirmation link — OTP login handles verification
  })

  if (createError || !created.user) {
    return { success: false, error: createError?.message ?? 'Could not create auth user' }
  }

  const { error: insertError } = await admin.from('staff').insert({
    id: created.user.id,
    email: parsed.data.email,
    first_name: parsed.data.first_name,
    surname: parsed.data.surname,
    role: parsed.data.role,
    department_id: parsed.data.department_id,
    level_id: parsed.data.level_id,
    active: true,
  })

  if (insertError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return {
      success: false,
      error: insertError.code === '23505' ? 'A staff member with this email already exists' : insertError.message,
    }
  }

  revalidatePath('/admin')
  return { success: true }
}

/**
 * Edit an existing staff member.
 * PRD Section 3.4: Admin can edit Name, Email, Role, Department, Level.
 */
export async function editStaff(input: UpdateStaffInput): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) return { success: false, error: auth.error }

  const parsed = updateStaffSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.message }
  }

  const { id, email, ...rest } = parsed.data
  const admin = createAdminClient()

  if (email) {
    const { error: authError } = await admin.auth.admin.updateUserById(id, { email })
    if (authError) return { success: false, error: authError.message }
  }

  const { error } = await admin
    .from('staff')
    .update({ ...(email ? { email } : {}), ...rest })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin')
  return { success: true }
}

/**
 * Deactivate a staff member (soft delete).
 * PRD Section 2.3: "Deactivated staff (offboarded) cannot log in."
 */
export async function deactivateStaff(staffId: string): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) return { success: false, error: auth.error }

  const parsed = deactivateStaffSchema.safeParse({ id: staffId })
  if (!parsed.success) {
    return { success: false, error: parsed.error.message }
  }

  const admin = createAdminClient()

  const { error } = await admin.from('staff').update({ active: false }).eq('id', parsed.data.id)
  if (error) return { success: false, error: error.message }

  // Belt-and-braces: ban the auth user too, so a fresh OTP request also fails
  // even if `staff.active` were ever bypassed.
  await admin.auth.admin.updateUserById(parsed.data.id, { ban_duration: '876000h' })

  revalidatePath('/admin')
  return { success: true }
}

/**
 * Get the signed-in user's own staff record, with department/level resolved.
 * Used by /staff/profile — self-service, any authenticated staff member can
 * read their own row (RLS: "Staff can view own record").
 */
export async function getMyProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated', data: null }

  const { data, error } = await supabase
    .from('staff')
    .select('*, department:departments(*), level:levels(*)')
    .eq('id', user.id)
    .single()

  if (error) return { success: false, error: error.message, data: null }
  return { success: true, data }
}

/**
 * List all staff members with department and level details.
 * Used by the Admin Dashboard staff management table.
 */
export async function listStaff() {
  const auth = await requireAdmin()
  if (!auth.authorized) return { success: false, error: auth.error, data: [] }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff')
    .select('*, department:departments(*), level:levels(*)')
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false, error: error.message, data: [] }
  }

  return { success: true, data }
}