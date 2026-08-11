import type { Metadata } from 'next'
import { getMyRequests } from '@/lib/actions/requests.actions'
import { StaffDashboard, type StaffRequestRow } from '@/components/staff/staff-dashboard'

export const metadata: Metadata = {
  title: 'Staff Dashboard — NIGCOMSAT Travel',
  description: 'Submit and track your travel requests',
}

/**
 * Staff Dashboard — PRD Section 3.1
 * Data fetch happens here (server component); all interactivity —
 * the request form, overlap warning, estimate, resubmit flow — lives in
 * the client component below.
 */
export default async function StaffDashboardPage() {
  const { data } = await getMyRequests()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
          Staff Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Submit travel requests and track their status
        </p>
      </div>

      <StaffDashboard requests={(data ?? []) as StaffRequestRow[]} />
    </div>
  )
}
