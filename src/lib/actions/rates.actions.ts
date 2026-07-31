'use server'

/**
 * Rate Management Server Actions.
 * PRD Section 3.4 — Admin: Rate management, promote overrides, FX override.
 */

import { createClient } from '@/lib/supabase/server'
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Used when TODOs are implemented
import { createAdminClient } from '@/lib/supabase/admin'
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Used when TODOs are implemented
import { revalidatePath } from 'next/cache'

// ============================================================
// Types
// ============================================================

export interface ActionResult {
  success: boolean
  error?: string
}

// ============================================================
// Rate Reference (Master Rate Table)
// ============================================================

/**
 * List all rate references.
 * PRD Section 3.4: "View and edit rate_reference (Master Rate Table)."
 */
export async function listRateReferences() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('rate_reference')
    .select('*, level:levels(name)')
    .order('destination', { ascending: true })

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data }
}

/**
 * Get rate reference for a specific destination and level.
 * Used by the "Suggest Standard Rates" button (PRD Section 3.2)
 * and the pre-submit estimate (PRD Section 3.1).
 */
export async function getRateForDestination(
  destination: string,
  levelId: string,
  mode: string
) {
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

// ============================================================
// Rate Overrides (Audit Trail)
// ============================================================

/**
 * List all rate overrides for admin review.
 * PRD Section 3.4: "View rate_overrides log (HR manual entries)."
 */
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
 * Promote a rate override to the master rate_reference table.
 * PRD Section 3.4: "One-Click 'Promote to Master Rate'."
 *
 * TODO (Sprint 0):
 * 1. Fetch the override record
 * 2. Upsert into rate_reference
 * 3. Revalidate admin dashboard
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Will be used when implemented
export async function promoteOverrideToMaster(overrideId: string): Promise<ActionResult> {
  // TODO: Implement promotion logic
  throw new Error('Not implemented — Sprint 0 task')
}

// ============================================================
// FX Rate (PRD Section 5.2)
// ============================================================

/**
 * Set the daily FX rate override.
 * PRD Section 3.4: "Manual override for daily exchange rate."
 *
 * TODO (Sprint 0):
 * 1. Store in a config/settings table or KV store
 * 2. This rate is used for new international requests
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Will be used when implemented
export async function setFxRateOverride(rate: number): Promise<ActionResult> {
  // TODO: Implement FX rate storage
  throw new Error('Not implemented — Sprint 0 task')
}
