'use server'

/**
 * Travel Request Server Actions.
 * PRD Section 3.1 — Staff: Submit requests
 * PRD Section 3.2 — HR: Review and set allowances
 * PRD Section 5.3 — Resubmission & Immutability
 *
 * MD approval moved to the ERP (REVISED_SCOPE.md decision 5) — there is no
 * MD action in this file anymore. See md-dashboard.tsx for the read-only view.
 */

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/utils/auth-guard'
import {
  createRequestSchema,
  hrReviewSchema,
  hrRejectSchema,
  type CreateRequestInput,
  type HRReviewInput,
  type HRRejectInput,
} from '@/lib/validations/request.schema'
import { POLICY_DEFAULT_KEYS } from '@/lib/validations/grade-bands.schema'
import { calculateTravellerCost, daysBetweenInclusive, resolveCoveragePercent } from '@/lib/policy/calculate'
import type { PolicyDefaults } from '@/lib/policy/calculate'
import { datesOverlap } from '@/lib/utils/formatting'
import { revalidatePath } from 'next/cache'
import type {
  ApprovalTrailEntry,
  TravelMode,
  TravelRequest,
  TravelRequestForHR,
  TravelRequestForMD,
} from '@/types/database'
import type { ActionResult } from '@/types/actions'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// ============================================================
// Policy context — coverage tiers, band rates, policy defaults
// ============================================================

interface PolicyContext {
  policyDefaults: PolicyDefaults
  fullCoverageCities: string[]
  fullPercent: number
  partialPercent: number
}

async function loadPolicyContext(supabase: SupabaseClient): Promise<PolicyContext> {
  const [{ data: settings }, { data: tiers }, { data: coverage }] = await Promise.all([
    supabase.from('app_settings').select('key, value').in('key', POLICY_DEFAULT_KEYS),
    supabase.from('coverage_tiers').select('code, percent'),
    supabase.from('destination_coverage').select('city'),
  ])

  const settingsByKey = new Map((settings ?? []).map((row) => [row.key, Number(row.value)]))
  const tierByCode = new Map((tiers ?? []).map((row) => [row.code, Number(row.percent)]))

  return {
    policyDefaults: {
      airFarePerLeg: settingsByKey.get('policy_air_fare_per_leg') ?? 150_000,
      roadFarePerLeg: settingsByKey.get('policy_road_fare_per_leg') ?? 50_000,
      taxiPerLeg: settingsByKey.get('policy_taxi_per_leg') ?? 40_000,
    },
    fullCoverageCities: (coverage ?? []).map((row) => row.city),
    fullPercent: tierByCode.get('full') ?? 100,
    partialPercent: tierByCode.get('partial') ?? 75,
  }
}

interface TravellerBand {
  staffId: string
  name: string
  bandCode: string
  dtaPerDay: number
  localRunningPerDay: number
}

/**
 * Loads each traveller's current grade band. A staff member with no level
 * assigned yet produces no entry — callers must treat that as a hard
 * refusal (never a silent default), per REVISED_SCOPE.md §3: an unmapped
 * grade must block pricing, not guess.
 */
async function loadTravellerBands(
  supabase: SupabaseClient,
  staffIds: string[]
): Promise<Map<string, TravellerBand>> {
  const { data } = await supabase
    .from('staff')
    .select('id, first_name, surname, email, level:levels(band:grade_bands(code, dta_per_day, local_running_per_day))')
    .in('id', staffIds)

  const result = new Map<string, TravellerBand>()
  for (const row of data ?? []) {
    const level = Array.isArray(row.level) ? row.level[0] : row.level
    const band = level?.band ? (Array.isArray(level.band) ? level.band[0] : level.band) : null
    if (!band) continue
    result.set(row.id, {
      staffId: row.id,
      name: [row.first_name, row.surname].filter(Boolean).join(' ') || row.email,
      bandCode: band.code,
      dtaPerDay: Number(band.dta_per_day),
      localRunningPerDay: Number(band.local_running_per_day),
    })
  }
  return result
}

// ============================================================
// Trip endpoint resolution
// ============================================================

