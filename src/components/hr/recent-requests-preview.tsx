/**
 * Compact "what needs my attention" preview for the HR dashboard home
 * (todays-task.md). Read-only: the editable allowance-entry flow lives on
 * each request's own page (`/hr/requests/[id]`, `ReviewCard`), never on a
 * list. Takes the same `pending` array `hr/page.tsx` already fetches for
 * the stat tiles — no extra query.
 */

import { RequestRow } from '@/components/hr/request-row'
import type { TravelRequestForHR } from '@/types/database'

export function RecentRequestsPreview({ requests }: { requests: TravelRequestForHR[] }) {
  if (requests.length === 0) {
    return <p className="text-sm text-gray-500">No requests pending HR review. You&apos;re all caught up.</p>
  }

  return (
    <div className="divide-y divide-gray-100">
      {requests.map((row) => (
        <RequestRow key={row.id} row={row} />
      ))}
    </div>
  )
}
