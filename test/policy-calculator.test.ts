import { describe, expect, it } from 'vitest'
import {
  inclusiveDayCount,
  priceTraveller,
  requestTotal,
  type PolicyDefaults,
} from '@/lib/utils/policy-calculator'
import type { GradeBand } from '@/types/database'

const defaults: PolicyDefaults = {
  transportAirEachWay: 150_000,
  transportRoadEachWay: 50_000,
  airportTaxiPerLeg: 40_000,
  fullCoverageCities: ['Lagos', 'Abuja', 'Port Harcourt'],
}

const band: GradeBand = {
  id: 'band-b3',
  code: 'B3',
  label: 'Manager',
  dta_per_day_100: 30_000,
  dta_per_day_75: 22_500,
  local_running_per_day_100: 9_000,
  local_running_per_day_75: 6_750,
}

describe('DTA calculator', () => {
  it('counts both travel dates inclusively', () => {
    expect(inclusiveDayCount('2026-10-19', '2026-10-21')).toBe(3)
  })

  it('halves only transport and airport taxi on a one-way air trip', () => {
    const result = priceTraveller({
      gradeBand: band,
      days: 3,
      coveragePercent: 75,
      mode: 'air',
      tripType: 'one_way',
      defaults,
    })

    expect(result.dtaAmount).toBe(67_500)
    expect(result.localRunningAmount).toBe(20_250)
    expect(result.transportAmount).toBe(150_000)
    expect(result.airportTaxiAmount).toBe(40_000)
    expect(result.travellerTotal).toBe(277_750)
  })

  it('refuses DTA pricing when a traveller is unmapped', () => {
    const result = priceTraveller({
      gradeBand: null,
      days: 2,
      coveragePercent: 100,
      mode: 'air',
      tripType: 'return',
      defaults,
    })

    expect(result.isUnmapped).toBe(true)
    expect(result.dtaAmount).toBeNull()
    expect(result.travellerTotal).toBeNull()
  })

  it('returns no request total when any traveller is unpriced', () => {
    expect(requestTotal([100_000, 200_000])).toBe(300_000)
    expect(requestTotal([100_000, null])).toBeNull()
  })
})
