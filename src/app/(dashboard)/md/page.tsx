import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'MD Dashboard — NIGCOMSAT Travel',
  description: 'Final approval authority for travel requests',
}

/**
 * MD Dashboard — PRD Section 3.3
 *
 * Primary Action: Approve or Reject Requests (Status = pending_md)
 *
 * Key Features to implement (Sprint 3 — Frontend):
 * - Approval queue with sorting/filtering:
 *   - Sort: Total Cost (High→Low), Earliest Departure, Department
 *   - Filter: Department, Destination
 * - Review screen showing:
 *   - Full cost breakdown (Fields 8-12)
 *   - Applied level coverage percentage
 *   - Final total cost
 *   - Staff's original reason for travel
 *   - HR's recommendation/note (side-by-side)
 * - Approve / Reject actions (mandatory rejection reason)
 * - History of past approvals with cost snapshots
 *
 * Data source: getPendingMDRequests() from requests.actions.ts
 */
export default function MDDashboardPage() {
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

      {/* TODO (Sprint 3): Pending Approval Queue */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          Pending Approval
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          No requests awaiting MD approval.
        </p>
      </section>

      {/* TODO (Sprint 3): Approval History */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          Approval History
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Past approvals and rejections will appear here.
        </p>
      </section>
    </div>
  )
}
