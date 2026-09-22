'use server'

/**
 * Grade bands, coverage tiers, destination coverage, and policy defaults —
 * the data the calculator (`src/lib/policy/calculate.ts`) reads, and the
 * Admin editors (REVISED_SCOPE.md §7 Admin surface) write to. Rates are
 * data, editable here, never constants in code (decision 14).
 */

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/utils/auth-guard'
import {
  updateGradeBandSchema,
  addDestinationCoverageSchema,
  removeDestinationCoverageSchema,
  updatePolicyDefaultSchema,
  POLICY_DEFAULT_KEYS,
  type UpdateGradeBandInput,
  type AddDestinationCoverageInput,
  type RemoveDestinationCoverageInput,
  type UpdatePolicyDefaultInput,
} from '@/lib/validations/grade-bands.schema'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types/actions'
import type { AppSetting, CoverageTier, DestinationCoverage, GradeBand } from '@/types/database'

// ============================================================
// Reads
// ============================================================

export async function listGradeBands(): Promise<ActionResult<GradeBand[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('grade_bands').select('*').order('sort_order', { ascending: true })
  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data }
}

export async function listCoverageTiers(): Promise<ActionResult<CoverageTier[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('coverage_tiers').select('*')
  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data }
}

export async function listDestinationCoverage(): Promise<ActionResult<DestinationCoverage[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('destination_coverage').select('*').order('city', { ascending: true })
  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data }
}

/** The three HR-overridable transport/taxi defaults (REVISED_SCOPE.md M4). */
export async function listPolicyDefaults(): Promise<ActionResult<AppSetting[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .in('key', POLICY_DEFAULT_KEYS)

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data }
}

// ============================================================
// Writes (admin only)
// ============================================================

export async function updateGradeBand(input: UpdateGradeBandInput): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) return { success: false, error: auth.error }

  const parsed = updateGradeBandSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.message }

  const { id, ...fields } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.from('grade_bands').update(fields).eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin')
  return { success: true }
}

/** Adds a city to the 100%-coverage tier. Everything not listed defaults to partial (75%) — there's nothing to "add" for that side. */
export async function addDestinationCoverage(input: AddDestinationCoverageInput): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) return { success: false, error: auth.error }

  const parsed = addDestinationCoverageSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('destination_coverage')
    .insert({ city: parsed.data.city.trim(), coverage_tier_code: 'full' })

  if (error) {
    return {
      success: false,
      error: error.code === '23505' ? 'That city is already on the full-coverage list' : error.message,
    }
  }

  revalidatePath('/admin')
  return { success: true }
}

export async function removeDestinationCoverage(input: RemoveDestinationCoverageInput): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) return { success: false, error: auth.error }

  const parsed = removeDestinationCoverageSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.message }

  const supabase = await createClient()
  const { error } = await supabase.from('destination_coverage').delete().eq('city', parsed.data.city)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin')
  return { success: true }
}

export async function updatePolicyDefault(input: UpdatePolicyDefaultInput): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) return { success: false, error: auth.error }

  const parsed = updatePolicyDefaultSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.message }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('app_settings').upsert({
    key: parsed.data.key,
    value: String(parsed.data.value),
    updated_by: user?.id ?? null,
    updated_at: new Date().toISOString(),
  })

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin')
  return { success: true }
}
