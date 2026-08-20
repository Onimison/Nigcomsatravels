import type { Metadata } from 'next'
import { getMyRequests } from '@/lib/actions/requests.actions'
import { createClient } from '@/lib/supabase/server'
import { StaffDashboard } from '@/components/staff/staff-dashboard'
import type { StaffRequestRow } from '@/components/staff/request-card'

export const metadata: Metadata = {
  title: 'Staff Dashboard — NIGCOMSAT Travel',
  description: 'Submit and track your travel requests',
}

/**
 * Staff Dashboard overview — PRD Section 3.1.
 * Data fetch happens here (server component); all interactivity lives in
 * the client component below. Matches ui-images/ reference: a pure
 * overview, no request form on this page (see /staff/request).
 */
export default async function StaffDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data }, { data: staff }] = await Promise.all([
    getMyRequests(),
    user
      ? supabase.from('staff').select('first_name').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
  ])

  return (
    <StaffDashboard
      requests={(data ?? []) as StaffRequestRow[]}
      staffFirstName={staff?.first_name ?? 'there'}
    />
  )
}
