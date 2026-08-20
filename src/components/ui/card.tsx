/**
 * Shared section Card — visual reference: frontend/components/ui/card.tsx,
 * adapted to the `rounded-xl border ... dark:` pattern every dashboard
 * section already hand-rolls (staff-dashboard.tsx, md-dashboard.tsx,
 * admin/page.tsx), so wrapping existing sections in it is a no-op visually.
 */

import type { ReactNode } from 'react'

interface CardProps {
  title?: string
  description?: string
  /** Rendered to the right of the title — e.g. an "Add Staff" button. */
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function Card({ title, description, action, children, className = '' }: CardProps) {
  return (
    <section
      className={`rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 ${className}`}
    >
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {title && <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">{title}</h2>}
            {description && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
