/**
 * Zod validation schema for travel requests.
 * Used by staff submission (PRD Section 3.1) and HR review (PRD Section 3.2).
 */

import { z } from 'zod'

/** Schema for staff submitting a new travel request (Fields 1-7 + reason) */
export const createRequestSchema = z
  .object({
    destination: z
      .string()
      .min(1, 'Destination is required')
      .max(200, 'Destination is too long'),
    origin: z
      .string()
      .min(1, 'Origin is required')
      .max(200, 'Origin is too long'),
    mode: z.enum(['air', 'road'], {
      message: 'Please select a travel mode',
    }),
    days: z
      .number()
      .int('Days must be a whole number')
      .min(1, 'Minimum 1 day'),
    reason_for_travel: z
      .string()
      .min(10, 'Please provide a detailed reason for travel')
      .max(2000, 'Reason is too long'),
    depart_date: z.string().min(1, 'Departure date is required'),
    return_date: z.string().min(1, 'Return date is required'),
  })
  .refine(
    (data) => new Date(data.return_date) >= new Date(data.depart_date),
    {
      message: 'Return date must be on or after departure date',
      path: ['return_date'],
    }
  )

/**
 * Schema for HR reviewing/updating allowance fields (Fields 8-12).
 * PRD Section 3.2: HR populates allowance fields from rate_reference or manually.
 */
export const hrReviewSchema = z.object({
  request_id: z.string().uuid(),
  allowance_local: z
    .number()
    .min(0, 'Allowance cannot be negative'),
  allowance_flight: z
    .number()
    .min(0, 'Allowance cannot be negative'),
  allowance_taxi: z
    .number()
    .min(0, 'Allowance cannot be negative'),
  accommodation: z
    .number()
    .min(0, 'Accommodation rate cannot be negative'),
  per_diem: z
    .number()
    .min(0, 'Per diem cannot be negative'),
  /** Optional HR recommendation/note (PRD Section 3.2) */
  hr_note: z.string().max(2000).optional(),
})

/**
 * Schema for HR rejecting a request back to the submitting staff member.
 * Unlike MD, HR has no "final" rejection — a request HR sends back is
 * always resubmittable (PRD Section 5.3/5.4).
 */
export const hrRejectSchema = z.object({
  request_id: z.string().uuid(),
  reason: z.string().min(1, 'A reason is required when rejecting a request').max(2000),
})

/**
 * Schema for HR/MD approval or rejection action.
 * PRD Section 5.4: Rejection reason is mandatory (also enforced at DB level).
 */
export const approvalActionSchema = z
  .object({
    request_id: z.string().uuid(),
    action: z.enum(['approve', 'reject']),
    reason: z.string().max(2000).optional(),
    is_final: z.boolean().default(false),
  })
  .refine(
    (data) => data.action !== 'reject' || (data.reason && data.reason.length > 0),
    {
      message: 'A reason is required when rejecting a request',
      path: ['reason'],
    }
  )

// Inferred types for use in actions and forms
export type CreateRequestInput = z.infer<typeof createRequestSchema>
export type HRReviewInput = z.infer<typeof hrReviewSchema>
export type HRRejectInput = z.infer<typeof hrRejectSchema>
export type ApprovalActionInput = z.infer<typeof approvalActionSchema>
