import { z } from 'zod'

export const createLevelSchema = z.object({
  name: z
    .string()
    .min(1, 'Level name is required')
    .max(100, 'Level name is too long'),
  coverage_percent: z
    .number()
    .min(0, 'Coverage cannot be negative')
    .max(100, 'Coverage cannot exceed 100%'),
  flight_class: z.string().max(50, 'Flight class is too long').nullable().optional(),
})

export const updateLevelSchema = createLevelSchema.partial().extend({
  id: z.string().uuid(),
})

export type CreateLevelInput = z.infer<typeof createLevelSchema>
export type UpdateLevelInput = z.infer<typeof updateLevelSchema>