/**
 * Turns one end of a trip into a (canonical text, airport FK) pair.
 *
 * The airport id is re-read server-side rather than trusted alongside the
 * client's text, so a tampered or stale form can't file a request whose
 * `destination` says one city and whose `destination_airport_id` points at
 * another — the text always comes from the row the FK names.
 *
 * Falls back to an exact case-insensitive match on the typed text, which is
 * what lets a request submitted through the "Other — not listed" escape
 * hatch still pick up a route key when the city does happen to be seeded.
 * A miss is not an error: the FK stays null and downstream degrades.
 */
async function resolveEndpoint(
  supabase: SupabaseClient,
  airportId: string | null | undefined,
  text: string
): Promise<{ text: string; airportId: string | null }> {
  if (airportId) {
    const { data } = await supabase
      .from('airports')
      .select('id, city')
      .eq('id', airportId)
      .maybeSingle()
    if (data) return { text: data.city, airportId: data.id }
  }

  const trimmed = text.trim()
  if (trimmed) {
    // No wildcards — ilike here is an exact match that ignores case.
    const { data } = await supabase
      .from('airports')
      .select('id, city')
      .ilike('city', trimmed)
      .limit(1)
      .maybeSingle()
    if (data) return { text: data.city, airportId: data.id }
  }

  return { text: trimmed, airportId: null }
}

// ============================================================
// Pricing — shared by submit, resubmit, and HR review
// ============================================================

interface PricedTraveller {
  staff_id: string
  grade_band_code: string
  dta: number
  local_running: number
  transport_cost: number
  airport_taxi: number
  traveller_total: number
}

interface PriceRequestParams {
  destination: string
  mode: TravelMode
  oneWay: boolean
  days: number
  travellerStaffIds: string[]
  policy: PolicyContext
  bands: Map<string, TravellerBand>
  /** HR overrides, keyed by staff_id — when omitted, the policy default is used. */
  overrides?: Map<string, { transport_cost: number; airport_taxi: number }>
}

interface PriceRequestResult {
  coveragePercent: number
  travellers: PricedTraveller[]
  requestTotal: number
  snapshot: Record<string, unknown>
}

/** Missing bands, keyed by staff_id, when a traveller has no grade assigned. */
class UnpricedTravellerError extends Error {
  constructor(public readonly names: string[]) {
    super(`No grade assigned for: ${names.join(', ')}. Contact Admin before this request can be priced.`)
  }
}

function priceRequest(params: PriceRequestParams): PriceRequestResult {
  const { destination, mode, oneWay, days, travellerStaffIds, policy, bands, overrides } = params

  const missing = travellerStaffIds.filter((id) => !bands.has(id))
  if (missing.length > 0) {
    throw new UnpricedTravellerError(missing.map((id) => bands.get(id)?.name ?? id))
  }

  const coveragePercent = resolveCoveragePercent(
    destination,
    policy.fullCoverageCities,
    policy.fullPercent,
    policy.partialPercent
  )

  const travellers: PricedTraveller[] = travellerStaffIds.map((staffId) => {
    const band = bands.get(staffId)!
    const override = overrides?.get(staffId)
    const result = calculateTravellerCost({
      dtaPerDay: band.dtaPerDay,
      localRunningPerDay: band.localRunningPerDay,
      coveragePercent,
      days,
      mode,
      oneWay,
      policyDefaults: policy.policyDefaults,
      transportOverride: override?.transport_cost,
      airportTaxiOverride: override?.airport_taxi,
    })
    return {
      staff_id: staffId,
      grade_band_code: band.bandCode,
      dta: result.dta,
      local_running: result.localRunning,
      transport_cost: result.transport,
      airport_taxi: result.airportTaxi,
      traveller_total: result.total,
    }
  })

  return {
    coveragePercent,
    travellers,
    requestTotal: travellers.reduce((sum, t) => sum + t.traveller_total, 0),
    snapshot: {
      computed_at: new Date().toISOString(),
      coverage_percent: coveragePercent,
      policy_defaults: policy.policyDefaults,
      bands: Object.fromEntries(
        [...new Set(travellers.map((t) => t.grade_band_code))].map((code) => {
          const band = [...bands.values()].find((b) => b.bandCode === code)!
          return [code, { dta_per_day: band.dtaPerDay, local_running_per_day: band.localRunningPerDay }]
        })
      ),
    },
  }
}

// ============================================================
// Staff Actions (PRD Section 3.1)
// ============================================================

