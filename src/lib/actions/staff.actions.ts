'use server'

/**
 * Staff Management Server Actions.
 * PRD Section 3.4 — System Admin Dashboard
 *
 * These actions use the Admin client (service role key) because
 * staff CRUD requires bypassing RLS to create auth users and
 * manage staff records.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Used when TODOs are implemented
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  createStaffSchema,
  updateStaffSchema,
  deactivateStaffSchema,
  type CreateStaffInput,
  type UpdateStaffInput,
} from '@/lib/validations/staff.schema'
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Used when TODOs are implemented
import { revalidatePath } from 'next/cache'

// ============================================================
// Types
// ============================================================

export interface ActionResult {
  success: boolean
  error?: string
}

// ============================================================
// Authorization Helper
// ============================================================

/**
 * Verify the current user has admin role.
 * All staff management actions require admin access.
 * Keys off email, not id, since staff.id is not the Supabase auth user id.
 */
async function requireAdmin(): Promise<{ authorized: true } | { authorized: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) {
    return { authorized: false, error: 'Not authenticated' }
  }

  const { data: staff } = await supabase
    .from('staff')
    .select('role')
    .eq('email', user.email)
    .maybeSingle()

  if (staff?.role !== 'admin') {
    return { authorized: false, error: 'Insufficient permissions' }
  }

  return { authorized: true }
}

// ============================================================
// Actions
// ============================================================

/**
 * Add a new staff member.
 * PRD Section 3.4: "Add, edit, deactivate staff (Name, Email, Role, Department, Level)."
 *
 * TODO (Sprint 0):
 * 1. Validate input with createStaffSchema
 * 2. Create auth user via admin.auth.admin.createUser()
 * 3. Insert into staff table
 * 4. Revalidate admin dashboard
 */
export async function addStaff(input: CreateStaffInput): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) return { success: false, error: auth.error }

  const parsed = createStaffSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.message }
  }

  // TODO: Implement with createAdminClient()
  // 1. admin.auth.admin.createUser({ email, email_confirm: true })
  // 2. Insert staff record linking to auth user
  // 3. revalidatePath('/admin')

  throw new Error('Not implemented — Sprint 0 task')
}

/**
 * Edit an existing staff member.
 * PRD Section 3.4: Admin can edit Name, Email, Role, Department, Level.
 *
 * TODO (Sprint 0):
 * 1. Validate input with updateStaffSchema
 * 2. Update staff table row
 * 3. If email changed, update auth.users email
 * 4. Revalidate admin dashboard
 */
export async function editStaff(input: UpdateStaffInput): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) return { success: false, error: auth.error }

  const parsed = updateStaffSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.message }
  }

  // TODO: Implement with createAdminClient()
  throw new Error('Not implemented — Sprint 0 task')
}

/**
 * Deactivate a staff member (soft delete).
 * PRD Section 2.3: "Deactivated staff (offboarded) cannot log in."
 *
 * TODO (Sprint 0):
 * 1. Set staff.active = false
 * 2. Optionally ban the auth user
 * 3. Revalidate admin dashboard
 */
export async function deactivateStaff(staffId: string): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) return { success: false, error: auth.error }

  const parsed = deactivateStaffSchema.safeParse({ id: staffId })
  if (!parsed.success) {
    return { success: false, error: parsed.error.message }
  }

  // TODO: Implement with createAdminClient()
  throw new Error('Not implemented — Sprint 0 task')
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