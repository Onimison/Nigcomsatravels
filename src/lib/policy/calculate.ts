/**
 * The travel-cost calculator — REVISED_SCOPE.md §4.
 *
 * One pure function, no Supabase import, prices exactly one traveller.
 * Consumed identically by the staff form's live preview, the server-side
 * insert, and HR's live recalculation — that's what stops the preview and
 * the saved figure from ever disagreeing. A memo with several travellers
 * calls this once per traveller and sums the results; that's what keeps
 * the multi-traveller case from becoming a second code path.
 *
 * Coverage, band rates, and policy defaults are all resolved by the caller
 * (DB lookups) and passed in as plain numbers — this function does no I/O.
 */

export type TravelMode = 'air' | 'road'

export interface PolicyDefaults {
  /** Naira, one leg. */
  airFarePerLeg: number
  roadFarePerLeg: number
  taxiPerLeg: number
}

export interface CalculateTravellerCostInput {
  /** Band's 100%-coverage day rates — the 75% figure is derived here, not stored. */
  dtaPerDay: number
  localRunningPerDay: number
  /** 100 or 75 (or any coverage_tiers.percent value). */
  coveragePercent: number
  /** Inclusive day count: (return date − depart date) + 1. HR's days_approved wins when set. */
  days: number
  mode: TravelMode
  oneWay: boolean
  policyDefaults: PolicyDefaults
  /** HR override for transport, in Naira. Falls back to the policy default when omitted. */
  transportOverride?: number | null
  /** HR override for airport taxi, in Naira. Falls back to the policy default when omitted. */
  airportTaxiOverride?: number | null
}

export interface CalculateTravellerCostResult {
  dta: number
  localRunning: number
  transport: number
  airportTaxi: number
  total: number
}

/**
 * Prices one traveller on one trip.
 *
 * DTA and local running are per-day living costs and are NOT halved by a
 * one-way trip — a traveller who spends three days in Kano eats and moves
 * around for three days exactly as a return traveller does (§4.2). Only the
 * journey components — transport and airport taxi — are halved, because
 * there's only one leg to pay for.
 *
 * Airport taxi is zero on a road trip by construction (§1.7/decision 11):
 * there is no airport to be taxied from.
 */
export function calculateTravellerCost(input: CalculateTravellerCostInput): CalculateTravellerCostResult {
  const {
    dtaPerDay,
    localRunningPerDay,
    coveragePercent,
    days,
    mode,
    oneWay,
    policyDefaults,
    transportOverride,
    airportTaxiOverride,
  } = input

  const coverage = coveragePercent / 100
  const legs = oneWay ? 1 : 2

  const dta = dtaPerDay * coverage * days
  const localRunning = localRunningPerDay * coverage * days

  const transportDefault = (mode === 'air' ? policyDefaults.airFarePerLeg : policyDefaults.roadFarePerLeg) * legs
  const transport = transportOverride ?? transportDefault

  const airportTaxiDefault = mode === 'air' ? policyDefaults.taxiPerLeg * legs : 0
  const airportTaxi = mode === 'road' ? 0 : (airportTaxiOverride ?? airportTaxiDefault)

  return {
    dta,
    localRunning,
    transport,
    airportTaxi,
    total: dta + localRunning + transport + airportTaxi,
  }
}

/** Sums a memo's per-traveller totals into the request total (§4: "request = Σ traveller"). */
export function sumTravellerCosts(totals: CalculateTravellerCostResult['total'][]): number {
  return totals.reduce((sum, total) => sum + total, 0)
}

/** Inclusive day count: depart Monday, return Wednesday is 3 days, not 2. */
export function daysBetweenInclusive(departDate: string, returnDate: string): number {
  const start = new Date(departDate)
  const end = new Date(returnDate)
  const ms = end.getTime() - start.getTime()
  return Math.round(ms / 86_400_000) + 1
}

/**
 * Coverage is destination-driven: a city listed in `destination_coverage`
 * gets the `full` tier's percent; anything else defaults to `partial` — the
 * discount rate itself is data (coverage_tiers), never a hardcoded number.
 */
export function resolveCoveragePercent(
  destinationCity: string,
  fullCoverageCities: readonly string[],
  fullPercent: number,
  partialPercent: number
): number {
  const isFull = fullCoverageCities.some((city) => city.toLowerCase() === destinationCity.trim().toLowerCase())
  return isFull ? fullPercent : partialPercent
}
