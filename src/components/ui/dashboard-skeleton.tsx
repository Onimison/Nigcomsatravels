/**
 * Shared loading fallback for the role dashboards (staff/hr/md/admin).
 * PRD Day 3 hardening — see IMPLEMENTATION_PLAN.md §3: "Add loading/error/
 * empty states across all four dashboards."
 */

import { Skeleton } from './skeleton'

export function DashboardSkeleton({
  sections = 2,
  statTiles = 0,
}: {
  sections?: number
  /** Renders a row of stat-tile-shaped skeletons above the sections, matching StatTile's grid. */
  statTiles?: number
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      {statTiles > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {Array.from({ length: statTiles }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:gap-4 sm:p-5">
              <Skeleton className="h-11 w-11 flex-shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      )}
      {Array.from({ length: sections }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
        >
          <Skeleton className="h-5 w-40" />
          <div className="mt-4 space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}
