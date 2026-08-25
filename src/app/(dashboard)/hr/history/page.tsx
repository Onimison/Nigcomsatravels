import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireDashboardAccess } from '@/lib/utils/auth-guard'
import { getHRHistory } from '@/lib/actions/requests.actions'
import { HRHistory } from '@/components/hr/hr-history'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Recently Processed — NIGCOMSAT Travel',
  description: 'Requests you have forwarded to MD or returned for revision',
}

/**
 * HR's decision history — split out of the Review Queue (todays-task.md:
 * "recently processed should be on the sidebar too"). Read-only.
 */
export default async function HRHistoryPage() {
  const auth = await requireDashboardAccess('hr')
  if (!auth.authorized) {
    // Belt-and-suspenders — src/proxy.ts already blocks a wrong-role visit
    // to this route with a 404 before this component ever runs. RLS
    // underneath is the real boundary (PRD Section 7.1).
    redirect('/')
  }

  const historyResult = await getHRHistory()

  return (
    <div className="space-y-6">
      <PageHeader title="Recently Processed" subtitle="Requests you've forwarded to MD or returned for revision" />

      {!historyResult.success && (
        <p className="text-sm text-red-600" role="alert">
          Could not load history: {historyResult.error}
        </p>
      )}

      <Card>
        <HRHistory history={historyResult.data} />
      </Card>
    </div>
  )
}
