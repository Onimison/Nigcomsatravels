import { describe, expect, it } from 'vitest'
import { withdrawTravelRequestSchema } from '@/lib/validations/travel-request-v2.schema'

describe('staff request withdrawal validation', () => {
  it('requires a request id and a reason', () => {
    expect(
      withdrawTravelRequestSchema.safeParse({
        request_id: '550e8400-e29b-41d4-a716-446655440000',
        reason: 'I entered the wrong travel dates',
      }).success,
    ).toBe(true)
  })

  it('rejects an empty or overlong reason', () => {
    const request_id = '550e8400-e29b-41d4-a716-446655440000'
    expect(withdrawTravelRequestSchema.safeParse({ request_id, reason: '   ' }).success).toBe(false)
    expect(withdrawTravelRequestSchema.safeParse({ request_id, reason: 'x'.repeat(501) }).success).toBe(false)
  })
})
