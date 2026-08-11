import { z } from 'zod'

export const rateReferenceSchema = z.object({
  destination: z
    .string()
    .min(1, 'Destination is required')
    .max(150, 'Destination is too long'),
  level_id: z.string().uuid('Please select a level'),
  mode: z.enum(['air', 'road'], {
    message: 'Please select a travel mode',
  }),
  accommodation_rate: z.number().nonnegative('Rate cannot be negative').nullable().optional(),
  per_diem_rate: z.number().nonnegative('Rate cannot be negative').nullable().optional(),
  flight_estimate: z.number().nonnegative('Rate cannot be negative').nullable().optional(),
  airport_taxi: z.number().nonnegative('Rate cannot be negative').nullable().optional(),
})

export const updateRateReferenceSchema = rateReferenceSchema.partial().extend({
  id: z.string().uuid(),
})

/** PRD Section 5.2: FX rate must be a positive multiplier (USD → NGN). */
export const fxRateSchema = z.object({
  rate: z.number().positive('Exchange rate must be greater than zero'),
})

export type RateReferenceInput = z.infer<typeof rateReferenceSchema>
export type UpdateRateReferenceInput = z.infer<typeof updateRateReferenceSchema>
export type FxRateInput = z.infer<typeof fxRateSchema>