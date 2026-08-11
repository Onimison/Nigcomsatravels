'use client'

/**
 * Request to Travel form — PRD Section 3.1
 *
 * Handles both new submissions and resubmissions of a rejected request
 * (same shape, different server action + a visible "what to fix" banner).
 *
 * - Pre-Submit Estimate: queries rate_reference via getRequestEstimate(),
 *   labeled "Subject to HR verification."
 * - Date-Overlap Warning: via useOverlapWarning(), warning only — never blocks submit.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  submitRequest,
  resubmitRequest,
  getRequestEstimate,
} from '@/lib/actions/requests.actions'
import { useOverlapWarning } from '@/hooks/useOverlapWarning'
import { formatDate, formatUSD } from '@/lib/utils/formatting'
import type { TravelMode } from '@/types/database'

export interface ResubmitTarget {
  id: string
  destination: string
  origin: string | null
  mode: string | null
  days: number | null
  depart_date: string
  return_date: string
  reason_for_travel: string | null
  rejectionReason: string | null
}

interface TravelRequestFormProps {
  resubmitTarget?: ResubmitTarget | null
  onCancelResubmit?: () => void
}

const EMPTY_FORM = {
  destination: '',
  origin: '',
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

function buildInitialForm(resubmitTarget?: ResubmitTarget | null): typeof EMPTY_FORM {
  if (!resubmitTarget) return EMPTY_FORM
  return {
    destination: resubmitTarget.destination,
    origin: resubmitTarget.origin ?? '',
    mode: (resubmitTarget.mode as TravelMode) ?? 'air',
    days: resubmitTarget.days ? String(resubmitTarget.days) : '',
    departDate: resubmitTarget.depart_date,
    returnDate: resubmitTarget.return_date,
    reason: resubmitTarget.reason_for_travel ?? '',
  }
}

/**
 * NOTE: The parent renders this with `key={resubmitTarget?.id ?? 'new'}`, so
 * switching between "new request" and "resubmit X" remounts the form instead
 * of syncing prop → state in an effect — all state below is fresh per target.
 */
export function TravelRequestForm({ resubmitTarget, onCancelResubmit }: TravelRequestFormProps) {
  const router = useRouter()
  const [form, setForm] = useState(() => buildInitialForm(resubmitTarget))
  const daysTouched = useRef(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [estimate, setEstimate] = useState<{ checked: boolean; value: number | null }>({
    checked: false,
    value: null,
  })

  // Auto-suggest "days" from the date range, unless the user has typed their own value.
  useEffect(() => {
    if (daysTouched.current) return
    const suggested = daysBetween(form.departDate, form.returnDate)
    if (suggested !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derived from dates, no external system involved
      setForm((f) => ({ ...f, days: String(suggested) }))
    }
  }, [form.departDate, form.returnDate])

  // Pre-submit estimate — debounced so it doesn't fire on every keystroke.
  useEffect(() => {
    const destination = form.destination.trim()
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
  }, [form.destination, form.mode])

  const { overlaps } = useOverlapWarning(
    form.departDate || null,
    form.returnDate || null,
    resubmitTarget?.id
  )

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const parsedDays = Number(form.days)
    const input = {
      destination: form.destination.trim(),
      origin: form.origin.trim(),
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

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-50'
  const labelClass = 'mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {resubmitTarget && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300">
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="destination">Destination</label>
          <input
            id="destination"
            required
            value={form.destination}
            onChange={(e) => updateField('destination', e.target.value)}
            placeholder="e.g. Abuja"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="origin">Origin</label>
          <input
            id="origin"
            required
            value={form.origin}
            onChange={(e) => updateField('origin', e.target.value)}
            placeholder="e.g. Lagos"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="mode">Mode of Travel</label>
          <select
            id="mode"
            value={form.mode}
            onChange={(e) => updateField('mode', e.target.value as TravelMode)}
            className={inputClass}
          >
            <option value="air">Air</option>
            <option value="road">Road</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="days">Number of Days</label>
          <input
            id="days"
            type="number"
            min={1}
            required
            value={form.days}
            onChange={(e) => {
              daysTouched.current = true
              updateField('days', e.target.value)
            }}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="depart_date">Departure Date</label>
          <input
            id="depart_date"
            type="date"
            required
            value={form.departDate}
            onChange={(e) => updateField('departDate', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="return_date">Return Date</label>
          <input
            id="return_date"
            type="date"
            required
            min={form.departDate || undefined}
            value={form.returnDate}
            onChange={(e) => updateField('returnDate', e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="reason">Reason for Travel</label>
        <textarea
          id="reason"
          required
          minLength={10}
          rows={3}
          value={form.reason}
          onChange={(e) => updateField('reason', e.target.value)}
          className={inputClass}
        />
      </div>

      {overlaps.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-900/50 dark:bg-yellow-950/40 dark:text-yellow-300">
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
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
          {estimate.value !== null ? (
            <>Estimated allowance: <strong>{formatUSD(estimate.value)}</strong>. Subject to HR verification.</>
          ) : (
            'No reference rate found; HR will compute manually.'
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600 dark:text-green-400" role="status">{success}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:w-auto"
      >
        {isSubmitting ? 'Submitting…' : resubmitTarget ? 'Resubmit Request' : 'Submit Request'}
      </button>
    </form>
  )
}
