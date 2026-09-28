/**
 * Zod validation for Admin's Phase 0 travel-policy configuration (FR-23,
 * FR-24) — grade-band rates, the designation→band mapping, and the flat
 * policy defaults (transport/taxi/full-coverage cities).
 */

import { z } from 'zod'

export const updateGradeBandSchema = z.object({
  id: z.string().uuid(),
  dta_per_day_100: z.number().min(0, 'Rate cannot be negative'),
  dta_per_day_75: z.number().min(0, 'Rate cannot be negative'),
  local_running_per_day_100: z.number().min(0, 'Rate cannot be negative'),
  local_running_per_day_75: z.number().min(0, 'Rate cannot be negative'),
})

/**
 * Which band a designation maps to (FR-24) — the 14 designations
 * themselves are confirmed exhaustive (PRD §8) and not editable here, only
 * their band assignment is.
 */
export const updateDesignationBandSchema = z.object({
  id: z.string().uuid(),
  grade_band_id: z.string().uuid(),
})

export const updatePolicyDefaultsSchema = z.object({
  transport_air_each_way: z.number().min(0, 'Amount cannot be negative'),
  transport_road_each_way: z.number().min(0, 'Amount cannot be negative'),
  airport_taxi_per_leg: z.number().min(0, 'Amount cannot be negative'),
  /** Comma-separated in the form, split before this schema sees it — each city name non-empty. */
  full_coverage_cities: z.array(z.string().trim().min(1)).min(1, 'At least one full-coverage city is required'),
})

export type UpdateGradeBandInput = z.infer<typeof updateGradeBandSchema>
export type UpdateDesignationBandInput = z.infer<typeof updateDesignationBandSchema>
export type UpdatePolicyDefaultsInput = z.infer<typeof updatePolicyDefaultsSchema>
