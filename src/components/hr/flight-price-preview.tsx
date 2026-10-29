/**
 * Compact local flight-price snapshot for the HR dashboard home. Legacy
 * level-specific records are collapsed into one route reference before they
 * reach this component, so the HR view never exposes staff-level pricing.
 */

import { formatNGN, formatStaleness, formatUSD, isStale, usdToNgn } from '@/lib/utils/formatting'
import { groupFlightPriceReferences } from '@/lib/utils/flight-price-reference'
import type { RateReference } from '@/types/database'

function PriceRange({ minimum, maximum, fxRate }: { minimum: number; maximum: number; fxRate: number | null }) {
  const samePrice = minimum === maximum
  const ngn = (value: number) => fxRate ? formatNGN(usdToNgn(value, fxRate)) : formatUSD(value)
  const usd = samePrice ? formatUSD(minimum) : `${formatUSD(minimum)} – ${formatUSD(maximum)}`

  return (
    <div className="text-right">
      <p className="text-sm font-semibold text-gray-900">{samePrice ? ngn(minimum) : `${ngn(minimum)} – ${ngn(maximum)}`}</p>
      <p className="text-xs text-gray-400">{fxRate ? `≈ ${usd}` : usd}</p>
    </div>
  )
}

export function FlightPricePreview({ rates, fxRate }: { rates: RateReference[]; fxRate: number | null }) {
  const recent = groupFlightPriceReferences(rates)
    .slice(0, 6)

  if (recent.length === 0) {
    return <p className="text-sm text-gray-500">No flight prices tracked yet.</p>
  }

  return (
    <div className="divide-y divide-gray-100">
      {recent.map((row) => {
        const stale = isStale(row.updated_at)
        return (
          <div key={row.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm font-medium text-gray-900">{row.destination}</p>
              <p className="text-xs capitalize text-gray-500">{row.route_type} · {row.mode ?? 'air'}</p>
            </div>
            <div>
              <PriceRange minimum={row.minimum} maximum={row.maximum} fxRate={fxRate} />
              <p className={`text-xs text-right ${stale ? 'font-medium text-amber-600' : 'text-gray-400'}`}>
                {formatStaleness(row.updated_at)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
