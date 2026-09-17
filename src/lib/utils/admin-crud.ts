import 'server-only'

/**
 * Shared implementation for the Admin Dashboard's simple CRUD server
 * actions (departments/levels/rate references — PRD Section 3.4).
 *
 * Every admin add/edit action follows the identical shape: require admin,
 * validate with zod, write, map a unique-constraint violation to a
 * friendly message, revalidate. Only the table, schema, row shape, and
 * violation message differ per entity — those are the parameters here.
 * Entities that need extra per-row behavior (e.g. rate_reference's
 * updated_at/updated_by tracking) supply their own `toRow`.
 */

import { revalidatePath } from 'next/cache'
import type { ZodType } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/utils/auth-guard'

interface CrudActionResult {
  success: boolean
  error?: string
}

export async function addAdminRow<Input>(options: {
  input: Input
  schema: ZodType<Input>
  table: string
  toRow: (parsed: Input) => Record<string, unknown> | Promise<Record<string, unknown>>
  uniqueViolationMessage: string
  revalidate: string[]
}): Promise<CrudActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) return { success: false, error: auth.error }

  const parsed = options.schema.safeParse(options.input)
  if (!parsed.success) return { success: false, error: parsed.error.message }

  const row = await options.toRow(parsed.data)
  const supabase = await createClient()
  const { error } = await supabase.from(options.table).insert(row)

  if (error) {
    return {
      success: false,
      error: error.code === '23505' ? options.uniqueViolationMessage : error.message,
    }
  }

  options.revalidate.forEach((path) => revalidatePath(path))
  return { success: true }
}

export async function editAdminRow<Input extends { id: string }>(options: {
  input: Input
  schema: ZodType<Input>
  table: string
  /** Defaults to every validated field except `id`, unchanged. */
  toRow?: (fields: Omit<Input, 'id'>) => Record<string, unknown> | Promise<Record<string, unknown>>
  revalidate: string[]
}): Promise<CrudActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) return { success: false, error: auth.error }

  const parsed = options.schema.safeParse(options.input)
  if (!parsed.success) return { success: false, error: parsed.error.message }

  const { id, ...fields } = parsed.data
  const row = options.toRow ? await options.toRow(fields) : fields
  const supabase = await createClient()
  const { error } = await supabase.from(options.table).update(row).eq('id', id)

  if (error) return { success: false, error: error.message }

  options.revalidate.forEach((path) => revalidatePath(path))
  return { success: true }
}
