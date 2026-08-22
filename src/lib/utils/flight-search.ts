/**
 * Builds an outbound "check live fares" link for a trip.
 *
 * This is the zero-dependency half of the flight-price work: no API key, no
 * scheduled fetch, no cache, and therefore nothing that can go stale or
 * return a wrong number. It saves HR the part they actually complained about
 * — retyping route and dates into a search box — while leaving the number
 * itself to the source of truth.
 *
 * When cached quotes land later they render *alongside* this link, never
 * instead of it: a quote is evidence with a timestamp, and HR still needs a
 * one-tap way to confirm it before committing an amount.
 */

/** Cabin as stored on `levels.flight_class`. Anything else is ignored rather than guessed at. */
const CABIN_LABELS: Record<string, string> = {
  economy: 'economy class',
  premium_economy: 'premium economy',
  business: 'business class',
  first: 'first class',
}

export interface FlightSearchParams {
  /** IATA code from the joined airports row — preferred, unambiguous. */
  originCode?: string | null
  /** Free-text origin from travel_requests. Used only when there's no IATA code. */
  originCity?: string | null
  destinationCode?: string | null
  destinationCity?: string | null
  /** ISO date (YYYY-MM-DD). */
  departDate?: string | null
  /** ISO date. Omit or null for a one-way search. */
  returnDate?: string | null
  /** `levels.flight_class` for the requesting staff member's level. */
  cabin?: string | null
}

/** Prefer the IATA code; fall back to the typed city; give up rather than guess. */
function endpoint(code: string | null | undefined, city: string | null | undefined): string | null {
  const trimmedCode = code?.trim()
  if (trimmedCode) return trimmedCode.toUpperCase()
  const trimmedCity = city?.trim()
  return trimmedCity || null
}

/**
 * True when both ends of the trip are the same place — a data-entry error
 * upstream, not something to search for.
 *
 * Compares codes and cities as two independent pairs rather than comparing
 * the resolved endpoints, so a trip only one of whose ends resolved to an
 * IATA code is still caught. That depends on callers passing the *canonical*
 * city (`airports.city`) when the airport resolved, falling back to the raw
 * text only when it didn't — this function has no code→city map of its own
 * and cannot tell that "ABV" and "Abuja" are the same place.
 */
function sameEndpoint(params: FlightSearchParams): boolean {
  const eq = (a: string | null | undefined, b: string | null | undefined) => {
    const left = a?.trim().toLowerCase()
    const right = b?.trim().toLowerCase()
    return Boolean(left && right && left === right)
  }
  return (
    eq(params.originCode, params.destinationCode) ||
    eq(params.originCity, params.destinationCity)
  )
}

/**
 * Returns a Google Flights search URL, or `null` when the trip can't be
 * identified well enough to search for — missing endpoint or missing
 * departure date. Callers must handle the null: render nothing, or a plain
 * "check manually" note. Never fabricate a partial search.
 */
export function buildFlightSearchUrl(params: FlightSearchParams): string | null {
  const from = endpoint(params.originCode, params.originCity)
  const to = endpoint(params.destinationCode, params.destinationCity)
  const depart = params.departDate?.trim()

  if (!from || !to || !depart) return null
  if (sameEndpoint(params)) return null

  const parts = [`Flights from ${from} to ${to} on ${depart}`]

  const returnDate = params.returnDate?.trim()
  if (returnDate && returnDate !== depart) parts.push(`through ${returnDate}`)

  const cabin = params.cabin ? CABIN_LABELS[params.cabin.trim().toLowerCase()] : undefined
  if (cabin) parts.push(cabin)

  return `https://www.google.com/travel/flights?q=${encodeURIComponent(parts.join(' '))}`
}

/** Human-readable route for the card label, e.g. "LOS → ABV" or "Lagos → Abuja". */
export function formatRoute(params: FlightSearchParams): string | null {
  const from = endpoint(params.originCode, params.originCity)
  const to = endpoint(params.destinationCode, params.destinationCity)
  if (!from || !to) return null
  return `${from} → ${to}`
}

/** Display label for a cabin, e.g. "Business class". Null when the level has none set. */
export function formatCabin(cabin: string | null | undefined): string | null {
  if (!cabin) return null
  const label = CABIN_LABELS[cabin.trim().toLowerCase()]
  if (!label) return null
  return label.charAt(0).toUpperCase() + label.slice(1)
}
