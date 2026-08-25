import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireDashboardAccess } from '@/lib/utils/auth-guard'
import { getPendingHRRequests, getHRHistory } from '@/lib/actions/requests.actions'
import { listFlightPriceReference, getFxRateOverride } from '@/lib/actions/rates.actions'
import { RecentRequestsPreview } from '@/components/hr/recent-requests-preview'
import { FlightPricePreview } from '@/components/hr/flight-price-preview'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { StatTile } from '@/components/ui/stat-tile'
import { LinkButton } from '@/components/ui/button'
import { ClockIcon, HistoryIcon, XCircleIcon, ArrowRightIcon } from '@/components/ui/icons'
import type { RateReferenceWithLevel } from '@/types/database'

export const metadata: Metadata = {
  title: 'HR Dashboard — NIGCOMSAT Travel',
  description: 'Review and process travel requests',
}

/**
 * HR Dashboard home — a glanceable overview, not the full working surface.
 * PRD Section 3.2, split per todays-task.md: the editable review queue and
 * the full flight price reference each moved to their own page
 * (/hr/requests, /hr/rates) so this page stays a single round-trip with no
 * heavy client-side form logic — just the stat tiles plus a preview of each
 * with a "view all" link.
 */
export default async function HRDashboardPage() {
  const auth = await requireDashboardAccess('hr')
  if (!auth.authorized) {
    // Belt-and-suspenders — src/proxy.ts already blocks a wrong-role visit
    // to this route with a 404 before this component ever runs. RLS
    // underneath is the real boundary (PRD Section 7.1).
    redirect('/')
  }

  const [pendingResult, historyResult, flightRatesResult, fxRateResult] = await Promise.all([
    getPendingHRRequests(),
    getHRHistory(),
    listFlightPriceReference(),
    getFxRateOverride(),
  ])

  const fxRate = fxRateResult.success && fxRateResult.data ? Number(fxRateResult.data.value) : null

  const resubmissionCount = pendingResult.data.filter((r) => r.previousRejectionReason).length
  const processedToday = historyResult.data.filter((r) => {
    const updated = new Date(r.updated_at).toDateString()
    return updated === new Date().toDateString()
  }).length

  const recentRequests = [...pendingResult.data]
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <PageHeader title="HR Dashboard" subtitle="Your at-a-glance view of what needs attention today" />

      {!pendingResult.success && (
        <p className="text-sm text-red-600" role="alert">
          Could not load pending requests: {pendingResult.error}
        </p>
      )}
      {!historyResult.success && (
        <p className="text-sm text-red-600" role="alert">
          Could not load recently processed requests: {historyResult.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatTile icon={ClockIcon} value={pendingResult.data.length} label="Awaiting Review" tone="amber" />
        <StatTile icon={XCircleIcon} value={resubmissionCount} label="Resubmissions in Queue" tone="red" />
        <StatTile icon={HistoryIcon} value={processedToday} label="Processed Today" tone="green" />
      </div>

      <Card
        title={`Awaiting Review (${pendingResult.data.length})`}
        description="Most recently submitted first"
        action={
          <LinkButton href="/hr/requests" variant="outline" className="gap-1.5">
            View All Requests <ArrowRightIcon className="h-3.5 w-3.5" />
          </LinkButton>
        }
      >
        <RecentRequestsPreview requests={recentRequests} />
      </Card>

      <Card
        title="Flight Price Reference"
        description="Latest tracked prices — check here before overriding a suggested rate"
        action={
          <LinkButton href="/hr/rates" variant="outline" className="gap-1.5">
            View Full Reference <ArrowRightIcon className="h-3.5 w-3.5" />
          </LinkButton>
        }
      >
        <FlightPricePreview rates={(flightRatesResult.data ?? []) as RateReferenceWithLevel[]} fxRate={fxRate} />
      </Card>
    </div>
  )
}
