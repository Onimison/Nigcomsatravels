import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { requireRole } from '@/lib/utils/auth-guard'
import { listStaff } from '@/lib/actions/staff.actions'
import { listDepartments } from '@/lib/actions/departments.actions'
import { listLevels } from '@/lib/actions/levels.actions'
import { listRateReferences, getFxRateOverride } from '@/lib/actions/rates.actions'
import { StaffManagement } from '@/components/admin/staff-management'
import { LevelManagement } from '@/components/admin/level-management'
import { RateManagement } from '@/components/admin/rate-management'
import { PageHeader } from '@/components/ui/page-header'
import { AdminTabs } from '@/components/admin/admin-tabs'
import type { Department, Level, RateReferenceWithLevel, StaffWithDetails } from '@/types/database'

export const metadata: Metadata = {
  title: 'Admin Dashboard — NIGCOMSAT Travel',
  description: 'System administration: staff, levels, rates, and departments',
}

/**
 * Admin Dashboard — PRD Section 3.4.
 * Access: Role = admin (assigned to HR Head or IT lead).
 *
 * - Staff Management: src/components/admin/staff-management.tsx
 * - Level Configuration: src/components/admin/level-management.tsx — the
 *   mechanism the demo travel policy runs on (TRAVEL_POLICY_DEMO.md)
 * - Rate Management / Flight Price Reference: src/components/admin/rate-management.tsx
 *   — this pass's redefined "Sprint 4" (UI_UX_DESIGN_PLAN.md §4)
 * - Department Management: still a placeholder, out of scope for this pass
 */
export default async function AdminDashboardPage() {
  const auth = await requireRole('admin')
  if (!auth.authorized) {
    // Friendly redirect for a role that simply isn't admin — RLS is the real
    // boundary (PRD Section 7.1); the root page re-routes to their own
    // dashboard based on their actual role.
    redirect('/')
  }

  const [staffResult, departmentsResult, levelsResult, ratesResult, fxRateResult] = await Promise.all([
    listStaff(),
    listDepartments(),
    listLevels(),
    listRateReferences(),
    getFxRateOverride(),
  ])

  const fxRate = fxRateResult.success && fxRateResult.data ? Number(fxRateResult.data.value) : null

  return (
    <div className="space-y-6">
      <PageHeader title="System Administration" subtitle="Manage staff, levels, rates, and departments" />

      {!staffResult.success && (
        <p className="text-sm text-red-600" role="alert">
          Could not load staff: {staffResult.error}
        </p>
      )}
      {!departmentsResult.success && (
        <p className="text-sm text-red-600" role="alert">
          Could not load departments: {departmentsResult.error}
        </p>
      )}
      {!levelsResult.success && (
        <p className="text-sm text-red-600" role="alert">
          Could not load levels: {levelsResult.error}
        </p>
      )}

      <Suspense>
        <AdminTabs
          tabs={[
            {
              key: 'staff',
              label: 'Staff Management',
              content: (
                <StaffManagement
                  staff={(staffResult.data ?? []) as StaffWithDetails[]}
                  departments={(departmentsResult.data ?? []) as Department[]}
                  levels={(levelsResult.data ?? []) as Level[]}
                />
              ),
            },
            {
              key: 'levels',
              label: 'Levels',
              content: <LevelManagement levels={(levelsResult.data ?? []) as Level[]} />,
            },
            {
              key: 'rates',
              label: 'Rates',
              content: (
                <RateManagement
                  rates={(ratesResult.data ?? []) as RateReferenceWithLevel[]}
                  levels={(levelsResult.data ?? []) as Level[]}
                  fxRate={fxRate}
                />
              ),
            },
            {
              key: 'departments',
              label: 'Departments',
              content: (
                // Out of scope for this pass, see UI_UX_DESIGN_PLAN.md §3.5
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Department Management</h2>
                  <p className="mt-2 text-sm text-gray-500">
                    Departments and annual budget ceilings. Not built this pass — see UI_UX_DESIGN_PLAN.md §3.5.
                  </p>
                </div>
              ),
            },
          ]}
        />
      </Suspense>
    </div>
  )
}
