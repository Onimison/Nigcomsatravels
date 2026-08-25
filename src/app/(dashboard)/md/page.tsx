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
 * MD Dashboard — PRD Section 3.3
 *
 * Primary Action: Approve or Reject Requests (Status = pending_md)
 * Queue sorting/filtering, cost breakdown, and approve/reject actions live
 * in the client component below; this page is auth + data fetching + the
 * surrounding stat tiles (UI_UX_DESIGN_PLAN.md §3.4).
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

  const approvedThisMonth = historyResult.data.filter((r) => {
    if (r.status !== 'approved') return false
    const updated = new Date(r.updated_at)
    const now = new Date()
    return updated.getMonth() === now.getMonth() && updated.getFullYear() === now.getFullYear()
  }).length
  const rejectedCount = historyResult.data.filter(
    (r) => r.status === 'md_rejected' || r.status === 'rejected_final'
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
        <StatTile icon={ClockIcon} value={pendingResult.data.length} label="Pending Approval" tone="amber" />
        <StatTile icon={CheckCircleIcon} value={approvedThisMonth} label="Approved This Month" tone="green" />
        <StatTile icon={XCircleIcon} value={rejectedCount} label="Rejected" tone="red" />
      </div>

      <MDDashboard pending={pendingResult.data} history={historyResult.data} />
    </div>
  )
}
