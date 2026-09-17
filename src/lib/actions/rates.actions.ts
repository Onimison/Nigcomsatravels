'use server'

/**
 * Rate Management Server Actions.
 * PRD Section 3.4 — Admin: Rate management, promote overrides, FX override.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/utils/auth-guard'
import { addAdminRow, editAdminRow } from '@/lib/utils/admin-crud'
import {
  rateReferenceSchema,
  updateRateReferenceSchema,
  fxRateSchema,
  type RateReferenceInput,
  type UpdateRateReferenceInput,
} from '@/lib/validations/rates.schema'
import { FX_RATE_SETTING_KEY } from '@/lib/utils/constants'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types/actions'
import type { AppSetting, RateOverrideWithStaff, RateReferenceWithLevel, RateSuggestion } from '@/types/database'

/**
 * `updated_at`/`updated_by` stamping shared by addRateReference and
 * updateRateReference — both need "who touched this row last, and when"
 * for HR to trust a suggested rate (PRD 3.2's Flight Price Reference
 * staleness note), which departments/levels have no equivalent of.
 */
async function stampedBy() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { updated_at: new Date().toISOString(), updated_by: user?.id ?? null }
}

// ============================================================
// Rate Reference (Master Rate Table)
// ============================================================

export async function listRateReferences(): Promise<ActionResult<RateReferenceWithLevel[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('rate_reference')
    .select('*, level:levels(name)')
    .order('destination', { ascending: true })

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data }
}

export async function addRateReference(input: RateReferenceInput): Promise<ActionResult> {
  return addAdminRow({
    input,
    schema: rateReferenceSchema,
    table: 'rate_reference',
    toRow: async (parsed) => ({ ...parsed, ...(await stampedBy()) }),
    uniqueViolationMessage: 'A rate already exists for this destination, level, and mode',
    revalidate: ['/admin'],
  })
}

export async function updateRateReference(input: UpdateRateReferenceInput): Promise<ActionResult> {
  return editAdminRow({
    input,
    schema: updateRateReferenceSchema,
    table: 'rate_reference',
    toRow: async (fields) => ({ ...fields, ...(await stampedBy()) }),
    revalidate: ['/admin', '/hr'],
  })
}

// ============================================================
// Flight Price Reference — "Sprint 4" (redefined), see UI_UX_DESIGN_PLAN.md §4
// ============================================================

/**
 * All tracked flight prices (rows with a non-null flight_estimate),
 * grouped domestic/international, newest-updated first within each group.
 * Used by the Admin "Flight Price Reference" panel and the HR dashboard's
 * always-visible reference widget.
 */
export async function listFlightPriceReference(): Promise<ActionResult<RateReferenceWithLevel[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('rate_reference')
    .select('*, level:levels(name)')
    .not('flight_estimate', 'is', null)
    .order('route_type', { ascending: true })
    .order('updated_at', { ascending: false })

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data }
}

// ============================================================
// Rate Overrides (Audit Trail)
// ============================================================

export async function listRateOverrides(): Promise<ActionResult<RateOverrideWithStaff[]>> {
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error: upsertError } = await supabase.from('rate_reference').upsert(
    {
      destination: request.destination,
      level_id: staffMember.level_id,
      mode: request.mode,
      [targetColumn]: override.overridden_value,
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    },
    { onConflict: 'destination,level_id,mode' }
  )

  if (upsertError) return { success: false, error: upsertError.message }

  revalidatePath('/admin')
  revalidatePath('/hr')
  return { success: true }
}

// ============================================================
// Rate Suggestions (AI agent write-target — read-only here)
// ============================================================

export async function listRateSuggestions(): Promise<ActionResult<RateSuggestion[]>> {
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

export async function getFxRateOverride(): Promise<ActionResult<Pick<AppSetting, 'value' | 'updated_at'> | null>> {
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