'use client'

/**
 * Admin page tab bar — replaces 4 vertically-stacked sub-apps (Staff,
 * Levels, Rates, Departments) that used to force scrolling past whichever
 * two you didn't want to reach the one you did.
 *
 * URL-synced via `?tab=`, not local-only state, so `nav-config.tsx`'s
 * sidebar links (`/admin?tab=staff` etc.) actually land on the right tab —
 * a client-state-only tab bar would silently ignore a deep link.
 */

import { useRouter, useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'

export interface AdminTab {
  key: string
  label: string
  content: ReactNode
}

export function AdminTabs({ tabs }: { tabs: AdminTab[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeKey = searchParams.get('tab') ?? tabs[0]?.key
  const active = tabs.find((t) => t.key === activeKey) ?? tabs[0]

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-gray-200" role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.key === active?.key
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => router.replace(`?tab=${tab.key}`, { scroll: false })}
              className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <div className="rounded-b-xl border border-t-0 border-gray-200 bg-white p-6" role="tabpanel">
        {active?.content}
      </div>
    </div>
  )
}
