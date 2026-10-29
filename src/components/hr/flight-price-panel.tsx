/**
 * Full local Flight Price Reference table — so HR can sanity-check a route
 * price without opening each request individually. Legacy level-specific
 * records are shown as one range per destination and mode.
 * Server component: data is fetched once in hr/rates/page.tsx and passed
 * straight through, no client interactivity needed. The page around this
 * component supplies the title/description via PageHeader.
 */

import { formatNGN, formatStaleness, formatUSD, isStale, usdToNgn } from '@/lib/utils/formatting'
import { groupFlightPriceReferences, type FlightPriceReferenceRow } from '@/lib/utils/flight-price-reference'
import type { RateReference } from '@/types/database'

function PriceRange({ minimum, maximum, fxRate }: Pick<FlightPriceReferenceRow, 'minimum' | 'maximum'> & { fxRate: number | null }) {
  const samePrice = minimum === maximum
  const ngn = (value: number) => fxRate ? formatNGN(usdToNgn(value, fxRate)) : formatUSD(value)
  const usd = samePrice ? formatUSD(minimum) : `${formatUSD(minimum)} – ${formatUSD(maximum)}`

  return (
    <div className="text-right">
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        {samePrice ? ngn(minimum) : `${ngn(minimum)} – ${ngn(maximum)}`}
      </p>
      <p className="text-xs text-gray-400">{fxRate ? `≈ ${usd}` : usd}</p>
    </div>
  )
}

function PriceRow({ row, fxRate }: { row: FlightPriceReferenceRow; fxRate: number | null }) {
  const stale = isStale(row.updated_at)
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{row.destination}</p>
        <p className="text-xs capitalize text-gray-500">{row.route_type} · {row.mode ?? 'air'}</p>
      </div>
      <div>
        <PriceRange minimum={row.minimum} maximum={row.maximum} fxRate={fxRate} />
        <p className={`text-xs ${stale ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>
          {formatStaleness(row.updated_at)}
        </p>
      </div>
    </div>
  )
}

export function FlightPricePanel({ rates, fxRate }: { rates: RateReference[]; fxRate: number | null }) {
  const grouped = groupFlightPriceReferences(rates)
  const domestic = grouped.filter((r) => r.route_type === 'domestic')
  const international = grouped.filter((r) => r.route_type === 'international')

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      {domestic.length === 0 && international.length === 0 ? (
        <p className="text-sm text-gray-500">No flight prices tracked yet.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Domestic ({domestic.length})
            </h3>
            <div className="mt-1 divide-y divide-gray-100 dark:divide-gray-800">
              {domestic.length === 0 ? (
                <p className="py-2 text-sm text-gray-500">None on file.</p>
              ) : (
                domestic.map((row) => <PriceRow key={row.id} row={row} fxRate={fxRate} />)
              )}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              International ({international.length})
            </h3>
            <div className="mt-1 divide-y divide-gray-100 dark:divide-gray-800">
              {international.length === 0 ? (
                <p className="py-2 text-sm text-gray-500">None on file.</p>
              ) : (
                international.map((row) => <PriceRow key={row.id} row={row} fxRate={fxRate} />)
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
