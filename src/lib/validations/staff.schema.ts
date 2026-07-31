/**
 * Zod validation schema for staff management.
 * Used by Admin CRUD actions (PRD Section 3.4) and forms.
 */

import { z } from 'zod'

/** Schema for creating a new staff member via Admin UI */
export const createStaffSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .min(1, 'Email is required'),
  first_name: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name is too long'),
  surname: z
    .string()
    .min(1, 'Surname is required')
    .max(100, 'Surname is too long'),
  role: z.enum(['staff', 'hr', 'md', 'admin'], {
    message: 'Please select a valid role',
  }),
  department_id: z.string().uuid('Please select a department'),
  level_id: z.string().uuid('Please select a level'),
})

/** Schema for editing an existing staff member */
export const updateStaffSchema = createStaffSchema.partial().extend({
  id: z.string().uuid(),
  active: z.boolean().optional(),
})

/** Schema for deactivating a staff member */
export const deactivateStaffSchema = z.object({
  id: z.string().uuid(),
})

// Inferred types for use in actions and forms
export type CreateStaffInput = z.infer<typeof createStaffSchema>
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>
export type DeactivateStaffInput = z.infer<typeof deactivateStaffSchema>
