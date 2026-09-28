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
  /** Nullable to support clearing a mis-assigned designation (FR-13/FR-24). */
  designation_id: z.string().uuid().nullable().optional(),
})

/** Schema for deactivating a staff member */
export const deactivateStaffSchema = z.object({
  id: z.string().uuid(),
})

/**
 * Schema for one row of a bulk-import CSV. Department/level are free-text
 * names here (matched against the DB by name in the action) rather than
 * UUIDs, since that's what a human-edited roster spreadsheet contains.
 */
export const staffCsvRowSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100, 'First name is too long'),
  surname: z.string().min(1, 'Surname is required').max(100, 'Surname is too long'),
  email: z.string().email('Not a valid email address').min(1, 'Email is required'),
  role: z.enum(['staff', 'hr', 'md', 'admin'], {
    message: 'Role must be one of: staff, hr, md, admin',
  }),
  department: z.string().min(1, 'Department is required'),
  level: z.string().min(1, 'Level is required'),
})

/** A CSV import in one go is capped as a sanity check against a wrong-file paste, not a real scaling limit. */
export const MAX_BULK_IMPORT_ROWS = 1000

// Inferred types for use in actions and forms
export type CreateStaffInput = z.infer<typeof createStaffSchema>
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>
export type DeactivateStaffInput = z.infer<typeof deactivateStaffSchema>
export type StaffCsvRow = z.infer<typeof staffCsvRowSchema>
