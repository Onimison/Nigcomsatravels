import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROLE_DASHBOARD_PATHS } from '@/lib/utils/constants'
import type { UserRole } from '@/types/database'

/**
 * Root page — redirects to login or the user's role-specific dashboard.
 * PRD Section 2.2: "On login, the system reads the role and routes
 * the user to their specific dashboard."
 */
export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch role from staff table
  const { data: staff } = await supabase
    .from('staff')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (staff?.role as UserRole) ?? 'staff'
  redirect(ROLE_DASHBOARD_PATHS[role])
}
