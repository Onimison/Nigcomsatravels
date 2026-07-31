import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Staff Dashboard — NIGCOMSAT Travel',
  description: 'Submit and track your travel requests',
}

/**
 * Staff Dashboard — PRD Section 3.1
 *
 * Primary Action: Request to Travel (Fields 1-7 + Reason)
 *
 * Key Features to implement (Sprint 1 — Frontend):
 * - "Request to Travel" form with pre-submit estimate
 * - Date-Overlap Warning (uses useOverlapWarning hook)
 * - Pending Requests list with status labels from constants.ts
 * - Travel History grouped by travel_group_id
 * - Ongoing Trip indicator (approved + today between depart/return)
 *
 * Data source: getMyRequests() from requests.actions.ts
 */
export default function StaffDashboardPage() {
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

      {/* TODO (Sprint 1): Request to Travel form */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          Request to Travel
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Fill in your travel details to submit a new request.
        </p>
        {/* TravelRequestForm component goes here */}
      </section>

      {/* TODO (Sprint 1): Pending Requests list */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          Pending Requests
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          No pending requests yet.
        </p>
      </section>

      {/* TODO (Sprint 1): Travel History */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          Travel History
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Your past travel requests will appear here.
        </p>
      </section>
    </div>
  )
}
