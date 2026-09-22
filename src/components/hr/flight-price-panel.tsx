/**
 * Full Flight Price Reference table — so HR can sanity-check a number
 * without opening each request individually (UI_UX_DESIGN_PLAN.md §4).
 * Server component: data is fetched once in hr/rates/page.tsx and passed
 * straight through, no client interactivity needed. The page around this
 * component supplies the title/description via PageHeader.
 *
 * Domestic-only since the currency migration (REVISED_SCOPE.md M2) dropped
 * international rate_reference rows — no more domestic/international split.
 */

import { formatStaleness, isStale } from '@/lib/utils/formatting'
import { Money } from '@/components/ui/money'
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
        <Money ngn={row.flight_estimate} align="right" />
        <p className={`text-xs ${stale ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>
          {formatStaleness(row.updated_at)}
        </p>
      </div>
    </div>
  )
}

export function FlightPricePanel({ rates }: { rates: RateReferenceWithLevel[] }) {
  const tracked = rates.filter((r) => r.flight_estimate != null)

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        Flight Prices ({tracked.length})
      </h3>
      <div className="mt-1 divide-y divide-gray-100 dark:divide-gray-800">
        {tracked.length === 0 ? (
          <p className="py-2 text-sm text-gray-500">No flight prices tracked yet.</p>
        ) : (
          tracked.map((row) => <PriceRow key={row.id} row={row} />)
        )}
      </div>
    </section>
  )
}
