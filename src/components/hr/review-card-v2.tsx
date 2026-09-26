'use client'

/**
 * HR's Phase 0 review form — notes.md v1.1, FR-15 through FR-19. Rendered
 * by review-card.tsx's router whenever `row.memo_number` is set; the
 * legacy 5-allowance-field/FX form (review-card-legacy.tsx) never sees a
 * request shaped like this.
 *
 * Exactly three fields are editable (FR-16): days (trip-wide) and, per
 * traveller, transport + airport taxi. DTA and local running are always a
 * pure function of the frozen per-day rate × the day count shown here —
 * never a text box. An unmapped traveller blocks forwarding entirely
 * (FR-13); the fix is Admin mapping their designation, not a number typed
 * in here.
 */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { hrRejectRequest } from '@/lib/actions/requests.actions'
import { hrReviewRequestV2 } from '@/lib/actions/hr-review-v2.actions'
import { departmentName, staffName } from '@/components/hr/request-row'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Money } from '@/components/ui/money'
import { AlertTriangleIcon } from '@/components/ui/icons'
import { formatDate, formatNGN } from '@/lib/utils/formatting'
import type { TravelRequestForHR } from '@/types/database'

export function ReviewCardV2({ row }: { row: TravelRequestForHR }) {
  const router = useRouter()
  const travelers = useMemo(() => row.request_travelers ?? [], [row.request_travelers])

  const [days, setDays] = useState(row.days ?? 1)
  const [inputs, setInputs] = useState<Record<string, { transport: string; taxi: string }>>(() =>
    Object.fromEntries(
      travelers.map((t) => [
        t.id,
        {
          transport: String(t.transport_override ?? t.transport_amount),
          taxi: String(t.airport_taxi_override ?? t.airport_taxi_amount),
        },
      ])
    )
  )
  const [note, setNote] = useState('')
  const [pendingAction, setPendingAction] = useState<'forward' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function updateInput(travelerId: string, field: 'transport' | 'taxi', value: string) {
    setInputs((prev) => ({ ...prev, [travelerId]: { ...prev[travelerId], [field]: value } }))
  }

  const priced = useMemo(
    () =>
      travelers.map((t) => {
        const transport = Number(inputs[t.id]?.transport ?? t.transport_amount)
        const taxi = Number(inputs[t.id]?.taxi ?? t.airport_taxi_amount)
        const dtaAmount = t.is_unmapped || t.dta_rate_used == null ? null : t.dta_rate_used * days
        const localAmount = t.is_unmapped || t.local_running_rate_used == null ? null : t.local_running_rate_used * days
        const total = dtaAmount === null || localAmount === null ? null : dtaAmount + localAmount + transport + taxi
        return { traveler: t, transport, taxi, dtaAmount, localAmount, total }
      }),
    [travelers, inputs, days]
  )

  const anyUnmapped = priced.some((p) => p.traveler.is_unmapped)
  const total = anyUnmapped ? null : priced.reduce((sum, p) => sum + (p.total ?? 0), 0)

  function buildBreakdownText(): string {
    const lines = [
      `Memo ${row.memo_number}`,
      `${staffName(row)} · ${departmentName(row)}`,
      `${row.origin} → ${row.destination} · ${formatDate(row.depart_date)}–${formatDate(row.return_date)} · ${days} day${days === 1 ? '' : 's'} · ${row.mode} · ${row.trip_type === 'one_way' ? 'One-way' : 'Return'}`,
      '',
      ...priced.map(
        (p) =>
          `${p.traveler.staff ? [p.traveler.staff.first_name, p.traveler.staff.surname].filter(Boolean).join(' ') : 'Unknown'} (${p.traveler.designation_name}): ${p.total !== null ? formatNGN(p.total) : 'Unmapped — not priced'}`
      ),
      '',
      `Total: ${total !== null ? formatNGN(total) : 'Incomplete — one or more travellers unmapped'}`,
    ]
    return lines.join('\n')
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(buildBreakdownText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleForward() {
    setError(null)
    if (anyUnmapped) {
      setError('One or more travellers have no mapped designation. Ask Admin to map them, then refresh this page.')
      return
    }

    setPendingAction('forward')
    const result = await hrReviewRequestV2({
      request_id: row.id,
      days,
      hr_note: note.trim() || undefined,
      traveler_overrides: priced.map((p) => ({
        request_traveler_id: p.traveler.id,
        transport_value: p.transport,
        airport_taxi_value: p.taxi,
      })),
    })
    setPendingAction(null)

    if (!result.success) {
      setError(result.error ?? 'Something went wrong. Please try again.')
      return
    }
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
    setPendingAction(null)

    if (!result.success) {
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
            {formatDate(row.depart_date)} – {formatDate(row.return_date)} · {row.mode} ·{' '}
            {row.trip_type === 'one_way' ? 'One-way' : 'Return'}
          </p>
        </div>
        <span className="text-xs text-gray-400">
          {row.policy_snapshot?.coverage_percent ?? 100}% coverage
        </span>
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

      {anyUnmapped && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>
            One or more travellers below have no designation mapped to a rate band. This request can&apos;t be
            forwarded until Admin maps them in Staff Management — refresh this page once that&apos;s done.
          </p>
        </div>
      )}

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Reason for Travel</p>
        <p className="mt-1 text-sm text-gray-700">{row.reason_for_travel || '—'}</p>
      </div>

      <div className="max-w-[10rem]">
        <Input
          id={`days-${row.id}`}
          label="Days (trip-wide)"
          type="number"
          min={1}
          value={days}
          onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
        />
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
          Travellers ({travelers.length})
        </p>
        <div className="space-y-3">
          {priced.map(({ traveler: t, transport, taxi, dtaAmount, localAmount, total: travelerTotal }) => (
            <div key={t.id} className="rounded-lg border border-gray-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {t.staff ? [t.staff.first_name, t.staff.surname].filter(Boolean).join(' ') : 'Unknown staff'}
                    {t.is_requester && <span className="ml-1.5 text-xs font-normal text-gray-400">(Requester)</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t.is_unmapped ? (
                      <span className="font-medium text-red-600">Unmapped designation</span>
                    ) : (
                      `${t.designation_name} · ${t.grade_band_code}`
                    )}
                  </p>
                </div>
                <Money ngn={travelerTotal} size="sm" emptyLabel="Unpriced" />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-gray-500">DTA (locked)</p>
                  <p className="text-sm text-gray-700">
                    {dtaAmount !== null ? formatNGN(dtaAmount) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Local Running (locked)</p>
                  <p className="text-sm text-gray-700">
                    {localAmount !== null ? formatNGN(localAmount) : '—'}
                  </p>
                </div>
                <Input
                  id={`transport-${t.id}`}
                  label="Transport"
                  type="number"
                  min={0}
                  step="0.01"
                  value={inputs[t.id]?.transport ?? String(transport)}
                  onChange={(e) => updateInput(t.id, 'transport', e.target.value)}
                />
                <Input
                  id={`taxi-${t.id}`}
                  label="Airport Taxi"
                  type="number"
                  min={0}
                  step="0.01"
                  value={inputs[t.id]?.taxi ?? String(taxi)}
                  onChange={(e) => updateInput(t.id, 'taxi', e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="no-print flex gap-2">
          <Button type="button" variant="outline" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy Breakdown'}
          </Button>
          <Button type="button" variant="outline" onClick={() => window.print()}>
            Print
          </Button>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Request Total</p>
          <Money ngn={total} size="lg" align="right" emptyLabel="Incomplete" />
        </div>
      </div>

      <div className="no-print space-y-2 border-t border-gray-100 pt-3">
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
          <Button variant="primary" disabled={pendingAction !== null || anyUnmapped} onClick={handleForward}>
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
