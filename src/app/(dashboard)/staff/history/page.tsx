import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getMyRequests } from '@/lib/actions/requests.actions'
import { requireDashboardAccess } from '@/lib/utils/auth-guard'
import type { StaffRequestRow } from '@/components/staff/request-card'
import { TravelHistory } from '@/components/staff/travel-history'
import { PageHeader } from '@/components/ui/page-header'

export const metadata: Metadata = {
  title: 'Travel History — NIGCOMSAT Travel',
  description: 'Your full travel request history',
}

export default async function TravelHistoryPage() {
  const auth = await requireDashboardAccess('staff')
  if (!auth.authorized) {
    redirect('/')
  }

  const requestsResult = await getMyRequests()
  if (!requestsResult.success) {
    throw new Error(requestsResult.error ?? 'Could not load your travel history')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Travel History"
        subtitle="Every trip you’ve requested, including rejected and resubmitted attempts."
      />
      <TravelHistory requests={requestsResult.data as StaffRequestRow[]} />
    </div>
  )
}
