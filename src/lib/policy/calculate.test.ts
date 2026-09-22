import { describe, expect, it } from 'vitest'
import {
  calculateTravellerCost,
  daysBetweenInclusive,
  resolveCoveragePercent,
  sumTravellerCosts,
  type PolicyDefaults,
} from './calculate'

const POLICY: PolicyDefaults = {
  airFarePerLeg: 150_000,
  roadFarePerLeg: 50_000,
  taxiPerLeg: 40_000,
}

const BANDS = {
  B1: { dtaPerDay: 60_000, localRunningPerDay: 18_000 },
  B2: { dtaPerDay: 40_000, localRunningPerDay: 12_000 },
  B3: { dtaPerDay: 30_000, localRunningPerDay: 9_000 },
  B4: { dtaPerDay: 15_000, localRunningPerDay: 4_500 },
} as const

/** REVISED_SCOPE.md §4.1 — the six worked examples, verbatim. */
describe('calculateTravellerCost — worked examples (REVISED_SCOPE.md §4.1)', () => {
  // REVISED_SCOPE.md's own total for this row (₦467,500) doesn't match the
  // sum of its own listed components (67,500 + 20,250 + 300,000 + 80,000 =
  // 467,750) — a ₦250 arithmetic typo in the source doc, repeated in the
  // multi-traveller table below. Asserting the correct sum of the
  // documented per-line figures, not the mistyped total.
  it('case 1 — B3, Abuja → Kano, air, 3 days, 75%', () => {
    const result = calculateTravellerCost({
      ...BANDS.B3,
      coveragePercent: 75,
      days: 3,
      mode: 'air',
      oneWay: false,
      policyDefaults: POLICY,
    })
    expect(result.dta).toBe(67_500)
    expect(result.localRunning).toBe(20_250)
    expect(result.transport).toBe(300_000)
    expect(result.airportTaxi).toBe(80_000)
    expect(result.total).toBe(467_750)
  })

  it('case 2 — B2, Gombe → Lagos, air, 2 days, 100%', () => {
    const result = calculateTravellerCost({
      ...BANDS.B2,
      coveragePercent: 100,
      days: 2,
      mode: 'air',
      oneWay: false,
      policyDefaults: POLICY,
    })
    expect(result.dta).toBe(80_000)
    expect(result.localRunning).toBe(24_000)
    expect(result.transport).toBe(300_000)
    expect(result.airportTaxi).toBe(80_000)
    expect(result.total).toBe(484_000)
  })

  it('case 3 — B4, Kaduna → Kano, road, 4 days, 75%', () => {
    const result = calculateTravellerCost({
      ...BANDS.B4,
      coveragePercent: 75,
      days: 4,
      mode: 'road',
      oneWay: false,
      policyDefaults: POLICY,
    })
    expect(result.dta).toBe(45_000)
    expect(result.localRunning).toBe(13_500)
    expect(result.transport).toBe(100_000)
    expect(result.airportTaxi).toBe(0)
    expect(result.total).toBe(158_500)
  })

  it('case 4 — B1, Abuja → Port Harcourt, air, 1 day, 100%', () => {
    const result = calculateTravellerCost({
      ...BANDS.B1,
      coveragePercent: 100,
      days: 1,
      mode: 'air',
      oneWay: false,
      policyDefaults: POLICY,
    })
    expect(result.dta).toBe(60_000)
    expect(result.localRunning).toBe(18_000)
    expect(result.transport).toBe(300_000)
    expect(result.airportTaxi).toBe(80_000)
    expect(result.total).toBe(458_000)
  })

  it('case 5 — B3, Lagos → Gombe, road, 3 days, 75%', () => {
    const result = calculateTravellerCost({
      ...BANDS.B3,
      coveragePercent: 75,
      days: 3,
      mode: 'road',
      oneWay: false,
      policyDefaults: POLICY,
    })
    expect(result.dta).toBe(67_500)
    expect(result.localRunning).toBe(20_250)
    expect(result.transport).toBe(100_000)
    expect(result.airportTaxi).toBe(0)
    expect(result.total).toBe(187_750)
  })

  it('case 6 — B3, Abuja → Kano, air, one-way, 3 days, 75%', () => {
    const result = calculateTravellerCost({
      ...BANDS.B3,
      coveragePercent: 75,
      days: 3,
      mode: 'air',
      oneWay: true,
      policyDefaults: POLICY,
    })
    expect(result.dta).toBe(67_500)
    expect(result.localRunning).toBe(20_250)
    expect(result.transport).toBe(150_000)
    expect(result.airportTaxi).toBe(40_000)
    expect(result.total).toBe(277_750)
  })
})

describe('calculateTravellerCost — one-way halves only journey components (§4.2)', () => {
  it('halves transport and airport taxi but leaves DTA/local running on the full day count', () => {
    const roundTrip = calculateTravellerCost({
      ...BANDS.B4,
      coveragePercent: 100,
      days: 5,
      mode: 'air',
      oneWay: false,
      policyDefaults: POLICY,
    })
    const oneWay = calculateTravellerCost({
      ...BANDS.B4,
      coveragePercent: 100,
      days: 5,
      mode: 'air',
      oneWay: true,
      policyDefaults: POLICY,
    })

    expect(oneWay.dta).toBe(roundTrip.dta)
    expect(oneWay.localRunning).toBe(roundTrip.localRunning)
    expect(oneWay.transport).toBe(roundTrip.transport / 2)
    expect(oneWay.airportTaxi).toBe(roundTrip.airportTaxi / 2)
  })
})

