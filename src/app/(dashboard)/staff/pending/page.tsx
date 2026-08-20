import type { Metadata } from 'next'
import { getMyRequests } from '@/lib/actions/requests.actions'
import type { StaffRequestRow } from '@/components/staff/request-card'
import { PendingRequestsList } from '@/components/staff/pending-requests-list'

export const metadata: Metadata = {
  title: 'Pending Requests — NIGCOMSAT Travel',
  description: 'Your travel requests awaiting review',
}

export default async function PendingRequestsPage() {
  const { data } = await getMyRequests()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Pending Requests</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Requests still moving through HR or MD review, or returned to you for revision.
        </p>
      </div>
      <PendingRequestsList requests={(data ?? []) as StaffRequestRow[]} />
    </div>
  )
}
