'use client'

/**
 * Level Configuration — PRD Section 3.4: "Edit coverage_percent and
 * flight_class mapping per level — no code deployment required." This is
 * the actual mechanism the demo travel policy runs on (TRAVEL_POLICY_DEMO.md)
 * — every number in that policy is editable here.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addLevel, editLevel } from '@/lib/actions/levels.actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Level } from '@/types/database'

const EMPTY_FORM = { name: '', coverage_percent: '', flight_class: '' }

function AddLevelForm({ onDone }: { onDone: () => void }) {
  const router = useRouter()
  const [form, setForm] = useState(EMPTY_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const coverage = Number(form.coverage_percent)
    if (!form.name.trim() || !Number.isFinite(coverage)) {
      setError('Name and a numeric coverage percentage are required')
      return
    }

    setIsSubmitting(true)
    const result = await addLevel({
      name: form.name.trim(),
      coverage_percent: coverage,
      flight_class: form.flight_class.trim() || undefined,
    })
    setIsSubmitting(false)

    if (!result.success) {
      setError(result.error ?? 'Could not add level. Please try again.')
      return
    }

    router.refresh()
    onDone()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4"
    >
      <Input
        label="Grade Name"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        placeholder="e.g. Assistant Manager"
        required
      />
      <Input
        label="Coverage %"
        type="number"
        min={0}
        max={100}
        value={form.coverage_percent}
        onChange={(e) => setForm((f) => ({ ...f, coverage_percent: e.target.value }))}
        required
        className="w-28"
      />
      <Input
        label="Flight Class"
        value={form.flight_class}
        onChange={(e) => setForm((f) => ({ ...f, flight_class: e.target.value }))}
        placeholder="economy"
        className="w-36"
      />
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Adding…' : 'Add Level'}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function LevelRow({ level }: { level: Level }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [coverage, setCoverage] = useState(String(level.coverage_percent))
  const [flightClass, setFlightClass] = useState(level.flight_class ?? '')
  const [isSaving, setIsSaving] = useState(false)

  async function handleSave() {
    const coverageNum = Number(coverage)
    if (!Number.isFinite(coverageNum) || coverageNum < 0 || coverageNum > 100) {
      window.alert('Coverage must be a number between 0 and 100')
      return
    }

    setIsSaving(true)
    const result = await editLevel({
      id: level.id,
      coverage_percent: coverageNum,
      flight_class: flightClass.trim() || undefined,
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
      <td className="whitespace-nowrap py-3 pr-4 font-medium text-gray-900">{level.name}</td>
      <td className="whitespace-nowrap py-3 pr-4">
        {editing ? (
          <div className="w-20">
            <Input
              type="number"
              min={0}
              max={100}
              value={coverage}
              onChange={(e) => setCoverage(e.target.value)}
              className="px-2 py-1"
            />
          </div>
        ) : (
          <span className="text-sm text-gray-700">{level.coverage_percent}%</span>
        )}
      </td>
      <td className="whitespace-nowrap py-3 pr-4">
        {editing ? (
          <div className="w-28">
            <Input
              value={flightClass}
              onChange={(e) => setFlightClass(e.target.value)}
              className="px-2 py-1 capitalize"
            />
          </div>
        ) : (
          <span className="text-sm capitalize text-gray-700">{level.flight_class ?? '—'}</span>
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

export function LevelManagement({ levels }: { levels: Level[] }) {
  const [showAddForm, setShowAddForm] = useState(false)
  const sorted = [...levels].sort((a, b) => a.coverage_percent - b.coverage_percent)

  return (
    <div id="levels">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Level Configuration</h2>
          <p className="mt-1 text-sm text-gray-500">
            Coverage percentage and flight class per grade — this is the demo travel policy (see TRAVEL_POLICY_DEMO.md).
          </p>
        </div>
        <Button onClick={() => setShowAddForm((v) => !v)}>{showAddForm ? 'Close' : '+ Add Level'}</Button>
      </div>

      {showAddForm && <AddLevelForm onDone={() => setShowAddForm(false)} />}

      {sorted.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No levels configured yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-400">
                <th className="py-2 pr-4">Grade</th>
                <th className="py-2 pr-4">Coverage</th>
                <th className="py-2 pr-4">Flight Class</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((level) => (
                <LevelRow key={level.id} level={level} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
