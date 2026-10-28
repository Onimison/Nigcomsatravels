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
  cadre: z.string().trim().min(1).max(100).optional(),
  role: z.enum(['staff', 'hr', 'md', 'admin'], {
    message: 'Please select a valid role',
  }),
  department_id: z.string().uuid('Please select a department'),
  /**
   * The DTA calculator prices from this NIGCOMSAT designation mapping.
   * `level_id` remains optional for legacy rate-reference records only.
   */
  designation_id: z.string().uuid('Please select a designation'),
  level_id: z.string().uuid('Please select a level').optional(),
  erp_employee_number: z.string().trim().min(1, 'ERP employee number cannot be empty').max(50).optional(),
})

/** Schema for editing an existing staff member */
export const updateStaffSchema = createStaffSchema.partial().extend({
  id: z.string().uuid(),
  active: z.boolean().optional(),
  /** Nullable to support clearing a mis-assigned designation (FR-13/FR-24). */
  designation_id: z.string().uuid().nullable().optional(),
  cadre: z.string().trim().min(1).max(100).nullable().optional(),
  erp_employee_number: z.string().trim().min(1).max(50).nullable().optional(),
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
  first_name: z.string().trim().max(100, 'First name is too long').optional(),
  surname: z.string().trim().max(100, 'Surname is too long').optional(),
  email: z.string().email('Not a valid email address').min(1, 'Email is required'),
  role: z.enum(['staff', 'hr', 'md', 'admin'], {
    message: 'Role must be one of: staff, hr, md, admin',
  }).optional(),
  department: z.string().trim().min(1, 'Department cannot be empty').optional(),
  level: z.string().trim().min(1, 'Level cannot be empty').optional(),
  /** Employment cadre from the nominal roll, such as Engineer or Finance. */
  cadre: z.string().trim().min(1, 'Cadre cannot be empty').max(100).optional(),
  /** Rank/designation used by the DTA calculator, such as Manager or Officer II. */
  designation: z.string().trim().min(1, 'Designation cannot be empty').max(100).optional(),
  erp_employee_number: z.string().trim().min(1).max(50).optional(),
}).superRefine((row, context) => {
  if (!row.designation && !row.cadre) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['designation'], message: 'Designation is required for DTA pricing' })
  }
})

/** A CSV import in one go is capped as a sanity check against a wrong-file paste, not a real scaling limit. */
export const MAX_BULK_IMPORT_ROWS = 1000

// Inferred types for use in actions and forms
export type CreateStaffInput = z.infer<typeof createStaffSchema>
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>
export type DeactivateStaffInput = z.infer<typeof deactivateStaffSchema>
export type StaffCsvRow = z.infer<typeof staffCsvRowSchema>
