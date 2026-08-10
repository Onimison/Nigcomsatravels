'use server'

/**
 * Rate Management Server Actions.
 * PRD Section 3.4 — Admin: Rate management, promote overrides, FX override.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/utils/auth-guard'
import {
  rateReferenceSchema,
  updateRateReferenceSchema,
  fxRateSchema,
  type RateReferenceInput,
  type UpdateRateReferenceInput,
} from '@/lib/validations/rates.schema'
import { FX_RATE_SETTING_KEY } from '@/lib/utils/constants'
import { revalidatePath } from 'next/cache'

export interface ActionResult {
  success: boolean
  error?: string
}

// ============================================================
// Rate Reference (Master Rate Table)
// ============================================================

export async function listRateReferences() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('rate_reference')
    .select('*, level:levels(name)')
    .order('destination', { ascending: true })

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data }
}

export async function getRateForDestination(destination: string, levelId: string, mode: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('rate_reference')
    .select('*')
    .eq('destination', destination)
    .eq('level_id', levelId)
    .eq('mode', mode)
    .maybeSingle()

  if (error) return { success: false, error: error.message, data: null }
  return { success: true, data }
}

export async function addRateReference(input: RateReferenceInput): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) return { success: false, error: auth.error }

  const parsed = rateReferenceSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.message }

  const supabase = await createClient()
  const { error } = await supabase.from('rate_reference').insert(parsed.data)

  if (error) {
    return {
      success: false,
      error:
        error.code === '23505'
          ? 'A rate already exists for this destination, level, and mode'
          : error.message,
    }
  }

  revalidatePath('/admin')
  return { success: true }
}

export async function updateRateReference(input: UpdateRateReferenceInput): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) return { success: false, error: auth.error }

  const parsed = updateRateReferenceSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.message }

  const { id, ...fields } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.from('rate_reference').update(fields).eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin')
  return { success: true }
}

// ============================================================
// Rate Overrides (Audit Trail)
// ============================================================

export async function listRateOverrides() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('rate_overrides')
    .select('*, hr_staff:staff(first_name, surname)')
    .order('timestamp', { ascending: false })

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data }
}

/**
 * Maps a travel_requests allowance column to its rate_reference equivalent.
 * `allowance_local` has no master-table column on purpose.
 */
const PROMOTABLE_FIELDS: Record<
  string,
  'accommodation_rate' | 'per_diem_rate' | 'flight_estimate' | 'airport_taxi'
> = {
  accommodation: 'accommodation_rate',
  per_diem: 'per_diem_rate',
  allowance_flight: 'flight_estimate',
  allowance_taxi: 'airport_taxi',
}

export async function promoteOverrideToMaster(overrideId: string): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) return { success: false, error: auth.error }

  const supabase = await createClient()

  const { data: override, error: overrideError } = await supabase
    .from('rate_overrides')
    .select('field_name, overridden_value, request_id')
    .eq('id', overrideId)
    .single()

  if (overrideError || !override) {
    return { success: false, error: overrideError?.message ?? 'Override not found' }
  }

  const targetColumn = PROMOTABLE_FIELDS[override.field_name]
  if (!targetColumn) {
    return {
      success: false,
      error: `"${override.field_name}" has no equivalent Master Rate Table column and cannot be promoted.`,
    }
  }

  const { data: request, error: requestError } = await supabase
    .from('travel_requests')
    .select('destination, mode, staff_id')
    .eq('id', override.request_id)
    .single()

  if (requestError || !request) {
    return { success: false, error: requestError?.message ?? 'Related travel request not found' }
  }

  const { data: staffMember, error: staffError } = await supabase
    .from('staff')
    .select('level_id')
    .eq('id', request.staff_id)
    .single()

  if (staffError || !staffMember?.level_id) {
    return { success: false, error: 'Could not determine the staff level for this request' }
  }

  const { error: upsertError } = await supabase.from('rate_reference').upsert(
    {
      destination: request.destination,
      level_id: staffMember.level_id,
      mode: request.mode,
      [targetColumn]: override.overridden_value,
    },
    { onConflict: 'destination,level_id,mode' }
  )

  if (upsertError) return { success: false, error: upsertError.message }

  revalidatePath('/admin')
  return { success: true }
}

// ============================================================
// Rate Suggestions (AI agent write-target — read-only here)
// ============================================================

export async function listRateSuggestions() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('rate_suggestions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data }
}

// ============================================================
// FX Rate (PRD Section 5.2)
// ============================================================

export async function getFxRateOverride() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('app_settings')
    .select('value, updated_at')
    .eq('key', FX_RATE_SETTING_KEY)
    .maybeSingle()

  if (error) return { success: false, error: error.message, data: null }
  return { success: true, data }
}

export async function setFxRateOverride(rate: number): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) return { success: false, error: auth.error }

  const parsed = fxRateSchema.safeParse({ rate })
  if (!parsed.success) return { success: false, error: parsed.error.message }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('app_settings').upsert({
    key: FX_RATE_SETTING_KEY,
    value: String(parsed.data.rate),
    updated_by: user?.id ?? null,
    updated_at: new Date().toISOString(),
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin')
  return { success: true }
}