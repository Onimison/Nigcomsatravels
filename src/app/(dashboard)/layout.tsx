import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/lib/actions/auth.actions'
import { DashboardChrome } from '@/components/dashboard/dashboard-chrome'
import { NAV_ITEMS } from '@/lib/utils/nav-config'
import type { UserRole } from '@/types/database'

export const metadata: Metadata = {
  title: 'Dashboard — NIGCOMSAT Travel',
  description: 'NIGCOMSAT Travel Request Tool Dashboard',
}

/** Per-role count that drives the sidebar's "pending" badge (UI_UX_DESIGN_PLAN.md §3.1). */
async function getPendingBadgeCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  role: UserRole,
  userId: string
): Promise<number> {
  if (role === 'staff') {
    const { count } = await supabase
      .from('travel_requests')
      .select('id', { count: 'exact', head: true })
      .eq('staff_id', userId)
      .in('status', ['pending_hr', 'pending_md', 'hr_rejected', 'md_rejected'])
    return count ?? 0
  }
  if (role === 'hr') {
    const { count } = await supabase
      .from('travel_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_hr')
    return count ?? 0
  }
  if (role === 'md') {
    const { count } = await supabase
      .from('travel_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_md')
    return count ?? 0
  }
  return 0
}

/**
 * Shared Dashboard Layout — PRD Section 3.
 * Wraps all authenticated role-based pages (staff, hr, md, admin).
 * Server-fetches the signed-in staff record + sidebar badge count, then
 * hands off to the client-side DashboardChrome for the interactive shell.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: staff } = await supabase
    .from('staff')
    .select('first_name, surname, role, active')
    .eq('id', user.id)
    .single()

  // PRD Section 2.3: Deactivated staff cannot access the app
  if (!staff || !staff.active) {
    redirect('/login')
  }

  const role = staff.role as UserRole
  const pending = await getPendingBadgeCount(supabase, role, user.id)
  const staffName = [staff.first_name, staff.surname].filter(Boolean).join(' ') || 'User'

  return (
    <DashboardChrome
      navItems={NAV_ITEMS[role]}
      badgeCounts={{ pending }}
      staffName={staffName}
      role={role}
      signOutAction={signOut}
    >
      {children}
    </DashboardChrome>
  )
}
