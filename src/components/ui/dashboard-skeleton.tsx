/**
 * Shared loading fallback for the four role dashboards (staff/hr/md/admin).
 * PRD Day 3 hardening — see IMPLEMENTATION_PLAN.md §3: "Add loading/error/
 * empty states across all four dashboards."
 */

import { Skeleton } from './skeleton'

export function DashboardSkeleton({ sections = 2 }: { sections?: number }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
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
