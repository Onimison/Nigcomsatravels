import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/utils/auth-guard'
import { getPendingHRRequests, getHRHistory } from '@/lib/actions/requests.actions'
import { listFlightPriceReference, getFxRateOverride } from '@/lib/actions/rates.actions'
import { HRDashboard } from '@/components/hr/hr-dashboard'
import { FlightPricePanel } from '@/components/hr/flight-price-panel'
import { PageHeader } from '@/components/ui/page-header'
import { StatTile } from '@/components/ui/stat-tile'
import { ClockIcon, HistoryIcon, XCircleIcon } from '@/components/ui/icons'
import type { RateReferenceWithLevel } from '@/types/database'

export const metadata: Metadata = {
  title: 'HR Dashboard — NIGCOMSAT Travel',
  description: 'Review and process travel requests',
}

/**
 * HR Dashboard — PRD Section 3.2.
 * Primary Action: Review Requests (Status = pending_hr). Queue filtering,
 * allowance entry, and forward/reject actions live in the client component
 * below; this page is auth + data fetching + the surrounding stat tiles and
 * Flight Price Reference widget (UI_UX_DESIGN_PLAN.md §3.3/§4).
 */
export default async function HRDashboardPage() {
  const auth = await requireRole('hr', 'admin')
  if (!auth.authorized) {
    // Friendly redirect for a role that simply isn't HR — RLS is the real
    // boundary (PRD Section 7.1); the root page re-routes to their own
    // dashboard based on their actual role.
    redirect('/')
  }

  const [pendingResult, historyResult, flightRatesResult, fxRateResult] = await Promise.all([
    getPendingHRRequests(),
    getHRHistory(),
    listFlightPriceReference(),
    getFxRateOverride(),
  ])

  // HR prices allowances in NGN; this is what converts that entry to the USD
  // figure the rest of the app stores and calculates on (PRD Section 5.2).
  const fxRate = fxRateResult.success && fxRateResult.data ? Number(fxRateResult.data.value) : null

  const resubmissionCount = pendingResult.data.filter((r) => r.previousRejectionReason).length
  const processedToday = historyResult.data.filter((r) => {
    const updated = new Date(r.updated_at).toDateString()
    return updated === new Date().toDateString()
  }).length

  return (
    <div className="space-y-6">
      <PageHeader title="HR Dashboard" subtitle="Review and process travel requests awaiting HR verification" />

      {!pendingResult.success && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          Could not load pending requests: {pendingResult.error}
        </p>
      )}
      {!historyResult.success && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          Could not load recently processed requests: {historyResult.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatTile icon={ClockIcon} value={pendingResult.data.length} label="Awaiting Review" tone="amber" />
        <StatTile icon={XCircleIcon} value={resubmissionCount} label="Resubmissions in Queue" tone="red" />
        <StatTile icon={HistoryIcon} value={processedToday} label="Processed Today" tone="green" />
      </div>

      <FlightPricePanel rates={(flightRatesResult.data ?? []) as RateReferenceWithLevel[]} fxRate={fxRate} />

      <HRDashboard pending={pendingResult.data} history={historyResult.data} fxRate={fxRate} />
    </div>
  )
}
