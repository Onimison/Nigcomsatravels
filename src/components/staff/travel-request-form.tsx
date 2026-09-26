'use client'

/**
 * Request to Travel form — Phase 0 rebuild (notes.md v1.1, replaces the old
 * FX/single-traveller form entirely per §11 Out of Scope).
 *
 * - Memo number is step one (FR-4); format-validated only, no ERP lookup
 *   yet (Phase 3).
 * - Origin is one of the four duty stations (FR-6); destination is picked
 *   from the seeded airports list with an "Other — not listed" escape
 *   hatch for road-only places, same pattern as before.
 * - The requester is auto-added and can't be removed; colleagues come from
 *   the staff directory (FR-5), each showing their designation or an
 *   "Unmapped" note when Admin hasn't assigned one yet (FR-13).
 * - The live per-traveller estimate is a pure, synchronous calculation
 *   (policy-calculator.ts) against data fetched once on page load — no
 *   network round-trip per keystroke (NFR Performance).
 */

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitTravelRequestV2, resubmitTravelRequestV2 } from '@/lib/actions/travel-requests-v2.actions'
import { useOverlapWarning } from '@/hooks/useOverlapWarning'
import { formatDate } from '@/lib/utils/formatting'
import { queueToast } from '@/lib/utils/toast'
import { DUTY_STATIONS } from '@/lib/utils/constants'
import {
  priceTraveller,
  inclusiveDayCount,
  coveragePercentFor,
  requestTotal,
  type PolicyDefaults,
} from '@/lib/utils/policy-calculator'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Money } from '@/components/ui/money'
import { XIcon } from '@/components/ui/icons'
import type { AirportOption, GradeBand, GradeBandCode, StaffDirectoryEntry, TravelMode, TripType } from '@/types/database'

/** Sentinel for the destination free-text escape hatch — not a uuid, so it can never be mistaken for an airport id. */
const OTHER = '__other__'

export interface ResubmitTarget {
  id: string
  memo_number: string
  origin: string
  destination: string
  destination_airport_id: string | null
  mode: TravelMode
  trip_type: TripType
  depart_date: string
  return_date: string
  reason_for_travel: string | null
  rejectionReason: string | null
  /** Colleague ids from the original submission — the requester is re-added automatically. */
  travelerStaffIds: string[]
}

interface CurrentUser {
  id: string
  name: string
  designation: string | null
  gradeBandCode: GradeBandCode | null
}

interface TravelRequestFormProps {
  airports: AirportOption[]
  gradeBands: GradeBand[]
  policyDefaults: PolicyDefaults
  staffDirectory: StaffDirectoryEntry[]
  currentUser: CurrentUser
  resubmitTarget?: ResubmitTarget | null
  onCancelResubmit?: () => void
}

function resolveDestinationChoice(
  airportId: string | null,
  text: string,
  airports: AirportOption[]
): { choice: string; other: string } {
  if (airportId && airports.some((a) => a.id === airportId)) return { choice: airportId, other: '' }
  const trimmed = text.trim()
  const match = airports.find((a) => a.city.toLowerCase() === trimmed.toLowerCase())
  if (match) return { choice: match.id, other: '' }
  return { choice: trimmed ? OTHER : '', other: trimmed }
}

function travelerDisplayName(entry: Pick<StaffDirectoryEntry, 'first_name' | 'surname' | 'id'>): string {
  return [entry.first_name, entry.surname].filter(Boolean).join(' ') || 'Unnamed staff'
}

/**
 * NOTE: the parent renders this with `key={resubmitTarget?.id ?? 'new'}`, so
 * switching between "new request" and "resubmit X" remounts the form
 * instead of syncing prop → state in an effect.
 */
