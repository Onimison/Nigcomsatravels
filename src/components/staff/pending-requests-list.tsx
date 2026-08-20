'use client'

/**
 * Full pending-requests list — /staff/pending. Extracted from the old
 * single-page staff-dashboard.tsx (UI_UX_DESIGN_PLAN.md §3.2).
 */

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { RequestCard, type StaffRequestRow } from './request-card'
import type { RequestStatus } from '@/types/database'

const ACTIVE_STATUSES: RequestStatus[] = ['pending_hr', 'pending_md', 'hr_rejected', 'md_rejected']

export function PendingRequestsList({ requests }: { requests: StaffRequestRow[] }) {
  const router = useRouter()

  // Only the latest version of each trip can be "pending" — earlier rejected
  // versions in the same group are superseded once resubmitted.
  const pendingRequests = useMemo(() => {
    const groups = new Map<string, StaffRequestRow[]>()
    for (const row of requests) {
      const list = groups.get(row.travel_group_id) ?? []
      list.push(row)
      groups.set(row.travel_group_id, list)
    }
    return [...groups.values()]
      .map((versions) => versions.sort((a, b) => a.created_at.localeCompare(b.created_at)))
      .map((versions) => versions[versions.length - 1])
      .filter((r) => ACTIVE_STATUSES.includes(r.status))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [requests])

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
        Pending Requests ({pendingRequests.length})
      </h2>
      <p className="mt-1 text-sm text-gray-500">Your active travel requests awaiting review.</p>
      {pendingRequests.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No pending requests right now.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {pendingRequests.map((row) => (
            <RequestCard
              key={row.id}
              row={row}
              onResubmit={(id) => router.push(`/staff/request?resubmit=${id}`)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
