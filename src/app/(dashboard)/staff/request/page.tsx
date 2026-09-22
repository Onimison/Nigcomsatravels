import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getMyRequests } from '@/lib/actions/requests.actions'
import { listAirports } from '@/lib/actions/airports.actions'
import { requireDashboardAccess } from '@/lib/utils/auth-guard'
import { latestReason, type StaffRequestRow } from '@/components/staff/request-card'
import { RequestFormClient } from '@/components/staff/request-form-client'
import type { ResubmitTarget } from '@/components/staff/travel-request-form'
import { PageHeader } from '@/components/ui/page-header'

export const metadata: Metadata = {
  title: 'Request Travel — NIGCOMSAT Travel',
  description: 'Submit a new travel request',
}

export default async function RequestTravelPage({
  searchParams,
}: {
  searchParams: Promise<{ resubmit?: string }>
}) {
  const auth = await requireDashboardAccess('staff')
  if (!auth.authorized) {
    redirect('/')
  }

  const { resubmit } = await searchParams
  const [{ data }, { data: airports }] = await Promise.all([getMyRequests(), listAirports()])
  const requests = (data ?? []) as StaffRequestRow[]
  const airportOptions = airports ?? []

  let resubmitTarget: ResubmitTarget | null = null
  if (resubmit) {
    const row = requests.find((r) => r.id === resubmit)
    if (row) {
      resubmitTarget = {
        id: row.id,
        memo_number: row.memo_number,
        destination: row.destination,
        origin: row.origin,
        destination_airport_id: row.destination_airport_id,
        mode: row.mode,
        one_way: row.one_way,
        days_requested: row.days_requested,
        depart_date: row.depart_date,
        return_date: row.return_date,
        reason_for_travel: row.reason_for_travel,
        travellerStaffIds: row.travellers.map((t) => t.staff_id),
        rejectionReason: latestReason(row),
      }
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={resubmitTarget ? 'Resubmit Request' : 'Request Travel'}
        subtitle="Fill in your travel details to submit a new request."
      />

      <section className="max-w-2xl rounded-xl border border-gray-200 bg-white p-6">
        <RequestFormClient airports={airportOptions} resubmitTarget={resubmitTarget} />
      </section>
    </div>
  )
}
