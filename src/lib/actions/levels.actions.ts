'use server'

/**
 * Level Configuration Server Actions.
 * PRD Section 3.4 — Admin: designation → grade band mapping, editable
 * without a code deployment. Mapping is exhaustive with hard failure by
 * construction: `band_id` is NOT NULL, so a level row can't exist without
 * one (REVISED_SCOPE.md §3).
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
import type { LevelWithBand } from '@/types/database'

export async function addLevel(input: CreateLevelInput): Promise<ActionResult> {
  return addAdminRow({
    input,
    schema: createLevelSchema,
    table: 'levels',
    toRow: (parsed) => ({
      name: parsed.name,
      band_id: parsed.band_id,
      sort_order: parsed.sort_order ?? null,
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

export async function listLevels(): Promise<ActionResult<LevelWithBand[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('levels')
    .select('*, band:grade_bands(code, name, dta_per_day, local_running_per_day)')
    .order('sort_order', { ascending: true })

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data }
}