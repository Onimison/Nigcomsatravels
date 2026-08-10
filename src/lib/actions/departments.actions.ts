'use server'

/**
 * Department Management Server Actions.
 * PRD Section 3.4 — Admin: "Add/edit departments and set optional annual
 * budget ceilings for future budget warnings."
 */

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/utils/auth-guard'
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  type CreateDepartmentInput,
  type UpdateDepartmentInput,
} from '@/lib/validations/department.schema'
import { revalidatePath } from 'next/cache'

export interface ActionResult {
  success: boolean
  error?: string
}

export async function addDepartment(input: CreateDepartmentInput): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) return { success: false, error: auth.error }

  const parsed = createDepartmentSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.message }

  const supabase = await createClient()
  const { error } = await supabase.from('departments').insert({
    name: parsed.data.name,
    annual_budget_ceiling: parsed.data.annual_budget_ceiling ?? null,
  })

  if (error) {
    return {
      success: false,
      error: error.code === '23505' ? 'A department with this name already exists' : error.message,
    }
  }

  revalidatePath('/admin')
  return { success: true }
}

export async function editDepartment(input: UpdateDepartmentInput): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) return { success: false, error: auth.error }

  const parsed = updateDepartmentSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.message }

  const { id, ...fields } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.from('departments').update(fields).eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin')
  return { success: true }
}

export async function listDepartments() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('departments').select('*').order('name', { ascending: true })

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data }
}