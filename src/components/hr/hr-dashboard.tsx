'use client'

/**
 * HR Dashboard orchestrator — PRD Section 3.2
 *
 * Renders the pending-HR-review queue (filterable) plus a read-only
 * "Recently Processed" history, built from getPendingHRRequests() /
 * getHRHistory() (both fetched server-side in page.tsx).
 */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { hrReviewRequest, hrRejectRequest, getRateSuggestionForRequest } from '@/lib/actions/requests.actions'
import { StatusBadge } from '@/components/ui/status-badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { CashIcon } from '@/components/ui/icons'
import { FlightLookupCard } from '@/components/hr/flight-lookup-card'
import {
  formatDate,
  formatUSD,
  usdToNgn,
  calculateTotalRawAllowance,
  calculateFinalCost,
  formatStaleness,
} from '@/lib/utils/formatting'
import type { TravelRequestForHR, TravelRequestForMD } from '@/types/database'

type SortKey = 'earliest' | 'department' | 'destination'

type AllowanceField = 'allowance_local' | 'allowance_flight' | 'allowance_taxi' | 'accommodation' | 'per_diem'

const ALLOWANCE_FIELDS: { key: AllowanceField; label: string; suggestible: boolean }[] = [
  { key: 'allowance_local', label: 'Local Running', suggestible: false },
  { key: 'allowance_flight', label: 'Flight', suggestible: true },
  { key: 'allowance_taxi', label: 'Airport Taxi', suggestible: true },
  { key: 'accommodation', label: 'Accommodation', suggestible: true },
  { key: 'per_diem', label: 'Per Diem', suggestible: true },
]

const EMPTY_ALLOWANCES: Record<AllowanceField, string> = {
  allowance_local: '',
  allowance_flight: '',
  allowance_taxi: '',
  accommodation: '',
  per_diem: '',
}

function departmentName(row: TravelRequestForHR): string {
  return row.staff?.department?.name ?? 'Unassigned'
}

function staffName(row: { staff: { first_name: string | null; surname: string | null; email: string } | null }): string {
  if (!row.staff) return 'Unknown staff'
  return [row.staff.first_name, row.staff.surname].filter(Boolean).join(' ') || row.staff.email
}

function decisionReason(row: TravelRequestForMD): string | null {
  const decisions = (row.approvals ?? []).filter(
    (a) => a.status === 'hr_approved' || a.status === 'hr_rejected'
  )
  if (decisions.length === 0) return null
  const latest = [...decisions].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0]
  return latest?.reason ?? null
}

