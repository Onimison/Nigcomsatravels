import type { Metadata } from 'next'
import { getMyProfile } from '@/lib/actions/staff.actions'
import type { StaffWithDetails } from '@/types/database'

export const metadata: Metadata = {
  title: 'Profile — NIGCOMSAT Travel',
  description: 'Your staff profile details',
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-50">{value}</p>
    </div>
  )
}

export default async function ProfilePage() {
  const { data } = await getMyProfile()
  const staff = data as StaffWithDetails | null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Profile</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Your staff record. Contact Admin to update any of these details.
        </p>
      </div>

      <section className="max-w-2xl rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        {!staff ? (
          <p className="text-sm text-red-600 dark:text-red-400">Could not load your profile.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name" value={[staff.first_name, staff.surname].filter(Boolean).join(' ') || '—'} />
            <Field label="Email" value={staff.email} />
            <Field label="Role" value={staff.role} />
            <Field label="Department" value={staff.department?.name ?? '—'} />
            <Field label="Level" value={staff.level?.name ?? '—'} />
            <Field
              label="Travel Coverage"
              value={staff.level ? `${staff.level.coverage_percent}% of allowance` : '—'}
            />
            <Field label="Flight Class" value={staff.level?.flight_class ?? '—'} />
            <Field label="Status" value={staff.active ? 'Active' : 'Deactivated'} />
          </div>
        )}
      </section>
    </div>
  )
}
