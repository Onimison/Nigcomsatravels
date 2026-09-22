/**
 * Zod validation schema for travel requests.
 * Used by staff submission (PRD Section 3.1) and HR review (PRD Section 3.2).
 */

import { z } from 'zod'

/** The four duty stations a trip can originate from (REVISED_SCOPE.md §1). */
export const DUTY_STATIONS = ['Abuja', 'Lagos', 'Kaduna', 'Gombe'] as const

/** Loose format check — a memo number is unverified free text until Phase 3's ERP read integration can validate it against Dynamics. */
const MEMO_NUMBER_PATTERN = /^[A-Za-z0-9/._-]+$/

/** Schema for staff submitting a new travel request */
export const createRequestSchema = z
  .object({
    memo_number: z
      .string()
      .min(3, 'Enter the memo number generated in the ERP')
      .max(50, 'Memo number is too long')
      .regex(MEMO_NUMBER_PATTERN, 'Memo number contains characters that don\'t look right'),
    destination: z
      .string()
      .min(1, 'Destination is required')
      .max(200, 'Destination is too long'),
    origin: z.enum(DUTY_STATIONS, {
      message: 'Select one of the four duty stations',
    }),
    /**
     * Airport picked in the dropdown, when the endpoint is one of the seeded
     * cities (20260822160000_airports.sql). Optional because the form keeps an
     * "Other — not listed" escape hatch for the destination: road trips and
     * unusual destinations must stay submittable. The server re-reads these
     * to derive the canonical `destination`/`origin` text, so a client can't
     * put the FK and the text out of step.
     */
    destination_airport_id: z.string().uuid().nullable().optional(),
    origin_airport_id: z.string().uuid().nullable().optional(),
    mode: z.enum(['air', 'road'], {
      message: 'Please select a travel mode',
    }),
    one_way: z.boolean(),
    reason_for_travel: z
      .string()
      .min(10, 'Please provide a detailed reason for travel')
      .max(2000, 'Reason is too long'),
    depart_date: z.string().min(1, 'Departure date is required'),
    return_date: z.string().min(1, 'Return date is required'),
    /**
     * Every traveller on the memo, requester included — one memo can carry
     * several people, raised by the most senior staff member on the trip
     * (REVISED_SCOPE.md decision 6). Each is priced at their own band.
     */
    traveller_staff_ids: z
      .array(z.string().uuid())
      .min(1, 'At least one traveller is required'),
  })
  .refine((data) => new Date(data.return_date) >= new Date(data.depart_date), {
    message: 'Return date must be on or after departure date',
    path: ['return_date'],
  })
  .refine((data) => data.destination.trim().toLowerCase() !== data.origin.trim().toLowerCase(), {
    message: 'Destination cannot be the same as the origin',
    path: ['destination'],
  })

/**
 * Schema for HR reviewing a request. HR edits exactly three things:
 * days allowed (trip-level) and transport/airport-taxi (per traveller) —
 * DTA and local running are locked policy, recomputed server-side.
 */
export const hrReviewSchema = z.object({
  request_id: z.string().uuid(),
  days_approved: z.number().int('Days must be a whole number').min(1, 'Minimum 1 day'),
  travellers: z
    .array(
      z.object({
        staff_id: z.string().uuid(),
        transport_cost: z.number().min(0, 'Cannot be negative'),
        airport_taxi: z.number().min(0, 'Cannot be negative'),
      })
    )
    .min(1),
  /** Optional HR recommendation/note, carried in the audit trail. */
  hr_note: z.string().max(2000).optional(),
})

/**
 * Schema for HR returning a request to the submitting staff member for
 * revision. Always resubmittable — HR has no "final" rejection (only the
 * ERP-reported MD decision, in a later phase, can be final).
 */
export const hrRejectSchema = z.object({
  request_id: z.string().uuid(),
  reason: z.string().min(1, 'A reason is required when returning a request').max(2000),
})

// Inferred types for use in actions and forms
export type CreateRequestInput = z.infer<typeof createRequestSchema>
export type HRReviewInput = z.infer<typeof hrReviewSchema>
export type HRRejectInput = z.infer<typeof hrRejectSchema>
