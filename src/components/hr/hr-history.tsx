/**
 * "Recently Processed" — HR's own decision history (forwarded to MD or
 * returned for revision). Its own page + sidebar entry (`/hr/history`),
 * split out of the Review Queue per todays-task.md. Server component: pure
 * display, data fetched once in hr/history/page.tsx.
 */

import { formatDate, usdToNgn } from '@/lib/utils/formatting'
import { StatusBadge } from '@/components/ui/status-badge'
import { Money } from '@/components/ui/money'
import type { TravelRequestForMD } from '@/types/database'

function staffName(row: { staff: { first_name: string | null; surname: string | null; email: string } | null }): string {
  if (!row.staff) return 'Unknown staff'
  return [row.staff.first_name, row.staff.surname].filter(Boolean).join(' ') || row.staff.email
}

function decisionReason(row: TravelRequestForMD): string | null {
  const decisions = (row.approvals ?? []).filter(
    (a) => a.status === 'hr_approved' || a.status === 'hr_rejected'
  )
  if (decisions.length === 0) return null
  const latest = [...decisions].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0]
  return latest?.reason ?? null
}

function HistoryRow({ row }: { row: TravelRequestForMD }) {
  const reason = decisionReason(row)
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-gray-900">
            {row.origin} → {row.destination}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {staffName(row)} · {row.staff?.department?.name ?? 'Unassigned'}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {formatDate(row.depart_date)} – {formatDate(row.return_date)}
          </p>
        </div>
        <div className="text-right">
          <StatusBadge status={row.status} />
          <div className="mt-1">
            <Money
              ngn={row.final_cost != null && row.locked_fx_rate != null ? usdToNgn(row.final_cost, row.locked_fx_rate) : null}
              usd={row.final_cost}
              align="right"
            />
          </div>
        </div>
      </div>
      {reason && row.status === 'hr_rejected' && (
        <p className="mt-2 text-sm text-gray-600">
          Reason: <span className="italic">“{reason}”</span>
        </p>
      )}
    </div>
  )
}

export function HRHistory({ history }: { history: TravelRequestForMD[] }) {
  if (history.length === 0) {
    return <p className="text-sm text-gray-500">Forwarded and rejected requests will appear here.</p>
  }

  return (
    <div className="space-y-3">
      {history.map((row) => (
        <HistoryRow key={row.id} row={row} />
      ))}
    </div>
  )
}
