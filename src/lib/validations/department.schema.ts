import { z } from 'zod'

export const createDepartmentSchema = z.object({
  name: z
    .string()
    .min(1, 'Department name is required')
    .max(150, 'Department name is too long'),
  annual_budget_ceiling: z
    .number()
    .nonnegative('Budget ceiling cannot be negative')
    .nullable()
    .optional(),
})

export const updateDepartmentSchema = createDepartmentSchema.partial().extend({
  id: z.string().uuid(),
})

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>