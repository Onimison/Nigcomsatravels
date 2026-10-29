import { describe, expect, it } from 'vitest'
import { buildCostingMemoSubject, renderCostingMemoBody } from '@/lib/erp/costing-memo'

describe('costing memo renderer', () => {
  it('builds a normalized subject from the destination and reason', () => {
    expect(buildCostingMemoSubject('Kano', 'official inspection')).toBe('TRIP TO KANO TO OFFICIAL INSPECTION')
    expect(buildCostingMemoSubject('Kano', 'Trip to Kano to official inspection.')).toBe('TRIP TO KANO TO OFFICIAL INSPECTION')
  })

  it('renders DTA and HR author details without introducing per diem', () => {
    const body = renderCostingMemoBody({
      sourceMemoNumber: 'NCSL/HR/001',
      authorName: 'Ada Okafor',
      authorTitle: 'Human Resources Officer',
      tripOrigin: 'Abuja',
      tripDestination: 'Kano',
      departureDate: '2026-10-19',
      returnDate: '2026-10-21',
      authorizedAt: '2026-10-18T10:00:00.000Z',
      days: 3,
      tripType: 'return',
      mode: 'air',
      reasonForTravel: 'official inspection',
      coveragePercent: 75,
      department: null,
      addressedTo: 'Managing Director / Chief Executive Officer',
      dueDate: null,
      approvedBy: null,
      lines: [
        { line_number: 10000, description: 'DTA of 75%', quantity: '3.00', unit_price: '22500.00', amount: '67500.00' },
      ],
      totalAmount: '67500.00',
      hrNote: 'Checked against the approved travel details.',
    })

    expect(body).toContain('Source HOD memo: NCSL/HR/001')
    expect(body).toContain('DTA of 75%')
    expect(body).toContain('Ada Okafor')
    expect(body).toContain('Human Resources Officer')
    expect(body).not.toMatch(/per diem/i)
  })
})
