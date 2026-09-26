/**
 * Shared request card — extracted from staff-dashboard.tsx so it can be
 * reused across the overview, /staff/pending, and /staff/history pages
 * (UI_UX_DESIGN_PLAN.md §3.2).
 */

import { StatusBadge } from '@/components/ui/status-badge'
import { Money } from '@/components/ui/money'
import { formatDate } from '@/lib/utils/formatting'
import type { RequestStatus, TravelRequest } from '@/types/database'

interface ApprovalInfo {
  status: string
  reason: string | null
  is_final: boolean
  timestamp: string
}

/** Traveller row shape as embedded by getMyRequests() — enough for a count + unmapped flag, not the full breakdown. */
interface TravelerSummary {
  staff_id: string
  is_requester: boolean
  designation_name: string
  is_unmapped: boolean
  traveller_total: number | null
}

export type StaffRequestRow = TravelRequest & {
  approvals: ApprovalInfo[] | null
  /** Null on pre-Phase-0 rows (queried before this column existed on the join). Empty array for a Phase-0 row somehow missing its own requester row. */
  request_travelers: TravelerSummary[] | null
}

export const RESUBMITTABLE_STATUSES: RequestStatus[] = ['hr_rejected', 'md_rejected']

export function latestReason(row: StaffRequestRow): string | null {
  if (!row.approvals || row.approvals.length === 0) return null
  const sorted = [...row.approvals].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
  return sorted[0]?.reason ?? null
}

export function RequestCard({
  row,
  onResubmit,
  versionLabel,
}: {
  row: StaffRequestRow
  /** Called with the request id to resubmit — the /staff/request page re-fetches full details server-side. */
  onResubmit?: (id: string) => void
  versionLabel?: string
}) {
  const reason = latestReason(row)
  const canResubmit = RESUBMITTABLE_STATUSES.includes(row.status) && Boolean(row.memo_number)
  const travelerCount = row.request_travelers?.length ?? 0
  const hasUnmapped = row.request_travelers?.some((t) => t.is_unmapped) ?? false

  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-50">
            {row.origin} → {row.destination}
            {versionLabel && (
              <span className="ml-2 text-xs font-normal text-gray-400">{versionLabel}</span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {formatDate(row.depart_date)} – {formatDate(row.return_date)} · {row.mode}
            {row.memo_number && <> · Memo {row.memo_number}</>}
            {travelerCount > 1 && <> · {travelerCount} travellers</>}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge status={row.status} />
          {row.memo_number && (
            <Money
              ngn={row.total_ngn}
              size="sm"
              layout="inline"
              emptyLabel={hasUnmapped ? 'Pending HR pricing' : '—'}
            />
          )}
        </div>
      </div>

      {reason && (row.status === 'hr_rejected' || row.status === 'md_rejected' || row.status === 'rejected_final') && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Reason: <span className="italic">“{reason}”</span>
        </p>
      )}

      {canResubmit && onResubmit && (
        <button
          type="button"
          onClick={() => onResubmit(row.id)}
          className="mt-3 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-950/40"
        >
          Resubmit
        </button>
      )}
    </div>
  )
}
