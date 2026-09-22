import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { requireDashboardAccess } from '@/lib/utils/auth-guard'
import { getRequestById } from '@/lib/actions/requests.actions'
import { PrintableMemo } from '@/components/hr/printable-memo'
import { ArrowLeftIcon } from '@/components/ui/icons'

export const metadata: Metadata = {
  title: 'Memo — NIGCOMSAT Travel',
  description: 'Printable travel memo and cost breakdown',
}

/**
 * Printable memo + copy-ready breakdown (REVISED_SCOPE.md §7) — the Phase 0
 * deliverable HR pastes into the ERP. Available once a request has been
 * forwarded; a still-pending request has nothing priced to print yet.
 */
export default async function RequestMemoPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireDashboardAccess('hr')
  if (!auth.authorized) {
    redirect('/')
  }

  const { id } = await params
  const result = await getRequestById(id)

  if (!result.success || !result.data) {
    notFound()
  }

  return (
    <div className="space-y-6 print:space-y-0">
      <Link
        href="/hr/history"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800 print:hidden"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Back to History
      </Link>

      <PrintableMemo row={result.data} />
    </div>
  )
}
