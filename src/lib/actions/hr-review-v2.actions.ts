'use server'

/**
 * HR's Phase 0 review action (notes.md v1.1, FR-16/FR-17/FR-18) — a
 * separate module from requests.actions.ts's `hrReviewRequest`, which still
 * backs the legacy 5-allowance-field/FX review path for pre-Phase-0 rows.
 * `hrRejectRequest` needs no v2 equivalent: it only ever touches status and
 * a reason, which is identical for both request shapes.
 */

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/utils/auth-guard'
import { revalidatePath } from 'next/cache'
import { hrReviewV2Schema, type HRReviewV2Input } from '@/lib/validations/hr-review-v2.schema'
import { priceTraveller, type PolicyDefaults } from '@/lib/utils/policy-calculator'
import type { GradeBand, GradeBandCode, PolicySnapshot, TravelMode, TripType } from '@/types/database'

export interface ActionResult {
  success: boolean
  error?: string
}

interface StoredTraveler {
  id: string
  staff_id: string
  is_unmapped: boolean
  dta_rate_used: number | null
  local_running_rate_used: number | null
  transport_amount: number
  airport_taxi_amount: number
  grade_band_code: GradeBandCode | null
  designation_name: string
}

/**
 * A GradeBand shaped from a frozen per-traveller rate rather than the live
 * grade_bands table (FR-14) — `coveragePercent` is fixed for the whole
 * request, so `priceTraveller` only ever reads the matching one of these
 * two identical values. Reusing the one shared calculator here, instead of
 * re-deriving dta/local inline, is what keeps FR-11 true on the HR side too.
 */
function frozenGradeBand(t: Pick<StoredTraveler, 'grade_band_code' | 'dta_rate_used' | 'local_running_rate_used'>): GradeBand {
  return {
    id: '',
    code: (t.grade_band_code ?? 'B4') as GradeBandCode,
    label: '',
    dta_per_day_100: t.dta_rate_used!,
    dta_per_day_75: t.dta_rate_used!,
    local_running_per_day_100: t.local_running_rate_used!,
    local_running_per_day_75: t.local_running_rate_used!,
  }
}

/** Re-checks whether Admin has since assigned a designation to a traveller who was unmapped at submission (FR-13). */
async function resolveFreshBands(
  supabase: Awaited<ReturnType<typeof createClient>>,
  staffIds: string[]
): Promise<Map<string, { designationName: string; gradeBand: GradeBand | null }>> {
  const result = new Map<string, { designationName: string; gradeBand: GradeBand | null }>()
  if (staffIds.length === 0) return result

  const { data } = await supabase
    .from('staff')
    .select('id, designation:designations(name, grade_band:grade_bands(*))')
    .in('id', staffIds)

  for (const row of data ?? []) {
    const designation = Array.isArray(row.designation) ? row.designation[0] : row.designation
    const gradeBand = designation
      ? ((Array.isArray(designation.grade_band) ? designation.grade_band[0] : designation.grade_band) as GradeBand)
      : null
    result.set(row.id, { designationName: designation?.name ?? 'Unmapped', gradeBand: gradeBand ?? null })
  }
  return result
}

/**
 * HR sets days trip-wide and, per traveller, transport/airport taxi
 * (FR-16/FR-17) — DTA and local running are never entered directly, only
 * recomputed from the frozen per-day rate × the (possibly revised) day
 * count. Forwarding is refused if any traveller is still unmapped (FR-13)
 * — DTA/local running can never be typed in to work around that; the fix
 * is Admin mapping the designation, not HR guessing a figure.
 */
