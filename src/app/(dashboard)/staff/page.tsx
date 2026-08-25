import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getMyRequests } from '@/lib/actions/requests.actions'
import { createClient } from '@/lib/supabase/server'
import { requireDashboardAccess } from '@/lib/utils/auth-guard'
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
  const auth = await requireDashboardAccess('staff')
  if (!auth.authorized) {
    // Belt-and-suspenders — src/proxy.ts already blocks a wrong-role visit
    // to this route with a 404 before this component ever runs. RLS
    // underneath is the real boundary (PRD Section 7.1).
    redirect('/')
  }

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
