'use client'

/**
 * Request to Travel form — REVISED_SCOPE.md §7 (Staff surface).
 *
 * Handles both new submissions and resubmissions of a returned request
 * (same shape, different server action + a visible "what to fix" banner).
 *
 * - Step 1 is the memo number the ERP already generated for this trip.
 * - Origin is one of the four duty stations; destination is the seeded
 *   airports list (20260822160000_airports.sql) with an "Other — not
 *   listed" escape hatch for road-only places.
 * - Days are computed from the date range, not typed — the policy is
 *   explicit that DTA/local running key off an inclusive day count.
 * - Most requests are one person, so the traveller picker stays collapsed
 *   until opened; the requester rides along automatically.
 * - Pre-Submit Estimate: the requester's own line, priced through the same
 *   calculator the server uses — "Subject to HR verification."
 * - Date-Overlap Warning: via useOverlapWarning(), warning only — never blocks submit.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  submitRequest,
  resubmitRequest,
  getRequestEstimate,
} from '@/lib/actions/requests.actions'
import { listStaffDirectory } from '@/lib/actions/staff.actions'
import { useOverlapWarning } from '@/hooks/useOverlapWarning'
import { DUTY_STATIONS } from '@/lib/validations/request.schema'
import { formatDate } from '@/lib/utils/formatting'
import { daysBetweenInclusive } from '@/lib/policy/calculate'
import { queueToast } from '@/lib/utils/toast'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Money } from '@/components/ui/money'
import type { AirportOption, TravelMode } from '@/types/database'

/**
 * Sentinel for the destination free-text escape hatch. Not a uuid, so it
 * can never be mistaken for an airport id by the server-side resolver.
 */
const OTHER = '__other__'

export interface ResubmitTarget {
  id: string
  memo_number: string
  destination: string
  origin: string | null
  destination_airport_id: string | null
  mode: string | null
  one_way: boolean
  days_requested: number | null
  depart_date: string
  return_date: string
  reason_for_travel: string | null
  travellerStaffIds: string[]
  rejectionReason: string | null
}

interface TravelRequestFormProps {
  airports: AirportOption[]
  resubmitTarget?: ResubmitTarget | null
  onCancelResubmit?: () => void
}

const EMPTY_FORM = {
  memoNumber: '',
  destinationChoice: '',
  destinationOther: '',
  origin: DUTY_STATIONS[0] as string,
  mode: 'air' as TravelMode,
  oneWay: false,
  departDate: '',
  returnDate: '',
  reason: '',
  travellerIds: [] as string[],
}

/**
 * Picks the destination dropdown state for a resubmitted trip. Prefers the
 * stored FK, falls back to matching the stored text against a city (rows
 * predating the airports migration have no FK), and only then drops to the
 * free-text hatch.
 */
function resolveChoice(
  airportId: string | null,
  text: string,
  airports: AirportOption[]
): { choice: string; other: string } {
  if (airportId && airports.some((a) => a.id === airportId)) {
    return { choice: airportId, other: '' }
  }
  const trimmed = text.trim()
  const match = airports.find((a) => a.city.toLowerCase() === trimmed.toLowerCase())
  if (match) return { choice: match.id, other: '' }
  return { choice: trimmed ? OTHER : '', other: trimmed }
}

function buildInitialForm(
  airports: AirportOption[],
  resubmitTarget?: ResubmitTarget | null
): typeof EMPTY_FORM {
  if (!resubmitTarget) return EMPTY_FORM

  const destination = resolveChoice(
    resubmitTarget.destination_airport_id,
    resubmitTarget.destination,
    airports
  )

  return {
    memoNumber: resubmitTarget.memo_number,
    destinationChoice: destination.choice,
    destinationOther: destination.other,
    origin: DUTY_STATIONS.includes(resubmitTarget.origin as (typeof DUTY_STATIONS)[number])
      ? (resubmitTarget.origin as string)
      : DUTY_STATIONS[0],
    mode: (resubmitTarget.mode as TravelMode) ?? 'air',
    oneWay: resubmitTarget.one_way,
    departDate: resubmitTarget.depart_date,
    returnDate: resubmitTarget.return_date,
    reason: resubmitTarget.reason_for_travel ?? '',
    travellerIds: resubmitTarget.travellerStaffIds,
  }
}

/**
 * NOTE: The parent renders this with `key={resubmitTarget?.id ?? 'new'}`, so
 * switching between "new request" and "resubmit X" remounts the form instead
 * of syncing prop → state in an effect — all state below is fresh per target.
 */
