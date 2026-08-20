import type { Metadata } from 'next'
import { getMyRequests } from '@/lib/actions/requests.actions'
import { latestReason, type StaffRequestRow } from '@/components/staff/request-card'
import { RequestFormClient } from '@/components/staff/request-form-client'
import type { ResubmitTarget } from '@/components/staff/travel-request-form'

export const metadata: Metadata = {
  title: 'Request Travel — NIGCOMSAT Travel',
  description: 'Submit a new travel request',
}

export default async function RequestTravelPage({
  searchParams,
}: {
  searchParams: Promise<{ resubmit?: string }>
}) {
  const { resubmit } = await searchParams
  const { data } = await getMyRequests()
  const requests = (data ?? []) as StaffRequestRow[]

  let resubmitTarget: ResubmitTarget | null = null
  if (resubmit) {
    const row = requests.find((r) => r.id === resubmit)
    if (row) {
      resubmitTarget = {
        id: row.id,
        destination: row.destination,
        origin: row.origin,
        mode: row.mode,
        days: row.days,
        depart_date: row.depart_date,
        return_date: row.return_date,
        reason_for_travel: row.reason_for_travel,
        rejectionReason: latestReason(row),
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
          {resubmitTarget ? 'Resubmit Request' : 'Request Travel'}
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Fill in your travel details to submit a new request.
        </p>
      </div>

      <section className="max-w-2xl rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <RequestFormClient resubmitTarget={resubmitTarget} />
      </section>
    </div>
  )
}
