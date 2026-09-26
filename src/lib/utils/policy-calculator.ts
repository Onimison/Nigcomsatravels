/**
 * The travel-policy calculator — PRD §8, implemented exactly.
 *
 * FR-11: "One shared calculation prices a single traveller and is the only
 * place this arithmetic exists — used identically for the staff preview,
 * the stored amount, and HR's live recalculation." `priceTraveller()` below
 * is that one place: the staff form calls it client-side against data
 * fetched once on page load (NFR Performance — no network round-trip per
 * keystroke), and `submitTravelRequestV2`/`resubmitTravelRequestV2` call the
 * exact same function server-side against a fresh DB read, because FR-12
 * says a client-supplied figure is never trusted or stored.
 */

import type { GradeBand, PolicySnapshot, TravelMode, TripType } from '@/types/database'

export interface PolicyDefaults {
  transportAirEachWay: number
  transportRoadEachWay: number
  airportTaxiPerLeg: number
  /** City names paid at 100% coverage for DTA/local running — everything else is 75% (§8). */
  fullCoverageCities: string[]
}

/** The tier the *destination* sits in — "the one the traveller is in" (§8). */
export function coveragePercentFor(destinationCity: string, defaults: PolicyDefaults): 100 | 75 {
  const normalized = destinationCity.trim().toLowerCase()
  const isFullCoverage = defaults.fullCoverageCities.some((city) => city.trim().toLowerCase() === normalized)
  return isFullCoverage ? 100 : 75
}

/** One-way pays for a single leg; return pays for both (§8 — DTA/local running are never scaled by this). */
export function legsFor(tripType: TripType): 1 | 2 {
  return tripType === 'one_way' ? 1 : 2
}

export interface TravellerPriceInput {
  gradeBand: GradeBand | null
  days: number
  coveragePercent: 100 | 75
  mode: TravelMode
  tripType: TripType
  defaults: PolicyDefaults
  /** HR's per-traveller override (FR-16) — wins over the computed flat default when set. */
  transportOverride?: number | null
  airportTaxiOverride?: number | null
}

export interface TravellerPriceResult {
  isUnmapped: boolean
  dtaRateUsed: number | null
  localRunningRateUsed: number | null
  dtaAmount: number | null
  localRunningAmount: number | null
  transportAmount: number
  airportTaxiAmount: number
  /** Null exactly when `isUnmapped` — FR-13's hard refusal, never a defaulted zero. */
  travellerTotal: number | null
}

/**
 * Prices one traveller. `gradeBand: null` is FR-13's exhaustive-mapping
 * safeguard — an unmapped designation must refuse DTA/local running rather
 * than default to the lowest band or to zero. Transport and airport taxi
 * never depend on designation, so they're always computable.
 */
export function priceTraveller(input: TravellerPriceInput): TravellerPriceResult {
  const { gradeBand, days, coveragePercent, mode, tripType, defaults, transportOverride, airportTaxiOverride } = input
  const legs = legsFor(tripType)

  const flatTransport = mode === 'air' ? defaults.transportAirEachWay : defaults.transportRoadEachWay
  const transportAmount = transportOverride ?? flatTransport * legs
  const flatTaxi = mode === 'air' ? defaults.airportTaxiPerLeg * legs : 0
  const airportTaxiAmount = airportTaxiOverride ?? flatTaxi

  if (!gradeBand) {
    return {
      isUnmapped: true,
      dtaRateUsed: null,
      localRunningRateUsed: null,
      dtaAmount: null,
      localRunningAmount: null,
      transportAmount,
      airportTaxiAmount,
      travellerTotal: null,
    }
  }

  const dtaRateUsed = coveragePercent === 100 ? gradeBand.dta_per_day_100 : gradeBand.dta_per_day_75
  const localRunningRateUsed =
    coveragePercent === 100 ? gradeBand.local_running_per_day_100 : gradeBand.local_running_per_day_75

  const dtaAmount = dtaRateUsed * days
  const localRunningAmount = localRunningRateUsed * days

  return {
    isUnmapped: false,
    dtaRateUsed,
    localRunningRateUsed,
    dtaAmount,
    localRunningAmount,
    transportAmount,
    airportTaxiAmount,
    travellerTotal: dtaAmount + localRunningAmount + transportAmount + airportTaxiAmount,
  }
}

/** Inclusive day count — "3 days, 15–17 Sep" (FR-7). Paid in full on both travel days regardless of trip type (confirmed, §1). */
export function inclusiveDayCount(departDate: string, returnDate: string): number | null {
  if (!departDate || !returnDate) return null
  const ms = new Date(returnDate).getTime() - new Date(departDate).getTime()
  if (Number.isNaN(ms) || ms < 0) return null
  return Math.floor(ms / 86_400_000) + 1
}

/** Sum of every traveller's total. Null the moment any traveller is unmapped — never show a partial figure as if it were authoritative (FR-13, travel_requests.total_ngn). */
export function requestTotal(travellerTotals: (number | null)[]): number | null {
  if (travellerTotals.some((t) => t === null)) return null
  return travellerTotals.reduce((sum: number, t) => sum + (t as number), 0)
}

/** Freezes the snapshot to write onto `travel_requests.policy_snapshot` (FR-14). */
export function buildPolicySnapshot(defaults: PolicyDefaults, coveragePercent: 100 | 75): PolicySnapshot {
  return {
    transport_air_each_way: defaults.transportAirEachWay,
    transport_road_each_way: defaults.transportRoadEachWay,
    airport_taxi_per_leg: defaults.airportTaxiPerLeg,
    full_coverage_cities: defaults.fullCoverageCities,
    coverage_percent: coveragePercent,
  }
}
