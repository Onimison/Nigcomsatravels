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

export type RateReferenceInput = z.infer<typeof rateReferenceSchema>
export type UpdateRateReferenceInput = z.infer<typeof updateRateReferenceSchema>