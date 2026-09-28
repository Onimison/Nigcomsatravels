'use client'

/**
 * Travel Policy — Admin's Phase 0 configuration surface (notes.md v1.1,
 * FR-23/FR-24): grade-band rates, which of the 14 confirmed-exhaustive
 * designations maps to which band, and the three flat policy defaults +
 * the 100%-coverage city list. Every number here is exactly what
 * policy-calculator.ts reads (via getPolicyDefaults()/listGradeBands()) —
 * editing it changes real pricing on the next request, no deployment.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateGradeBand, updateDesignationBand, updatePolicyDefaults } from '@/lib/actions/policy.actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { PolicyDefaults } from '@/lib/utils/policy-calculator'
import type { Designation, GradeBand } from '@/types/database'

type DesignationWithBand = Designation & { grade_band: Pick<GradeBand, 'code' | 'label'> | null }

function GradeBandRow({ band }: { band: GradeBand }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    dta_per_day_100: String(band.dta_per_day_100),
    dta_per_day_75: String(band.dta_per_day_75),
    local_running_per_day_100: String(band.local_running_per_day_100),
    local_running_per_day_75: String(band.local_running_per_day_75),
  })
  const [isSaving, setIsSaving] = useState(false)

  async function handleSave() {
    const parsed = {
      dta_per_day_100: Number(form.dta_per_day_100),
      dta_per_day_75: Number(form.dta_per_day_75),
      local_running_per_day_100: Number(form.local_running_per_day_100),
      local_running_per_day_75: Number(form.local_running_per_day_75),
    }
    if (Object.values(parsed).some((n) => !Number.isFinite(n) || n < 0)) {
      window.alert('All rates must be non-negative numbers')
      return
    }

    setIsSaving(true)
    const result = await updateGradeBand({ id: band.id, ...parsed })
    setIsSaving(false)

    if (!result.success) {
      window.alert(result.error ?? 'Could not save changes.')
      return
    }
    setEditing(false)
    router.refresh()
  }

  const cell = (key: keyof typeof form, value: number) =>
    editing ? (
      <div className="w-24">
        <Input
          type="number"
          min={0}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          className="px-2 py-1"
        />
      </div>
    ) : (
      <span className="text-sm text-gray-700">₦{value.toLocaleString()}</span>
    )

  return (
    <tr className={`border-b last:border-0 ${editing ? 'border-blue-100 bg-blue-50/60' : 'border-gray-100'}`}>
      <td className="whitespace-nowrap py-3 pr-4 font-medium text-gray-900">
        {band.code}
        <p className="text-xs font-normal text-gray-500">{band.label}</p>
      </td>
      <td className="whitespace-nowrap py-3 pr-4">{cell('dta_per_day_100', band.dta_per_day_100)}</td>
      <td className="whitespace-nowrap py-3 pr-4">{cell('dta_per_day_75', band.dta_per_day_75)}</td>
      <td className="whitespace-nowrap py-3 pr-4">{cell('local_running_per_day_100', band.local_running_per_day_100)}</td>
      <td className="whitespace-nowrap py-3 pr-4">{cell('local_running_per_day_75', band.local_running_per_day_75)}</td>
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

function DesignationRow({ designation, gradeBands }: { designation: DesignationWithBand; gradeBands: GradeBand[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [bandId, setBandId] = useState(
    gradeBands.find((b) => b.code === designation.grade_band?.code)?.id ?? designation.grade_band_id
  )
  const [isSaving, setIsSaving] = useState(false)

  async function handleSave() {
    setIsSaving(true)
    const result = await updateDesignationBand({ id: designation.id, grade_band_id: bandId })
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
      <td className="whitespace-nowrap py-3 pr-4 font-medium text-gray-900">{designation.name}</td>
      <td className="whitespace-nowrap py-3 pr-4">
        {editing ? (
          <div className="w-32">
            <Select value={bandId} onChange={(e) => setBandId(e.target.value)} className="px-2 py-1">
              {gradeBands.map((b) => (
                <option key={b.id} value={b.id}>{b.code}</option>
              ))}
            </Select>
          </div>
        ) : (
          <span className="text-sm text-gray-700">
            {designation.grade_band?.code ?? '—'}
          </span>
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
            Reassign Band
          </Button>
        )}
      </td>
    </tr>
  )
}

function PolicyDefaultsForm({ defaults }: { defaults: PolicyDefaults }) {
  const router = useRouter()
  const [form, setForm] = useState({
    transport_air_each_way: String(defaults.transportAirEachWay),
    transport_road_each_way: String(defaults.transportRoadEachWay),
    airport_taxi_per_leg: String(defaults.airportTaxiPerLeg),
    full_coverage_cities: defaults.fullCoverageCities.join(', '),
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaved(false)

    const cities = form.full_coverage_cities.split(',').map((c) => c.trim()).filter(Boolean)
    const parsedNumbers = {
      transport_air_each_way: Number(form.transport_air_each_way),
      transport_road_each_way: Number(form.transport_road_each_way),
      airport_taxi_per_leg: Number(form.airport_taxi_per_leg),
    }
    if (Object.values(parsedNumbers).some((n) => !Number.isFinite(n) || n < 0) || cities.length === 0) {
      window.alert('All amounts must be non-negative, and at least one full-coverage city is required')
      return
    }

    setIsSaving(true)
    const result = await updatePolicyDefaults({ ...parsedNumbers, full_coverage_cities: cities })
    setIsSaving(false)

    if (!result.success) {
      window.alert(result.error ?? 'Could not save changes.')
      return
    }
    setSaved(true)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          label="Air Transport (each way)"
          type="number"
          min={0}
          value={form.transport_air_each_way}
          onChange={(e) => setForm((f) => ({ ...f, transport_air_each_way: e.target.value }))}
        />
        <Input
          label="Road Transport (each way)"
          type="number"
          min={0}
          value={form.transport_road_each_way}
          onChange={(e) => setForm((f) => ({ ...f, transport_road_each_way: e.target.value }))}
        />
        <Input
          label="Airport Taxi (per leg)"
          type="number"
          min={0}
          value={form.airport_taxi_per_leg}
          onChange={(e) => setForm((f) => ({ ...f, airport_taxi_per_leg: e.target.value }))}
        />
      </div>
      <Input
        label="100%-Coverage Cities (comma-separated)"
        value={form.full_coverage_cities}
        onChange={(e) => setForm((f) => ({ ...f, full_coverage_cities: e.target.value }))}
        placeholder="Lagos, Abuja, Port Harcourt"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save Policy Defaults'}
        </Button>
        {saved && <span className="text-sm text-green-700">Saved.</span>}
      </div>
    </form>
  )
}

export function TravelPolicyManagement({
  gradeBands,
  designations,
  policyDefaults,
}: {
  gradeBands: GradeBand[]
  designations: DesignationWithBand[]
  policyDefaults: PolicyDefaults
}) {
  return (
    <div className="space-y-8">
      <div id="grade-bands">
        <h2 className="text-lg font-semibold text-gray-900">Grade Bands</h2>
        <p className="mt-1 text-sm text-gray-500">
          DTA and local running, per day, at full and reduced coverage (PRD §8). Every request priced from this
          moment onward uses these numbers.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-400">
                <th className="py-2 pr-4">Band</th>
                <th className="py-2 pr-4">DTA @100%</th>
                <th className="py-2 pr-4">DTA @75%</th>
                <th className="py-2 pr-4">Local @100%</th>
                <th className="py-2 pr-4">Local @75%</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {gradeBands.map((b) => (
                <GradeBandRow key={b.id} band={b} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div id="designations">
        <h2 className="text-lg font-semibold text-gray-900">Designation → Grade Band</h2>
        <p className="mt-1 text-sm text-gray-500">
          The 14 designations are confirmed exhaustive (PRD §8) — only which band each one maps to is editable
          here. A designation left unmapped hard-refuses the calculator rather than guessing (FR-13).
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-400">
                <th className="py-2 pr-4">Designation</th>
                <th className="py-2 pr-4">Band</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {designations.map((d) => (
                <DesignationRow key={d.id} designation={d} gradeBands={gradeBands} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div id="policy-defaults">
        <h2 className="text-lg font-semibold text-gray-900">Policy Defaults</h2>
        <p className="mt-1 text-sm text-gray-500">
          Flat transport/taxi defaults and the cities paid at 100% coverage — HR can still override transport and
          taxi per traveller on any individual request.
        </p>
        <div className="mt-4">
          <PolicyDefaultsForm defaults={policyDefaults} />
        </div>
      </div>
    </div>
  )
}
