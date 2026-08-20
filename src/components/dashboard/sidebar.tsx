'use client'

/**
 * Dashboard sidebar nav. Client component (needs usePathname for active-route
 * highlighting). See UI_UX_DESIGN_PLAN.md §2/§3.1.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { EyeMark } from '@/components/auth/icons'
import { LogoutIcon } from '@/components/ui/icons'
import { Button } from '@/components/ui/button'
import type { NavItem } from '@/lib/utils/nav-config'

interface SidebarProps {
  navItems: NavItem[]
  badgeCounts: Partial<Record<'pending', number>>
  staffName: string
  role: string
  signOutAction: () => Promise<void>
  onNavigate?: () => void
}

function isActive(pathname: string, href: string): boolean {
  const base = href.split('#')[0]
  if (base === '/staff' || base === '/hr' || base === '/md' || base === '/admin') {
    return pathname === base
  }
  return pathname === base || pathname.startsWith(`${base}/`)
}

export function Sidebar({ navItems, badgeCounts, staffName, role, signOutAction, onNavigate }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col">
      {/* Logo — mirrors the brand mark in components/auth/brand-panel.tsx */}
      <div className="flex h-16 items-center gap-2.5 border-b border-gray-200 px-6 dark:border-gray-800">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600">
          <EyeMark className="h-4 w-4 text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight text-gray-900 dark:text-gray-50">NIGCOMSAT</p>
          <p className="text-[10px] font-semibold tracking-widest text-gray-400">TRAVELS</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href)
          const badge = item.badgeKey ? badgeCounts[item.badgeKey] : undefined
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                  : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800/60'
              }`}
            >
              <Icon className={`h-4 w-4 flex-shrink-0 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
              <span className="flex-1">{item.label}</span>
              {!!badge && badge > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-semibold text-white">
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User info + logout — PRD 2.1: "Mandatory logout button" */}
      <div className="border-t border-gray-200 p-4 dark:border-gray-800">
        <div className="mb-3">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{staffName}</p>
          <p className="text-xs capitalize text-gray-500">{role}</p>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="secondary" className="w-full gap-2">
            <LogoutIcon className="h-4 w-4" />
            Sign Out
          </Button>
        </form>
      </div>
    </div>
  )
}
