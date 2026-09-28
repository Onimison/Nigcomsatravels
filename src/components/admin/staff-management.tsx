'use client'

/**
 * Staff Management — PRD Section 3.4: "Add, edit, deactivate staff
 * (Name, Email, Role, Department, Level)."
 *
 * The backend (addStaff/deactivateStaff/listStaff in staff.actions.ts) has
 * existed since Sprint 0; this is the UI that was never built (admin/page.tsx
 * was a static TODO stub — see IMPLEMENTATION_PLAN.md §1, §3 Day 3).
 *
 * Edit is intentionally out of scope for this pass — Add + Deactivate covers
 * the PRD-critical "get a tester onto the platform" path without expanding
 * today's surface area.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addStaff, deactivateStaff, editStaff } from '@/lib/actions/staff.actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { StaffBulkImport } from '@/components/admin/staff-bulk-import'
import type { Department, Designation, GradeBand, Level, StaffWithDetails, UserRole } from '@/types/database'

type DesignationWithBand = Designation & { grade_band: Pick<GradeBand, 'code' | 'label'> | null }

const ROLE_OPTIONS: { label: string; value: UserRole }[] = [
  { label: 'Staff', value: 'staff' },
  { label: 'HR', value: 'hr' },
  { label: 'MD', value: 'md' },
  { label: 'Admin', value: 'admin' },
]

const EMPTY_FORM = {
  first_name: '',
  surname: '',
  email: '',
  role: 'staff' as UserRole,
  department_id: '',
  level_id: '',
}

function staffName(row: StaffWithDetails): string {
  return [row.first_name, row.surname].filter(Boolean).join(' ') || row.email
}

function AddStaffForm({
  departments,
  levels,
  onDone,
}: {
  departments: Department[]
  levels: Level[]
  onDone: () => void
}) {
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

    if (!form.department_id || !form.level_id) {
      setError('Select a department and level')
      return
    }

    setIsSubmitting(true)
    const result = await addStaff({
      first_name: form.first_name.trim(),
      surname: form.surname.trim(),
      email: form.email.trim(),
      role: form.role,
      department_id: form.department_id,
      level_id: form.level_id,
    })
    setIsSubmitting(false)

    if (!result.success) {
      setError(result.error ?? 'Could not add staff member. Please try again.')
      return
    }

    router.refresh()
    onDone()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 space-y-4 rounded-lg border border-gray-100 bg-gray-50 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="First Name"
          value={form.first_name}
          onChange={(e) => update('first_name', e.target.value)}
          required
        />
        <Input
          label="Surname"
          value={form.surname}
          onChange={(e) => update('surname', e.target.value)}
          required
        />
      </div>

      <Input
        label="Official Email"
        type="email"
        value={form.email}
        onChange={(e) => update('email', e.target.value)}
        placeholder="you@nigcomsat.gov.ng"
        required
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Select
          label="Role"
          value={form.role}
          onChange={(e) => update('role', e.target.value as UserRole)}
          options={ROLE_OPTIONS}
        />
        <Select
          label="Department"
          value={form.department_id}
          onChange={(e) => update('department_id', e.target.value)}
        >
          <option value="">Select department…</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </Select>
        <Select
          label="Level"
          value={form.level_id}
          onChange={(e) => update('level_id', e.target.value)}
        >
          <option value="">Select level…</option>
          {levels.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </Select>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">{error}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Adding…' : 'Add Staff'}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function StaffRow({ row, designations }: { row: StaffWithDetails; designations: DesignationWithBand[] }) {
  const router = useRouter()
  const [isDeactivating, setIsDeactivating] = useState(false)
  const [editingDesignation, setEditingDesignation] = useState(false)
  const [designationId, setDesignationId] = useState(designations.find((d) => d.name === row.designation?.name)?.id ?? '')
  const [isSavingDesignation, setIsSavingDesignation] = useState(false)

  async function handleDeactivate() {
    if (!window.confirm(`Deactivate ${staffName(row)}? They will no longer be able to log in.`)) return

    setIsDeactivating(true)
    const result = await deactivateStaff(row.id)
    setIsDeactivating(false)

    if (!result.success) {
      window.alert(result.error ?? 'Could not deactivate staff member.')
      return
    }

    router.refresh()
  }

  async function handleSaveDesignation() {
    setIsSavingDesignation(true)
    const result = await editStaff({ id: row.id, designation_id: designationId || null })
    setIsSavingDesignation(false)

    if (!result.success) {
      window.alert(result.error ?? 'Could not save designation.')
      return
    }
    setEditingDesignation(false)
    router.refresh()
  }

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="whitespace-nowrap py-3 pr-4">
        <p className="font-medium text-gray-900">{staffName(row)}</p>
        <p className="text-xs text-gray-500">{row.email}</p>
      </td>
      <td className="whitespace-nowrap py-3 pr-4 text-sm capitalize text-gray-700">
        {row.role}
      </td>
      <td className="whitespace-nowrap py-3 pr-4 text-sm text-gray-700">
        {row.department?.name ?? '—'}
      </td>
      <td className="whitespace-nowrap py-3 pr-4 text-sm text-gray-700">
        {row.level?.name ?? '—'}
      </td>
      <td className="whitespace-nowrap py-3 pr-4">
        {editingDesignation ? (
          <div className="flex items-center gap-1.5">
            <div className="w-40">
              <Select value={designationId} onChange={(e) => setDesignationId(e.target.value)} className="px-2 py-1">
                <option value="">Unmapped</option>
                {designations.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </div>
            <Button className="px-2 py-1.5" onClick={handleSaveDesignation} disabled={isSavingDesignation}>
              {isSavingDesignation ? '…' : 'Save'}
            </Button>
            <Button variant="secondary" className="px-2 py-1.5" onClick={() => setEditingDesignation(false)} disabled={isSavingDesignation}>
              Cancel
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingDesignation(true)}
            className="text-sm text-gray-700 hover:underline"
          >
            {row.designation?.name ?? <span className="text-amber-600">Unmapped</span>}
          </button>
        )}
      </td>
      <td className="whitespace-nowrap py-3 pr-4">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            row.active
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {row.active ? 'Active' : 'Deactivated'}
        </span>
      </td>
      <td className="whitespace-nowrap py-3 text-right">
        {row.active && (
          <Button variant="danger" className="px-3 py-1.5" onClick={handleDeactivate} disabled={isDeactivating}>
            {isDeactivating ? 'Deactivating…' : 'Deactivate'}
          </Button>
        )}
      </td>
    </tr>
  )
}

export function StaffManagement({
  staff,
  departments,
  levels,
  designations,
}: {
  staff: StaffWithDetails[]
  departments: Department[]
  levels: Level[]
  designations: DesignationWithBand[]
}) {
  const [openForm, setOpenForm] = useState<'add' | 'import' | null>(null)
  const canAdd = departments.length > 0 && levels.length > 0

  function toggle(form: 'add' | 'import') {
    setOpenForm((current) => (current === form ? null : form))
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Staff Management</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => toggle('import')} disabled={!canAdd}>
            {openForm === 'import' ? 'Close' : 'Bulk Import'}
          </Button>
          <Button onClick={() => toggle('add')} disabled={!canAdd}>
            {openForm === 'add' ? 'Close' : '+ Add Staff'}
          </Button>
        </div>
      </div>

      {!canAdd && (
        <p className="mt-2 text-sm text-amber-600">
          Add at least one department and level before adding staff.
        </p>
      )}

      {openForm === 'add' && (
        <AddStaffForm departments={departments} levels={levels} onDone={() => setOpenForm(null)} />
      )}

      {openForm === 'import' && <StaffBulkImport departments={departments} levels={levels} />}

      {staff.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No staff members yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-400">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Department</th>
                <th className="py-2 pr-4">Level</th>
                <th className="py-2 pr-4">Designation</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {staff.map((row) => (
                <StaffRow key={row.id} row={row} designations={designations} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
