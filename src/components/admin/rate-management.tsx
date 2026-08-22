'use client'

/**
 * Rate Management — PRD Section 3.4, with Flight Price Reference as the
 * flagship section (this pass's redefined "Sprint 4" — see
 * UI_UX_DESIGN_PLAN.md §4). One table drives both: `rate_reference` already
 * covers accommodation/per-diem/taxi/flight per destination+level+mode, so
 * this is a single CRUD surface over it, grouped by `route_type` (domestic
 * vs international) with the flight price and its staleness given top
 * billing since that's what HR needs most.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addRateReference, updateRateReference } from '@/lib/actions/rates.actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { AlertTriangleIcon } from '@/components/ui/icons'
import { formatUSD, formatStaleness, isStale } from '@/lib/utils/formatting'
import type { Level, RateReferenceWithLevel, RouteType } from '@/types/database'

type NumField = 'flight_estimate' | 'accommodation_rate' | 'per_diem_rate' | 'airport_taxi'
const NUM_FIELDS: { key: NumField; label: string }[] = [
  { key: 'flight_estimate', label: 'Flight' },
  { key: 'accommodation_rate', label: 'Accommodation' },
  { key: 'per_diem_rate', label: 'Per Diem' },
  { key: 'airport_taxi', label: 'Airport Taxi' },
]

const EMPTY_FORM = {
  destination: '',
  level_id: '',
  mode: 'air' as 'air' | 'road',
  route_type: 'domestic' as RouteType,
  flight_estimate: '',
  accommodation_rate: '',
  per_diem_rate: '',
  airport_taxi: '',
}

function AddRateForm({ levels, onDone }: { levels: Level[]; onDone: () => void }) {
  const router = useRouter()
  const [form, setForm] = useState(EMPTY_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.level_id) {
      setError('Select a level')
      return
    }

    setIsSubmitting(true)
    const result = await addRateReference({
      destination: form.destination.trim(),
      level_id: form.level_id,
      mode: form.mode,
      route_type: form.route_type,
      flight_estimate: form.flight_estimate ? Number(form.flight_estimate) : null,
      accommodation_rate: form.accommodation_rate ? Number(form.accommodation_rate) : null,
      per_diem_rate: form.per_diem_rate ? Number(form.per_diem_rate) : null,
      airport_taxi: form.airport_taxi ? Number(form.airport_taxi) : null,
    })
    setIsSubmitting(false)

    if (!result.success) {
      setError(result.error ?? 'Could not add rate. Please try again.')
      return
    }

    router.refresh()
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          label="Destination"
          value={form.destination}
          onChange={(e) => update('destination', e.target.value)}
          placeholder="e.g. London"
          required
        />
        <Select label="Level" value={form.level_id} onChange={(e) => update('level_id', e.target.value)}>
          <option value="">Select level…</option>
          {levels.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </Select>
        <Select
          label="Mode"
          value={form.mode}
          onChange={(e) => update('mode', e.target.value as 'air' | 'road')}
          options={[
            { label: 'Air', value: 'air' },
            { label: 'Road', value: 'road' },
          ]}
        />
      </div>

      <Select
        label="Route Type"
        value={form.route_type}
        onChange={(e) => update('route_type', e.target.value as RouteType)}
        options={[
          { label: 'Domestic', value: 'domestic' },
          { label: 'International', value: 'international' },
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {NUM_FIELDS.map(({ key, label }) => (
          <Input
            key={key}
            label={`${label} (USD)`}
            type="number"
            min={0}
            step="0.01"
            value={form[key]}
            onChange={(e) => update(key, e.target.value)}
            placeholder="0.00"
          />
        ))}
      </div>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Adding…' : 'Add Rate'}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function RateRow({ row }: { row: RateReferenceWithLevel }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState<Record<NumField, string>>({
    flight_estimate: row.flight_estimate != null ? String(row.flight_estimate) : '',
    accommodation_rate: row.accommodation_rate != null ? String(row.accommodation_rate) : '',
    per_diem_rate: row.per_diem_rate != null ? String(row.per_diem_rate) : '',
    airport_taxi: row.airport_taxi != null ? String(row.airport_taxi) : '',
  })
  const [isSaving, setIsSaving] = useState(false)

  async function handleSave() {
    setIsSaving(true)
    const result = await updateRateReference({
      id: row.id,
      flight_estimate: values.flight_estimate ? Number(values.flight_estimate) : null,
      accommodation_rate: values.accommodation_rate ? Number(values.accommodation_rate) : null,
      per_diem_rate: values.per_diem_rate ? Number(values.per_diem_rate) : null,
      airport_taxi: values.airport_taxi ? Number(values.airport_taxi) : null,
    })
    setIsSaving(false)

    if (!result.success) {
      window.alert(result.error ?? 'Could not save changes.')
      return
    }

    setEditing(false)
    router.refresh()
  }

  const stale = isStale(row.updated_at)

  return (
    <tr className={`border-b last:border-0 ${editing ? 'border-blue-100 bg-blue-50/60' : 'border-gray-100'}`}>
      <td className="whitespace-nowrap py-3 pr-4">
        <div className="flex items-center gap-1.5">
          <p className="font-medium text-gray-900">{row.destination}</p>
          {stale && (
            <span title={formatStaleness(row.updated_at)} className="text-amber-600">
              <AlertTriangleIcon className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        <p className="text-xs capitalize text-gray-500">{row.level?.name ?? '—'} · {row.mode}</p>
      </td>
      {NUM_FIELDS.map(({ key }) => (
        <td key={key} className="whitespace-nowrap py-3 pr-4 text-sm text-gray-700">
          {editing ? (
            <div className="w-24">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={values[key]}
                onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                className="px-2 py-1"
              />
            </div>
          ) : row[key] != null ? (
            formatUSD(Number(row[key]))
          ) : (
            '—'
          )}
        </td>
      ))}
      <td className="whitespace-nowrap py-3 text-right">
        {editing ? (
          <div className="flex justify-end gap-2">
            <Button className="px-3 py-1.5" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="secondary" className="px-3 py-1.5" onClick={() => setEditing(false)} disabled={isSaving}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="px-3 py-1.5" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </td>
    </tr>
  )
}

function RateGroup({ title, rows }: { title: string; rows: RateReferenceWithLevel[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700">
        {title} <span className="font-normal text-gray-400">({rows.length})</span>
      </h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">No {title.toLowerCase()} rates on file yet.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-400">
                <th className="py-2 pr-4">Destination / Level / Mode</th>
                {NUM_FIELDS.map(({ key, label }) => (
                  <th key={key} className="py-2 pr-4">{label}</th>
                ))}
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <RateRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function RateManagement({ rates, levels }: { rates: RateReferenceWithLevel[]; levels: Level[] }) {
  const [showAddForm, setShowAddForm] = useState(false)
  const domestic = rates.filter((r) => r.route_type === 'domestic')
  const international = rates.filter((r) => r.route_type === 'international')
  const staleFlightCount = rates.filter((r) => r.flight_estimate != null && isStale(r.updated_at)).length

  return (
    <div id="rates">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Flight Price Reference</h2>
          <p className="mt-1 text-sm text-gray-500">
            Domestic and international flight prices, kept current for HR to reference during review.
            {staleFlightCount > 0 && (
              <span className="ml-1 font-medium text-amber-600">
                {staleFlightCount} price{staleFlightCount === 1 ? '' : 's'} haven&rsquo;t been checked in 30+ days.
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => setShowAddForm((v) => !v)} disabled={levels.length === 0}>
          {showAddForm ? 'Close' : '+ Add Rate'}
        </Button>
      </div>

      {levels.length === 0 && (
        <p className="mt-2 text-sm text-amber-600">Add at least one level before adding rates.</p>
      )}

      {showAddForm && <AddRateForm levels={levels} onDone={() => setShowAddForm(false)} />}

      <div className="mt-6 space-y-6">
        <RateGroup title="Domestic" rows={domestic} />
        <RateGroup title="International" rows={international} />
      </div>
    </div>
  )
}
