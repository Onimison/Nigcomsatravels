'use server'

/**
 * Level Configuration Server Actions.
 * PRD Section 3.4 — Admin: "Edit coverage percentage and flight-class
 * mapping per level — no code deployment required."
 */

import { createClient } from '@/lib/supabase/server'
import { addAdminRow, editAdminRow } from '@/lib/utils/admin-crud'
import {
  createLevelSchema,
  updateLevelSchema,
  type CreateLevelInput,
  type UpdateLevelInput,
} from '@/lib/validations/level.schema'
import type { ActionResult } from '@/types/actions'

export async function addLevel(input: CreateLevelInput): Promise<ActionResult> {
  return addAdminRow({
    input,
    schema: createLevelSchema,
    table: 'levels',
    toRow: (parsed) => ({
      name: parsed.name,
      coverage_percent: parsed.coverage_percent,
      flight_class: parsed.flight_class ?? null,
    }),
    uniqueViolationMessage: 'A level with this name already exists',
    revalidate: ['/admin'],
  })
}

export async function editLevel(input: UpdateLevelInput): Promise<ActionResult> {
  return editAdminRow({
    input,
    schema: updateLevelSchema,
    table: 'levels',
    revalidate: ['/admin'],
  })
}

export async function listLevels() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('levels').select('*').order('name', { ascending: true })

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data }
}