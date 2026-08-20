'use server'

/**
 * Travel Request Server Actions.
 * PRD Section 3.1 — Staff: Submit requests
 * PRD Section 3.2 — HR: Review and set allowances
 * PRD Section 3.3 — MD: Approve or reject
 * PRD Section 5.3 — Resubmission & Immutability
 */

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/utils/auth-guard'
import {
  createRequestSchema,
  hrReviewSchema,
  hrRejectSchema,
  approvalActionSchema,
  type CreateRequestInput,
  type HRReviewInput,
  type HRRejectInput,
  type ApprovalActionInput,
} from '@/lib/validations/request.schema'
import { calculateFinalCost, calculateTotalRawAllowance, datesOverlap } from '@/lib/utils/formatting'
import { FX_RATE_SETTING_KEY } from '@/lib/utils/constants'
import { revalidatePath } from 'next/cache'
import type { TravelMode, TravelRequestForHR, RateSuggestionResult } from '@/types/database'

// ============================================================
// Types
// ============================================================

export interface ActionResult {
  success: boolean
  error?: string
}

// ============================================================
// Staff Actions (PRD Section 3.1)
// ============================================================

/**
 * Submit a new travel request.
 * PRD: Staff submit Fields 1-7 + Reason for Travel.
 * Status starts as 'pending_hr'. Allowance/cost fields are left null —
 * HR populates them during review (Sprint 2).
 */
export async function submitRequest(input: CreateRequestInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated' }

  const parsed = createRequestSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.message }
  }

  const { error } = await supabase.from('travel_requests').insert({
    travel_group_id: crypto.randomUUID(),
    previous_version_id: null,
    staff_id: user.id,
    status: 'pending_hr',
    ...parsed.data,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/staff')
  return { success: true }
}

/**
 * Resubmit a rejected request.
 * PRD Section 5.3: Creates a NEW row, copies travel_group_id,
 * sets previous_version_id to the rejected request's id.
 * Only requests in `hr_rejected` or `md_rejected` can be resubmitted —
 * `rejected_final` is deliberately excluded (final rejections are immutable dead ends).
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

  if (original.status !== 'hr_rejected' && original.status !== 'md_rejected') {
    return {
      success: false,
      error: 'Only requests returned for revision can be resubmitted',
    }
  }

  const { error: insertError } = await supabase.from('travel_requests').insert({
    travel_group_id: original.travel_group_id,
    previous_version_id: original.id,
    staff_id: user.id,
    status: 'pending_hr',
    ...parsed.data,
  })

  if (insertError) return { success: false, error: insertError.message }

  revalidatePath('/staff')
  return { success: true }
}

/**
 * Fetch the current user's travel requests, including each request's
 * approval history (used to surface the HR/MD rejection reason so staff
 * know what to fix before resubmitting).
 * PRD Section 3.1: Pending Requests list + Travel History.
 */
export async function getMyRequests() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated', data: [] }

  const { data, error } = await supabase
    .from('travel_requests')
    .select('*, approvals(status, reason, is_final, timestamp)')
    .eq('staff_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data }
}

/**
 * Pre-submit non-binding cost estimate.
 * PRD Section 3.1: "Before submitting, the system queries rate_reference
 * and displays a non-binding estimate labeled 'Subject to HR verification.'
 * If no rate exists, shows 'No reference rate found; HR will compute manually.'"
 */
export async function getRequestEstimate(destination: string, mode: TravelMode) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated', data: null }

  const { data: staff } = await supabase
    .from('staff')
    .select('level_id, level:levels(coverage_percent)')
    .eq('id', user.id)
    .single()

  // No level assigned yet (e.g. brand-new staff record) — nothing to estimate against.
  if (!staff?.level_id) return { success: true, data: null }

  const { data: rate } = await supabase
    .from('rate_reference')
    .select('accommodation_rate, per_diem_rate, flight_estimate, airport_taxi')
    .ilike('destination', destination.trim())
    .eq('level_id', staff.level_id)
    .eq('mode', mode)
    .maybeSingle()

  if (!rate) return { success: true, data: null }

  const rawTotal =
    (rate.accommodation_rate ?? 0) +
    (rate.per_diem_rate ?? 0) +
    (rate.flight_estimate ?? 0) +
    (rate.airport_taxi ?? 0)

  const level = Array.isArray(staff.level) ? staff.level[0] : staff.level
  const coveragePercent = level?.coverage_percent ?? 100

  return {
    success: true,
    data: {
      estimate: calculateFinalCost(rawTotal, coveragePercent),
      coveragePercent,
    },
  }
}

