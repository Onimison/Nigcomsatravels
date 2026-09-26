'use server'

/**
 * Phase 0 staff submission — notes.md v1.1. A deliberately separate module
 * from requests.actions.ts: that file's `submitRequest`/`resubmitRequest`
 * back the old FX/single-traveller path HR and MD still run against today,
 * and this is a different shape end to end (memo number, multiple
 * travellers, NGN-only). Both write to the same `travel_requests` table —
 * see the migration's header comment for why that's safe.
 */

import { createClient } from '@/lib/supabase/server'
import { resolveEndpoint, type SupabaseClient } from '@/lib/utils/resolve-endpoint'
import { revalidatePath } from 'next/cache'
import {
  createTravelRequestV2Schema,
  type CreateTravelRequestV2Input,
} from '@/lib/validations/travel-request-v2.schema'
import { getPolicyDefaults } from '@/lib/actions/policy.actions'
import {
  priceTraveller,
  inclusiveDayCount,
  coveragePercentFor,
  requestTotal,
  buildPolicySnapshot,
} from '@/lib/utils/policy-calculator'
import type { GradeBand } from '@/types/database'

export interface ActionResult {
  success: boolean
  error?: string
}

const UNIQUE_VIOLATION = '23505'

/** One staff row's resolved designation + grade band, keyed for a batch lookup. */
interface ResolvedStaff {
  id: string
  designationName: string | null
  gradeBand: GradeBand | null
}

async function resolveStaffBands(supabase: SupabaseClient, staffIds: string[]): Promise<Map<string, ResolvedStaff>> {
  const { data } = await supabase
    .from('staff')
    .select('id, designation:designations(name, grade_band:grade_bands(*))')
    .in('id', staffIds)

  const byId = new Map<string, ResolvedStaff>()
  for (const row of data ?? []) {
    const designation = Array.isArray(row.designation) ? row.designation[0] : row.designation
    const gradeBand = designation
      ? ((Array.isArray(designation.grade_band) ? designation.grade_band[0] : designation.grade_band) as GradeBand)
      : null
    byId.set(row.id, {
      id: row.id,
      designationName: designation?.name ?? null,
      gradeBand: gradeBand ?? null,
    })
  }
  return byId
}

/**
 * Shared by submit and resubmit: resolves endpoints, prices every
 * traveller with the one shared calculator (FR-11), and writes both rows.
 * Not run inside a database transaction (this app has none for multi-table
 * writes — see hrReviewRequest's approvals insert for the same tradeoff);
 * a traveller-insert failure compensates by deleting the request row it was
 * about to belong to, so a submit either fully succeeds or leaves nothing.
 */
async function insertTravelRequestV2(
  supabase: SupabaseClient,
  requesterId: string,
  input: CreateTravelRequestV2Input,
  versioning: { travelGroupId: string; previousVersionId: string | null }
): Promise<ActionResult> {
  const destination = await resolveEndpoint(supabase, input.destination_airport_id, input.destination)
  const origin = await resolveEndpoint(supabase, null, input.origin)

  const days = inclusiveDayCount(input.depart_date, input.return_date)
  if (days === null) {
    return { success: false, error: 'Invalid travel dates' }
  }

  const travellerIds = [...new Set([requesterId, ...input.traveler_staff_ids])]

  const [{ data: defaults }, staffBands] = await Promise.all([
    getPolicyDefaults(),
    resolveStaffBands(supabase, travellerIds),
  ])

  const coveragePercent = coveragePercentFor(destination.text, defaults)

  const priced = travellerIds.map((staffId) => {
    const resolved = staffBands.get(staffId)
    const result = priceTraveller({
      gradeBand: resolved?.gradeBand ?? null,
      days,
      coveragePercent,
      mode: input.mode,
      tripType: input.trip_type,
      defaults,
    })
    return { staffId, resolved, result }
  })

  const { data: requestRow, error: insertError } = await supabase
    .from('travel_requests')
    .insert({
      travel_group_id: versioning.travelGroupId,
      previous_version_id: versioning.previousVersionId,
      staff_id: requesterId,
      status: 'pending_hr',
      memo_number: input.memo_number,
      trip_type: input.trip_type,
      mode: input.mode,
      days,
      depart_date: input.depart_date,
      return_date: input.return_date,
      reason_for_travel: input.reason_for_travel,
      destination: destination.text,
      destination_airport_id: destination.airportId,
      origin: origin.text,
      origin_airport_id: origin.airportId,
      policy_snapshot: buildPolicySnapshot(defaults, coveragePercent),
      total_ngn: requestTotal(priced.map((p) => p.result.travellerTotal)),
    })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === UNIQUE_VIOLATION) {
      return { success: false, error: 'This memo number already has an active request. Resubmit that one instead of starting a new one.' }
    }
    return { success: false, error: insertError.message }
  }

  const travellerRows = priced.map(({ staffId, resolved, result }) => ({
    request_id: requestRow.id,
    staff_id: staffId,
    is_requester: staffId === requesterId,
    designation_name: resolved?.designationName ?? 'Unmapped',
    grade_band_code: resolved?.gradeBand?.code ?? null,
    is_unmapped: result.isUnmapped,
    dta_rate_used: result.dtaRateUsed,
    local_running_rate_used: result.localRunningRateUsed,
    dta_amount: result.dtaAmount,
    local_running_amount: result.localRunningAmount,
    transport_amount: result.transportAmount,
    airport_taxi_amount: result.airportTaxiAmount,
    traveller_total: result.travellerTotal,
  }))

  const { error: travellersError } = await supabase.from('request_travelers').insert(travellerRows)

  if (travellersError) {
    // Compensate — a request with no travellers (not even the requester) is invalid data.
    await supabase.from('travel_requests').delete().eq('id', requestRow.id)
    return { success: false, error: travellersError.message }
  }

  revalidatePath('/staff')
  return { success: true }
}

/** New submission — FR-4 through FR-9. */
export async function submitTravelRequestV2(input: CreateTravelRequestV2Input): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const parsed = createTravelRequestV2Schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' }
  }

  return insertTravelRequestV2(supabase, user.id, parsed.data, {
    travelGroupId: crypto.randomUUID(),
    previousVersionId: null,
  })
}

/** Resubmit a request HR or MD returned for revision — same versioning chain as the old path (PRD §5.3 equivalent). */
export async function resubmitTravelRequestV2(
  originalRequestId: string,
  input: CreateTravelRequestV2Input
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const parsed = createTravelRequestV2Schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' }
  }

  const { data: original, error: fetchError } = await supabase
    .from('travel_requests')
    .select('id, staff_id, travel_group_id, status')
    .eq('id', originalRequestId)
    .single()

  if (fetchError || !original) {
    return { success: false, error: 'Original request not found' }
  }
  if (original.staff_id !== user.id) {
    return { success: false, error: 'You can only resubmit your own requests' }
  }
  if (original.status !== 'hr_rejected' && original.status !== 'md_rejected') {
    return { success: false, error: 'Only requests returned for revision can be resubmitted' }
  }

  return insertTravelRequestV2(supabase, user.id, parsed.data, {
    travelGroupId: original.travel_group_id,
    previousVersionId: original.id,
  })
}
