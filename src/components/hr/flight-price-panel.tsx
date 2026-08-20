/**
 * Always-visible Flight Price Reference widget for the HR dashboard — so HR
 * can sanity-check a number without opening each request individually
 * (UI_UX_DESIGN_PLAN.md §4). Server component: data is fetched once in
 * hr/page.tsx and passed straight through, no client interactivity needed.
 */

import { formatUSD, formatStaleness, isStale } from '@/lib/utils/formatting'
import type { RateReferenceWithLevel } from '@/types/database'

function PriceRow({ row }: { row: RateReferenceWithLevel }) {
  const stale = isStale(row.updated_at)
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{row.destination}</p>
        <p className="text-xs capitalize text-gray-500">{row.level?.name ?? '—'} · {row.mode}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
          {row.flight_estimate != null ? formatUSD(row.flight_estimate) : '—'}
        </p>
        <p className={`text-xs ${stale ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>
          {formatStaleness(row.updated_at)}
        </p>
      </div>
    </div>
  )
}

export function FlightPricePanel({ rates }: { rates: RateReferenceWithLevel[] }) {
  const domestic = rates.filter((r) => r.route_type === 'domestic' && r.flight_estimate != null)
  const international = rates.filter((r) => r.route_type === 'international' && r.flight_estimate != null)

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Flight Price Reference</h2>
      <p className="mt-1 text-sm text-gray-500">
        Current tracked flight prices — check here before overriding a suggested rate. Managed by Admin.
      </p>

      {domestic.length === 0 && international.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No flight prices tracked yet.</p>
      ) : (
        <div className="mt-3 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Domestic ({domestic.length})
            </h3>
            <div className="mt-1 divide-y divide-gray-100 dark:divide-gray-800">
              {domestic.length === 0 ? (
                <p className="py-2 text-sm text-gray-500">None on file.</p>
              ) : (
                domestic.map((row) => <PriceRow key={row.id} row={row} />)
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
                international.map((row) => <PriceRow key={row.id} row={row} />)
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