async function insertRequestWithTravellers(
  supabase: SupabaseClient,
  input: {
    travel_group_id: string
    previous_version_id: string | null
    staff_id: string
    memo_number: string
    destination: string
    origin: string
    destination_airport_id: string | null
    origin_airport_id: string | null
    mode: TravelMode
    one_way: boolean
    days_requested: number
    reason_for_travel: string
    depart_date: string
    return_date: string
  },
  priced: PriceRequestResult
): Promise<ActionResult> {
  const { data: request, error } = await supabase
    .from('travel_requests')
    .insert({
      ...input,
      status: 'pending_hr',
      days_approved: null,
      policy_snapshot: priced.snapshot,
      coverage_percent_applied: priced.coveragePercent,
      request_total: priced.requestTotal,
    })
    .select('id')
    .single()

  if (error || !request) {
    return {
      success: false,
      error: error?.code === '23505' ? 'This memo number already has a live request' : (error?.message ?? 'Could not save the request'),
    }
  }

  const { error: travellersError } = await supabase
    .from('request_travellers')
    .insert(priced.travellers.map((t) => ({ ...t, request_id: request.id })))

  if (travellersError) {
    // Best-effort cleanup — the header shouldn't exist without its travellers.
    await supabase.from('travel_requests').delete().eq('id', request.id)
    return { success: false, error: travellersError.message }
  }

  return { success: true }
}

/**
 * Submit a new travel request. Prices every traveller against the current
 * grade bands and coverage tier, server-side — the client's preview is
 * never trusted (§4.3).
 */
export async function submitRequest(input: CreateRequestInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated' }

  const parsed = createRequestSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.message }
  }

  // The requester rides along as a traveller even if they left themselves
  // off the picker.
  const travellerStaffIds = [...new Set([user.id, ...parsed.data.traveller_staff_ids])]

  const [endpoints, bands, policy] = await Promise.all([
    (async () => {
      const [destination, origin] = await Promise.all([
        resolveEndpoint(supabase, parsed.data.destination_airport_id, parsed.data.destination),
        resolveEndpoint(supabase, parsed.data.origin_airport_id, parsed.data.origin),
      ])
      return { destination, origin }
    })(),
    loadTravellerBands(supabase, travellerStaffIds),
    loadPolicyContext(supabase),
  ])

  const daysRequested = daysBetweenInclusive(parsed.data.depart_date, parsed.data.return_date)

  let priced: PriceRequestResult
  try {
    priced = priceRequest({
      destination: endpoints.destination.text,
      mode: parsed.data.mode,
      oneWay: parsed.data.one_way,
      days: daysRequested,
      travellerStaffIds,
      policy,
      bands,
    })
  } catch (err) {
    if (err instanceof UnpricedTravellerError) return { success: false, error: err.message }
    throw err
  }

  const result = await insertRequestWithTravellers(
    supabase,
    {
      travel_group_id: crypto.randomUUID(),
      previous_version_id: null,
      staff_id: user.id,
      memo_number: parsed.data.memo_number.trim(),
      destination: endpoints.destination.text,
      origin: endpoints.origin.text,
      destination_airport_id: endpoints.destination.airportId,
      origin_airport_id: endpoints.origin.airportId,
      mode: parsed.data.mode,
      one_way: parsed.data.one_way,
      days_requested: daysRequested,
      reason_for_travel: parsed.data.reason_for_travel,
      depart_date: parsed.data.depart_date,
      return_date: parsed.data.return_date,
    },
    priced
  )

  if (!result.success) return result

  revalidatePath('/staff')
  return { success: true }
}

/**
 * Resubmit a request HR returned for revision.
 * PRD Section 5.3: Creates a NEW row, copies travel_group_id,
 * sets previous_version_id to the returned request's id.
 */
