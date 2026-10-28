'use server'

/**
 * HR's Phase 0 review action (notes.md v1.1, FR-16/FR-17/FR-18) — a
 * separate module from requests.actions.ts's `hrReviewRequest`, which still
 * backs the legacy 5-allowance-field/FX review path for pre-Phase-0 rows.
 * `hrRejectRequest` needs no v2 equivalent: it only ever touches status and
 * a reason, which is identical for both request shapes.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/utils/auth-guard'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { hrReviewV2Schema, type HRReviewV2Input } from '@/lib/validations/hr-review-v2.schema'
import { priceTraveller, type PolicyDefaults } from '@/lib/utils/policy-calculator'
import {
  COSTING_MEMO_TEMPLATE_VERSION,
  ERP_MEMO_ADDRESSED_TO,
  ERP_MEMO_PRIORITY,
  ERP_MEMO_TYPE,
  buildCostingMemoSubject,
  renderCostingMemoBody,
} from '@/lib/erp/costing-memo'
import type {
  ErpExportPayload,
  ErpExportTraveler,
  ErpMemoLine,
  GradeBand,
  GradeBandCode,
  PolicySnapshot,
} from '@/types/database'

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

const staffIdentitySchema = z.object({
  id: z.string().uuid(),
  first_name: z.string().nullable(),
  surname: z.string().nullable(),
  erp_employee_number: z.string().trim().min(1).nullable(),
})

const storedTravelerSchema = z.object({
  id: z.string().uuid(),
  staff_id: z.string().uuid(),
  is_unmapped: z.boolean(),
  dta_rate_used: z.number().finite().nullable(),
  local_running_rate_used: z.number().finite().nullable(),
  transport_amount: z.number().finite(),
  airport_taxi_amount: z.number().finite(),
  grade_band_code: z.enum(['B1', 'B2', 'B3', 'B4']).nullable(),
  designation_name: z.string().min(1),
})

const policySnapshotSchema = z.object({
  transport_air_each_way: z.number().finite().nonnegative(),
  transport_road_each_way: z.number().finite().nonnegative(),
  airport_taxi_per_leg: z.number().finite().nonnegative(),
  full_coverage_cities: z.array(z.string().min(1)),
  coverage_percent: z.union([z.literal(100), z.literal(75)]),
})

const authorRowSchema = staffIdentitySchema
  .omit({ id: true, erp_employee_number: true })
  .extend({
    email: z.string().email(),
    designation: z.union([
      z.object({ name: z.string().trim().min(1) }),
      z.array(z.object({ name: z.string().trim().min(1) })),
      z.null(),
    ]),
    level: z.union([
      z.object({ name: z.string().trim().min(1) }),
      z.array(z.object({ name: z.string().trim().min(1) })),
      z.null(),
    ]),
  })

/**
 * A GradeBand shaped from a frozen per-traveller rate rather than the live
 * grade_bands table (FR-14) — `coveragePercent` is fixed for the whole
 * request, so `priceTraveller` only ever reads the matching one of these
 * two identical values. Reusing the one shared calculator here, instead of
 * re-deriving dta/local inline, is what keeps FR-11 true on the HR side too.
 */
function frozenGradeBand(t: Pick<StoredTraveler, 'grade_band_code' | 'dta_rate_used' | 'local_running_rate_used'>): GradeBand | null {
  if (t.grade_band_code === null || t.dta_rate_used === null || t.local_running_rate_used === null) return null

  return {
    id: '',
    code: t.grade_band_code,
    label: '',
    dta_per_day_100: t.dta_rate_used,
    dta_per_day_75: t.dta_rate_used,
    local_running_per_day_100: t.local_running_rate_used,
    local_running_per_day_75: t.local_running_rate_used,
  }
}

