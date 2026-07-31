import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/lib/actions/auth.actions'

export const metadata: Metadata = {
  title: 'Dashboard — NIGCOMSAT Travel',
  description: 'NIGCOMSAT Travel Request Tool Dashboard',
}

/**
 * Shared Dashboard Layout — PRD Section 3
 * Wraps all authenticated role-based pages (staff, hr, md, admin).
 * Provides the sidebar navigation and top navbar.
 *
 * TODO (Sprint 1 — Frontend):
 * - Build the Sidebar component (src/components/shared/Sidebar.tsx)
 * - Build the Navbar component (src/components/shared/Navbar.tsx)
 * - Show navigation links based on user role
 * - Highlight active route in sidebar
 * - Mobile-responsive hamburger menu
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Server-side auth check: redirect to login if not authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user details for the navbar/sidebar
  const { data: staff } = await supabase
    .from('staff')
    .select('first_name, surname, role, active')
    .eq('id', user.id)
    .single()

  // PRD Section 2.3: Deactivated staff cannot access the app
  if (!staff || !staff.active) {
    redirect('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar — TODO: Extract to src/components/shared/Sidebar.tsx */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:block">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center border-b border-gray-200 px-6 dark:border-gray-800">
            <span className="text-lg font-bold text-gray-900 dark:text-gray-50">
              NIGCOMSAT Travel
            </span>
          </div>

          {/* Navigation — TODO: Build role-aware nav links */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Navigation
            </p>
            {/* Links will be rendered here based on staff.role */}
          </nav>

          {/* User info + logout */}
          <div className="border-t border-gray-200 p-4 dark:border-gray-800">
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
                {staff.first_name} {staff.surname}
              </p>
              <p className="text-xs capitalize text-gray-500">
                {staff.role}
              </p>
            </div>
            {/* PRD Section 2.1: "Mandatory logout button" */}
            <form action={signOut}>
              <button
                type="submit"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar — TODO: Extract to src/components/shared/Navbar.tsx */}
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 dark:border-gray-800 dark:bg-gray-900 lg:justify-end">
          {/* Mobile menu button — TODO: implement */}
          <button className="text-gray-500 lg:hidden">
            <span className="sr-only">Open menu</span>
            ☰
          </button>
          <div className="text-sm text-gray-500">
            {staff.first_name} {staff.surname}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
