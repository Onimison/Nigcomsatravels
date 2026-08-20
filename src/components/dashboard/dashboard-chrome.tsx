'use client'

/**
 * Combines Sidebar + Topbar + mobile drawer state. Replaces the inline
 * <aside>/<header> markup that used to live directly in
 * `(dashboard)/layout.tsx` (see UI_UX_DESIGN_PLAN.md §3.1).
 */

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { XIcon } from '@/components/ui/icons'
import type { NavItem } from '@/lib/utils/nav-config'

export function DashboardChrome({
  navItems,
  badgeCounts,
  staffName,
  role,
  signOutAction,
  children,
}: {
  navItems: NavItem[]
  badgeCounts: Partial<Record<'pending', number>>
  staffName: string
  role: string
  signOutAction: () => Promise<void>
  children: React.ReactNode
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  const title = navItems.find((item) => {
    const base = item.href.split('#')[0]
    return pathname === base || (base !== `/${role}` && pathname.startsWith(`${base}/`))
  })?.label ?? 'Dashboard'

  const sidebarProps = { navItems, badgeCounts, staffName, role, signOutAction }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:block">
        <Sidebar {...sidebarProps} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl dark:bg-gray-900">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <span className="sr-only">Close menu</span>
              <XIcon />
            </button>
            <Sidebar {...sidebarProps} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title={title} staffName={staffName} role={role} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