/** Re-checks whether Admin has since assigned a designation to a traveller who was unmapped at submission (FR-13). */
async function resolveFreshBands(
  supabase: Awaited<ReturnType<typeof createClient>>,
  staffIds: string[]
): Promise<Map<string, { designationName: string; gradeBand: GradeBand | null }> | null> {
  const result = new Map<string, { designationName: string; gradeBand: GradeBand | null }>()
  if (staffIds.length === 0) return result

  const { data, error } = await supabase
    .from('staff')
    .select('id, designation:designations(name, grade_band:grade_bands(*))')
    .in('id', staffIds)

  if (error || !data) return null

  for (const row of data) {
    const designation = Array.isArray(row.designation) ? row.designation[0] : row.designation
    let gradeBand: GradeBand | null = null
    if (designation) {
      const resolvedGradeBand = Array.isArray(designation.grade_band) ? designation.grade_band[0] : designation.grade_band
      if (resolvedGradeBand) gradeBand = resolvedGradeBand as GradeBand
    }
    result.set(row.id, { designationName: designation ? designation.name : 'Unmapped', gradeBand })
  }
  return result
}

/**
 * HR sets days trip-wide and, per traveller, transport/airport taxi
 * (FR-16/FR-17) — DTA and local running are never entered directly, only
 * recomputed from the frozen per-day rate × the (possibly revised) day
 * count. Finalization is standalone-safe: a Business Central employee number
 * is required only when a later API delivery enrollment is performed.
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
    .select('id, status, memo_number, mode, trip_type, days, policy_snapshot, origin, destination, depart_date, return_date, reason_for_travel, approval_source, erp_export_id')
    .eq('id', request_id)
    .single()

  if (fetchError || !request) return { success: false, error: 'Request not found' }
  if (!request.memo_number) return { success: false, error: 'This request predates the Phase 0 review flow' }
  if (request.status !== 'pending_hr') {
    if (request.status === 'pending_md' && request.approval_source === 'erp' && request.erp_export_id) {
      return { success: true }
    }
    return { success: false, error: 'This request is no longer awaiting HR review' }
  }
  if (request.mode !== 'air' && request.mode !== 'road') return { success: false, error: 'This request has no valid travel mode' }
  if (request.trip_type !== 'one_way' && request.trip_type !== 'return') return { success: false, error: 'This request has no valid trip type' }
  if (!request.origin || !request.destination || !request.depart_date || !request.return_date || !request.reason_for_travel) {
    return { success: false, error: 'This request is missing travel details required for the ERP memo' }
  }

  const parsedPolicySnapshot = policySnapshotSchema.safeParse(request.policy_snapshot)
  if (!parsedPolicySnapshot.success) {
    return { success: false, error: 'This request is missing its policy snapshot and cannot be recomputed' }
  }
  const policySnapshot: PolicySnapshot = parsedPolicySnapshot.data

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

  const parsedTravelers = z.array(storedTravelerSchema).safeParse(travelers)
  if (!parsedTravelers.success) {
    return { success: false, error: 'The request contains invalid traveller pricing data' }
  }

  const storedTravelers: StoredTraveler[] = parsedTravelers.data
  const travelerStaffIds = Array.from(new Set(storedTravelers.map((traveler) => traveler.staff_id)))
  const { data: identityRows, error: identityError } = await supabase
    .from('staff')
    .select('id, first_name, surname, erp_employee_number')
    .in('id', travelerStaffIds)

  if (identityError || !identityRows) {
    return { success: false, error: 'Could not load ERP employee identities for this request' }
  }

  const parsedIdentities = z.array(staffIdentitySchema).safeParse(identityRows)
  if (!parsedIdentities.success || parsedIdentities.data.length !== travelerStaffIds.length) {
    return { success: false, error: 'One or more travellers are missing a valid ERP employee identity' }
  }

  const identityByStaffId = new Map(parsedIdentities.data.map((identity) => [identity.id, identity]))

  const overrideByTravelerId = new Map(traveler_overrides.map((o) => [o.request_traveler_id, o]))
  const stillUnmappedStaffIds = storedTravelers.filter((t) => t.is_unmapped).map((t) => t.staff_id)
  const freshBands = await resolveFreshBands(supabase, stillUnmappedStaffIds)
  if (freshBands === null) return { success: false, error: 'Could not refresh designation mappings for this request' }

  const priced = storedTravelers.map((t) => {
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
      if (fresh && fresh.gradeBand) {
        gradeBand = fresh.gradeBand
        designationName = fresh.designationName
        gradeBandCode = fresh.gradeBand.code
      }
    }

    const result = priceTraveller({
      gradeBand,
      days,
      coveragePercent: policySnapshot.coverage_percent,
      mode: request.mode,
      tripType: request.trip_type,
      defaults,
      transportOverride,
      airportTaxiOverride,
    })

    return { travelerRowId: t.id, staffId: t.staff_id, designationName, gradeBandCode, transportOverride, airportTaxiOverride, result }
  })

  const stillUnmapped = priced.filter((p) => p.result.isUnmapped)
  if (stillUnmapped.length > 0) {
    return {
      success: false,
      error: `${stillUnmapped.length} traveller${stillUnmapped.length === 1 ? '' : 's'} still ${stillUnmapped.length === 1 ? 'has' : 'have'} no designation mapped to a rate band. Ask Admin to map ${stillUnmapped.length === 1 ? 'it' : 'them'} in Staff Management before this costing can be finalized.`,
    }
  }

  // FR-18: every deviation from the policy default is logged.
  const overrideRows: { field_name: string; overridden_value: number; reason: string | null }[] = []
  if (days !== request.days) {
    overrideRows.push({ field_name: 'days', overridden_value: days, reason: hr_note ?? null })
  }
  for (const p of priced) {
    if (p.transportOverride !== null) {
      overrideRows.push({ field_name: `transport:${p.travelerRowId}`, overridden_value: p.transportOverride, reason: hr_note ?? null })
    }
    if (p.airportTaxiOverride !== null) {
      overrideRows.push({ field_name: `airport_taxi:${p.travelerRowId}`, overridden_value: p.airportTaxiOverride, reason: hr_note ?? null })
    }
  }

  let totalNgn = 0
  const travelerUpdates: {
    id: string
    designation_name: string
    grade_band_code: GradeBandCode
    dta_rate_used: number
    local_running_rate_used: number
    dta_amount: number
    local_running_amount: number
    transport_override: number | null
    airport_taxi_override: number | null
    traveller_total: number
  }[] = []
  const travelerExports: ErpExportTraveler[] = []

  for (const pricedTraveler of priced) {
    const identity = identityByStaffId.get(pricedTraveler.staffId)
    if (!identity) return { success: false, error: 'Every traveller must have a staff identity before HR can finalize this costing' }

    const nameParts = [identity.first_name, identity.surname].filter(
      (value): value is string => value !== null && value.trim().length > 0,
    )
    if (nameParts.length === 0) {
      return { success: false, error: 'Every traveller must have a name before HR can submit this memo' }
    }

    const { result } = pricedTraveler
    if (
      pricedTraveler.gradeBandCode === null ||
      result.dtaRateUsed === null ||
      result.localRunningRateUsed === null ||
      result.dtaAmount === null ||
      result.localRunningAmount === null ||
      result.travellerTotal === null
    ) {
      return { success: false, error: 'A traveller could not be priced completely; no changes were committed.' }
    }

    totalNgn += result.travellerTotal
    travelerUpdates.push({
      id: pricedTraveler.travelerRowId,
      designation_name: pricedTraveler.designationName,
      grade_band_code: pricedTraveler.gradeBandCode,
      dta_rate_used: result.dtaRateUsed,
      local_running_rate_used: result.localRunningRateUsed,
      dta_amount: result.dtaAmount,
      local_running_amount: result.localRunningAmount,
      transport_override: pricedTraveler.transportOverride,
      airport_taxi_override: pricedTraveler.airportTaxiOverride,
      traveller_total: result.travellerTotal,
    })
    travelerExports.push({
      employee_identifier: identity.erp_employee_number,
      name: nameParts.join(' '),
      designation: pricedTraveler.designationName,
      grade_band: pricedTraveler.gradeBandCode,
      dta_rate: result.dtaRateUsed.toFixed(2),
      dta_amount: result.dtaAmount.toFixed(2),
      local_running_rate: result.localRunningRateUsed.toFixed(2),
      local_running_amount: result.localRunningAmount.toFixed(2),
      transport_amount: result.transportAmount.toFixed(2),
      airport_taxi_amount: result.airportTaxiAmount.toFixed(2),
      total_amount: result.travellerTotal.toFixed(2),
    })
  }

  const { data: authorRow, error: authorError } = await supabase
    .from('staff')
    .select('first_name, surname, email, designation:designations(name), level:levels(name)')
    .eq('id', user.id)
    .single()

  if (authorError || !authorRow) {
    return { success: false, error: 'Could not load the HR author identity for this memo' }
  }

  const parsedAuthor = authorRowSchema.safeParse(authorRow)
  if (!parsedAuthor.success) {
    return { success: false, error: 'The HR author must have a valid office email and organizational position' }
  }

  const authorDesignation = Array.isArray(parsedAuthor.data.designation)
    ? parsedAuthor.data.designation[0]
    : parsedAuthor.data.designation
  const authorLevel = Array.isArray(parsedAuthor.data.level)
    ? parsedAuthor.data.level[0]
    : parsedAuthor.data.level
  // The logged-in HR reviewer is the memo author. Prefer the current DTA
  // designation; legacy HR accounts may only have an organizational level
  // until Admin completes their DTA mapping.
  const authorTitle = authorDesignation?.name ?? authorLevel?.name

  if (!authorTitle) {
    return { success: false, error: 'The HR author must have an organizational position before submitting this memo' }
  }

  const authorNameParts = [parsedAuthor.data.first_name, parsedAuthor.data.surname].filter(
    (value): value is string => value !== null && value.trim().length > 0,
  )
  if (authorNameParts.length === 0) {
    return { success: false, error: 'The HR author must have a name before submitting this memo' }
  }

  const authorName = authorNameParts.join(' ')
  const authorizedAt = new Date().toISOString()
  const totalAmount = totalNgn.toFixed(2)
  const costingMemoLines: ErpMemoLine[] = []
  let lineNumber = 10000
  for (const traveler of travelerExports) {
    const legsDescription = request.trip_type === 'return' ? 'two legs' : 'one leg'
    const transportDescription = request.mode === 'air' ? 'Air ticket' : 'Road transport'
    const dtaRate = Number(traveler.dta_rate)
    const localRunningRate = Number(traveler.local_running_rate)
    const localRunningLabel = dtaRate > 0
      ? `Local running of ${Math.round((localRunningRate / dtaRate) * 100)}% of DTA`
      : 'Local running'

    costingMemoLines.push(
      {
        line_number: lineNumber,
        description: `${transportDescription} for ${traveler.name} (${legsDescription})`,
        quantity: '1.00',
        unit_price: traveler.transport_amount,
        amount: traveler.transport_amount,
      },
      {
        line_number: lineNumber + 10000,
        description: `DTA of ${policySnapshot.coverage_percent}% for ${traveler.name}`,
        quantity: days.toFixed(2),
        unit_price: traveler.dta_rate,
        amount: traveler.dta_amount,
      },
      {
        line_number: lineNumber + 20000,
        description: `${localRunningLabel} for ${traveler.name}`,
        quantity: days.toFixed(2),
        unit_price: traveler.local_running_rate,
        amount: traveler.local_running_amount,
      },
      {
        line_number: lineNumber + 30000,
        description: `Airport taxi for ${traveler.name} (${legsDescription})`,
        quantity: '1.00',
        unit_price: traveler.airport_taxi_amount,
        amount: traveler.airport_taxi_amount,
      },
    )
    lineNumber += 40000
  }
  const costingMemoSubject = buildCostingMemoSubject(request.destination, request.reason_for_travel)
  const costingMemoBody = renderCostingMemoBody({
    sourceMemoNumber: request.memo_number,
    authorName,
    authorTitle,
    tripOrigin: request.origin,
    tripDestination: request.destination,
    departureDate: request.depart_date,
    returnDate: request.return_date,
    authorizedAt,
    days,
    tripType: request.trip_type,
    mode: request.mode,
    reasonForTravel: request.reason_for_travel,
    coveragePercent: policySnapshot.coverage_percent,
    department: null,
    addressedTo: ERP_MEMO_ADDRESSED_TO,
    dueDate: null,
    approvedBy: null,
    lines: costingMemoLines,
    totalAmount,
    hrNote: hr_note ?? null,
  })

  const exportPayload: ErpExportPayload = {
    schema_version: '1.0',
    export_id: randomUUID(),
    delivery_mode: 'manual',
    source_memo_number: request.memo_number,
    costing_memo_revision: 1,
    costing_memo_subject: costingMemoSubject,
    costing_memo_body: costingMemoBody,
    costing_memo_body_format: 'plain_text',
    costing_memo_template_version: COSTING_MEMO_TEMPLATE_VERSION,
    memo_type: ERP_MEMO_TYPE,
    memo_priority: ERP_MEMO_PRIORITY,
    memo_department: null,
    memo_addressed_to: ERP_MEMO_ADDRESSED_TO,
    memo_due_date: null,
    memo_approved_by: null,
    coverage_percent: policySnapshot.coverage_percent,
    costing_memo_lines: costingMemoLines,
    hr_author_name: authorName,
    hr_author_title: authorTitle,
    hr_author_email: parsedAuthor.data.email,
    hr_authorized_at: authorizedAt,
    hr_note: hr_note ?? null,
    trip_origin: request.origin,
    trip_destination: request.destination,
    departure_date: request.depart_date,
    return_date: request.return_date,
    days,
    trip_type: request.trip_type,
    mode: request.mode,
    reason_for_travel: request.reason_for_travel,
    travelers: travelerExports,
    total_amount: totalAmount,
    currency: 'NGN',
  }
  const admin = createAdminClient()
  const { error: finalizeError } = await admin.rpc('finalize_hr_costing_standalone_v1', {
    p_request_id: request_id,
    p_hr_staff_id: user.id,
    p_days: days,
    p_total_ngn: totalNgn,
    p_traveler_updates: travelerUpdates,
    p_override_rows: overrideRows,
    p_hr_note: hr_note ?? null,
    p_hr_author_snapshot: {
      staff_id: user.id,
      office_email: parsedAuthor.data.email,
      name: authorName,
      organizational_title: authorTitle,
      authorized_at: authorizedAt,
    },
    p_costing_memo_body: costingMemoBody,
    p_template_version: COSTING_MEMO_TEMPLATE_VERSION,
    p_export_payload: exportPayload,
  })

  if (finalizeError) {
    console.error('HR costing finalization RPC failed', {
      code: finalizeError.code,
      message: finalizeError.message,
      details: finalizeError.details,
      hint: finalizeError.hint,
    })
    if (finalizeError.code === '40001') return { success: false, error: 'This request is no longer awaiting HR review' }
    if (finalizeError.code === '42501') return { success: false, error: 'You are not authorized to finalize this costing' }
    if (finalizeError.code === 'PGRST202' || finalizeError.code === '42883') {
      const configuredDatabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'unknown Supabase project'
      return {
        success: false,
        error: `The configured database (${configuredDatabase}) does not expose the standalone HR finalization function. Confirm the migration was applied to this Supabase project, reload the PostgREST schema, and redeploy the app before retrying.`,
      }
    }
    return { success: false, error: 'The HR review could not be saved. No changes were committed.' }
  }

  revalidatePath('/hr')
  revalidatePath('/hr/requests')
  revalidatePath('/hr/history')
  return { success: true }
}
