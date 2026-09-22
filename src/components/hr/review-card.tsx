'use client'

/**
 * The single-request review form — REVISED_SCOPE.md §7 (HR surface).
 *
 * The queue shows a computed total on arrival, not empty fields to fill —
 * that's the change that removes the work. HR edits exactly three things:
 * days allowed (trip-level) and transport/airport-taxi (per traveller).
 * DTA and local running are locked policy, recomputed live as HR edits
 * days — never hand-entered.
 *
 * The on-screen recompute uses the request's `policy_snapshot` (what the
 * staff member saw at submit) so it updates instantly with no round trip;
 * the server always recomputes from the *current* band/coverage/policy
 * data when this is actually saved (§4.3 — server authority). If an admin
 * changed a rate in between, the saved total reflects that, not this preview.
 */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { hrReviewRequest, hrRejectRequest } from '@/lib/actions/requests.actions'
import { calculateTravellerCost, type PolicyDefaults } from '@/lib/policy/calculate'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CashIcon } from '@/components/ui/icons'
import { Money } from '@/components/ui/money'
import { FlightLookupCard } from '@/components/hr/flight-lookup-card'
import { departmentName, staffName } from '@/components/hr/request-row'
import { formatDate } from '@/lib/utils/formatting'
import type { TravelRequestForHR, RequestTravellerWithStaff } from '@/types/database'

interface SnapshotBand {
  dta_per_day: number
  local_running_per_day: number
}

interface Snapshot {
  coverage_percent?: number
  policy_defaults?: PolicyDefaults
  bands?: Record<string, SnapshotBand>
}

const FALLBACK_POLICY: PolicyDefaults = { airFarePerLeg: 150_000, roadFarePerLeg: 50_000, taxiPerLeg: 40_000 }

function travellerName(t: RequestTravellerWithStaff): string {
  if (!t.staff) return 'Unknown staff'
  return [t.staff.first_name, t.staff.surname].filter(Boolean).join(' ') || t.staff.email
}

export function ReviewCard({ row }: { row: TravelRequestForHR }) {
  const router = useRouter()
  const snapshot = (row.policy_snapshot ?? {}) as Snapshot
  const coveragePercent = row.coverage_percent_applied ?? snapshot.coverage_percent ?? 100
  const policyDefaults = snapshot.policy_defaults ?? FALLBACK_POLICY
  const mode = (row.mode as 'air' | 'road') ?? 'air'

  const [daysApproved, setDaysApproved] = useState(String(row.days_approved ?? row.days_requested))
  const [overrides, setOverrides] = useState<Record<string, { transport: string; taxi: string }>>(() =>
    Object.fromEntries(
      row.travellers.map((t) => [t.staff_id, { transport: String(t.transport_cost), taxi: String(t.airport_taxi) }])
    )
  )
  const [note, setNote] = useState('')
  const [pendingAction, setPendingAction] = useState<'forward' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const days = Number(daysApproved)
  const validDays = Number.isFinite(days) && days >= 1

  const computed = useMemo(() => {
    if (!validDays) return []
    return row.travellers.map((t) => {
      const band = snapshot.bands?.[t.grade_band_code]
      const override = overrides[t.staff_id]
      const result = calculateTravellerCost({
        dtaPerDay: band?.dta_per_day ?? 0,
        localRunningPerDay: band?.local_running_per_day ?? 0,
        coveragePercent,
        days,
        mode,
        oneWay: row.one_way,
        policyDefaults,
        transportOverride: override ? Number(override.transport) : undefined,
        airportTaxiOverride: override ? Number(override.taxi) : undefined,
      })
      return { staffId: t.staff_id, name: travellerName(t), ...result }
    })
  }, [row.travellers, row.one_way, snapshot.bands, overrides, coveragePercent, days, mode, policyDefaults, validDays])

  const grandTotal = computed.reduce((sum, t) => sum + t.total, 0)

  function updateOverride(staffId: string, field: 'transport' | 'taxi', value: string) {
    setOverrides((prev) => ({ ...prev, [staffId]: { ...prev[staffId], [field]: value } }))
  }

  async function handleForward() {
    setError(null)

    if (!validDays) {
      setError('Enter a valid number of days')
      return
    }

    const travellers = row.travellers.map((t) => {
      const override = overrides[t.staff_id]
      return {
        staff_id: t.staff_id,
        transport_cost: Number(override?.transport ?? 0),
        airport_taxi: mode === 'road' ? 0 : Number(override?.taxi ?? 0),
      }
    })

    setPendingAction('forward')
    const result = await hrReviewRequest({
      request_id: row.id,
      days_approved: days,
      travellers,
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
      setError('A reason is required when returning a request')
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
            {staffName(row)} · {departmentName(row)} · Memo {row.memo_number}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {formatDate(row.depart_date)} – {formatDate(row.return_date)} · {row.days_requested} day{row.days_requested === 1 ? '' : 's'} requested · {mode}
            {row.one_way && ' · one-way'}
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
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Cost Breakdown (NGN)</p>
          </div>
          <div className="w-32">
            <Input
              label="Days Allowed"
              type="number"
              min={1}
              value={daysApproved}
              onChange={(e) => setDaysApproved(e.target.value)}
            />
          </div>
        </div>

        {/* Air trips only — there's no fare to look up for a road journey. */}
        {mode === 'air' && (
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
            />
          </div>
        )}

        <div className="mt-3 space-y-3">
          {computed.map((t) => {
            const override = overrides[t.staffId]
            return (
              <div key={t.staffId} className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">{t.name}</p>
                  <Money ngn={t.total} size="sm" />
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-gray-500">DTA</p>
                    <Money ngn={t.dta} size="sm" layout="inline" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Local Running</p>
                    <Money ngn={t.localRunning} size="sm" layout="inline" />
                  </div>
                  <Input
                    label="Transport"
                    type="number"
                    min={0}
                    step="0.01"
                    value={override?.transport ?? ''}
                    onChange={(e) => updateOverride(t.staffId, 'transport', e.target.value)}
                  />
                  <Input
                    label="Airport Taxi"
                    type="number"
                    min={0}
                    step="0.01"
                    value={mode === 'road' ? '0' : (override?.taxi ?? '')}
                    onChange={(e) => updateOverride(t.staffId, 'taxi', e.target.value)}
                    disabled={mode === 'road'}
                  />
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-gray-200 pt-3">
          <p className="text-xs text-gray-500">
            {row.travellers.length} traveller{row.travellers.length === 1 ? '' : 's'} · {coveragePercent}% coverage
          </p>
          <div>
            <p className="text-xs text-gray-500">Total</p>
            <Money ngn={validDays ? grandTotal : null} size="lg" align="right" />
          </div>
        </div>
      </div>

      <div className="space-y-2 border-t border-gray-100 pt-3">
        <label className="block text-xs font-medium text-gray-700" htmlFor={`note-${row.id}`}>
          Note (optional when forwarding, required to return)
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
            {pendingAction === 'forward' ? 'Saving…' : 'Forward (ready for ERP)'}
          </Button>
          <Button variant="danger" disabled={pendingAction !== null} onClick={handleReject}>
            {pendingAction === 'reject' ? 'Returning…' : 'Return to Staff'}
          </Button>
        </div>
      </div>
    </div>
  )
}
