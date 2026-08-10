'use server'

/**
 * Level Configuration Server Actions.
 * PRD Section 3.4 — Admin: "Edit coverage percentage and flight-class
 * mapping per level — no code deployment required."
 */

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/utils/auth-guard'
import {
  createLevelSchema,
  updateLevelSchema,
  type CreateLevelInput,
  type UpdateLevelInput,
} from '@/lib/validations/level.schema'
import { revalidatePath } from 'next/cache'

export interface ActionResult {
  success: boolean
  error?: string
}

export async function addLevel(input: CreateLevelInput): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) return { success: false, error: auth.error }

  const parsed = createLevelSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.message }

  const supabase = await createClient()
  const { error } = await supabase.from('levels').insert({
    name: parsed.data.name,
    coverage_percent: parsed.data.coverage_percent,
    flight_class: parsed.data.flight_class ?? null,
  })

  if (error) {
    return {
      success: false,
      error: error.code === '23505' ? 'A level with this name already exists' : error.message,
    }
  }

  revalidatePath('/admin')
  return { success: true }
}

export async function editLevel(input: UpdateLevelInput): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) return { success: false, error: auth.error }

  const parsed = updateLevelSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.message }

  const { id, ...fields } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.from('levels').update(fields).eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin')
  return { success: true }
}

export async function listLevels() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('levels').select('*').order('name', { ascending: true })

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data }
}