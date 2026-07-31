import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'HR Dashboard — NIGCOMSAT Travel',
  description: 'Review and process travel requests',
}

/**
 * HR Dashboard — PRD Section 3.2
 *
 * Primary Action: Review Requests (Status = pending_hr)
 *
 * Key Features to implement (Sprint 2 — Frontend):
 * - Review queue showing pending_hr requests
 * - Review screen with staff details, destination, days, reason
 * - "Suggest Standard Rates" button (queries rate_reference)
 * - Editable allowance fields (8-12) with live total
 * - Overlap flag for staff with conflicting trips
 * - Resubmission context (prior rejection reason if travel_group_id has history)
 * - Approve (forward to MD) / Reject (mandatory reason) actions
 *
 * Data source: getPendingHRRequests() from requests.actions.ts
 */
export default function HRDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
          HR Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Review and process travel requests awaiting HR verification
        </p>
      </div>

      {/* TODO (Sprint 2): Pending HR Review Queue */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          Awaiting Review
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          No requests pending HR review.
        </p>
      </section>

      {/* TODO (Sprint 2): Recently Processed */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          Recently Processed
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Forwarded and rejected requests will appear here.
        </p>
      </section>
    </div>
  )
}