export async function resubmitRequest(
  originalRequestId: string,
  input: CreateRequestInput
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated' }

  const parsed = createRequestSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.message }
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

  if (original.status !== 'hr_returned') {
    return {
      success: false,
      error: 'Only requests returned for revision can be resubmitted',
    }
  }

  const travellerStaffIds = [...new Set([user.id, ...parsed.data.traveller_staff_ids])]

  const [endpoints, bands, policy] = await Promise.all([
    (async () => {
      const [destination, origin] = await Promise.all([
        resolveEndpoint(supabase, parsed.data.destination_airport_id, parsed.data.destination),
        resolveEndpoint(supabase, parsed.data.origin_airport_id, parsed.data.origin),
      ])
      return { destination, origin }
    })(),
    loadTravellerBands(supabase, travellerStaffIds),
    loadPolicyContext(supabase),
  ])

  const daysRequested = daysBetweenInclusive(parsed.data.depart_date, parsed.data.return_date)

  let priced: PriceRequestResult
  try {
    priced = priceRequest({
      destination: endpoints.destination.text,
      mode: parsed.data.mode,
      oneWay: parsed.data.one_way,
      days: daysRequested,
      travellerStaffIds,
      policy,
      bands,
    })
  } catch (err) {
    if (err instanceof UnpricedTravellerError) return { success: false, error: err.message }
    throw err
  }

  const result = await insertRequestWithTravellers(
    supabase,
    {
      travel_group_id: original.travel_group_id,
      previous_version_id: original.id,
      staff_id: user.id,
      memo_number: parsed.data.memo_number.trim(),
      destination: endpoints.destination.text,
      origin: endpoints.origin.text,
      destination_airport_id: endpoints.destination.airportId,
      origin_airport_id: endpoints.origin.airportId,
      mode: parsed.data.mode,
      one_way: parsed.data.one_way,
      days_requested: daysRequested,
      reason_for_travel: parsed.data.reason_for_travel,
      depart_date: parsed.data.depart_date,
      return_date: parsed.data.return_date,
    },
    priced
  )

  if (!result.success) return result

  revalidatePath('/staff')
  return { success: true }
}

/**
 * Fetch the current user's travel requests, including each request's
 * approval history (used to surface the HR rejection reason so staff know
 * what to fix before resubmitting).
 * PRD Section 3.1: Pending Requests list + Travel History.
 */
export async function getMyRequests(): Promise<
  ActionResult<(TravelRequest & { approvals: ApprovalTrailEntry[] | null; travellers: { staff_id: string }[] })[]>
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated', data: [] }

  const { data, error } = await supabase
    .from('travel_requests')
    .select('*, approvals(status, reason, is_final, timestamp), travellers:request_travellers(staff_id)')
    .eq('staff_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data }
}

/**
 * Pre-submit non-binding cost estimate for the submitting staff member —
 * priced through the same `calculate.ts` function everything else uses, so
 * it can never disagree with the number that actually gets saved. Only
 * previews the requester's own line; the full multi-traveller total is
 * computed authoritatively at submit.
 */
export async function getRequestEstimate(
  destination: string,
  mode: TravelMode,
  days: number,
  oneWay: boolean
): Promise<ActionResult<{ total: number; coveragePercent: number; bandName: string } | null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated', data: null }
  if (destination.trim().length === 0 || days < 1) return { success: true, data: null }

  const [bands, policy, { data: staffLevel }] = await Promise.all([
    loadTravellerBands(supabase, [user.id]),
    loadPolicyContext(supabase),
    supabase.from('staff').select('level:levels(name)').eq('id', user.id).single(),
  ])

  const band = bands.get(user.id)
  if (!band) return { success: true, data: null }

  const coveragePercent = resolveCoveragePercent(destination, policy.fullCoverageCities, policy.fullPercent, policy.partialPercent)
  const result = calculateTravellerCost({
    dtaPerDay: band.dtaPerDay,
    localRunningPerDay: band.localRunningPerDay,
    coveragePercent,
    days,
    mode,
    oneWay,
    policyDefaults: policy.policyDefaults,
  })

  const level = Array.isArray(staffLevel?.level) ? staffLevel.level[0] : staffLevel?.level

  return {
    success: true,
    data: { total: result.total, coveragePercent, bandName: level?.name ?? '' },
  }
}

// ============================================================
// HR Actions (PRD Section 3.2)
// ============================================================

const TRAVELLER_SELECT = 'travellers:request_travellers(*, staff:staff(first_name, surname, email))'

/**
 * Fields selected for the MD queue and history views: staff identity +
 * department, every traveller's priced line, plus the full approvals trail
 * so the UI can pull HR's forwarding note (the `hr_approved` row's `reason`)
 * and, for history, the final decision reason. Also reused by
 * `getHRHistory()` below — HR is allowed to see the same columns per the
 * `HR read all requests` RLS policy.
 */
const MD_REQUEST_SELECT = `*,
  staff:staff(first_name, surname, email, department:departments(name)),
  ${TRAVELLER_SELECT},
  approvals(status, reason, is_final, timestamp)`

