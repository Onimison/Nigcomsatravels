import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireDashboardAccess } from '@/lib/utils/auth-guard'
import { getPendingHRRequests } from '@/lib/actions/requests.actions'
import { HRRequestQueue } from '@/components/hr/hr-request-queue'
import { PageHeader } from '@/components/ui/page-header'

export const metadata: Metadata = {
  title: 'Review Queue — NIGCOMSAT Travel',
  description: 'Every request awaiting HR verification',
}

/**
 * HR Review Queue — the full list of requests awaiting HR verification,
 * split out of the HR dashboard home (todays-task.md). A compact,
 * filterable list of rows (`HRRequestQueue`/`RequestRow`) — clicking a row
 * opens that one request's own review page (`/hr/requests/[id]`), it never
 * opens this whole list. "Recently Processed" has its own page now too
 * (`/hr/history`), reachable from the sidebar.
 */
export default async function HRRequestsPage() {
  const auth = await requireDashboardAccess('hr')
  if (!auth.authorized) {
    // Belt-and-suspenders — src/proxy.ts already blocks a wrong-role visit
    // to this route with a 404 before this component ever runs. RLS
    // underneath is the real boundary (PRD Section 7.1).
    redirect('/')
  }

  const pendingResult = await getPendingHRRequests()

  return (
    <div className="space-y-6">
      <PageHeader title="Review Queue" subtitle="Every request awaiting HR verification" />

      {!pendingResult.success && (
        <p className="text-sm text-red-600" role="alert">
          Could not load pending requests: {pendingResult.error}
        </p>
      )}

      <HRRequestQueue pending={pendingResult.data} />
    </div>
  )
}
