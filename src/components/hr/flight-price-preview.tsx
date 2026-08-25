/**
 * Compact "latest prices" snapshot for the HR dashboard home — the most
 * recently-updated rate rows, flat (no domestic/international split). The
 * full categorized table lives on /hr/rates (`FlightPricePanel`, unchanged).
 */

import { formatStaleness, isStale, usdToNgn } from '@/lib/utils/formatting'
import { Money } from '@/components/ui/money'
import type { RateReferenceWithLevel } from '@/types/database'

export function FlightPricePreview({ rates, fxRate }: { rates: RateReferenceWithLevel[]; fxRate: number | null }) {
  const recent = [...rates]
    .filter((r) => r.flight_estimate != null)
    .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime())
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
              <p className="text-xs capitalize text-gray-500">{row.level?.name ?? '—'} · {row.mode}</p>
            </div>
            <div className="text-right">
              <Money
                ngn={row.flight_estimate != null && fxRate ? usdToNgn(row.flight_estimate, fxRate) : null}
                usd={row.flight_estimate}
                align="right"
              />
              <p className={`text-xs ${stale ? 'font-medium text-amber-600' : 'text-gray-400'}`}>
                {formatStaleness(row.updated_at)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
