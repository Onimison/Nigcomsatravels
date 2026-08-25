/**
 * Full Flight Price Reference table — so HR can sanity-check a number
 * without opening each request individually (UI_UX_DESIGN_PLAN.md §4).
 * Server component: data is fetched once in hr/rates/page.tsx and passed
 * straight through, no client interactivity needed. The page around this
 * component supplies the title/description via PageHeader.
 */

import { formatStaleness, isStale, usdToNgn } from '@/lib/utils/formatting'
import { Money } from '@/components/ui/money'
import type { RateReferenceWithLevel } from '@/types/database'

function PriceRow({ row, fxRate }: { row: RateReferenceWithLevel; fxRate: number | null }) {
  const stale = isStale(row.updated_at)
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{row.destination}</p>
        <p className="text-xs capitalize text-gray-500">{row.level?.name ?? '—'} · {row.mode}</p>
      </div>
      <div className="text-right">
        <Money
          ngn={row.flight_estimate != null && fxRate ? usdToNgn(row.flight_estimate, fxRate) : null}
          usd={row.flight_estimate}
          align="right"
        />
        <p className={`text-xs ${stale ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>
          {formatStaleness(row.updated_at)}
        </p>
      </div>
    </div>
  )
}

export function FlightPricePanel({ rates, fxRate }: { rates: RateReferenceWithLevel[]; fxRate: number | null }) {
  const domestic = rates.filter((r) => r.route_type === 'domestic' && r.flight_estimate != null)
  const international = rates.filter((r) => r.route_type === 'international' && r.flight_estimate != null)

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
