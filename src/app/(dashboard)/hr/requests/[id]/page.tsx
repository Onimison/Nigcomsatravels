import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { requireDashboardAccess } from '@/lib/utils/auth-guard'
import { getPendingHRRequests } from '@/lib/actions/requests.actions'
import { getFxRateOverride } from '@/lib/actions/rates.actions'
import { ReviewCard } from '@/components/hr/review-card'
import { ArrowLeftIcon } from '@/components/ui/icons'

export const metadata: Metadata = {
  title: 'Review Request — NIGCOMSAT Travel',
  description: 'Review a single travel request',
}

/**
 * A single request's review page — allowance entry, live fare lookup,
 * forward/reject (`ReviewCard`). This is what a row in the Review Queue or
 * the HR home preview links to; the queue/preview never render this form
 * inline (todays-task.md: "clicking each one should only open the
 * particular review").
 */
export default async function HRRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireDashboardAccess('hr')
  if (!auth.authorized) {
    // Belt-and-suspenders — src/proxy.ts already blocks a wrong-role visit
    // to this route with a 404 before this component ever runs. RLS
    // underneath is the real boundary (PRD Section 7.1).
    redirect('/')
  }

  const { id } = await params
  const [pendingResult, fxRateResult] = await Promise.all([getPendingHRRequests(), getFxRateOverride()])
  const row = pendingResult.data.find((r) => r.id === id)

  // Not pending — already handled (by this HR user or someone else while
  // this page sat open in a tab) or the id is just wrong. Either way there's
  // nothing to review here anymore.
  if (!row) {
    notFound()
  }

  const fxRate = fxRateResult.success && fxRateResult.data ? Number(fxRateResult.data.value) : null

  return (
    <div className="space-y-6">
      <Link
        href="/hr/requests"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Back to Review Queue
      </Link>

      <ReviewCard row={row} fxRate={fxRate} />
    </div>
  )
}
