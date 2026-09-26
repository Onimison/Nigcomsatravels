/**
 * Zod validation for the Phase 0 staff submission flow (notes.md v1.1).
 * Separate from request.schema.ts on purpose — that file's schemas back the
 * old FX/single-traveller path HR and MD still run against, and this one
 * has a genuinely different shape (memo number, multiple travellers, no
 * currency conversion anywhere).
 */

import { z } from 'zod'
import { DUTY_STATIONS } from '@/lib/utils/constants'

/**
 * FR-4: "format-validated in Phase 0, looked up against the ERP in
 * Phase 3." The exact ERP format is Q5 in the PRD's open questions — this
 * is a deliberately loose placeholder (non-empty, no whitespace, a sane
 * length) that Phase 3 will replace with the real pattern once ICT
 * confirms which Dynamics product is in use.
 */
export const memoNumberSchema = z
  .string()
  .trim()
  .min(3, 'Memo number looks too short')
  .max(50, 'Memo number is too long')
  .regex(/^\S+$/, 'Memo number cannot contain spaces')

export const travelerInputSchema = z.object({
  staff_id: z.string().uuid(),
})

export const createTravelRequestV2Schema = z
  .object({
    memo_number: memoNumberSchema,
    origin: z.enum(DUTY_STATIONS, { message: 'Origin must be one of the four duty stations' }),
    destination: z.string().min(1, 'Destination is required').max(200, 'Destination is too long'),
    /** Airport picked in the dropdown — null via the "Other — not listed" escape hatch for road-only places (FR-6). */
    destination_airport_id: z.string().uuid().nullable().optional(),
    mode: z.enum(['air', 'road'], { message: 'Please select a travel mode' }),
    trip_type: z.enum(['one_way', 'return'], { message: 'Please select one-way or return' }),
    depart_date: z.string().min(1, 'Departure date is required'),
    return_date: z.string().min(1, 'Return date is required'),
    reason_for_travel: z
      .string()
      .min(10, 'Please provide a detailed reason for travel')
      .max(2000, 'Reason is too long'),
    /** The requester is auto-included by the server, not required here — colleagues only (FR-5). */
    traveler_staff_ids: z.array(z.string().uuid()).max(20, 'That is a lot of travellers for one memo'),
  })
  .refine((data) => new Date(data.return_date) >= new Date(data.depart_date), {
    message: 'Return date must be on or after departure date',
    path: ['return_date'],
  })
  .refine((data) => data.destination.trim().toLowerCase() !== data.origin.trim().toLowerCase(), {
    message: 'Destination cannot be the same as origin',
    path: ['destination'],
  })

export type CreateTravelRequestV2Input = z.infer<typeof createTravelRequestV2Schema>