// The two airport embeds are disambiguated by constraint name because both
// FKs point at the same table — PostgREST can't infer which is which
// otherwise (constraints named in 20260822160000_airports.sql).
const HR_REQUEST_SELECT = `*,
  staff:staff(first_name, surname, email, department:departments(name)),
  ${TRAVELLER_SELECT},
  origin_airport:airports!travel_requests_origin_airport_fkey(iata_code, city),
  destination_airport:airports!travel_requests_destination_airport_fkey(iata_code, city)`

const HR_ACTIVE_STATUSES = ['pending_hr', 'queued_for_erp', 'in_erp', 'approved']

/**
 * Get all requests pending HR review, enriched with two things the review
 * screen needs that don't come off a single-table query (PRD Section 3.2):
 * - `overlaps`: other active trips by the same staff member with
 *   conflicting dates (the Date-Overlap Warning, mirrored from
 *   useOverlapWarning but computed server-side across all pending rows).
 * - `previousRejectionReason`: when this row is a resubmission
 *   (`previous_version_id` set), the reason HR sent the prior version
 *   back — so HR has resubmission context without a second click.
 */
export async function getPendingHRRequests(): Promise<ActionResult<TravelRequestForHR[]>> {
  const auth = await requireRole('hr', 'admin')
  if (!auth.authorized) return { success: false, error: auth.error, data: [] }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('travel_requests')
    .select(HR_REQUEST_SELECT)
    .eq('status', 'pending_hr')
    .order('submitted_at', { ascending: true })

  if (error) return { success: false, error: error.message, data: [] as TravelRequestForHR[] }
  if (!data || data.length === 0) return { success: true, data: [] as TravelRequestForHR[] }

  const staffIds = [...new Set(data.map((row) => row.staff_id))]
  const previousIds = [
    ...new Set(data.map((row) => row.previous_version_id).filter((id): id is string => id !== null)),
  ]

  const [{ data: activeRequests }, { data: priorApprovals }] = await Promise.all([
    supabase
      .from('travel_requests')
      .select('id, staff_id, destination, depart_date, return_date')
      .in('staff_id', staffIds)
      .in('status', HR_ACTIVE_STATUSES),
    previousIds.length > 0
      ? supabase
          .from('approvals')
          .select('request_id, reason, timestamp')
          .in('request_id', previousIds)
          .eq('status', 'hr_rejected')
          .order('timestamp', { ascending: false })
      : Promise.resolve({ data: [] as { request_id: string; reason: string | null; timestamp: string }[] }),
  ])

  // First match per request_id wins — the query is already sorted newest-first.
  const latestReasonByPreviousId = new Map<string, string | null>()
  for (const approval of priorApprovals ?? []) {
    if (!latestReasonByPreviousId.has(approval.request_id)) {
      latestReasonByPreviousId.set(approval.request_id, approval.reason)
    }
  }

  const enriched: TravelRequestForHR[] = data.map((row) => ({
    ...row,
    overlaps: (activeRequests ?? []).filter(
      (other) =>
        other.staff_id === row.staff_id &&
        other.id !== row.id &&
        datesOverlap(row.depart_date, row.return_date, other.depart_date, other.return_date)
    ),
    previousRejectionReason: row.previous_version_id
      ? (latestReasonByPreviousId.get(row.previous_version_id) ?? null)
      : null,
  }))

  return { success: true, data: enriched }
}

/**
 * HR's decision history: every request that has moved past `pending_hr`,
 * newest first. PRD Section 3.2's "Recently Processed" list. Reuses the MD
 * queue's row shape (staff + department + travellers + full approvals
 * trail) — HR is allowed to see the same columns per the `HR read all
 * requests` RLS policy.
 */
export async function getHRHistory(): Promise<ActionResult<TravelRequestForMD[]>> {
  const auth = await requireRole('hr', 'admin')
  if (!auth.authorized) return { success: false, error: auth.error, data: [] }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('travel_requests')
    .select(MD_REQUEST_SELECT)
    .neq('status', 'pending_hr')
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data }
}

/**
 * A single request, priced-fields and all — the read behind the printable
 * memo (REVISED_SCOPE.md §7: "Printable memo + copy-ready breakdown is the
 * Phase 0 deliverable and stays permanently as the fallback"). Available
 * once HR has forwarded it; `pending_hr` rows have nothing to print yet.
 */
