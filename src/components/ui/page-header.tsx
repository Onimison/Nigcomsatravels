/**
 * Title + subtitle + optional primary action, right-aligned. Replaces the
 * hand-rolled header markup repeated at the top of every dashboard page.
 * See UI_UX_DESIGN_PLAN.md §2.
 */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
