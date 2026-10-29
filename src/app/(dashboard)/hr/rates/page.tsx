import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireDashboardAccess } from '@/lib/utils/auth-guard'
import { listFlightPriceReference, getFxRateOverride } from '@/lib/actions/rates.actions'
import { listGradeBands, getPolicyDefaults } from '@/lib/actions/policy.actions'
import { FlightPricePanel } from '@/components/hr/flight-price-panel'
import { FlightOriginSearch } from '@/components/hr/flight-origin-search'
import { DtaPolicyDisclosure } from '@/components/hr/dta-policy-disclosure'
import { PageHeader } from '@/components/ui/page-header'
import type { RateReference } from '@/types/database'

export const metadata: Metadata = {
  title: 'Flight Price Reference — NIGCOMSAT Travel',
  description: 'Domestic air references — primary origin Abuja (ABV)',
}

/**
 * HR's read-only local flight-price reference. Stored legacy level records are
 * grouped by destination and mode before rendering, so this view is not
 * segmented by manager, grade, or staff level.
 */
export default async function HRRatesPage() {
  const auth = await requireDashboardAccess('hr')
  if (!auth.authorized) {
    // Belt-and-suspenders — src/proxy.ts already blocks a wrong-role visit
    // to this route with a 404 before this component ever runs. RLS
    // underneath is the real boundary (PRD Section 7.1).
    redirect('/')
  }

  const [flightRatesResult, fxRateResult, gradeBandsResult, policyDefaultsResult] = await Promise.all([
    listFlightPriceReference(),
    getFxRateOverride(),
    listGradeBands(),
    getPolicyDefaults(),
  ])

  const fxRate = fxRateResult.success && fxRateResult.data ? Number(fxRateResult.data.value) : null

  return (
    <div className="space-y-6">
      <PageHeader title="Flight Price Reference" subtitle="Domestic air references — primary origin Abuja (ABV)" />

      {!flightRatesResult.success && (
        <p className="text-sm text-red-600" role="alert">
          Could not load flight price reference: {flightRatesResult.error}
        </p>
      )}

      <FlightPricePanel rates={(flightRatesResult.data ?? []) as RateReference[]} fxRate={fxRate} />
      <FlightOriginSearch />
      <DtaPolicyDisclosure
        gradeBands={gradeBandsResult.data}
        policyDefaults={policyDefaultsResult.data}
      />
    </div>
  )
}
