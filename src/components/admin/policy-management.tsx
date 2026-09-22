'use client'

/**
 * Policy — REVISED_SCOPE.md §7 Admin surface: grade-band rates,
 * full-coverage city list, and the three HR-overridable policy defaults.
 * Everything the calculator (`src/lib/policy/calculate.ts`) reads is data
 * here, editable without a deploy (decision 14).
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateGradeBand,
  addDestinationCoverage,
  removeDestinationCoverage,
  updatePolicyDefault,
} from '@/lib/actions/grade-bands.actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Money } from '@/components/ui/money'
import type { AppSetting, DestinationCoverage, GradeBand } from '@/types/database'

function GradeBandRow({ band }: { band: GradeBand }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [dta, setDta] = useState(String(band.dta_per_day))
  const [local, setLocal] = useState(String(band.local_running_per_day))
  const [isSaving, setIsSaving] = useState(false)

  async function handleSave() {
    const dtaNum = Number(dta)
    const localNum = Number(local)
    if (!Number.isFinite(dtaNum) || !Number.isFinite(localNum) || dtaNum < 0 || localNum < 0) {
      window.alert('Enter valid, non-negative rates')
      return
    }

    setIsSaving(true)
    const result = await updateGradeBand({ id: band.id, dta_per_day: dtaNum, local_running_per_day: localNum })
    setIsSaving(false)

    if (!result.success) {
      window.alert(result.error ?? 'Could not save changes.')
      return
    }

    setEditing(false)
    router.refresh()
  }

  return (
    <tr className={`border-b last:border-0 ${editing ? 'border-blue-100 bg-blue-50/60' : 'border-gray-100'}`}>
      <td className="whitespace-nowrap py-3 pr-4">
        <p className="font-medium text-gray-900">{band.code}</p>
        <p className="text-xs text-gray-500">{band.name}</p>
      </td>
      <td className="whitespace-nowrap py-3 pr-4">
        {editing ? (
          <div className="w-32">
            <Input type="number" min={0} step="0.01" value={dta} onChange={(e) => setDta(e.target.value)} className="px-2 py-1" />
          </div>
        ) : (
          <Money ngn={band.dta_per_day} size="sm" layout="inline" />
        )}
      </td>
      <td className="whitespace-nowrap py-3 pr-4">
        {editing ? (
          <div className="w-32">
            <Input type="number" min={0} step="0.01" value={local} onChange={(e) => setLocal(e.target.value)} className="px-2 py-1" />
          </div>
        ) : (
          <Money ngn={band.local_running_per_day} size="sm" layout="inline" />
        )}
      </td>
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

function GradeBandRates({ bands }: { bands: GradeBand[] }) {
  const sorted = [...bands].sort((a, b) => a.sort_order - b.sort_order)
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700">Grade Band Rates (100% coverage, per day)</h3>
      <p className="mt-1 text-xs text-gray-500">
        The 75% figures are derived automatically — see the coverage tier below. Editing a rate here changes every
        request priced after the change; requests already submitted keep the rate they were priced at.
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-400">
              <th className="py-2 pr-4">Band</th>
              <th className="py-2 pr-4">DTA / day</th>
              <th className="py-2 pr-4">Local Running / day</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((band) => (
              <GradeBandRow key={band.id} band={band} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CoverageCities({ cities, coveragePercent }: { cities: DestinationCoverage[]; coveragePercent: number }) {
  const router = useRouter()
  const [newCity, setNewCity] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!newCity.trim()) return

    setIsSubmitting(true)
    const result = await addDestinationCoverage({ city: newCity.trim() })
    setIsSubmitting(false)

    if (!result.success) {
      setError(result.error ?? 'Could not add city.')
      return
    }

    setNewCity('')
    router.refresh()
  }

  async function handleRemove(city: string) {
    if (!window.confirm(`Remove ${city} from the ${coveragePercent}% coverage list? It will fall to the default tier.`)) return
    const result = await removeDestinationCoverage({ city })
    if (!result.success) {
      window.alert(result.error ?? 'Could not remove city.')
      return
    }
    router.refresh()
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700">Full-Coverage Cities ({coveragePercent}%)</h3>
      <p className="mt-1 text-xs text-gray-500">
        Any destination not listed here defaults to the partial-coverage tier.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {cities.map((c) => (
          <span key={c.city} className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-800">
            {c.city}
            <button
              type="button"
              onClick={() => handleRemove(c.city)}
              className="text-blue-400 hover:text-blue-700"
              aria-label={`Remove ${c.city}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <form onSubmit={handleAdd} className="mt-3 flex items-end gap-2">
        <Input
          label="Add a city"
          value={newCity}
          onChange={(e) => setNewCity(e.target.value)}
          placeholder="e.g. Kano"
          className="w-56"
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Adding…' : 'Add'}
        </Button>
      </form>
      {error && <p className="mt-1 text-sm text-red-600" role="alert">{error}</p>}
    </div>
  )
}

const POLICY_DEFAULT_LABELS: Record<string, string> = {
  policy_air_fare_per_leg: 'Air fare (per leg)',
  policy_road_fare_per_leg: 'Road fare (per leg)',
  policy_taxi_per_leg: 'Airport taxi (per leg)',
}

function PolicyDefaultRow({ setting }: { setting: AppSetting }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(setting.value)
  const [isSaving, setIsSaving] = useState(false)

  async function handleSave() {
    const num = Number(value)
    if (!Number.isFinite(num) || num < 0) {
      window.alert('Enter a valid, non-negative amount')
      return
    }

    setIsSaving(true)
    const result = await updatePolicyDefault({
      key: setting.key as 'policy_air_fare_per_leg' | 'policy_road_fare_per_leg' | 'policy_taxi_per_leg',
      value: num,
    })
    setIsSaving(false)

    if (!result.success) {
      window.alert(result.error ?? 'Could not save changes.')
      return
    }

    setEditing(false)
    router.refresh()
  }

  return (
    <tr className={`border-b last:border-0 ${editing ? 'border-blue-100 bg-blue-50/60' : 'border-gray-100'}`}>
      <td className="whitespace-nowrap py-3 pr-4 font-medium text-gray-900">
        {POLICY_DEFAULT_LABELS[setting.key] ?? setting.key}
      </td>
      <td className="whitespace-nowrap py-3 pr-4">
        {editing ? (
          <div className="w-32">
            <Input type="number" min={0} step="0.01" value={value} onChange={(e) => setValue(e.target.value)} className="px-2 py-1" />
          </div>
        ) : (
          <Money ngn={Number(setting.value)} size="sm" layout="inline" />
        )}
      </td>
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

function PolicyDefaults({ settings }: { settings: AppSetting[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700">Policy Defaults</h3>
      <p className="mt-1 text-xs text-gray-500">
        Transport and airport taxi defaults — HR can override per traveller on any request.
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left">
          <tbody>
            {settings.map((s) => (
              <PolicyDefaultRow key={s.key} setting={s} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function PolicyManagement({
  bands,
  coverageCities,
  coveragePercent,
  policyDefaults,
}: {
  bands: GradeBand[]
  coverageCities: DestinationCoverage[]
  coveragePercent: number
  policyDefaults: AppSetting[]
}) {
  return (
    <div className="space-y-8">
      <GradeBandRates bands={bands} />
      <CoverageCities cities={coverageCities} coveragePercent={coveragePercent} />
      <PolicyDefaults settings={policyDefaults} />
    </div>
  )
}
