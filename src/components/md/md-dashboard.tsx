'use client'

/**
 * MD Dashboard — REVISED_SCOPE.md decision 5 / M6: read-only. Approval now
 * happens in the ERP, not here. This view exists so the MD can see the
 * total, the per-traveller breakdown, and HR's note without asking "why is
 * this ₦X?" — the ERP memo will carry only the total.
 */

import { useMemo, useState } from 'react'
import { StatusBadge } from '@/components/ui/status-badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { CashIcon } from '@/components/ui/icons'
import { Money } from '@/components/ui/money'
import { formatDate } from '@/lib/utils/formatting'
import type { RequestTravellerWithStaff, TravelRequestForMD } from '@/types/database'

type SortKey = 'cost_desc' | 'earliest' | 'department'

function departmentName(row: TravelRequestForMD): string {
  return row.staff?.department?.name ?? 'Unassigned'
}

function staffName(row: TravelRequestForMD): string {
  if (!row.staff) return 'Unknown staff'
  return [row.staff.first_name, row.staff.surname].filter(Boolean).join(' ') || row.staff.email
}

function travellerName(t: RequestTravellerWithStaff): string {
  if (!t.staff) return 'Unknown staff'
  return [t.staff.first_name, t.staff.surname].filter(Boolean).join(' ') || t.staff.email
}

/** HR's forwarding note is the reason on the `hr_approved` row, if any. */
function hrNote(row: TravelRequestForMD): string | null {
  const approved = (row.approvals ?? []).filter((a) => a.status === 'hr_approved')
  if (approved.length === 0) return null
  const latest = [...approved].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0]
  return latest?.reason ?? null
}

/** Most recent decision reason — used in the history list. */
function decisionReason(row: TravelRequestForMD): string | null {
  const decisions = (row.approvals ?? []).filter(
    (a) => a.status === 'md_approved' || a.status === 'md_rejected'
  )
  if (decisions.length === 0) return null
  const latest = [...decisions].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0]
  return latest?.reason ?? null
}

function CostBreakdown({ row }: { row: TravelRequestForMD }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
          <CashIcon className="h-3.5 w-3.5" />
        </span>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Cost Breakdown (NGN)</p>
      </div>
      <div className="space-y-2">
        {row.travellers.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-2 rounded border border-gray-200 bg-white px-2.5 py-1.5">
            <div>
              <p className="text-xs font-medium text-gray-900">{travellerName(t)}</p>
              <p className="text-[11px] text-gray-500">{t.grade_band_code}</p>
            </div>
            <Money ngn={t.traveller_total} size="sm" layout="inline" />
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-gray-200 pt-2">
        <span className="text-xs text-gray-500">
          Coverage: {row.coverage_percent_applied != null ? `${row.coverage_percent_applied}%` : 'Unknown'}
        </span>
        <div>
          <p className="text-xs text-gray-500">Total</p>
          <Money ngn={row.request_total} size="md" align="right" />
        </div>
      </div>
    </div>
  )
}

function ReasonPair({ row }: { row: TravelRequestForMD }) {
  const note = hrNote(row)
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
          Staff&apos;s Reason for Travel
        </p>
        <p className="mt-1 text-sm text-gray-700">
          {row.reason_for_travel || '—'}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
          HR&apos;s Recommendation / Note
        </p>
        <p className="mt-1 text-sm text-gray-700">
          {note || 'No note left by HR.'}
        </p>
      </div>
    </div>
  )
}

function RequestCard({ row }: { row: TravelRequestForMD }) {
  return (
    <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-gray-900">
            {row.origin} → {row.destination}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {staffName(row)} · {departmentName(row)} · Memo {row.memo_number}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {formatDate(row.depart_date)} – {formatDate(row.return_date)} · {row.mode}
          </p>
        </div>
        <StatusBadge status={row.status} />
      </div>

      <CostBreakdown row={row} />
      <ReasonPair row={row} />
    </div>
  )
}

function HistoryCard({ row }: { row: TravelRequestForMD }) {
  const reason = decisionReason(row)
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-gray-900">
            {row.origin} → {row.destination}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {staffName(row)} · {departmentName(row)}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {formatDate(row.depart_date)} – {formatDate(row.return_date)}
          </p>
        </div>
        <div className="text-right">
          <StatusBadge status={row.status} />
          <div className="mt-1">
            <Money ngn={row.request_total} align="right" />
          </div>
        </div>
      </div>
      {reason && (
        <p className="mt-2 text-sm text-gray-600">
          Reason: <span className="italic">“{reason}”</span>
        </p>
      )}
    </div>
  )
}

export function MDDashboard({
  pending,
  history,
}: {
  pending: TravelRequestForMD[]
  history: TravelRequestForMD[]
}) {
  const [department, setDepartment] = useState('all')
  const [destination, setDestination] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('earliest')

  const departments = useMemo(
    () => [...new Set(pending.map(departmentName))].sort(),
    [pending]
  )

  const visible = useMemo(() => {
    const filtered = pending.filter((row) => {
      if (department !== 'all' && departmentName(row) !== department) return false
      if (destination.trim() && !row.destination.toLowerCase().includes(destination.trim().toLowerCase())) {
        return false
      }
      return true
    })

    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'cost_desc':
          return (b.request_total ?? 0) - (a.request_total ?? 0)
        case 'department':
          return departmentName(a).localeCompare(departmentName(b))
        case 'earliest':
        default:
          return a.depart_date.localeCompare(b.depart_date)
      }
    })
  }, [pending, department, destination, sortKey])

  const filterRow = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-44">
        <Select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          aria-label="Filter by department"
        >
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </Select>
      </div>
      <div className="w-48">
        <Input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="Filter by destination"
          aria-label="Filter by destination"
        />
      </div>
      <div className="w-56">
        <Select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          aria-label="Sort requests"
        >
          <option value="earliest">Sort: Earliest Departure</option>
          <option value="cost_desc">Sort: Total Cost (High→Low)</option>
          <option value="department">Sort: Department</option>
        </Select>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        Read-only. Approval now happens in the ERP once HR forwards a request — this view exists so you can see the
        total and the reasoning behind it.
      </p>

      <Card title={`Priced by HR (${visible.length})`} action={filterRow}>
        {visible.length === 0 ? (
          <p className="text-sm text-gray-500">
            {pending.length === 0
              ? 'No requests forwarded by HR yet.'
              : 'No requests match the current filters.'}
          </p>
        ) : (
          <div className="space-y-3">
            {visible.map((row) => (
              <RequestCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </Card>

      <Card title="ERP Outcomes">
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">
            Outcomes reported back from the ERP will appear here once that integration ships.
          </p>
        ) : (
          <div className="space-y-3">
            {history.map((row) => (
              <HistoryCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
