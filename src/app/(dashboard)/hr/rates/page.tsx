import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireDashboardAccess } from '@/lib/utils/auth-guard'
import { listFlightPriceReference, getFxRateOverride } from '@/lib/actions/rates.actions'
import { FlightPricePanel } from '@/components/hr/flight-price-panel'
import { PageHeader } from '@/components/ui/page-header'
import type { RateReferenceWithLevel } from '@/types/database'

export const metadata: Metadata = {
  title: 'Flight Price Reference — NIGCOMSAT Travel',
  description: 'Current tracked flight prices, by destination and level',
}

/**
 * Full Flight Price Reference — split out of the HR dashboard home
 * (todays-task.md). `FlightPricePanel` itself is unchanged; this page is
 * just auth + data fetching, same as the old `hr/page.tsx` was.
 */
export default async function HRRatesPage() {
  const auth = await requireDashboardAccess('hr')
  if (!auth.authorized) {
    // Belt-and-suspenders — src/proxy.ts already blocks a wrong-role visit
    // to this route with a 404 before this component ever runs. RLS
    // underneath is the real boundary (PRD Section 7.1).
    redirect('/')
  }

  const [flightRatesResult, fxRateResult] = await Promise.all([
    listFlightPriceReference(),
    getFxRateOverride(),
  ])

  const fxRate = fxRateResult.success && fxRateResult.data ? Number(fxRateResult.data.value) : null

  return (
    <div className="space-y-6">
      <PageHeader title="Flight Price Reference" subtitle="Managed by Admin — check here before overriding a suggested rate" />

      {!flightRatesResult.success && (
        <p className="text-sm text-red-600" role="alert">
          Could not load flight price reference: {flightRatesResult.error}
        </p>
      )}

      <FlightPricePanel rates={(flightRatesResult.data ?? []) as RateReferenceWithLevel[]} fxRate={fxRate} />
    </div>
  )
}
