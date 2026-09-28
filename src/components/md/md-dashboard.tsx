'use client'

/**
 * MD Dashboard orchestrator — PRD Section 3.3
 *
 * Renders the pending-approval queue (sortable/filterable) plus a read-only
 * decision history, built from getPendingMDRequests() / getMDHistory()
 * (both fetched server-side in page.tsx).
 */

import { useMemo, useState } from 'react'
import { mdApproveReject } from '@/lib/actions/requests.actions'
import { StatusBadge } from '@/components/ui/status-badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { CashIcon } from '@/components/ui/icons'
import { Money } from '@/components/ui/money'
import { formatDate, usdToNgn } from '@/lib/utils/formatting'
import type { RequestTravelerWithName, TravelRequestForMD } from '@/types/database'
import { useRouter } from 'next/navigation'

type SortKey = 'cost_desc' | 'earliest' | 'department'

const ALLOWANCE_FIELDS: { key: keyof TravelRequestForMD; label: string }[] = [
  { key: 'allowance_local', label: 'Local Running' },
  { key: 'allowance_flight', label: 'Flight' },
  { key: 'allowance_taxi', label: 'Airport Taxi' },
  { key: 'accommodation', label: 'Accommodation' },
  { key: 'per_diem', label: 'Per Diem' },
]

function departmentName(row: TravelRequestForMD): string {
  return row.staff?.department?.name ?? 'Unassigned'
}

function staffName(row: TravelRequestForMD): string {
  if (!row.staff) return 'Unknown staff'
  return [row.staff.first_name, row.staff.surname].filter(Boolean).join(' ') || row.staff.email
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
  const coveragePercent = row.staff?.level?.coverage_percent ?? null

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
          <CashIcon className="h-3.5 w-3.5" />
        </span>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Cost Breakdown (NGN)</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
        {ALLOWANCE_FIELDS.map(({ key, label }) => {
          const usd = row[key] != null ? Number(row[key]) : null
          return (
            <div key={key} className="flex justify-between gap-2 sm:block">
              <dt className="text-xs text-gray-500">{label}</dt>
              <dd>
                <Money
                  ngn={usd != null && row.locked_fx_rate != null ? usdToNgn(usd, row.locked_fx_rate) : null}
                  usd={usd}
                  size="sm"
                  layout="inline"
                />
              </dd>
            </div>
          )
        })}
      </dl>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-gray-200 pt-2">
        <span className="text-xs text-gray-500">
          Level coverage: {coveragePercent != null ? `${coveragePercent}%` : 'Unknown'}
        </span>
        <div>
          <p className="text-xs text-gray-500">Final Total</p>
          {row.final_cost != null ? (
            <Money
              ngn={row.locked_fx_rate != null ? usdToNgn(row.final_cost, row.locked_fx_rate) : null}
              usd={row.final_cost}
              size="md"
              align="right"
            />
          ) : (
            <p className="text-sm font-medium text-gray-500">Pending HR calculation</p>
          )}
        </div>
      </div>
    </div>
  )
}

/** FR-21: "coverage rationale" — why this trip landed at 100% or 75%, in the reader's own words rather than a bare percentage. */
function coverageRationale(row: TravelRequestForMD): string {
  const snapshot = row.policy_snapshot
  if (!snapshot) return 'Coverage rationale unavailable for this request.'
  const cities = snapshot.full_coverage_cities.join(', ')
  return snapshot.coverage_percent === 100
    ? `${row.destination} is a full-coverage destination (${cities}) — DTA and local running are paid at 100%.`
    : `${row.destination} is outside the full-coverage list (${cities}) — DTA and local running are paid at the reduced 75% tier.`
}

function TravelerBreakdownReadOnly({ travelers }: { travelers: RequestTravelerWithName[] }) {
  return (
    <div className="space-y-2">
      {travelers.map((t) => (
        <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 p-2.5 text-sm">
          <div>
            <p className="font-medium text-gray-900">
              {t.staff ? [t.staff.first_name, t.staff.surname].filter(Boolean).join(' ') : 'Unknown staff'}
              {t.is_requester && <span className="ml-1.5 text-xs font-normal text-gray-400">(Requester)</span>}
            </p>
            <p className="text-xs text-gray-500">
              {t.is_unmapped ? 'Unmapped designation' : `${t.designation_name}${t.grade_band_code ? ` · ${t.grade_band_code}` : ''}`}
            </p>
          </div>
          <Money ngn={t.traveller_total} size="sm" emptyLabel="Unpriced" />
        </div>
      ))}
    </div>
  )
}

