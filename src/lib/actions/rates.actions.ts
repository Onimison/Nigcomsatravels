'use server'

/**
 * Rate Management Server Actions — the flight-price reference board
 * (REVISED_SCOPE.md M4; no longer a pricing input) and its audit trail.
 */

import { createClient } from '@/lib/supabase/server'
import { addAdminRow, editAdminRow } from '@/lib/utils/admin-crud'
import {
  rateReferenceSchema,
  updateRateReferenceSchema,
  type RateReferenceInput,
  type UpdateRateReferenceInput,
} from '@/lib/validations/rates.schema'
import type { ActionResult } from '@/types/actions'
import type { RateOverrideWithStaff, RateReferenceWithLevel, RateSuggestion } from '@/types/database'

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
 * newest-updated first. Used by the Admin "Flight Price Reference" panel
 * and the HR dashboard's always-visible reference widget.
 */
export async function listFlightPriceReference(): Promise<ActionResult<RateReferenceWithLevel[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('rate_reference')
    .select('*, level:levels(name)')
    .not('flight_estimate', 'is', null)
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