import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getMyRequests } from '@/lib/actions/requests.actions'
import { listAirports } from '@/lib/actions/airports.actions'
import { listGradeBands, getPolicyDefaults, listStaffDirectory, getMyGradeBand } from '@/lib/actions/policy.actions'
import { createClient } from '@/lib/supabase/server'
import { requireDashboardAccess } from '@/lib/utils/auth-guard'
import { latestReason, type StaffRequestRow } from '@/components/staff/request-card'
import { RequestFormClient } from '@/components/staff/request-form-client'
import type { ResubmitTarget } from '@/components/staff/travel-request-form'
import { PageHeader } from '@/components/ui/page-header'
import type { TravelMode, TripType } from '@/types/database'

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

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { resubmit } = await searchParams
  const [{ data: requests }, { data: airports }, { data: gradeBands }, { data: policyDefaults }, { data: staffDirectory }, myBand, { data: staff }] =
    await Promise.all([
      getMyRequests(),
      listAirports(),
      listGradeBands(),
      getPolicyDefaults(),
      listStaffDirectory(),
      getMyGradeBand(),
      user
        ? supabase.from('staff').select('first_name, surname').eq('id', user.id).single()
        : Promise.resolve({ data: null }),
    ])

  const rows = (requests ?? []) as StaffRequestRow[]

  const currentUser = {
    id: user?.id ?? '',
    name: [staff?.first_name, staff?.surname].filter(Boolean).join(' ') || 'You',
    designation: myBand.data.designation,
    gradeBandCode: myBand.data.gradeBand?.code ?? null,
  }

  let resubmitTarget: ResubmitTarget | null = null
  if (resubmit) {
    const row = rows.find((r) => r.id === resubmit)
    if (row && row.memo_number) {
      resubmitTarget = {
        id: row.id,
        memo_number: row.memo_number,
        destination: row.destination,
        origin: row.origin ?? '',
        destination_airport_id: row.destination_airport_id,
        mode: (row.mode as TravelMode) ?? 'air',
        trip_type: (row.trip_type as TripType) ?? 'return',
        depart_date: row.depart_date,
        return_date: row.return_date,
        reason_for_travel: row.reason_for_travel,
        rejectionReason: latestReason(row),
        travelerStaffIds: (row.request_travelers ?? [])
          .filter((t) => !t.is_requester)
          .map((t) => t.staff_id),
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
        <RequestFormClient
          airports={airports}
          gradeBands={gradeBands}
          policyDefaults={policyDefaults}
          staffDirectory={staffDirectory}
          currentUser={currentUser}
          resubmitTarget={resubmitTarget}
        />
      </section>
    </div>
  )
}