export function TravelRequestForm({
  airports,
  gradeBands,
  policyDefaults,
  staffDirectory,
  currentUser,
  resubmitTarget,
  onCancelResubmit,
}: TravelRequestFormProps) {
  const router = useRouter()

  const destinationInit = resolveDestinationChoice(
    resubmitTarget?.destination_airport_id ?? null,
    resubmitTarget?.destination ?? '',
    airports
  )

  const [memoNumber, setMemoNumber] = useState(resubmitTarget?.memo_number ?? '')
  const [origin, setOrigin] = useState(resubmitTarget?.origin ?? '')
  const [destinationChoice, setDestinationChoice] = useState(destinationInit.choice)
  const [destinationOther, setDestinationOther] = useState(destinationInit.other)
  const [mode, setMode] = useState<TravelMode>(resubmitTarget?.mode ?? 'air')
  const [tripType, setTripType] = useState<TripType>(resubmitTarget?.trip_type ?? 'return')
  const [departDate, setDepartDate] = useState(resubmitTarget?.depart_date ?? '')
  const [returnDate, setReturnDate] = useState(resubmitTarget?.return_date ?? '')
  const [reason, setReason] = useState(resubmitTarget?.reason_for_travel ?? '')
  const [travelerIds, setTravelerIds] = useState<string[]>(resubmitTarget?.travelerStaffIds ?? [])
  const [travelerSearch, setTravelerSearch] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const airportById = useMemo(() => new Map(airports.map((a) => [a.id, a])), [airports])
  const gradeBandByCode = useMemo(() => new Map(gradeBands.map((b) => [b.code, b])), [gradeBands])
  const directoryById = useMemo(() => new Map(staffDirectory.map((s) => [s.id, s])), [staffDirectory])

  const destination =
    destinationChoice === OTHER ? destinationOther.trim() : (airportById.get(destinationChoice)?.city ?? '')
  const destinationAirportId = destinationChoice && destinationChoice !== OTHER ? destinationChoice : null

  const days = inclusiveDayCount(departDate, returnDate)
  const coveragePercent = destination.length >= 2 ? coveragePercentFor(destination, policyDefaults) : null

  const { overlaps } = useOverlapWarning(departDate || null, returnDate || null, resubmitTarget?.id)

  const travelerCandidates = useMemo(() => {
    const search = travelerSearch.trim().toLowerCase()
    return staffDirectory
      .filter((s) => s.id !== currentUser.id && !travelerIds.includes(s.id))
      .filter((s) => !search || travelerDisplayName(s).toLowerCase().includes(search))
      .slice(0, 8)
  }, [staffDirectory, travelerIds, travelerSearch, currentUser.id])

  const pricedTravelers = useMemo(() => {
    const all = [
      { id: currentUser.id, name: `${currentUser.name} (You)`, designation: currentUser.designation, gradeBandCode: currentUser.gradeBandCode, removable: false },
      ...travelerIds.map((id) => {
        const entry = directoryById.get(id)
        return {
          id,
          name: entry ? travelerDisplayName(entry) : 'Unknown staff',
          designation: entry?.designation ?? null,
          gradeBandCode: entry?.grade_band_code ?? null,
          removable: true,
        }
      }),
    ]

    return all.map((t) => {
      const gradeBand = t.gradeBandCode ? (gradeBandByCode.get(t.gradeBandCode) ?? null) : null
      const result =
        days !== null && coveragePercent !== null
          ? priceTraveller({ gradeBand, days, coveragePercent, mode, tripType, defaults: policyDefaults })
          : null
      return { ...t, result }
    })
  }, [currentUser, travelerIds, directoryById, gradeBandByCode, days, coveragePercent, mode, tripType, policyDefaults])

  const total = requestTotal(pricedTravelers.map((t) => t.result?.travellerTotal ?? null))

  function addTraveler(id: string) {
    setTravelerIds((ids) => [...ids, id])
    setTravelerSearch('')
    setPickerOpen(false)
  }

  function removeTraveler(id: string) {
    setTravelerIds((ids) => ids.filter((t) => t !== id))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!destination) {
      setError('Please select or type a destination')
      return
    }
    if (!DUTY_STATIONS.includes(origin as (typeof DUTY_STATIONS)[number])) {
      setError('Please select an origin duty station')
      return
    }

    const input = {
      memo_number: memoNumber.trim(),
      origin: origin as (typeof DUTY_STATIONS)[number],
      destination,
      destination_airport_id: destinationAirportId,
      mode,
      trip_type: tripType,
      depart_date: departDate,
      return_date: returnDate,
      reason_for_travel: reason.trim(),
      traveler_staff_ids: travelerIds,
    }

    setIsSubmitting(true)
    const result = resubmitTarget
      ? await resubmitTravelRequestV2(resubmitTarget.id, input)
      : await submitTravelRequestV2(input)
    setIsSubmitting(false)

    if (!result.success) {
      setError(result.error ?? 'Something went wrong. Please try again.')
      return
    }

    queueToast(resubmitTarget ? 'Request resubmitted for HR review.' : 'Travel request submitted for HR review.')
    router.push('/staff/pending')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {resubmitTarget && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">Resubmitting memo {resubmitTarget.memo_number}.</p>
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
        <h3 className="text-sm font-semibold text-gray-700">Memo</h3>
        <Input
          id="memo_number"
          label="ERP Memo Number"
          required
          value={memoNumber}
          onChange={(e) => setMemoNumber(e.target.value)}
          placeholder="e.g. MEMO-2026-00123"
        />
        <p className="text-xs text-gray-500">The memo number your HOD has already approved in the ERP.</p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Trip Details</h3>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Select id="origin" label="Origin (Duty Station)" required value={origin} onChange={(e) => setOrigin(e.target.value)}>
            <option value="">Select duty station…</option>
            {DUTY_STATIONS.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </Select>

          <div className="space-y-2">
            <Select
              id="destination"
              label="Destination"
              required
              value={destinationChoice}
              onChange={(e) => setDestinationChoice(e.target.value)}
            >
              <option value="">Select destination…</option>
              <optgroup label="Nigeria">
                {airports
                  .filter((a) => a.route_type === 'domestic')
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.city} ({a.iata_code})
                    </option>
                  ))}
              </optgroup>
              <option value={OTHER}>Other — not listed</option>
            </Select>
            {destinationChoice === OTHER && (
              <Input
                id="destination-other"
                required
                value={destinationOther}
                onChange={(e) => setDestinationOther(e.target.value)}
                placeholder="Type the city name"
                aria-label="Destination — city not listed"
              />
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            id="mode"
            label="Mode of Travel"
            value={mode}
            onChange={(e) => setMode(e.target.value as TravelMode)}
            options={[
              { label: 'Air', value: 'air' },
              { label: 'Road', value: 'road' },
            ]}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Trip Type</label>
            <div className="inline-flex rounded-lg border border-gray-300 p-1">
              {(['return', 'one_way'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTripType(t)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    tripType === t ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t === 'return' ? 'Return' : 'One-way'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Dates &amp; Duration</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="depart_date"
            label="Departure Date"
            type="date"
            required
            value={departDate}
            onChange={(e) => setDepartDate(e.target.value)}
          />
          <Input
            id="return_date"
            label="Return Date"
            type="date"
            required
            min={departDate || undefined}
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
          />
        </div>
        {days !== null && (
          <p className="text-sm text-gray-600">
            {days} day{days === 1 ? '' : 's'}, {formatDate(departDate)}–{formatDate(returnDate)}
            {tripType === 'one_way' && ' · one-way — DTA and local running are still paid for every day of the trip'}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-700">Travellers</h3>
          <div className="relative">
            <Button type="button" variant="outline" onClick={() => { setPickerOpen((o) => !o); requestAnimationFrame(() => searchRef.current?.focus()) }}>
              + Add colleague
            </Button>
            {pickerOpen && (
              <div className="absolute right-0 z-10 mt-1.5 w-72 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
                <input
                  ref={searchRef}
                  id="traveler-search"
                  placeholder="Search staff by name…"
                  value={travelerSearch}
                  onChange={(e) => setTravelerSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <ul className="mt-2 max-h-56 space-y-0.5 overflow-y-auto">
                  {travelerCandidates.length === 0 ? (
                    <li className="px-2 py-2 text-sm text-gray-400">No matching staff</li>
                  ) : (
                    travelerCandidates.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => addTraveler(s.id)}
                          className="flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-50"
                        >
                          <span className="font-medium text-gray-900">{travelerDisplayName(s)}</span>
                          <span className="text-xs text-gray-500">{s.designation ?? 'Unmapped designation'}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {pricedTravelers.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 p-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-500">
                  {t.result?.isUnmapped ? (
                    <span className="text-amber-600">Unmapped designation — HR will price manually</span>
                  ) : (
                    t.designation ?? '—'
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Money ngn={t.result?.travellerTotal ?? null} size="sm" emptyLabel="—" />
                {t.removable && (
                  <button
                    type="button"
                    onClick={() => removeTraveler(t.id)}
                    aria-label={`Remove ${t.name}`}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Textarea
        id="reason"
        label="Reason for Travel"
        required
        minLength={10}
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
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

      {coveragePercent !== null && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          {coveragePercent === 100
            ? 'This trip is covered at 100% — Lagos, Abuja and Port Harcourt are full-coverage destinations.'
            : 'This trip is covered at 75% — destinations outside Lagos, Abuja and Port Harcourt are paid at the reduced tier.'}
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
        <span className="text-sm font-medium text-gray-700">Estimated Request Total</span>
        <Money ngn={total} size="lg" emptyLabel={days === null ? 'Set travel dates to see a total' : '—'} />
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">{error}</p>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
        {isSubmitting ? 'Submitting…' : resubmitTarget ? 'Resubmit Request' : 'Submit Request'}
      </Button>
    </form>
  )
}