/**
 * FR-21: the MD's approve/reject action on this platform is retired for a
 * Phase 0 request — this is read-only, always. The MD approves or rejects
 * memo_number directly in the ERP; FR-22 (Phase 5) is what will eventually
 * reflect that decision back here automatically.
 */
function PendingCardReadOnly({ row }: { row: TravelRequestForMD }) {
  const travelers = row.request_travelers ?? []

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
            {formatDate(row.depart_date)} – {formatDate(row.return_date)} · {row.days} day{row.days === 1 ? '' : 's'} ·{' '}
            {row.mode} · {row.trip_type === 'one_way' ? 'One-way' : 'Return'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Total Cost</p>
          <Money ngn={row.total_ngn} size="lg" align="right" emptyLabel="Incomplete" />
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        {coverageRationale(row)}
      </div>

      <ReasonPair row={row} />

      {travelers.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
            Travellers ({travelers.length})
          </p>
          <TravelerBreakdownReadOnly travelers={travelers} />
        </div>
      )}

      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500">
        Approving or rejecting this memo happens directly in the ERP — that action has been retired on this
        platform. Once the ERP decision-polling integration ships, it will show up here automatically.
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

function PendingCard({ row }: { row: TravelRequestForMD }) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [isFinal, setIsFinal] = useState(false)
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleAction(action: 'approve' | 'reject') {
    setError(null)

    if (action === 'reject' && note.trim().length === 0) {
      setError('A reason is required when rejecting a request')
      return
    }

    setPendingAction(action)
    const result = await mdApproveReject({
      request_id: row.id,
      action,
      reason: note.trim() || undefined,
      is_final: action === 'reject' ? isFinal : false,
    })
    setPendingAction(null)

    if (!result.success) {
      setError(result.error ?? 'Something went wrong. Please try again.')
      return
    }

    router.refresh()
  }

  return (
    <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-gray-900">
            {row.origin} → {row.destination}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {staffName(row)} · {departmentName(row)}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {formatDate(row.depart_date)} – {formatDate(row.return_date)} · {row.mode}
          </p>
        </div>
      </div>

      <CostBreakdown row={row} />
      <ReasonPair row={row} />

      <div className="space-y-2 border-t border-gray-100 pt-3">
        <label className="block text-xs font-medium text-gray-700" htmlFor={`note-${row.id}`}>
          Reason (required to reject, optional note when approving)
        </label>
        <textarea
          id={`note-${row.id}`}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />

        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={isFinal}
            onChange={(e) => setIsFinal(e.target.checked)}
            className="rounded border-gray-300"
          />
          Mark rejection as final (blocks resubmission)
        </label>

        {error && (
          <p className="text-sm text-red-600" role="alert">{error}</p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="success" disabled={pendingAction !== null} onClick={() => handleAction('approve')}>
            {pendingAction === 'approve' ? 'Approving…' : 'Approve'}
          </Button>
          <Button variant="danger" disabled={pendingAction !== null} onClick={() => handleAction('reject')}>
            {pendingAction === 'reject' ? 'Rejecting…' : 'Reject'}
          </Button>
        </div>
      </div>
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
            {row.memo_number && <span className="ml-2 text-xs font-normal text-gray-400">Memo {row.memo_number}</span>}
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
            {row.memo_number ? (
              <Money ngn={row.total_ngn} align="right" />
            ) : (
              <Money
                ngn={row.final_cost != null && row.locked_fx_rate != null ? usdToNgn(row.final_cost, row.locked_fx_rate) : null}
                usd={row.final_cost}
                align="right"
              />
            )}
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
          return (b.final_cost ?? b.total_ngn ?? 0) - (a.final_cost ?? a.total_ngn ?? 0)
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
      <Card title={`Pending Approval (${visible.length})`} action={filterRow}>
        {visible.length === 0 ? (
          <p className="text-sm text-gray-500">
            {pending.length === 0
              ? 'No requests awaiting MD approval.'
              : 'No requests match the current filters.'}
          </p>
        ) : (
          <div className="space-y-3">
            {visible.map((row) =>
              row.memo_number ? (
                <PendingCardReadOnly key={row.id} row={row} />
              ) : (
                <PendingCard key={row.id} row={row} />
              )
            )}
          </div>
        )}
      </Card>

      <Card title="Approval History">
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">
            Past approvals and rejections will appear here.
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
