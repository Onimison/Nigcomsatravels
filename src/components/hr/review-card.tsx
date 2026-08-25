'use client'

/**
 * The single-request review form — allowance entry, live fare lookup,
 * forward/reject. Lives entirely on its own page (`/hr/requests/[id]`),
 * one request at a time — not one instance per row in a long list, which is
 * what `hr-request-queue.tsx` used to render before the queue became a
 * compact, clickable list (todays-task.md: "clicking each one should only
 * open the particular review").
 */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { hrReviewRequest, hrRejectRequest, getRateSuggestionForRequest } from '@/lib/actions/requests.actions'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CashIcon } from '@/components/ui/icons'
import { Money } from '@/components/ui/money'
import { FlightLookupCard } from '@/components/hr/flight-lookup-card'
import { departmentName, staffName } from '@/components/hr/request-row'
import {
  formatDate,
  formatNGN,
  usdToNgn,
  ngnToUsd,
  calculateTotalRawAllowance,
  calculateFinalCost,
  formatStaleness,
} from '@/lib/utils/formatting'
import type { TravelRequestForHR } from '@/types/database'

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

export function ReviewCard({ row, fxRate }: { row: TravelRequestForHR; fxRate: number | null }) {
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

  // HR types these in Naira — what accommodation/flight/taxi quotes actually
  // come in. Everything downstream (travel_requests columns, MD's dashboard,
  // the audit trail) is USD, so the NGN entry is converted at this boundary,
  // once, using the same rate that gets locked onto the request in
  // hrReviewRequest() (PRD Section 5.2).
  const parsedAllowancesNgn = useMemo(() => {
    const parsed = {} as Record<AllowanceField, number>
    for (const { key } of ALLOWANCE_FIELDS) {
      const n = Number(allowances[key])
      parsed[key] = Number.isFinite(n) ? n : 0
    }
    return parsed
  }, [allowances])

  const rawTotalNgn = calculateTotalRawAllowance(parsedAllowancesNgn)
  const finalCostNgn = calculateFinalCost(rawTotalNgn, coveragePercent)
  const rawTotalUsd = fxRate ? ngnToUsd(rawTotalNgn, fxRate) : null
  const finalCostUsd = fxRate ? ngnToUsd(finalCostNgn, fxRate) : null

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

    if (!fxRate) {
      setSuggestion({
        loading: false,
        checked: true,
        message: 'No FX rate configured; enter amounts manually.',
      })
      return
    }

    const { data } = result
    // Reference rates in the Master Rate Table are USD — convert to NGN,
    // since that's what these fields take.
    const toNgnString = (usd: number) => (Math.round(usdToNgn(usd, fxRate) * 100) / 100).toString()
    setAllowances((prev) => ({
      ...prev,
      ...(data.allowance_flight != null && { allowance_flight: toNgnString(data.allowance_flight) }),
      ...(data.allowance_taxi != null && { allowance_taxi: toNgnString(data.allowance_taxi) }),
      ...(data.accommodation != null && { accommodation: toNgnString(data.accommodation) }),
      ...(data.per_diem != null && { per_diem: toNgnString(data.per_diem) }),
    }))
    const staleness =
      data.allowance_flight != null ? ` Flight price: ${formatStaleness(data.flightUpdatedAt).toLowerCase()}.` : ''
    setSuggestion({
      loading: false,
      checked: true,
      message: `Standard rates applied, converted to NGN at today's rate. Review before forwarding.${staleness}`,
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

    if (!fxRate) {
      setError('No FX rate is configured. Contact an admin before forwarding.')
      return
    }

    setPendingAction('forward')
    const result = await hrReviewRequest({
      request_id: row.id,
      // Stored/calculated in USD — convert the NGN entry at the boundary.
      allowance_local: ngnToUsd(parsedAllowancesNgn.allowance_local, fxRate),
      allowance_flight: ngnToUsd(parsedAllowancesNgn.allowance_flight, fxRate),
      allowance_taxi: ngnToUsd(parsedAllowancesNgn.allowance_taxi, fxRate),
      accommodation: ngnToUsd(parsedAllowancesNgn.accommodation, fxRate),
      per_diem: ngnToUsd(parsedAllowancesNgn.per_diem, fxRate),
      hr_note: note.trim() || undefined,
    })

    if (!result.success) {
      setPendingAction(null)
      setError(result.error ?? 'Something went wrong. Please try again.')
      return
    }

    // Handled — this request is no longer awaiting HR review, so there's
    // nothing left to show here. Back to the queue.
    router.push('/hr/requests')
  }

  async function handleReject() {
    setError(null)

    if (note.trim().length === 0) {
      setError('A reason is required when rejecting a request')
      return
    }

    setPendingAction('reject')
    const result = await hrRejectRequest({ request_id: row.id, reason: note.trim() })

    if (!result.success) {
      setPendingAction(null)
      setError(result.error ?? 'Something went wrong. Please try again.')
      return
    }

    router.push('/hr/requests')
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
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Allowances (NGN)</p>
              {fxRate && (
                <p className="text-[11px] text-gray-400">1 USD ≈ {formatNGN(fxRate)}</p>
              )}
            </div>
          </div>
          <Button variant="outline" onClick={handleSuggestRates} disabled={suggestion.loading}>
            {suggestion.loading ? 'Looking up rates…' : 'Suggest Standard Rates'}
          </Button>
        </div>

        {!fxRate && (
          <p className="mt-2 text-xs text-red-600" role="alert">
            No FX rate is configured — amounts can&apos;t be converted to USD for storage. Contact an admin.
          </p>
        )}

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

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-gray-200 pt-3">
          <div>
            <p className="text-xs text-gray-500">Total Raw Allowance</p>
            <Money ngn={rawTotalNgn} usd={rawTotalUsd} size="sm" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Final Total ({coveragePercent}% coverage)</p>
            <Money ngn={finalCostNgn} usd={finalCostUsd} size="lg" align="right" />
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
