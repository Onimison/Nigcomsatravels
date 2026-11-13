import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { requireDashboardAccess } from '@/lib/utils/auth-guard'
import { listStaff } from '@/lib/actions/staff.actions'
import { listGradeBands, listDesignations, getPolicyDefaults } from '@/lib/actions/policy.actions'
import { StaffManagement } from '@/components/admin/staff-management'
import { TravelPolicyManagement } from '@/components/admin/travel-policy-management'
import { PageHeader } from '@/components/ui/page-header'
import { AdminTabs } from '@/components/admin/admin-tabs'
import type { StaffWithDetails } from '@/types/database'

export const metadata: Metadata = {
  title: 'Admin Dashboard — NIGCOMSAT Travel',
  description: 'System administration: staff and travel policy',
}

/**
 * Admin Dashboard — PRD Section 3.4.
 * Access: Role = admin (assigned to HR Head or IT lead).
 *
 * - Staff Management: src/components/admin/staff-management.tsx
 * - Travel Policy: grade bands, designations, and DTA defaults.
 */
export default async function AdminDashboardPage() {
  const auth = await requireDashboardAccess('admin')
  if (!auth.authorized) {
    // Belt-and-suspenders — src/proxy.ts already blocks a wrong-role visit
    // to this route with a 404 before this component ever runs. RLS
    // underneath is the real boundary (PRD Section 7.1).
    redirect('/')
  }

  const [staffResult, gradeBandsResult, designationsResult, policyDefaultsResult] =
    await Promise.all([
      listStaff(),
      listGradeBands(),
      listDesignations(),
      getPolicyDefaults(),
    ])

  return (
    <div className="space-y-6">
      <PageHeader title="System Administration" subtitle="Manage staff and travel policy" />

      {!staffResult.success && (
        <p className="text-sm text-red-600" role="alert">
          Could not load staff: {staffResult.error}
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
                  designations={designationsResult.data}
                />
              ),
            },
            {
              key: 'policy',
              label: 'Travel Policy',
              content: (
                <TravelPolicyManagement
                  gradeBands={gradeBandsResult.data}
                  designations={designationsResult.data}
                  policyDefaults={policyDefaultsResult.data}
                />
              ),
            },
          ]}
        />
      </Suspense>
    </div>
  )
}
