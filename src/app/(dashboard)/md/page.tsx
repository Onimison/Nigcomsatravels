import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/utils/auth-guard'
import { getPendingMDRequests, getMDHistory } from '@/lib/actions/requests.actions'
import { MDDashboard } from '@/components/md/md-dashboard'

export const metadata: Metadata = {
  title: 'MD Dashboard — NIGCOMSAT Travel',
  description: 'Final approval authority for travel requests',
}

/**
 * MD Dashboard — PRD Section 3.3
 *
 * Primary Action: Approve or Reject Requests (Status = pending_md)
 * Queue sorting/filtering, cost breakdown, and approve/reject actions live
 * in the client component below; this page is just auth + data fetching.
 */
export default async function MDDashboardPage() {
  const auth = await requireRole('md', 'admin')
  if (!auth.authorized) {
    // Friendly redirect for a role that simply isn't MD — RLS is the real
    // boundary (PRD Section 7.1); the root page re-routes to their own
    // dashboard based on their actual role.
    redirect('/')
  }

  const [pendingResult, historyResult] = await Promise.all([
    getPendingMDRequests(),
    getMDHistory(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
          MD Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Review and approve travel requests awaiting final authorization
        </p>
      </div>

      {!pendingResult.success && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          Could not load pending requests: {pendingResult.error}
        </p>
      )}
      {!historyResult.success && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          Could not load approval history: {historyResult.error}
        </p>
      )}

      <MDDashboard pending={pendingResult.data} history={historyResult.data} />
    </div>
  )
}
