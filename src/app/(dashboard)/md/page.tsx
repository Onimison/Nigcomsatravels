import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireDashboardAccess } from '@/lib/utils/auth-guard'
import { getPendingMDRequests, getMDHistory } from '@/lib/actions/requests.actions'
import { MDDashboard } from '@/components/md/md-dashboard'
import { PageHeader } from '@/components/ui/page-header'
import { StatTile } from '@/components/ui/stat-tile'
import { ClockIcon, CheckCircleIcon, XCircleIcon } from '@/components/ui/icons'

export const metadata: Metadata = {
  title: 'MD Dashboard — NIGCOMSAT Travel',
  description: 'Final approval authority for travel requests',
}

/**
 * MD Dashboard — read-only (REVISED_SCOPE.md decision 5 / M6). Approval
 * happens in the ERP now; this page shows what HR has priced and, once
 * Phase 5 ships, the ERP-reported outcome. Filtering, cost breakdown, etc.
 * live in the client component below; this page is auth + data fetching +
 * the surrounding stat tiles.
 */
export default async function MDDashboardPage() {
  const auth = await requireDashboardAccess('md')
  if (!auth.authorized) {
    // Belt-and-suspenders — src/proxy.ts already blocks a wrong-role visit
    // to this route with a 404 before this component ever runs. RLS
    // underneath is the real boundary (PRD Section 7.1).
    redirect('/')
  }

  const [pendingResult, historyResult] = await Promise.all([
    getPendingMDRequests(),
    getMDHistory(),
  ])

  const pending = pendingResult.data ?? []
  const history = historyResult.data ?? []

  const approvedThisMonth = history.filter((r) => {
    if (r.status !== 'approved') return false
    const updated = new Date(r.updated_at)
    const now = new Date()
    return updated.getMonth() === now.getMonth() && updated.getFullYear() === now.getFullYear()
  }).length
  const rejectedCount = history.filter(
    (r) => r.status === 'rejected' || r.status === 'rejected_final'
  ).length

  return (
    <div className="space-y-6">
      <PageHeader title="MD Dashboard" subtitle="Review and approve travel requests awaiting final authorization" />

      {!pendingResult.success && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          Could not load pending requests: {pendingResult.error}
        </p>
      )}
      {!historyResult.success && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          Could not load approval history: {historyResult.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatTile icon={ClockIcon} value={pending.length} label="Priced by HR" tone="amber" />
        <StatTile icon={CheckCircleIcon} value={approvedThisMonth} label="Approved This Month" tone="green" />
        <StatTile icon={XCircleIcon} value={rejectedCount} label="Rejected" tone="red" />
      </div>

      <MDDashboard pending={pending} history={history} />
    </div>
  )
}
