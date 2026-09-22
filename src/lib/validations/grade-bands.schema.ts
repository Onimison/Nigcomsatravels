import { z } from 'zod'

export const updateGradeBandSchema = z.object({
  id: z.string().uuid(),
  dta_per_day: z.number().nonnegative('Rate cannot be negative'),
  local_running_per_day: z.number().nonnegative('Rate cannot be negative'),
})

export const addDestinationCoverageSchema = z.object({
  city: z.string().min(1, 'City is required').max(150, 'City name is too long'),
})

export const removeDestinationCoverageSchema = z.object({
  city: z.string().min(1),
})

export const POLICY_DEFAULT_KEYS = [
  'policy_air_fare_per_leg',
  'policy_road_fare_per_leg',
  'policy_taxi_per_leg',
] as const

export const updatePolicyDefaultSchema = z.object({
  key: z.enum(POLICY_DEFAULT_KEYS),
  value: z.number().nonnegative('Rate cannot be negative'),
})

export type UpdateGradeBandInput = z.infer<typeof updateGradeBandSchema>
export type AddDestinationCoverageInput = z.infer<typeof addDestinationCoverageSchema>
export type RemoveDestinationCoverageInput = z.infer<typeof removeDestinationCoverageSchema>
export type UpdatePolicyDefaultInput = z.infer<typeof updatePolicyDefaultSchema>
