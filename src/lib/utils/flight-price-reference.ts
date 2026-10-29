import type { RateReference, RouteType } from '@/types/database'

export interface FlightPriceReferenceRow {
  id: string
  destination: string
  mode: string | null
  route_type: RouteType
  minimum: number
  maximum: number
  updated_at: string | null
}

/**
 * The stored reference table can contain one fare per legacy level. The HR
 * reference is route-based, so those records are collapsed into one range
 * per destination and mode without exposing the level that supplied it.
 */
export function groupFlightPriceReferences(
  rows: Pick<RateReference, 'id' | 'destination' | 'mode' | 'route_type' | 'flight_estimate' | 'updated_at'>[],
): FlightPriceReferenceRow[] {
  const grouped = new Map<string, FlightPriceReferenceRow>()

  for (const row of rows) {
    if (row.flight_estimate == null || !Number.isFinite(row.flight_estimate)) continue

    const destination = row.destination.trim()
    const mode = row.mode?.trim().toLowerCase() || null
    const key = `${row.route_type}:${destination.toLowerCase()}:${mode ?? 'unspecified'}`
    const current = grouped.get(key)

    if (!current) {
      grouped.set(key, {
        id: key,
        destination,
        mode,
        route_type: row.route_type,
        minimum: row.flight_estimate,
        maximum: row.flight_estimate,
        updated_at: row.updated_at,
      })
      continue
    }

    current.minimum = Math.min(current.minimum, row.flight_estimate)
    current.maximum = Math.max(current.maximum, row.flight_estimate)
    if (new Date(row.updated_at ?? 0).getTime() > new Date(current.updated_at ?? 0).getTime()) {
      current.updated_at = row.updated_at
    }
  }

  return [...grouped.values()].sort((left, right) => {
    const dateDifference = new Date(right.updated_at ?? 0).getTime() - new Date(left.updated_at ?? 0).getTime()
    if (dateDifference !== 0) return dateDifference
    return left.destination.localeCompare(right.destination)
  })
}