export function TravelRequestForm({
  airports,
  resubmitTarget,
  onCancelResubmit,
}: TravelRequestFormProps) {
  const router = useRouter()
  const [form, setForm] = useState(() => buildInitialForm(airports, resubmitTarget))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTravellers, setShowTravellers] = useState(form.travellerIds.length > 0)

  const [directory, setDirectory] = useState<
    { id: string; name: string; level_name: string | null; department_name: string | null }[]
  >([])

  useEffect(() => {
    listStaffDirectory().then((result) => {
      if (result.success) setDirectory(result.data ?? [])
    })
  }, [])

  const [estimate, setEstimate] = useState<{
    checked: boolean
    total: number | null
    coveragePercent: number | null
    bandName: string | null
  }>({ checked: false, total: null, coveragePercent: null, bandName: null })

  const grouped = useMemo(
    () => ({
      domestic: airports.filter((a) => a.route_type === 'domestic'),
      international: airports.filter((a) => a.route_type === 'international'),
    }),
    [airports]
  )

  const airportById = useMemo(() => new Map(airports.map((a) => [a.id, a])), [airports])

  /** The city text a choice resolves to — '' until something valid is picked. */
  function destinationText(choice: string, other: string): string {
    if (choice === OTHER) return other.trim()
    return airportById.get(choice)?.city ?? ''
  }

  const destination = destinationText(form.destinationChoice, form.destinationOther)
  const daysRequested = form.departDate && form.returnDate
    ? daysBetweenInclusive(form.departDate, form.returnDate)
    : null

  // Pre-submit estimate — debounced, since the free-text hatch still types.
  useEffect(() => {
    if (destination.length < 2 || !daysRequested || daysRequested < 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets stale estimate when inputs are incomplete
      setEstimate({ checked: false, total: null, coveragePercent: null, bandName: null })
      return
    }

    const timer = setTimeout(async () => {
      const result = await getRequestEstimate(destination, form.mode, daysRequested, form.oneWay)
      setEstimate(
        result.success && result.data
          ? { checked: true, total: result.data.total, coveragePercent: result.data.coveragePercent, bandName: result.data.bandName }
          : { checked: true, total: null, coveragePercent: null, bandName: null }
      )
    }, 500)

    return () => clearTimeout(timer)
  }, [destination, form.mode, form.oneWay, daysRequested])

  const { overlaps } = useOverlapWarning(
    form.departDate || null,
    form.returnDate || null,
    resubmitTarget?.id
  )

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function toggleTraveller(id: string) {
    setForm((f) => ({
      ...f,
      travellerIds: f.travellerIds.includes(id)
        ? f.travellerIds.filter((t) => t !== id)
        : [...f.travellerIds, id],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const input = {
      memo_number: form.memoNumber.trim(),
      destination,
      origin: form.origin as (typeof DUTY_STATIONS)[number],
      destination_airport_id: form.destinationChoice && form.destinationChoice !== OTHER ? form.destinationChoice : null,
      origin_airport_id: null,
      mode: form.mode,
      one_way: form.oneWay,
      depart_date: form.departDate,
      return_date: form.returnDate,
      reason_for_travel: form.reason.trim(),
      traveller_staff_ids: form.travellerIds,
    }

    setIsSubmitting(true)
    const result = resubmitTarget
      ? await resubmitRequest(resubmitTarget.id, input)
      : await submitRequest(input)
    setIsSubmitting(false)

    if (!result.success) {
      setError(result.error ?? 'Something went wrong. Please try again.')
      return
    }

    // Confirmation is shown as a pop-up on the page we land on, not inline
    // here — the whole point of redirecting is to get the user off the form.
    queueToast(
      resubmitTarget ? 'Request resubmitted for HR review.' : 'Travel request submitted for HR review.'
    )
    router.push('/staff/pending')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {resubmitTarget && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">
            Resubmitting the request to {resubmitTarget.destination}.
          </p>
          {resubmitTarget.rejectionReason && (
            <p className="mt-1">Reason for return: “{resubmitTarget.rejectionReason}”</p>
          )}
          <button
            type="button"
            onClick={onCancelResubmit}
            className="mt-2 text-xs font-medium underline underline-offset-2"
          >
            Cancel and start a new request instead
          </button>
        </div>
      )}

      <Input
        id="memo_number"
        label="ERP Memo Number"
        required
        value={form.memoNumber}
        onChange={(e) => updateField('memoNumber', e.target.value)}
        placeholder="e.g. TR/2026/00123"
      />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Trip Details</h3>
        <div className="grid items-start gap-4 sm:grid-cols-3">
          <Select
            id="origin"
            label="Origin (duty station)"
            required
            value={form.origin}
            onChange={(e) => updateField('origin', e.target.value)}
            options={DUTY_STATIONS.map((city) => ({ label: city, value: city }))}
          />
          <div className="space-y-2">
            <Select
              id="destination"
              label="Destination"
              required
              value={form.destinationChoice}
              onChange={(e) => updateField('destinationChoice', e.target.value)}
            >
              <option value="">Select destination…</option>
              {grouped.domestic.length > 0 && (
                <optgroup label="Nigeria">
                  {grouped.domestic.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.city} ({a.iata_code})
                    </option>
                  ))}
                </optgroup>
              )}
              {grouped.international.length > 0 && (
                <optgroup label="International">
                  {grouped.international.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.city} ({a.iata_code})
                    </option>
                  ))}
                </optgroup>
              )}
              <option value={OTHER}>Other — not listed</option>
            </Select>
            {form.destinationChoice === OTHER && (
              <Input
                id="destination-other"
                required
                value={form.destinationOther}
                onChange={(e) => updateField('destinationOther', e.target.value)}
                placeholder="Type the city name"
                aria-label="Destination — city not listed"
              />
            )}
          </div>
          <Select
            id="mode"
            label="Mode of Travel"
            value={form.mode}
            onChange={(e) => updateField('mode', e.target.value as TravelMode)}
            options={[
              { label: 'Air', value: 'air' },
              { label: 'Road', value: 'road' },
            ]}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.oneWay}
            onChange={(e) => updateField('oneWay', e.target.checked)}
            className="rounded border-gray-300"
          />
          One-way trip
        </label>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Dates</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="depart_date"
            label="Departure Date"
            type="date"
            required
            value={form.departDate}
            onChange={(e) => updateField('departDate', e.target.value)}
          />
          <Input
            id="return_date"
            label="Return Date"
            type="date"
            required
            min={form.departDate || undefined}
            value={form.returnDate}
            onChange={(e) => updateField('returnDate', e.target.value)}
          />
        </div>
        {daysRequested !== null && (
          <p className="text-sm text-gray-500">
            {daysRequested} day{daysRequested === 1 ? '' : 's'}
            {form.departDate && form.returnDate && (
              <> · {formatDate(form.departDate)} – {formatDate(form.returnDate)}</>
            )}
          </p>
        )}
      </div>

      <Textarea
        id="reason"
        label="Reason for Travel"
        required
        minLength={10}
        rows={3}
        value={form.reason}
        onChange={(e) => updateField('reason', e.target.value)}
      />

      <div className="space-y-2 rounded-lg border border-gray-200 p-3">
        <button
          type="button"
          onClick={() => setShowTravellers((v) => !v)}
          className="text-sm font-medium text-blue-700"
        >
          {showTravellers ? 'Hide' : 'Travelling with others?'}
        </button>
        <p className="text-xs text-gray-500">
          You&apos;re added automatically. Add colleagues if this memo covers more than one traveller —
          each is priced at their own grade.
        </p>
        {showTravellers && (
          <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
            {directory.length === 0 ? (
              <p className="text-sm text-gray-400">No other staff found.</p>
            ) : (
              directory.map((s) => (
                <label key={s.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={form.travellerIds.includes(s.id)}
                    onChange={() => toggleTraveller(s.id)}
                    className="rounded border-gray-300"
                  />
                  <span>{s.name}</span>
                  <span className="text-xs text-gray-400">
                    {[s.level_name, s.department_name].filter(Boolean).join(' · ')}
                  </span>
                </label>
              ))
            )}
          </div>
        )}
      </div>

      {overlaps.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Warning: This trip overlaps with your existing request
          {overlaps.length === 1 ? '' : 's'} to{' '}
          {overlaps.map((o, i) => (
            <span key={o.id}>
              {i > 0 && ', '}
              {o.destination} ({formatDate(o.depart_date)}–{formatDate(o.return_date)})
            </span>
          ))}
          . Please confirm this is intentional.
        </div>
      )}

      {estimate.checked && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          {estimate.total !== null ? (
            <>
              <div className="flex flex-wrap items-baseline gap-x-1.5">
                <span>Your estimated allowance:</span>
                <Money ngn={estimate.total} size="sm" layout="inline" className="!text-blue-900" />
                <span>· Subject to HR verification.</span>
              </div>
              {estimate.coveragePercent !== null && estimate.coveragePercent < 100 && (
                <p className="mt-1 text-xs text-blue-700">
                  {destination} is not Lagos, Abuja or Port Harcourt, so DTA and local running are at {estimate.coveragePercent}%.
                </p>
              )}
            </>
          ) : (
            'Your grade isn\'t set up yet — HR will compute this manually.'
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">{error}</p>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
        {isSubmitting ? 'Submitting…' : resubmitTarget ? 'Resubmit Request' : 'Submit Request'}
      </Button>
    </form>
  )
}
