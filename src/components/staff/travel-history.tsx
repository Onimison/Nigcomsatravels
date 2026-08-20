'use client'

/**
 * Full travel history, grouped by travel_group_id — /staff/history.
 * Extracted from the old single-page staff-dashboard.tsx
 * (UI_UX_DESIGN_PLAN.md §3.2).
 */

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { RequestCard, type StaffRequestRow } from './request-card'

export function TravelHistory({ requests }: { requests: StaffRequestRow[] }) {
  const router = useRouter()

  const historyGroups = useMemo(() => {
    const groups = new Map<string, StaffRequestRow[]>()
    for (const row of requests) {
      const list = groups.get(row.travel_group_id) ?? []
      list.push(row)
      groups.set(row.travel_group_id, list)
    }
    return [...groups.values()]
      .map((versions) => versions.sort((a, b) => a.created_at.localeCompare(b.created_at)))
      .sort((a, b) => b[b.length - 1].created_at.localeCompare(a[a.length - 1].created_at))
  }, [requests])

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Travel History</h2>
      <p className="mt-1 text-sm text-gray-500">
        Every trip you&rsquo;ve requested, grouped by resubmission chain.
      </p>
      {historyGroups.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">Your past travel requests will appear here.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {historyGroups.map((versions) => (
            <div key={versions[0].travel_group_id} className="space-y-2">
              {versions.map((row, i) => (
                <RequestCard
                  key={row.id}
                  row={row}
                  onResubmit={
                    versions.length - 1 === i ? (id) => router.push(`/staff/request?resubmit=${id}`) : undefined
                  }
                  versionLabel={versions.length > 1 ? `Attempt ${i + 1} of ${versions.length}` : undefined}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
