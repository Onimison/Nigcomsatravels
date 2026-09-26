/**
 * Zod validation for HR's Phase 0 review action (FR-16/FR-17) — a
 * different shape from hrReviewSchema in request.schema.ts, which still
 * backs the legacy 5-allowance-field/FX review path.
 */

import { z } from 'zod'

export const travelerOverrideSchema = z.object({
  request_traveler_id: z.string().uuid(),
  /** What HR has in the Transport field right now — compared server-side against the frozen default to decide whether it's actually an override (FR-18). */
  transport_value: z.number().min(0),
  /** Same for Airport Taxi. */
  airport_taxi_value: z.number().min(0),
})

export const hrReviewV2Schema = z.object({
  request_id: z.string().uuid(),
  /** Trip-wide (FR-17) — HR's one editable day count, applies to every traveller. */
  days: z.number().int('Days must be a whole number').min(1, 'Minimum 1 day'),
  hr_note: z.string().max(2000).optional(),
  traveler_overrides: z.array(travelerOverrideSchema),
})

export type HRReviewV2Input = z.infer<typeof hrReviewV2Schema>
