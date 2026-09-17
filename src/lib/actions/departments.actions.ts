'use server'

/**
 * Department Management Server Actions.
 * PRD Section 3.4 — Admin: "Add/edit departments and set optional annual
 * budget ceilings for future budget warnings."
 */

import { createClient } from '@/lib/supabase/server'
import { addAdminRow, editAdminRow } from '@/lib/utils/admin-crud'
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  type CreateDepartmentInput,
  type UpdateDepartmentInput,
} from '@/lib/validations/department.schema'
import type { ActionResult } from '@/types/actions'

export async function addDepartment(input: CreateDepartmentInput): Promise<ActionResult> {
  return addAdminRow({
    input,
    schema: createDepartmentSchema,
    table: 'departments',
    toRow: (parsed) => ({
      name: parsed.name,
      annual_budget_ceiling: parsed.annual_budget_ceiling ?? null,
    }),
    uniqueViolationMessage: 'A department with this name already exists',
    revalidate: ['/admin'],
  })
}

export async function editDepartment(input: UpdateDepartmentInput): Promise<ActionResult> {
  return editAdminRow({
    input,
    schema: updateDepartmentSchema,
    table: 'departments',
    revalidate: ['/admin'],
  })
}

export async function listDepartments() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('departments').select('*').order('name', { ascending: true })

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data }
}