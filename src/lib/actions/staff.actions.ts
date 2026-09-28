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
  staffCsvRowSchema,
  MAX_BULK_IMPORT_ROWS,
  type CreateStaffInput,
  type UpdateStaffInput,
  type StaffCsvRow,
} from '@/lib/validations/staff.schema'
import { revalidatePath } from 'next/cache'

export interface ActionResult {
  success: boolean
  error?: string
}

export interface BulkAddRowResult {
  email: string
  status: 'created' | 'repaired' | 'failed'
  error?: string
}

export interface BulkAddResult {
  success: boolean
  error?: string
  created: number
  repaired: number
  failed: number
  results: BulkAddRowResult[]
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
 * Bulk-add staff from a validated CSV roster (Admin UI "Bulk Import").
 *
 * Mirrors addStaff()'s create-user → insert-row → rollback-on-failure
 * sequence per row, but:
 *  - resolves department/level BY NAME against the DB (the CSV uses
 *    human-readable names, not UUIDs)
 *  - is idempotent by email — an email that already has a staff row gets
 *    that row corrected instead of erroring (same repair pattern as
 *    scripts/seed-superusers.mjs), so a fixed re-upload of the same file
 *    is safe to run again
 *  - runs sequentially, not in parallel, to stay gentle on the Supabase
 *    Admin API
 *  - never fails the whole batch on one bad row — every row gets its own
 *    created/repaired/failed result
 */
export async function bulkAddStaff(rows: StaffCsvRow[]): Promise<BulkAddResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) {
    return { success: false, error: auth.error, created: 0, repaired: 0, failed: 0, results: [] }
  }

  if (rows.length === 0) {
    return { success: false, error: 'No rows to import', created: 0, repaired: 0, failed: 0, results: [] }
  }
  if (rows.length > MAX_BULK_IMPORT_ROWS) {
    return {
      success: false,
      error: `Too many rows in one import (max ${MAX_BULK_IMPORT_ROWS})`,
      created: 0,
      repaired: 0,
      failed: 0,
      results: [],
    }
  }

  const admin = createAdminClient()

  const [{ data: departments }, { data: levels }] = await Promise.all([
    admin.from('departments').select('id, name'),
    admin.from('levels').select('id, name'),
  ])

  const results: BulkAddRowResult[] = []
  let created = 0
  let repaired = 0
  let failed = 0

  for (const row of rows) {
    const parsed = staffCsvRowSchema.safeParse(row)
    if (!parsed.success) {
      results.push({ email: row.email || '(unknown)', status: 'failed', error: parsed.error.issues[0]?.message ?? 'Invalid row' })
      failed++
      continue
    }

    const email = parsed.data.email.trim().toLowerCase()
    const dept = departments?.find((d) => d.name.toLowerCase() === parsed.data.department.trim().toLowerCase())
    const level = levels?.find((l) => l.name.toLowerCase() === parsed.data.level.trim().toLowerCase())

    if (!dept) {
      results.push({ email, status: 'failed', error: `Department "${parsed.data.department}" not found` })
      failed++
      continue
    }
    if (!level) {
      results.push({ email, status: 'failed', error: `Level "${parsed.data.level}" not found` })
      failed++
      continue
    }

    const staffRow = {
      email,
      first_name: parsed.data.first_name.trim(),
      surname: parsed.data.surname.trim(),
      role: parsed.data.role,
      department_id: dept.id,
      level_id: level.id,
      active: true,
    }

    const { data: existing } = await admin.from('staff').select('id').eq('email', email).maybeSingle()

    if (existing) {
      const { error } = await admin.from('staff').update(staffRow).eq('id', existing.id)
      if (error) {
        results.push({ email, status: 'failed', error: error.message })
        failed++
        continue
      }
      results.push({ email, status: 'repaired' })
      repaired++
      continue
    }

    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true, // no confirmation link — OTP login handles verification
    })

    if (createError || !createdUser.user) {
      results.push({ email, status: 'failed', error: createError?.message ?? 'Could not create auth user' })
      failed++
      continue
    }

    const { error: insertError } = await admin.from('staff').insert({ id: createdUser.user.id, ...staffRow })

    if (insertError) {
      await admin.auth.admin.deleteUser(createdUser.user.id)
      results.push({
        email,
        status: 'failed',
        error: insertError.code === '23505' ? 'A staff member with this email already exists' : insertError.message,
      })
      failed++
      continue
    }

    results.push({ email, status: 'created' })
    created++
  }

  revalidatePath('/admin')
  return { success: true, created, repaired, failed, results }
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
    .select('*, department:departments(*), level:levels(*), designation:designations(name, grade_band:grade_bands(code))')
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false, error: error.message, data: [] }
  }

  return { success: true, data }
}