export async function getRequestById(requestId: string): Promise<ActionResult<TravelRequestForMD | null>> {
  const auth = await requireRole('hr', 'md', 'admin')
  if (!auth.authorized) return { success: false, error: auth.error, data: null }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('travel_requests')
    .select(MD_REQUEST_SELECT)
    .eq('id', requestId)
    .neq('status', 'pending_hr')
    .maybeSingle()

  if (error) return { success: false, error: error.message, data: null }
  return { success: true, data }
}

/**
 * HR forwards a request: sets days allowed (trip-level) and edits
 * transport/airport-taxi per traveller. DTA and local running are
 * recomputed server-side from the current band rates and coverage tier —
 * HR cannot set them directly, only the three fields the UI exposes.
 *
 * The status flip is a compare-and-swap — `.eq('status', 'pending_hr')` on
 * the UPDATE — so two concurrent HR reviews of the same request can't both
 * succeed.
 */
export async function hrReviewRequest(input: HRReviewInput): Promise<ActionResult> {
  const auth = await requireRole('hr', 'admin')
  if (!auth.authorized) return { success: false, error: auth.error }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated' }

  const parsed = hrReviewSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.message }
  }

  const { request_id, days_approved, travellers, hr_note } = parsed.data

  const { data: request, error: fetchError } = await supabase
    .from('travel_requests')
    .select('destination, mode, one_way')
    .eq('id', request_id)
    .single()

  if (fetchError || !request) return { success: false, error: 'Request not found' }

  const travellerStaffIds = travellers.map((t) => t.staff_id)
  const [bands, policy] = await Promise.all([
    loadTravellerBands(supabase, travellerStaffIds),
    loadPolicyContext(supabase),
  ])

  const overrides = new Map(travellers.map((t) => [t.staff_id, { transport_cost: t.transport_cost, airport_taxi: t.airport_taxi }]))

  let priced: PriceRequestResult
  try {
    priced = priceRequest({
      destination: request.destination,
      mode: request.mode as TravelMode,
      oneWay: request.one_way,
      days: days_approved,
      travellerStaffIds,
      policy,
      bands,
      overrides,
    })
  } catch (err) {
    if (err instanceof UnpricedTravellerError) return { success: false, error: err.message }
    throw err
  }

  // Flag any traveller whose transport/taxi HR set differently from the
  // policy default they'd have gotten with no override — the evidence
  // trail for why someone was paid above policy (§7 HR surface).
  const overrideRows: {
    staff_id: string
    request_id: string
    field_name: string
    overridden_value: number
    hr_staff_id: string
  }[] = []
  for (const staffId of travellerStaffIds) {
    const band = bands.get(staffId)!
    const withoutOverride = calculateTravellerCost({
      dtaPerDay: band.dtaPerDay,
      localRunningPerDay: band.localRunningPerDay,
      coveragePercent: priced.coveragePercent,
      days: days_approved,
      mode: request.mode as TravelMode,
      oneWay: request.one_way,
      policyDefaults: policy.policyDefaults,
    })
    const set = overrides.get(staffId)!
    if (set.transport_cost !== withoutOverride.transport) {
      overrideRows.push({ staff_id: staffId, request_id, field_name: 'transport_cost', overridden_value: set.transport_cost, hr_staff_id: user.id })
    }
    if (request.mode === 'air' && set.airport_taxi !== withoutOverride.airportTaxi) {
      overrideRows.push({ staff_id: staffId, request_id, field_name: 'airport_taxi', overridden_value: set.airport_taxi, hr_staff_id: user.id })
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('travel_requests')
    .update({
      days_approved,
      policy_snapshot: priced.snapshot,
      coverage_percent_applied: priced.coveragePercent,
      request_total: priced.requestTotal,
      status: 'queued_for_erp',
    })
    .eq('id', request_id)
    .eq('status', 'pending_hr')
    .select('id')
    .maybeSingle()

  if (updateError) return { success: false, error: updateError.message }
  if (!updated) {
    return { success: false, error: 'This request is no longer awaiting HR review' }
  }

  const travellerUpdates = await Promise.all(
    priced.travellers.map((t) =>
      supabase
        .from('request_travellers')
        .update({
          dta: t.dta,
          local_running: t.local_running,
          transport_cost: t.transport_cost,
          airport_taxi: t.airport_taxi,
          traveller_total: t.traveller_total,
        })
        .eq('request_id', request_id)
        .eq('staff_id', t.staff_id)
        .select('id')
        .single()
    )
  )

  const failedTravellerUpdate = travellerUpdates.find((r) => r.error)
  if (failedTravellerUpdate?.error) {
    return { success: false, error: `Totals saved but a traveller line failed to update: ${failedTravellerUpdate.error.message}` }
  }

  // Back-fill traveller_id on the override rows now that we know each row's id.
  if (overrideRows.length > 0) {
    const travellerIdByStaffId = new Map(
      travellerUpdates.map((r, i) => [priced.travellers[i].staff_id, r.data?.id ?? null])
    )
    await supabase.from('rate_overrides').insert(
      overrideRows.map(({ staff_id, ...row }) => ({
        ...row,
        traveller_id: travellerIdByStaffId.get(staff_id) ?? null,
      }))
    )
  }

  const { error: approvalError } = await supabase.from('approvals').insert({
    request_id,
    approver_id: user.id,
    status: 'hr_approved',
    reason: hr_note ?? null,
    is_final: false,
  })

  if (approvalError) {
    return {
      success: false,
      error: `Totals saved but the audit log entry failed: ${approvalError.message}`,
    }
  }

  // '/hr' (home preview), '/hr/requests' (queue list), '/hr/history'
  // (recently processed) all show this request in one shape or another.
  revalidatePath('/hr')
  revalidatePath('/hr/requests')
  revalidatePath('/hr/history')
  revalidatePath('/md')
  return { success: true }
}

/**
 * HR returns a request to the submitting staff member for revision.
 * PRD Section 5.4: mandatory reason (also enforced by the
 * `approvals.rejection_requires_reason` DB constraint). Always
 * resubmittable — HR has no "final" rejection.
 */
export async function hrRejectRequest(input: HRRejectInput): Promise<ActionResult> {
  const auth = await requireRole('hr', 'admin')
  if (!auth.authorized) return { success: false, error: auth.error }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated' }

  const parsed = hrRejectSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'A reason is required when returning a request' }
  }

  const { request_id, reason } = parsed.data

  const { data: updated, error: updateError } = await supabase
    .from('travel_requests')
    .update({ status: 'hr_returned' })
    .eq('id', request_id)
    .eq('status', 'pending_hr')
    .select('id')
    .maybeSingle()

  if (updateError) return { success: false, error: updateError.message }
  if (!updated) {
    return { success: false, error: 'This request is no longer awaiting HR review' }
  }

  const { error: approvalError } = await supabase.from('approvals').insert({
    request_id,
    approver_id: user.id,
    status: 'hr_rejected',
    reason,
    is_final: false,
  })

  if (approvalError) {
    return {
      success: false,
      error: `Decision saved but the audit log entry failed: ${approvalError.message}`,
    }
  }

  revalidatePath('/hr')
  revalidatePath('/hr/requests')
  revalidatePath('/hr/history')
  return { success: true }
}

// ============================================================
// MD (read-only — REVISED_SCOPE.md decision 5 / M6)
// ============================================================

/**
 * Requests HR has finished pricing. There is no MD action in this app
 * anymore — approval happens in the ERP. This view exists so the MD can
 * see the total, the coverage rationale, and HR's note without asking
 * "why is this ₦X?" — the ERP memo will carry only the total.
 */
export async function getPendingMDRequests(): Promise<ActionResult<TravelRequestForMD[]>> {
  const auth = await requireRole('md', 'admin')
  if (!auth.authorized) return { success: false, error: auth.error, data: [] }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('travel_requests')
    .select(MD_REQUEST_SELECT)
    .eq('status', 'queued_for_erp')
    .order('submitted_at', { ascending: true })

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data }
}

/** Requests with an ERP-reported outcome (Phase 5) — empty until that phase ships. */
export async function getMDHistory(): Promise<ActionResult<TravelRequestForMD[]>> {
  const auth = await requireRole('md', 'admin')
  if (!auth.authorized) return { success: false, error: auth.error, data: [] }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('travel_requests')
    .select(MD_REQUEST_SELECT)
    .in('status', ['approved', 'rejected', 'rejected_final'])
    .order('updated_at', { ascending: false })

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data }
}
