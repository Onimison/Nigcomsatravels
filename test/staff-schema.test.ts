import { describe, expect, it } from 'vitest'
import { createStaffSchema, staffCsvRowSchema } from '@/lib/validations/staff.schema'

const requiredStaffFields = {
  email: 'ada.okafor@nigcomsat.gov.ng',
  first_name: 'Ada',
  surname: 'Okafor',
  role: 'staff' as const,
  department_id: '550e8400-e29b-41d4-a716-446655440000',
  designation_id: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
}

describe('staff administration validation', () => {
  it('requires a career when adding staff', () => {
    expect(createStaffSchema.safeParse(requiredStaffFields).success).toBe(false)
    expect(createStaffSchema.safeParse({ ...requiredStaffFields, cadre: 'Engineering' }).success).toBe(true)
  })

  it('requires a career in the bulk import roster', () => {
    expect(staffCsvRowSchema.safeParse({ email: requiredStaffFields.email }).success).toBe(false)
    expect(staffCsvRowSchema.safeParse({ email: requiredStaffFields.email, cadre: 'Engineering' }).success).toBe(true)
  })
})
