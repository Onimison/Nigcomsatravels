/**
 * One pending request as a compact, clickable row — links straight to its
 * own review page (`/hr/requests/[id]`), never to the full queue. Shared by
 * the HR home preview (`recent-requests-preview.tsx`) and the full queue
 * list (`hr-request-queue.tsx`) so "click one request" behaves identically
 * everywhere it appears.
 */

import Link from 'next/link'
import { formatDate } from '@/lib/utils/formatting'
import { Money } from '@/components/ui/money'
import type { TravelRequestForHR } from '@/types/database'

export function departmentName(row: TravelRequestForHR): string {
  return row.staff?.department?.name ?? 'Unassigned'
}

export function staffName(row: { staff: { first_name: string | null; surname: string | null; email: string } | null }): string {
  if (!row.staff) return 'Unknown staff'
  return [row.staff.first_name, row.staff.surname].filter(Boolean).join(' ') || row.staff.email
}

export function RequestRow({ row }: { row: TravelRequestForHR }) {
  return (
    <Link
      href={`/hr/requests/${row.id}`}
      className="flex flex-wrap items-center justify-between gap-2 py-3 transition-colors first:pt-0 last:pb-0 hover:bg-gray-50"
    >
      <div>
        <p className="text-sm font-medium text-gray-900">
          {row.origin} → {row.destination}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">
          {staffName(row)} · {departmentName(row)}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">
          {formatDate(row.depart_date)} – {formatDate(row.return_date)} · {row.days_requested} day{row.days_requested === 1 ? '' : 's'}
          {row.travellers.length > 1 && <> · {row.travellers.length} travellers</>}
        </p>
      </div>
      <div className="text-right">
        <Money ngn={row.request_total} size="sm" align="right" />
        <p className="text-xs text-gray-500">Submitted {formatDate(row.submitted_at)}</p>
        <div className="mt-1 flex justify-end gap-1">
          {row.previousRejectionReason && (
            <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              Resubmission
            </span>
          )}
          {row.overlaps.length > 0 && (
            <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              Overlap
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
