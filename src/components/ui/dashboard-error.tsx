'use client'

/**
 * Shared error fallback for the four role dashboards. Rendered by each
 * route's error.tsx (a required Client Component / Error Boundary per
 * Next.js — see node_modules/next/dist/docs/.../file-conventions/error.md).
 */

interface DashboardErrorProps {
  error: Error & { digest?: string }
  /** Next 16.2's `unstable_retry` (preferred) or the classic `reset`. */
  retry?: () => void
  title?: string
}

export function DashboardError({ error, retry, title = 'Something went wrong' }: DashboardErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-10 text-center dark:border-red-900/50 dark:bg-red-950/30">
      <h2 className="text-lg font-semibold text-red-900 dark:text-red-300">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-red-700 dark:text-red-400">
        {error.message || 'An unexpected error occurred while loading this page.'}
      </p>
      {retry && (
        <button
          type="button"
          onClick={retry}
          className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-800"
        >
          Try again
        </button>
      )}
    </div>
  )
}
