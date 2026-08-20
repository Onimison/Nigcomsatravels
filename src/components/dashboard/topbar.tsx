'use client'

/**
 * Dashboard topbar: mobile menu toggle, page title, bell (static — no
 * notification backend exists yet, this is a visual placeholder, not wired
 * to fake data), and user avatar. See UI_UX_DESIGN_PLAN.md §3.1.
 */

import { BellIcon, MenuIcon } from '@/components/ui/icons'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

export function Topbar({
  title,
  staffName,
  role,
  onMenuClick,
}: {
  title: string
  staffName: string
  role: string
  onMenuClick: () => void
}) {
  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden"
        >
          <span className="sr-only">Open menu</span>
          <MenuIcon />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          className="relative rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          aria-label="Notifications"
        >
          <BellIcon />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
            {initials(staffName)}
          </div>
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{staffName}</p>
            <p className="text-xs capitalize text-gray-500">{role}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
