'use server'

/**
 * Travel Request Server Actions.
 * PRD Section 3.1 — Staff: Submit requests
 * PRD Section 3.2 — HR: Review and set allowances
 * PRD Section 3.3 — MD: Approve or reject
 * PRD Section 5.3 — Resubmission & Immutability
 */

import { createClient } from '@/lib/supabase/server'
import {
  createRequestSchema,
  hrReviewSchema,
  approvalActionSchema,
  type CreateRequestInput,
  type HRReviewInput,
  type ApprovalActionInput,
} from '@/lib/validations/request.schema'
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Used when TODOs are implemented
import { calculateTotalRawAllowance, calculateFinalCost } from '@/lib/utils/formatting'
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
// Staff Actions (PRD Section 3.1)
// ============================================================

/**
 * Submit a new travel request.
 * PRD: Staff submit Fields 1-7 + Reason for Travel.
 * Status starts as 'pending_hr'.
 *
 * TODO (Sprint 1):
 * 1. Validate with createRequestSchema
 * 2. Generate travel_group_id (crypto.randomUUID())
 * 3. Insert into travel_requests with status = 'pending_hr'
 * 4. Revalidate staff dashboard
 */
export async function submitRequest(input: CreateRequestInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated' }

  const parsed = createRequestSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.message }
  }

  // TODO: Implement insertion
  // 1. const travel_group_id = crypto.randomUUID()
  // 2. Insert with staff_id = user.id, status = 'pending_hr'
  // 3. revalidatePath('/staff')
  throw new Error('Not implemented — Sprint 1 task')
}

/**
 * Resubmit a rejected request.
 * PRD Section 5.3: Creates a NEW row, copies travel_group_id,
 * sets previous_version_id to the rejected request's id.
 *
 * TODO (Sprint 1):
 * 1. Verify original request belongs to user and is hr_rejected/md_rejected
 * 2. Verify NOT rejected_final
 * 3. Create new row with same travel_group_id
 * 4. Set previous_version_id = original request id
 * 5. New status = 'pending_hr'
 */
export async function resubmitRequest(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  originalRequestId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  input: CreateRequestInput
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated' }

  // TODO: Implement resubmission logic
  throw new Error('Not implemented — Sprint 1 task')
}

/**
 * Fetch the current user's travel requests.
 * PRD Section 3.1: Pending Requests list + Travel History.
 */
export async function getMyRequests() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated', data: [] }

  const { data, error } = await supabase
    .from('travel_requests')
    .select('*')
    .eq('staff_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data }
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
 * Get all requests pending MD approval.
 * PRD Section 3.3: MD sees requests with status = 'pending_md'.
 */
export async function getPendingMDRequests() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('travel_requests')
    .select('*')
    .eq('status', 'pending_md')
    .order('submitted_at', { ascending: true })

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data }
}

/**
 * MD approves or rejects a request.
 * PRD Section 3.3 + Section 5.4: Mandatory rejection reason.
 *
 * TODO (Sprint 3):
 * 1. Validate with approvalActionSchema
 * 2. Update travel_requests.status
 * 3. Insert into approvals table
 * 4. If rejected_final, block resubmission
 * 5. Revalidate MD dashboard
 */
export async function mdApproveReject(input: ApprovalActionInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated' }

  const parsed = approvalActionSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.message }
  }

  // TODO: Implement MD approval/rejection logic
  throw new Error('Not implemented — Sprint 3 task')
}
