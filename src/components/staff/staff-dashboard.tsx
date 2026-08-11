'use client'

/**
 * Staff Dashboard orchestrator — PRD Section 3.1
 *
 * Renders the Request to Travel form plus three read views built from a
 * single `getMyRequests()` fetch (done server-side in page.tsx):
 * - Ongoing Trip: an `approved` request whose date range covers today.
 * - Pending Requests: requests still moving (pending_hr, pending_md) or
 *   returned for revision (hr_rejected, md_rejected) — i.e. anything that
 *   isn't a terminal state yet.
 * - Travel History: every request, grouped by travel_group_id, so a
 *   reject → resubmit → approve chain reads as one story.
 */

import { useMemo, useState } from 'react'
import { TravelRequestForm, type ResubmitTarget } from './travel-request-form'
import { REQUEST_STATUS_COLORS, REQUEST_STATUS_LABELS } from '@/lib/utils/constants'
import { formatDate } from '@/lib/utils/formatting'
import type { RequestStatus, TravelRequest } from '@/types/database'

interface ApprovalInfo {
  status: string
  reason: string | null
  is_final: boolean
  timestamp: string
}

export type StaffRequestRow = TravelRequest & { approvals: ApprovalInfo[] | null }

const ACTIVE_STATUSES: RequestStatus[] = ['pending_hr', 'pending_md', 'hr_rejected', 'md_rejected']
const RESUBMITTABLE_STATUSES: RequestStatus[] = ['hr_rejected', 'md_rejected']

function latestReason(row: StaffRequestRow): string | null {
  if (!row.approvals || row.approvals.length === 0) return null
  const sorted = [...row.approvals].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
  return sorted[0]?.reason ?? null
}

function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${REQUEST_STATUS_COLORS[status]}`}>
      {REQUEST_STATUS_LABELS[status]}
    </span>
  )
}

function RequestCard({
  row,
  onResubmit,
  versionLabel,
}: {
  row: StaffRequestRow
  onResubmit?: (target: ResubmitTarget) => void
  versionLabel?: string
}) {
  const reason = latestReason(row)
  const canResubmit = RESUBMITTABLE_STATUSES.includes(row.status)

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
          </p>
        </div>
        <StatusBadge status={row.status} />
      </div>

      {reason && (row.status === 'hr_rejected' || row.status === 'md_rejected' || row.status === 'rejected_final') && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Reason: <span className="italic">“{reason}”</span>
        </p>
      )}

      {canResubmit && onResubmit && (
        <button
          type="button"
          onClick={() =>
            onResubmit({
              id: row.id,
              destination: row.destination,
              origin: row.origin,
              mode: row.mode,
              days: row.days,
              depart_date: row.depart_date,
              return_date: row.return_date,
              reason_for_travel: row.reason_for_travel,
              rejectionReason: reason,
            })
          }
          className="mt-3 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-950/40"
        >
          Resubmit
        </button>
      )}
    </div>
  )
}

export function StaffDashboard({ requests }: { requests: StaffRequestRow[] }) {
  const [resubmitTarget, setResubmitTarget] = useState<ResubmitTarget | null>(null)

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const ongoingTrip = requests.find(
    (r) => r.status === 'approved' && r.depart_date <= today && today <= r.return_date
  )

  const historyGroups = useMemo(() => {
    const groups = new Map<string, StaffRequestRow[]>()
    for (const row of requests) {
      const list = groups.get(row.travel_group_id) ?? []
      list.push(row)
      groups.set(row.travel_group_id, list)
    }
    return [...groups.values()]
      .map((versions) => versions.sort((a, b) => a.created_at.localeCompare(b.created_at)))
      .sort((a, b) => b[b.length - 1].created_at.localeCompare(a[a.length - 1].created_at))
  }, [requests])

  // Only the latest version of each trip can be "pending" on something — earlier
  // rejected versions in the same group are superseded once resubmitted, and stay
  // in Travel History rather than cluttering the actionable list here.
  const pendingRequests = historyGroups
    .map((versions) => versions[versions.length - 1])
    .filter((r) => ACTIVE_STATUSES.includes(r.status))

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          {resubmitTarget ? 'Resubmit Request' : 'Request to Travel'}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Fill in your travel details to submit a new request.
        </p>
        <div className="mt-4">
          <TravelRequestForm
            key={resubmitTarget?.id ?? 'new'}
            resubmitTarget={resubmitTarget}
            onCancelResubmit={() => setResubmitTarget(null)}
          />
        </div>
      </section>

      {ongoingTrip && (
        <section className="rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-900/50 dark:bg-green-950/30">
          <h2 className="text-lg font-semibold text-green-900 dark:text-green-300">Ongoing Trip</h2>
          <p className="mt-2 text-sm text-green-800 dark:text-green-400">
            You are currently on approved travel to {ongoingTrip.destination}, returning{' '}
            {formatDate(ongoingTrip.return_date)}.
          </p>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Pending Requests</h2>
        {pendingRequests.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No pending requests yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {pendingRequests.map((row) => (
              <RequestCard key={row.id} row={row} onResubmit={setResubmitTarget} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Travel History</h2>
        {historyGroups.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Your past travel requests will appear here.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {historyGroups.map((versions) => (
              <div key={versions[0].travel_group_id} className="space-y-2">
                {versions.map((row, i) => (
                  <RequestCard
                    key={row.id}
                    row={row}
                    onResubmit={versions.length - 1 === i ? setResubmitTarget : undefined}
                    versionLabel={versions.length > 1 ? `Attempt ${i + 1} of ${versions.length}` : undefined}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