// ============================================================
// HR Actions (PRD Section 3.2)
// ============================================================

/**
 * Fields selected for the MD queue and history views: staff identity +
 * department + level (for coverage %), plus the full approvals trail so the
 * UI can pull HR's forwarding note (the `hr_approved` row's `reason`) and,
 * for history, the final HR/MD decision reason. Also reused by
 * `getHRHistory()` below — HR is allowed to see the same columns per the
 * `HR read all requests` RLS policy.
 */
const MD_REQUEST_SELECT = `*,
  staff:staff(
    first_name, surname, email,
    department:departments(name),
    level:levels(name, coverage_percent)
  ),
  approvals(status, reason, is_final, timestamp)`

/**
 * Fields selected for the HR queue: staff identity + department + level
 * (needed both for the live coverage-adjusted total and to look up
 * `rate_reference` for "Suggest Standard Rates").
 */
const HR_REQUEST_SELECT = `*,
  staff:staff(
    first_name, surname, email,
    department:departments(name),
    level:levels(id, name, coverage_percent)
  )`

/**
 * Get all requests pending HR review, enriched with two things the review
 * screen needs that don't come off a single-table query (PRD Section 3.2):
 * - `overlaps`: other active trips by the same staff member with
 *   conflicting dates (the Date-Overlap Warning, mirrored from
 *   useOverlapWarning but computed server-side across all pending rows).
 * - `previousRejectionReason`: when this row is a resubmission
 *   (`previous_version_id` set), the reason HR/MD sent the prior version
 *   back — so HR has resubmission context without a second click.
 */
