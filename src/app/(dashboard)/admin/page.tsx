import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin Dashboard — NIGCOMSAT Travel',
  description: 'System administration: staff, levels, rates, and departments',
}

/**
 * Admin Dashboard — PRD Section 3.4
 *
 * Access: Role = admin (assigned to HR Head or IT lead)
 *
 * Key Features to implement (Sprint 0 — Frontend):
 * - Staff Management: Add, edit, deactivate staff
 * - Level Configuration: Edit coverage_percent and flight_class
 * - Rate Management:
 *   - View/edit rate_reference (Master Rate Table)
 *   - View rate_overrides log
 *   - "Promote to Master Rate" button
 *   - View AI rate_suggestions (if enabled)
 * - Department Management: Add/edit departments, budget ceilings
 * - FX Rate Override: Manual daily exchange rate
 *
 * Data sources:
 *   - listStaff() from staff.actions.ts
 *   - listRateReferences(), listRateOverrides() from rates.actions.ts
 */
export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
          System Administration
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Manage staff, levels, rates, and departments
        </p>
      </div>

      {/* TODO (Sprint 0): Staff Management */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            Staff Management
          </h2>
          {/* TODO: Add Staff button */}
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Staff table will appear here.
        </p>
      </section>

      {/* TODO (Sprint 0): Level Configuration */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          Level Configuration
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Coverage percentages and flight class mappings.
        </p>
      </section>

      {/* TODO (Sprint 0): Rate Management */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          Rate Management
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Master rate table and override log.
        </p>
      </section>

      {/* TODO (Sprint 0): Department Management */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          Department Management
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Departments and annual budget ceilings.
        </p>
      </section>
    </div>
  )
}
