import { z } from 'zod'

export const createLevelSchema = z.object({
  name: z
    .string()
    .min(1, 'Level name is required')
    .max(100, 'Level name is too long'),
  band_id: z.string().uuid('Please select a grade band'),
  sort_order: z.number().int().nullable().optional(),
})

export const updateLevelSchema = createLevelSchema.partial().extend({
  id: z.string().uuid(),
})

export type CreateLevelInput = z.infer<typeof createLevelSchema>
export type UpdateLevelInput = z.infer<typeof updateLevelSchema>