export async function getPendingHRRequests() {
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
      .in('status', ['pending_hr', 'pending_md', 'approved']),
    previousIds.length > 0
      ? supabase
          .from('approvals')
          .select('request_id, reason, timestamp')
          .in('request_id', previousIds)
          .in('status', ['hr_rejected', 'md_rejected'])
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
 * queue's row shape (staff + department + level + full approvals trail) —
 * HR is allowed to see the same columns per the `HR read all requests`
 * RLS policy, and the UI needs the same decision-reason lookup.
 */
export async function getHRHistory() {
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
 * "Suggest Standard Rates" (PRD Section 3.2): looks up `rate_reference` for
 * this request's destination/mode/staff-level and returns the 4 fields that
 * have a master-table equivalent. `allowance_local` has none (same
 * exclusion as `PROMOTABLE_FIELDS` in rates.actions.ts) — HR always enters
 * it manually. Returns `data: null` (not an error) when no reference rate
 * exists, matching the staff-facing estimate's "HR will compute manually."
 */
export async function getRateSuggestionForRequest(
  requestId: string
): Promise<{ success: boolean; error?: string; data: RateSuggestionResult | null }> {
  const auth = await requireRole('hr', 'admin')
  if (!auth.authorized) return { success: false, error: auth.error, data: null }

  const supabase = await createClient()

  const { data: request, error: requestError } = await supabase
    .from('travel_requests')
    .select('destination, mode, staff:staff(level_id, level:levels(coverage_percent))')
    .eq('id', requestId)
    .single()

  if (requestError || !request) return { success: false, error: 'Request not found', data: null }

  const staffRow = Array.isArray(request.staff) ? request.staff[0] : request.staff
  if (!staffRow?.level_id) return { success: true, data: null }

  const { data: rate } = await supabase
    .from('rate_reference')
    .select('accommodation_rate, per_diem_rate, flight_estimate, airport_taxi, updated_at')
    .eq('destination', request.destination)
    .eq('level_id', staffRow.level_id)
    .eq('mode', request.mode)
    .maybeSingle()

  if (!rate) return { success: true, data: null }

  const level = Array.isArray(staffRow.level) ? staffRow.level[0] : staffRow.level

  return {
    success: true,
    data: {
      accommodation: rate.accommodation_rate,
      per_diem: rate.per_diem_rate,
      allowance_flight: rate.flight_estimate,
      allowance_taxi: rate.airport_taxi,
      coveragePercent: level?.coverage_percent ?? null,
      // Flight Price Reference staleness (UI_UX_DESIGN_PLAN.md §4) — only
      // meaningful when there's actually a flight_estimate to trust.
      flightUpdatedAt: rate.flight_estimate != null ? rate.updated_at : null,
    },
  }
}

/**
 * Maps an allowance column to its rate_reference equivalent, for diffing
 * HR's final entry against the suggested rate so a manual override gets
 * logged. Mirrors `PROMOTABLE_FIELDS` in rates.actions.ts (same exclusion
 * of `allowance_local`, which has no master-table column).
 */
const OVERRIDE_CHECKS: {
  field: 'accommodation' | 'per_diem' | 'allowance_flight' | 'allowance_taxi'
  referenceField: 'accommodation_rate' | 'per_diem_rate' | 'flight_estimate' | 'airport_taxi'
}[] = [
  { field: 'accommodation', referenceField: 'accommodation_rate' },
  { field: 'per_diem', referenceField: 'per_diem_rate' },
  { field: 'allowance_flight', referenceField: 'flight_estimate' },
  { field: 'allowance_taxi', referenceField: 'airport_taxi' },
]

/**
 * HR sets allowance fields and forwards to MD.
 * PRD Section 3.2: "Suggest Standard Rates" populates fields 8-12; HR can
 * edit any of them before forwarding.
 *
 * The status flip is the same compare-and-swap pattern as `mdApproveReject`
 * — `.eq('status', 'pending_hr')` on the UPDATE — so two concurrent HR
 * reviews of the same request can't both succeed.
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

  const { request_id, hr_note, ...allowances } = parsed.data

  const { data: request, error: fetchError } = await supabase
    .from('travel_requests')
    .select('destination, mode, staff:staff(level_id, level:levels(coverage_percent))')
    .eq('id', request_id)
    .single()

  if (fetchError || !request) return { success: false, error: 'Request not found' }

  const staffRow = Array.isArray(request.staff) ? request.staff[0] : request.staff
  const level = staffRow?.level ? (Array.isArray(staffRow.level) ? staffRow.level[0] : staffRow.level) : null
  const coveragePercent = level?.coverage_percent ?? 100

  const totalRawAllowance = calculateTotalRawAllowance(allowances)
  const finalCost = calculateFinalCost(totalRawAllowance, coveragePercent)

  // PRD Section 5.2: lock today's FX rate onto the request at the point HR
  // prices it, so a later admin FX override doesn't retroactively change
  // the NGN equivalent of an already-forwarded request.
  const { data: fxSetting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', FX_RATE_SETTING_KEY)
    .maybeSingle()
  const lockedFxRate = fxSetting ? Number(fxSetting.value) : null

  const { data: updated, error: updateError } = await supabase
    .from('travel_requests')
    .update({
      ...allowances,
      total_cost: totalRawAllowance,
      final_cost: finalCost,
      locked_fx_rate: lockedFxRate,
      status: 'pending_md',
    })
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
    status: 'hr_approved',
    reason: hr_note ?? null,
    is_final: false,
  })

  if (approvalError) {
    return {
      success: false,
      error: `Allowances saved but the audit log entry failed: ${approvalError.message}`,
    }
  }

  // PRD Section 3.4: any field HR set differently from the master rate gets
  // logged so admin can review/promote it. Best-effort — a failure here
  // shouldn't undo the review that already succeeded.
  if (staffRow?.level_id) {
    const { data: reference } = await supabase
      .from('rate_reference')
      .select('accommodation_rate, per_diem_rate, flight_estimate, airport_taxi')
      .eq('destination', request.destination)
      .eq('level_id', staffRow.level_id)
      .eq('mode', request.mode)
      .maybeSingle()

    if (reference) {
      const overrides = OVERRIDE_CHECKS.filter(
        ({ referenceField }) => reference[referenceField] != null
      )
        .filter(({ field, referenceField }) => Number(reference[referenceField]) !== allowances[field])
        .map(({ field }) => ({
          request_id,
          field_name: field,
          overridden_value: allowances[field],
          hr_staff_id: user.id,
        }))

      if (overrides.length > 0) {
        await supabase.from('rate_overrides').insert(overrides)
      }
    }
  }

  revalidatePath('/hr')
  return { success: true }
}

/**
 * HR rejects a request back to the submitting staff member.
 * PRD Section 5.4: mandatory reason (also enforced by the
 * `approvals.rejection_requires_reason` DB constraint). Unlike MD, HR has
 * no "final" rejection — `hr_rejected` is always resubmittable.
 */
export async function hrRejectRequest(input: HRRejectInput): Promise<ActionResult> {
  const auth = await requireRole('hr', 'admin')
  if (!auth.authorized) return { success: false, error: auth.error }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated' }

  const parsed = hrRejectSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'A reason is required when rejecting a request' }
  }

  const { request_id, reason } = parsed.data

  const { data: updated, error: updateError } = await supabase
    .from('travel_requests')
    .update({ status: 'hr_rejected' })
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
  return { success: true }
}