function ReviewCard({ row }: { row: TravelRequestForHR }) {
  const router = useRouter()
  const coveragePercent = row.staff?.level?.coverage_percent ?? 100

  const [allowances, setAllowances] = useState<Record<AllowanceField, string>>(EMPTY_ALLOWANCES)
  const [note, setNote] = useState('')
  const [suggestion, setSuggestion] = useState<{ loading: boolean; checked: boolean; message: string | null }>({
    loading: false,
    checked: false,
    message: null,
  })
  const [pendingAction, setPendingAction] = useState<'forward' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const parsedAllowances = useMemo(() => {
    const parsed = {} as Record<AllowanceField, number>
    for (const { key } of ALLOWANCE_FIELDS) {
      const n = Number(allowances[key])
      parsed[key] = Number.isFinite(n) ? n : 0
    }
    return parsed
  }, [allowances])

  const rawTotal = calculateTotalRawAllowance(parsedAllowances)
  const finalCost = calculateFinalCost(rawTotal, coveragePercent)

  function updateField(key: AllowanceField, value: string) {
    setAllowances((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSuggestRates() {
    setSuggestion({ loading: true, checked: false, message: null })
    const result = await getRateSuggestionForRequest(row.id)

    if (!result.success || !result.data) {
      setSuggestion({
        loading: false,
        checked: true,
        message: result.success ? 'No reference rate found; enter amounts manually.' : (result.error ?? 'Could not load suggested rates.'),
      })
      return
    }

    const { data } = result
    setAllowances((prev) => ({
      ...prev,
      ...(data.allowance_flight != null && { allowance_flight: String(data.allowance_flight) }),
      ...(data.allowance_taxi != null && { allowance_taxi: String(data.allowance_taxi) }),
      ...(data.accommodation != null && { accommodation: String(data.accommodation) }),
      ...(data.per_diem != null && { per_diem: String(data.per_diem) }),
    }))
    const staleness =
      data.allowance_flight != null ? ` Flight price: ${formatStaleness(data.flightUpdatedAt).toLowerCase()}.` : ''
    setSuggestion({
      loading: false,
      checked: true,
      message: `Standard rates applied. Review before forwarding.${staleness}`,
    })
  }

  async function handleForward() {
    setError(null)

    for (const { key, label } of ALLOWANCE_FIELDS) {
      if (allowances[key].trim() === '') {
        setError(`Enter an amount for ${label} before forwarding`)
        return
      }
    }

    setPendingAction('forward')
    const result = await hrReviewRequest({
      request_id: row.id,
      allowance_local: parsedAllowances.allowance_local,
      allowance_flight: parsedAllowances.allowance_flight,
      allowance_taxi: parsedAllowances.allowance_taxi,
      accommodation: parsedAllowances.accommodation,
      per_diem: parsedAllowances.per_diem,
      hr_note: note.trim() || undefined,
    })
    setPendingAction(null)

    if (!result.success) {
      setError(result.error ?? 'Something went wrong. Please try again.')
      return
    }

    router.refresh()
  }

  async function handleReject() {
    setError(null)

    if (note.trim().length === 0) {
      setError('A reason is required when rejecting a request')
      return
    }

    setPendingAction('reject')
    const result = await hrRejectRequest({ request_id: row.id, reason: note.trim() })
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
            {formatDate(row.depart_date)} – {formatDate(row.return_date)} · {row.days} day{row.days === 1 ? '' : 's'} · {row.mode}
          </p>
        </div>
        <span className="text-xs text-gray-400">Coverage: {coveragePercent}%</span>
      </div>

      {row.previousRejectionReason && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">This is a resubmission.</p>
          <p className="mt-0.5">Previously returned because: “{row.previousRejectionReason}”</p>
        </div>
      )}

      {row.overlaps.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Overlap warning: {staffName(row)} has {row.overlaps.length === 1 ? 'another active trip' : 'other active trips'} that
          overlap{row.overlaps.length === 1 ? 's' : ''} these dates —{' '}
          {row.overlaps.map((o, i) => (
            <span key={o.id}>
              {i > 0 && ', '}
              {o.destination} ({formatDate(o.depart_date)}–{formatDate(o.return_date)})
            </span>
          ))}
          .
        </div>
      )}

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Reason for Travel</p>
        <p className="mt-1 text-sm text-gray-700">{row.reason_for_travel || '—'}</p>
      </div>

      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <CashIcon className="h-3.5 w-3.5" />
            </span>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Allowances (USD)</p>
          </div>
          <Button variant="outline" onClick={handleSuggestRates} disabled={suggestion.loading}>
            {suggestion.loading ? 'Looking up rates…' : 'Suggest Standard Rates'}
          </Button>
        </div>

        {suggestion.checked && suggestion.message && (
          <p className="mt-2 text-xs text-blue-700">{suggestion.message}</p>
        )}

        {/* Air trips only — there's no fare to look up for a road journey. */}
        {row.mode === 'air' && (
          <div className="mt-3">
            <FlightLookupCard
              originCode={row.origin_airport?.iata_code}
              // Canonical city when the airport resolved, raw text otherwise —
              // this is what lets the same-endpoint guard catch a trip where one
              // side resolved to a code and the other didn't.
              originCity={row.origin_airport?.city ?? row.origin}
              destinationCode={row.destination_airport?.iata_code}
              destinationCity={row.destination_airport?.city ?? row.destination}
              departDate={row.depart_date}
              returnDate={row.return_date}
              cabin={row.staff?.level?.flight_class}
            />
          </div>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ALLOWANCE_FIELDS.map(({ key, label }) => (
            <Input
              key={key}
              id={`${key}-${row.id}`}
              label={label}
              type="number"
              min={0}
              step="0.01"
              value={allowances[key]}
              onChange={(e) => updateField(key, e.target.value)}
              placeholder="0.00"
            />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3">
          <span className="text-xs text-gray-500">Total Raw Allowance: {formatUSD(rawTotal)}</span>
          <div className="text-right">
            <p className="text-xs text-gray-500">Final Total ({coveragePercent}% coverage)</p>
            <p className="text-base font-semibold text-gray-900">{formatUSD(finalCost)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2 border-t border-gray-100 pt-3">
        <label className="block text-xs font-medium text-gray-700" htmlFor={`note-${row.id}`}>
          Note to MD (optional when forwarding, required to reject)
        </label>
        <textarea
          id={`note-${row.id}`}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />

        {error && (
          <p className="text-sm text-red-600" role="alert">{error}</p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="primary" disabled={pendingAction !== null} onClick={handleForward}>
            {pendingAction === 'forward' ? 'Forwarding…' : 'Forward to MD'}
          </Button>
          <Button variant="danger" disabled={pendingAction !== null} onClick={handleReject}>
            {pendingAction === 'reject' ? 'Rejecting…' : 'Reject'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function HistoryRow({ row }: { row: TravelRequestForMD }) {
  const reason = decisionReason(row)
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-gray-900">
            {row.origin} → {row.destination}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {staffName(row)} · {row.staff?.department?.name ?? 'Unassigned'}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {formatDate(row.depart_date)} – {formatDate(row.return_date)}
          </p>
        </div>
        <div className="text-right">
          <StatusBadge status={row.status} />
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {row.final_cost != null ? formatUSD(row.final_cost) : '—'}
          </p>
          {row.final_cost != null && row.locked_fx_rate != null && (
            <p className="text-xs text-gray-500">
              ≈ {usdToNgn(row.final_cost, row.locked_fx_rate).toLocaleString('en-NG', {
                style: 'currency',
                currency: 'NGN',
                maximumFractionDigits: 0,
              })}
            </p>
          )}
        </div>
      </div>
      {reason && row.status === 'hr_rejected' && (
        <p className="mt-2 text-sm text-gray-600">
          Reason: <span className="italic">“{reason}”</span>
        </p>
      )}
    </div>
  )
}

export function HRDashboard({
  pending,
  history,
}: {
  pending: TravelRequestForHR[]
  history: TravelRequestForMD[]
}) {
  const [department, setDepartment] = useState('all')
  const [destination, setDestination] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('earliest')

  const departments = useMemo(() => [...new Set(pending.map(departmentName))].sort(), [pending])

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
        case 'department':
          return departmentName(a).localeCompare(departmentName(b))
        case 'destination':
          return a.destination.localeCompare(b.destination)
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
          <option value="department">Sort: Department</option>
          <option value="destination">Sort: Destination</option>
        </Select>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <Card title={`Awaiting Review (${visible.length})`} action={filterRow}>
        {visible.length === 0 ? (
          <p className="text-sm text-gray-500">
            {pending.length === 0 ? 'No requests pending HR review.' : 'No requests match the current filters.'}
          </p>
        ) : (
          <div className="space-y-3">
            {visible.map((row) => (
              <ReviewCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </Card>

      <Card title="Recently Processed">
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">Forwarded and rejected requests will appear here.</p>
        ) : (
          <div className="space-y-3">
            {history.map((row) => (
              <HistoryRow key={row.id} row={row} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
