/**
 * Full local Flight Price Reference table — so HR can sanity-check a route
 * price without opening each request individually. Legacy level-specific
 * records are shown as one range per destination and mode.
 * Server component: data is fetched once in hr/rates/page.tsx and passed
 * straight through, no client interactivity needed. The page around this
 * component supplies the title/description via PageHeader.
 */

import { formatNGN, formatUSD, usdToNgn } from '@/lib/utils/formatting'
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
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{row.destination}</p>
        <p className="text-xs text-gray-500">Domestic air</p>
      </div>
      <div>
        <PriceRange minimum={row.minimum} maximum={row.maximum} fxRate={fxRate} />
        <p className="text-right text-xs text-gray-400">Reference fare</p>
      </div>
    </div>
  )
}

export function FlightPricePanel({ rates, fxRate }: { rates: RateReference[]; fxRate: number | null }) {
  const domestic = groupFlightPriceReferences(rates)
    .filter((r) => r.route_type === 'domestic' && r.mode === 'air')

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      {domestic.length === 0 ? (
        <p className="text-sm text-gray-500">No flight prices tracked yet.</p>
      ) : (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Abuja-origin domestic air references ({domestic.length})
          </h3>
          <div className="mt-1 divide-y divide-gray-100 dark:divide-gray-800">
            {domestic.map((row) => <PriceRow key={row.id} row={row} fxRate={fxRate} />)}
          </div>
        </div>
      )}
    </section>
  )
}