describe('calculateTravellerCost — airport taxi on road trips is always zero', () => {
  it('ignores an override and forces zero when mode is road', () => {
    const result = calculateTravellerCost({
      ...BANDS.B2,
      coveragePercent: 100,
      days: 2,
      mode: 'road',
      oneWay: false,
      policyDefaults: POLICY,
      airportTaxiOverride: 80_000,
    })
    expect(result.airportTaxi).toBe(0)
  })
})

describe('calculateTravellerCost — HR overrides win over policy defaults', () => {
  it('uses the override for transport and taxi when provided', () => {
    const result = calculateTravellerCost({
      ...BANDS.B3,
      coveragePercent: 75,
      days: 3,
      mode: 'air',
      oneWay: false,
      policyDefaults: POLICY,
      transportOverride: 350_000,
      airportTaxiOverride: 90_000,
    })
    expect(result.transport).toBe(350_000)
    expect(result.airportTaxi).toBe(90_000)
    expect(result.total).toBe(67_500 + 20_250 + 350_000 + 90_000)
  })
})

describe('calculateTravellerCost — B2@75% and B3@100% collide on purpose', () => {
  it('produces identical DTA and local running figures — a genuine property of the policy, not a bug', () => {
    const b2AtPartial = calculateTravellerCost({
      ...BANDS.B2,
      coveragePercent: 75,
      days: 1,
      mode: 'road',
      oneWay: false,
      policyDefaults: POLICY,
    })
    const b3AtFull = calculateTravellerCost({
      ...BANDS.B3,
      coveragePercent: 100,
      days: 1,
      mode: 'road',
      oneWay: false,
      policyDefaults: POLICY,
    })
    expect(b2AtPartial.dta).toBe(30_000)
    expect(b3AtFull.dta).toBe(30_000)
    expect(b2AtPartial.localRunning).toBe(9_000)
    expect(b3AtFull.localRunning).toBe(9_000)
  })
})

describe('calculateTravellerCost — same-day trip earns a full day', () => {
  it('a same-day return trip is 1 day, not 0', () => {
    const result = calculateTravellerCost({
      ...BANDS.B4,
      coveragePercent: 100,
      days: 1,
      mode: 'road',
      oneWay: false,
      policyDefaults: POLICY,
    })
    expect(result.dta).toBe(15_000)
    expect(result.localRunning).toBe(4_500)
  })
})

describe('sumTravellerCosts', () => {
  it('sums a multi-traveller memo — GM, Assistant Manager, Officer I, Abuja → Kano, air, 3 days, 75%', () => {
    const gm = calculateTravellerCost({
      ...BANDS.B2,
      coveragePercent: 75,
      days: 3,
      mode: 'air',
      oneWay: false,
      policyDefaults: POLICY,
    })
    const am = calculateTravellerCost({
      ...BANDS.B3,
      coveragePercent: 75,
      days: 3,
      mode: 'air',
      oneWay: false,
      policyDefaults: POLICY,
    })
    const officer1 = calculateTravellerCost({
      ...BANDS.B4,
      coveragePercent: 75,
      days: 3,
      mode: 'air',
      oneWay: false,
      policyDefaults: POLICY,
    })

    expect(gm.total).toBe(497_000)
    // See the note on the case-1 test above — the doc's per-traveller
    // subtotal for this row has the same ₦250 typo.
    expect(am.total).toBe(467_750)
    expect(officer1.total).toBe(423_875)
    expect(sumTravellerCosts([gm.total, am.total, officer1.total])).toBe(1_388_625)
  })

  it('returns 0 for an empty list', () => {
    expect(sumTravellerCosts([])).toBe(0)
  })
})

describe('daysBetweenInclusive', () => {
  it('depart Monday, return Wednesday is 3 days', () => {
    expect(daysBetweenInclusive('2026-09-14', '2026-09-16')).toBe(3)
  })

  it('same-day trip is 1 day', () => {
    expect(daysBetweenInclusive('2026-09-14', '2026-09-14')).toBe(1)
  })
})

describe('resolveCoveragePercent', () => {
  const FULL_CITIES = ['Lagos', 'Abuja', 'Port Harcourt']

  it('gives the full tier to Lagos, Abuja, Port Harcourt', () => {
    expect(resolveCoveragePercent('Lagos', FULL_CITIES, 100, 75)).toBe(100)
    expect(resolveCoveragePercent('abuja', FULL_CITIES, 100, 75)).toBe(100)
    expect(resolveCoveragePercent('Port Harcourt', FULL_CITIES, 100, 75)).toBe(100)
  })

  it('gives the partial tier to everywhere else', () => {
    expect(resolveCoveragePercent('Kano', FULL_CITIES, 100, 75)).toBe(75)
    expect(resolveCoveragePercent('Gombe', FULL_CITIES, 100, 75)).toBe(75)
  })

  it('is case-insensitive and trims whitespace', () => {
    expect(resolveCoveragePercent('  LAGOS  ', FULL_CITIES, 100, 75)).toBe(100)
  })
})