export async function hrReviewRequestV2(input: HRReviewV2Input): Promise<ActionResult> {
  const auth = await requireRole('hr', 'admin')
  if (!auth.authorized) return { success: false, error: auth.error }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const parsed = hrReviewV2Schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const { request_id, days, hr_note, traveler_overrides } = parsed.data

  const { data: request, error: fetchError } = await supabase
    .from('travel_requests')
    .select('id, status, memo_number, mode, trip_type, days, policy_snapshot')
    .eq('id', request_id)
    .single()

  if (fetchError || !request) return { success: false, error: 'Request not found' }
  if (!request.memo_number) return { success: false, error: 'This request predates the Phase 0 review flow' }
  if (request.status !== 'pending_hr') return { success: false, error: 'This request is no longer awaiting HR review' }

  const policySnapshot = request.policy_snapshot as PolicySnapshot | null
  if (!policySnapshot) return { success: false, error: 'This request is missing its policy snapshot and cannot be recomputed' }

  const defaults: PolicyDefaults = {
    transportAirEachWay: policySnapshot.transport_air_each_way,
    transportRoadEachWay: policySnapshot.transport_road_each_way,
    airportTaxiPerLeg: policySnapshot.airport_taxi_per_leg,
    fullCoverageCities: policySnapshot.full_coverage_cities,
  }

  const { data: travelers, error: travelersError } = await supabase
    .from('request_travelers')
    .select(
      'id, staff_id, is_unmapped, dta_rate_used, local_running_rate_used, transport_amount, airport_taxi_amount, grade_band_code, designation_name'
    )
    .eq('request_id', request_id)

  if (travelersError || !travelers || travelers.length === 0) {
    return { success: false, error: 'Could not load travellers for this request' }
  }

  const travelersById = new Map((travelers as StoredTraveler[]).map((t) => [t.id, t]))
  const overrideByTravelerId = new Map(traveler_overrides.map((o) => [o.request_traveler_id, o]))
  const stillUnmappedStaffIds = (travelers as StoredTraveler[]).filter((t) => t.is_unmapped).map((t) => t.staff_id)
  const freshBands = await resolveFreshBands(supabase, stillUnmappedStaffIds)

  const priced = (travelers as StoredTraveler[]).map((t) => {
    const override = overrideByTravelerId.get(t.id)
    const transportOverride = override && override.transport_value !== t.transport_amount ? override.transport_value : null
    const airportTaxiOverride =
      override && override.airport_taxi_value !== t.airport_taxi_amount ? override.airport_taxi_value : null

    let gradeBand: GradeBand | null = null
    let designationName = t.designation_name
    let gradeBandCode = t.grade_band_code

    if (!t.is_unmapped) {
      gradeBand = frozenGradeBand(t)
    } else {
      const fresh = freshBands.get(t.staff_id)
      if (fresh?.gradeBand) {
        gradeBand = fresh.gradeBand
        designationName = fresh.designationName
        gradeBandCode = fresh.gradeBand.code
      }
    }

    const result = priceTraveller({
      gradeBand,
      days,
      coveragePercent: policySnapshot.coverage_percent,
      mode: request.mode as TravelMode,
      tripType: request.trip_type as TripType,
      defaults,
      transportOverride,
      airportTaxiOverride,
    })

    return { travelerRowId: t.id, designationName, gradeBandCode, transportOverride, airportTaxiOverride, result }
  })

  const stillUnmapped = priced.filter((p) => p.result.isUnmapped)
  if (stillUnmapped.length > 0) {
    return {
      success: false,
      error: `${stillUnmapped.length} traveller${stillUnmapped.length === 1 ? '' : 's'} still ${stillUnmapped.length === 1 ? 'has' : 'have'} no designation mapped to a rate band. Ask Admin to map ${stillUnmapped.length === 1 ? 'it' : 'them'} in Staff Management before this request can be forwarded.`,
    }
  }

  const totalNgn = priced.reduce((sum, p) => sum + (p.result.travellerTotal ?? 0), 0)

  const { data: updated, error: updateError } = await supabase
    .from('travel_requests')
    .update({ days, total_ngn: totalNgn, status: 'pending_md' })
    .eq('id', request_id)
    .eq('status', 'pending_hr')
    .select('id')
    .maybeSingle()

  if (updateError) return { success: false, error: updateError.message }
  if (!updated) return { success: false, error: 'This request is no longer awaiting HR review' }

  const { error: travelerUpdateError } = await supabase.from('request_travelers').upsert(
    priced.map((p) => ({
      id: p.travelerRowId,
      designation_name: p.designationName,
      grade_band_code: p.gradeBandCode,
      is_unmapped: false,
      dta_rate_used: p.result.dtaRateUsed,
      local_running_rate_used: p.result.localRunningRateUsed,
      dta_amount: p.result.dtaAmount,
      local_running_amount: p.result.localRunningAmount,
      // The immutable policy default from submission — never rewritten, only ever read against to detect an override (see the `transportOverride`/`airportTaxiOverride` derivation above).
      transport_amount: travelersById.get(p.travelerRowId)!.transport_amount,
      airport_taxi_amount: travelersById.get(p.travelerRowId)!.airport_taxi_amount,
      transport_override: p.transportOverride,
      airport_taxi_override: p.airportTaxiOverride,
      traveller_total: p.result.travellerTotal,
    }))
  )

  if (travelerUpdateError) {
    return { success: false, error: `Status updated but traveller pricing failed to save: ${travelerUpdateError.message}` }
  }

  const { error: approvalError } = await supabase.from('approvals').insert({
    request_id,
    approver_id: user.id,
    status: 'hr_approved',
    reason: hr_note ?? null,
    is_final: false,
  })

  if (approvalError) {
    return { success: false, error: `Allowances saved but the audit log entry failed: ${approvalError.message}` }
  }

  // FR-18: every deviation from the policy default is logged.
  const overrideRows: { request_id: string; field_name: string; overridden_value: number; hr_staff_id: string }[] = []
  if (days !== request.days) {
    overrideRows.push({ request_id, field_name: 'days', overridden_value: days, hr_staff_id: user.id })
  }
  for (const p of priced) {
    if (p.transportOverride !== null) {
      overrideRows.push({ request_id, field_name: `transport:${p.travelerRowId}`, overridden_value: p.transportOverride, hr_staff_id: user.id })
    }
    if (p.airportTaxiOverride !== null) {
      overrideRows.push({ request_id, field_name: `airport_taxi:${p.travelerRowId}`, overridden_value: p.airportTaxiOverride, hr_staff_id: user.id })
    }
  }
  if (overrideRows.length > 0) {
    await supabase.from('rate_overrides').insert(overrideRows)
  }

  revalidatePath('/hr')
  revalidatePath('/hr/requests')
  revalidatePath('/hr/history')
  return { success: true }
}
