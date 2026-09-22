'use client'

/**
 * Level Configuration — designation → grade band mapping
 * (REVISED_SCOPE.md §3/§7 Admin surface). Fourteen real designations, each
 * mapped to exactly one of four rate bands; the mapping is exhaustive with
 * hard failure by construction (`band_id` is NOT NULL), so an unmapped
 * grade can't exist as a level row in the first place.
 *
 * Editing the band *rates* themselves (dta_per_day / local_running_per_day)
 * happens in GradeBandManagement, not here — this screen only edits which
 * band a designation maps to.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addLevel, editLevel } from '@/lib/actions/levels.actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { GradeBand, LevelWithBand } from '@/types/database'

const EMPTY_FORM = { name: '', band_id: '' }

function AddLevelForm({ bands, onDone }: { bands: GradeBand[]; onDone: () => void }) {
  const router = useRouter()
  const [form, setForm] = useState(EMPTY_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.name.trim() || !form.band_id) {
      setError('Name and a grade band are required')
      return
    }

    setIsSubmitting(true)
    const result = await addLevel({ name: form.name.trim(), band_id: form.band_id })
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
        label="Designation"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        placeholder="e.g. Assistant Manager"
        required
      />
      <Select
        label="Grade Band"
        value={form.band_id}
        onChange={(e) => setForm((f) => ({ ...f, band_id: e.target.value }))}
        className="w-56"
      >
        <option value="">Select band…</option>
        {bands.map((b) => (
          <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
        ))}
      </Select>
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

function LevelRow({ level, bands }: { level: LevelWithBand; bands: GradeBand[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [bandId, setBandId] = useState(level.band_id)
  const [isSaving, setIsSaving] = useState(false)

  async function handleSave() {
    setIsSaving(true)
    const result = await editLevel({ id: level.id, band_id: bandId })
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
          <div className="w-56">
            <Select value={bandId} onChange={(e) => setBandId(e.target.value)}>
              {bands.map((b) => (
                <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
              ))}
            </Select>
          </div>
        ) : (
          <span className="text-sm text-gray-700">{level.band ? `${level.band.code} — ${level.band.name}` : '—'}</span>
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

export function LevelManagement({ levels, bands }: { levels: LevelWithBand[]; bands: GradeBand[] }) {
  const [showAddForm, setShowAddForm] = useState(false)
  const sorted = [...levels].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  return (
    <div id="levels">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Level Configuration</h2>
          <p className="mt-1 text-sm text-gray-500">
            Designation → grade band mapping. Band rates themselves are edited under Rates.
          </p>
        </div>
        <Button onClick={() => setShowAddForm((v) => !v)} disabled={bands.length === 0}>
          {showAddForm ? 'Close' : '+ Add Level'}
        </Button>
      </div>

      {showAddForm && <AddLevelForm bands={bands} onDone={() => setShowAddForm(false)} />}

      {sorted.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No levels configured yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-400">
                <th className="py-2 pr-4">Designation</th>
                <th className="py-2 pr-4">Grade Band</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((level) => (
                <LevelRow key={level.id} level={level} bands={bands} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
