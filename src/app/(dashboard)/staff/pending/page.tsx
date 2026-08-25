import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getMyRequests } from '@/lib/actions/requests.actions'
import { requireDashboardAccess } from '@/lib/utils/auth-guard'
import type { StaffRequestRow } from '@/components/staff/request-card'
import { PendingRequestsList } from '@/components/staff/pending-requests-list'
import { PageHeader } from '@/components/ui/page-header'
import { ToastOnMount } from '@/components/ui/toast'

export const metadata: Metadata = {
  title: 'Pending Requests — NIGCOMSAT Travel',
  description: 'Your travel requests awaiting review',
}

export default async function PendingRequestsPage() {
  const auth = await requireDashboardAccess('staff')
  if (!auth.authorized) {
    redirect('/')
  }

  const { data } = await getMyRequests()

  return (
    <div className="space-y-6">
      <ToastOnMount />
      <PageHeader
        title="Pending Requests"
        subtitle="Requests still moving through HR or MD review, or returned to you for revision."
      />
      <PendingRequestsList requests={(data ?? []) as StaffRequestRow[]} />
    </div>
  )
}
