import type { Metadata } from 'next'
import { getMyRequests } from '@/lib/actions/requests.actions'
import type { StaffRequestRow } from '@/components/staff/request-card'
import { TravelHistory } from '@/components/staff/travel-history'

export const metadata: Metadata = {
  title: 'Travel History — NIGCOMSAT Travel',
  description: 'Your full travel request history',
}

export default async function TravelHistoryPage() {
  const { data } = await getMyRequests()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Travel History</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Every trip you&rsquo;ve requested, including rejected and resubmitted attempts.
        </p>
      </div>
      <TravelHistory requests={(data ?? []) as StaffRequestRow[]} />
    </div>
  )
}
