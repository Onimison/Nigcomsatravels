import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireDashboardAccess } from '@/lib/utils/auth-guard'
import { listGradeBands, getPolicyDefaults } from '@/lib/actions/policy.actions'
import { DtaPolicyReference } from '@/components/hr/dta-policy-reference'
import { PageHeader } from '@/components/ui/page-header'

export const metadata: Metadata = {
  title: 'DTA Policy Reference — NIGCOMSAT Travel',
  description: 'Current DTA rates used by the travel request calculator',
}

/**
 * HR's read-only view of the DTA policy. Rates are managed by Admin under
 * Travel Policy and are the same values used in staff previews and HR review.
 */
export default async function HRDtaPolicyPage() {
  const auth = await requireDashboardAccess('hr')
  if (!auth.authorized) {
    // Belt-and-suspenders — src/proxy.ts already blocks a wrong-role visit
    // to this route with a 404 before this component ever runs. RLS
    // underneath is the real boundary (PRD Section 7.1).
    redirect('/')
  }

  const [gradeBandsResult, policyDefaultsResult] = await Promise.all([
    listGradeBands(),
    getPolicyDefaults(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader title="DTA Policy Reference" subtitle="Managed by Admin — the same policy used in staff previews and HR costing" />

      {!gradeBandsResult.success && (
        <p className="text-sm text-red-600" role="alert">
          Could not load DTA policy: {gradeBandsResult.error}
        </p>
      )}

      <DtaPolicyReference
        showHeader={false}
        gradeBands={gradeBandsResult.data}
        policyDefaults={policyDefaultsResult.data}
      />
    </div>
  )
}
