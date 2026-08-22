'use client'

/**
 * Request to Travel form — PRD Section 3.1
 *
 * Handles both new submissions and resubmissions of a rejected request
 * (same shape, different server action + a visible "what to fix" banner).
 *
 * - Destination/Origin are picked from the seeded airports list
 *   (20260822160000_airports.sql) so every request carries a machine-usable
 *   route key, with an "Other — not listed" escape hatch that keeps road
 *   trips and unseeded cities submittable.
 * - Pre-Submit Estimate: queries rate_reference via getRequestEstimate(),
 *   labeled "Subject to HR verification."
 * - Date-Overlap Warning: via useOverlapWarning(), warning only — never blocks submit.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  submitRequest,
  resubmitRequest,
  getRequestEstimate,
} from '@/lib/actions/requests.actions'
import { useOverlapWarning } from '@/hooks/useOverlapWarning'
import { formatDate, formatUSD } from '@/lib/utils/formatting'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import type { AirportOption, TravelMode } from '@/types/database'

/**
 * Sentinel for the free-text escape hatch. Not a uuid, so it can never be
 * mistaken for an airport id by the server-side resolver.
 */
const OTHER = '__other__'

export interface ResubmitTarget {
  id: string
  destination: string
  origin: string | null
  destination_airport_id: string | null
  origin_airport_id: string | null
  mode: string | null
  days: number | null
  depart_date: string
  return_date: string
  reason_for_travel: string | null
  rejectionReason: string | null
}

interface TravelRequestFormProps {
  airports: AirportOption[]
  resubmitTarget?: ResubmitTarget | null
  onCancelResubmit?: () => void
}

const EMPTY_FORM = {
  destinationChoice: '',
  destinationOther: '',
  originChoice: '',
  originOther: '',
  mode: 'air' as TravelMode,
  days: '',
  departDate: '',
  returnDate: '',
  reason: '',
}

function daysBetween(start: string, end: string): number | null {
  if (!start || !end) return null
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (Number.isNaN(ms) || ms < 0) return null
  return Math.floor(ms / 86_400_000) + 1
}

/**
 * Picks the dropdown state for one end of a resubmitted trip. Prefers the
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
  const origin = resolveChoice(
    resubmitTarget.origin_airport_id,
    resubmitTarget.origin ?? '',
    airports
  )

  return {
    destinationChoice: destination.choice,
    destinationOther: destination.other,
    originChoice: origin.choice,
    originOther: origin.other,
    mode: (resubmitTarget.mode as TravelMode) ?? 'air',
    days: resubmitTarget.days ? String(resubmitTarget.days) : '',
    departDate: resubmitTarget.depart_date,
    returnDate: resubmitTarget.return_date,
    reason: resubmitTarget.reason_for_travel ?? '',
  }
}

function EndpointField({
  id,
  label,
  grouped,
  choice,
  other,
  onChoiceChange,
  onOtherChange,
}: {
  id: string
  label: string
  grouped: { domestic: AirportOption[]; international: AirportOption[] }
  choice: string
  other: string
  onChoiceChange: (value: string) => void
  onOtherChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Select
        id={id}
        label={label}
        required
        value={choice}
        onChange={(e) => onChoiceChange(e.target.value)}
      >
        <option value="">Select {label.toLowerCase()}…</option>
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

      {choice === OTHER && (
        <Input
          id={`${id}-other`}
          required
          value={other}
          onChange={(e) => onOtherChange(e.target.value)}
          placeholder="Type the city name"
          aria-label={`${label} — city not listed`}
        />
      )}
    </div>
  )
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
  const daysTouched = useRef(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [estimate, setEstimate] = useState<{ checked: boolean; value: number | null }>({
    checked: false,
    value: null,
  })

  const grouped = useMemo(
    () => ({
      domestic: airports.filter((a) => a.route_type === 'domestic'),
      international: airports.filter((a) => a.route_type === 'international'),
    }),
    [airports]
  )

  const airportById = useMemo(() => new Map(airports.map((a) => [a.id, a])), [airports])

  /** The city text a choice resolves to — '' until something valid is picked. */
  function endpointText(choice: string, other: string): string {
    if (choice === OTHER) return other.trim()
    return airportById.get(choice)?.city ?? ''
  }

  const destination = endpointText(form.destinationChoice, form.destinationOther)
  const origin = endpointText(form.originChoice, form.originOther)

  // Auto-suggest "days" from the date range, unless the user has typed their own value.
  useEffect(() => {
    if (daysTouched.current) return
    const suggested = daysBetween(form.departDate, form.returnDate)
    if (suggested !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derived from dates, no external system involved
      setForm((f) => ({ ...f, days: String(suggested) }))
    }
  }, [form.departDate, form.returnDate])

  // Pre-submit estimate — debounced, since the free-text hatch still types.
  useEffect(() => {
    if (destination.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets stale estimate when destination is cleared
      setEstimate({ checked: false, value: null })
      return
    }

    const timer = setTimeout(async () => {
      const result = await getRequestEstimate(destination, form.mode)
      setEstimate({ checked: true, value: result.success ? (result.data?.estimate ?? null) : null })
    }, 500)

    return () => clearTimeout(timer)
  }, [destination, form.mode])

  const { overlaps } = useOverlapWarning(
    form.departDate || null,
    form.returnDate || null,
    resubmitTarget?.id
  )

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  /** The FK to file, or null when the endpoint came through the free-text hatch. */
  function airportIdFor(choice: string): string | null {
    return choice && choice !== OTHER ? choice : null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const parsedDays = Number(form.days)
    const input = {
      destination,
      origin,
      destination_airport_id: airportIdFor(form.destinationChoice),
      origin_airport_id: airportIdFor(form.originChoice),
      mode: form.mode,
      days: Number.isFinite(parsedDays) ? parsedDays : 0,
      depart_date: form.departDate,
      return_date: form.returnDate,
      reason_for_travel: form.reason.trim(),
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

    setSuccess(resubmitTarget ? 'Request resubmitted for HR review.' : 'Travel request submitted for HR review.')
    setForm(EMPTY_FORM)
    daysTouched.current = false
    onCancelResubmit?.()
    router.refresh()
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

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Trip Details</h3>
        <div className="grid items-start gap-4 sm:grid-cols-3">
          <EndpointField
            id="destination"
            label="Destination"
            grouped={grouped}
            choice={form.destinationChoice}
            other={form.destinationOther}
            onChoiceChange={(v) => updateField('destinationChoice', v)}
            onOtherChange={(v) => updateField('destinationOther', v)}
          />
          <EndpointField
            id="origin"
            label="Origin"
            grouped={grouped}
            choice={form.originChoice}
            other={form.originOther}
            onChoiceChange={(v) => updateField('originChoice', v)}
            onOtherChange={(v) => updateField('originOther', v)}
          />
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
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Dates &amp; Duration</h3>
        <div className="grid gap-4 sm:grid-cols-3">
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
          <Input
            id="days"
            label="Number of Days"
            type="number"
            min={1}
            required
            value={form.days}
            onChange={(e) => {
              daysTouched.current = true
              updateField('days', e.target.value)
            }}
          />
        </div>
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
          {estimate.value !== null ? (
            <>Estimated allowance: <strong>{formatUSD(estimate.value)}</strong>. Subject to HR verification.</>
          ) : (
            'No reference rate found; HR will compute manually.'
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600" role="status">{success}</p>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
        {isSubmitting ? 'Submitting…' : resubmitTarget ? 'Resubmit Request' : 'Submit Request'}
      </Button>
    </form>
  )
}