// ============================================================
// MD Actions (PRD Section 3.3)
// ============================================================

/**
 * Get all requests pending MD approval.
 * PRD Section 3.3: MD sees requests with status = 'pending_md'.
 * Sorting/filtering (cost, department, destination) happens client-side —
 * the queue is small enough that a materialized view isn't warranted yet
 * (PRD Section 6.1 applies the same reasoning to reporting).
 */
export async function getPendingMDRequests() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('travel_requests')
    .select(MD_REQUEST_SELECT)
    .eq('status', 'pending_md')
    .order('submitted_at', { ascending: true })

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data }
}

/**
 * Get MD's decision history: requests that reached a final MD-visible
 * outcome. PRD Section 3.3: "History: Full view of past approvals with
 * cost snapshots." Mirrors the MD read RLS policy exactly, so this never
 * returns more than MD is already allowed to see.
 */
export async function getMDHistory() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('travel_requests')
    .select(MD_REQUEST_SELECT)
    .in('status', ['approved', 'md_rejected', 'rejected_final'])
    .order('updated_at', { ascending: false })

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data }
}

/**
 * MD approves or rejects a request.
 * PRD Section 3.3 + Section 5.4: Mandatory rejection reason (also enforced
 * by the `approvals.rejection_requires_reason` DB constraint).
 *
 * The status flip is a compare-and-swap — `.eq('status', 'pending_md')` on
 * the UPDATE — rather than a separate read-then-write. Without that, two
 * concurrent calls on the same request (double-click, a retry, two MD
 * sessions) could both pass a stale "is it still pending_md?" check and
 * each insert their own approvals row, even though only one status change
 * can actually win. The CAS UPDATE runs first specifically so only its
 * winner ever inserts an approval — the loser gets zero rows back and
 * bails before writing anything.
 */
export async function mdApproveReject(input: ApprovalActionInput): Promise<ActionResult> {
  const auth = await requireRole('md', 'admin')
  if (!auth.authorized) return { success: false, error: auth.error }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated' }

  const parsed = approvalActionSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.message }
  }

  const { request_id, action, reason, is_final } = parsed.data

  // PRD Section 4: a final rejection is a distinct terminal status
  // (`rejected_final`) — otherwise `md_rejected` allows the staff member
  // to resubmit.
  const newStatus = action === 'approve' ? 'approved' : is_final ? 'rejected_final' : 'md_rejected'

  const { data: updated, error: updateError } = await supabase
    .from('travel_requests')
    .update({ status: newStatus })
    .eq('id', request_id)
    .eq('status', 'pending_md')
    .select('id')
    .maybeSingle()

  if (updateError) return { success: false, error: updateError.message }
  if (!updated) {
    return { success: false, error: 'This request is no longer awaiting MD approval' }
  }

  const { error: approvalError } = await supabase.from('approvals').insert({
    request_id,
    approver_id: user.id,
    status: action === 'approve' ? 'md_approved' : 'md_rejected',
    reason: reason ?? null,
    is_final,
  })

  if (approvalError) {
    // The status change already committed and won't be retried by the
    // caller (a retry would just see "no longer pending_md" above), so
    // surface this as distinct from a normal validation failure.
    return {
      success: false,
      error: `Decision saved but the audit log entry failed: ${approvalError.message}`,
    }
  }

  revalidatePath('/md')
  return { success: true }
}
