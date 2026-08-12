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
  approvalActionSchema,
  type CreateRequestInput,
  type HRReviewInput,
  type ApprovalActionInput,
} from '@/lib/validations/request.schema'
import { calculateFinalCost } from '@/lib/utils/formatting'
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Used by HR review (Sprint 2)
import { calculateTotalRawAllowance } from '@/lib/utils/formatting'
import { revalidatePath } from 'next/cache'
import type { TravelMode } from '@/types/database'

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
 * Get all requests pending HR review.
 * PRD Section 3.2: HR reviews requests with status = 'pending_hr'.
 */
export async function getPendingHRRequests() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('travel_requests')
    .select('*, staff:staff(first_name, surname, email), level:staff!inner(level:levels(name, coverage_percent))')
    .eq('status', 'pending_hr')
    .order('submitted_at', { ascending: true })

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data }
}

/**
 * HR sets allowance fields and forwards to MD.
 * PRD Section 3.2: "Suggest Standard Rates" populates fields 8-12.
 *
 * TODO (Sprint 2):
 * 1. Validate with hrReviewSchema
 * 2. Calculate total_cost and final_cost
 * 3. Lock FX rate if international
 * 4. Update request status to 'pending_md'
 * 5. Create approval record
 * 6. Log any overrides to rate_overrides
 */
export async function hrReviewRequest(input: HRReviewInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated' }

  const parsed = hrReviewSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.message }
  }

  // TODO: Implement HR review logic
  throw new Error('Not implemented — Sprint 2 task')
}

// ============================================================
// MD Actions (PRD Section 3.3)
// ============================================================

/**
 * Fields selected for the MD queue and history views: staff identity +
 * department + level (for coverage %), plus the full approvals trail so the
 * UI can pull HR's forwarding note (the `hr_approved` row's `reason`) and,
 * for history, the final HR/MD decision reason.
 */
const MD_REQUEST_SELECT = `*,
  staff:staff(
    first_name, surname, email,
    department:departments(name),
    level:levels(name, coverage_percent)
  ),
  approvals(status, reason, is_final, timestamp)`

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
