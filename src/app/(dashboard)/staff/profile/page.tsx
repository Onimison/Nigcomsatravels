import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getMyProfile } from '@/lib/actions/staff.actions'
import { requireDashboardAccess } from '@/lib/utils/auth-guard'
import { PageHeader } from '@/components/ui/page-header'
import type { StaffWithDetails } from '@/types/database'

export const metadata: Metadata = {
  title: 'Profile — NIGCOMSAT Travel',
  description: 'Your staff profile details',
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-900">{value}</p>
    </div>
  )
}

function initials(staff: StaffWithDetails): string {
  return `${staff.first_name?.[0] ?? ''}${staff.surname?.[0] ?? ''}`.toUpperCase() || staff.email[0].toUpperCase()
}

export default async function ProfilePage() {
  const auth = await requireDashboardAccess('staff')
  if (!auth.authorized) {
    redirect('/')
  }

  const { data } = await getMyProfile()
  const staff = data as StaffWithDetails | null

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" subtitle="Your staff record. Contact Admin to update any of these details." />

      <section className="max-w-2xl rounded-xl border border-gray-200 bg-white p-6">
        {!staff ? (
          <p className="text-sm text-red-600">Could not load your profile.</p>
        ) : (
          <>
            <div className="mb-5 flex items-center gap-4 border-b border-gray-100 pb-5">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xl font-semibold text-blue-700">
                {initials(staff)}
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {[staff.first_name, staff.surname].filter(Boolean).join(' ') || staff.email}
                </p>
                <p className="text-sm text-gray-500">
                  {staff.role.toUpperCase()} · {staff.department?.name ?? 'No department'}
                </p>
                <span
                  className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    staff.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {staff.active ? 'Active' : 'Deactivated'}
                </span>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Email" value={staff.email} />
              <Field label="Role" value={staff.role} />
              <Field label="Department" value={staff.department?.name ?? '—'} />
              <Field label="Level" value={staff.level?.name ?? '—'} />
              <Field
                label="Travel Coverage"
                value={staff.level ? `${staff.level.coverage_percent}% of allowance` : '—'}
              />
              <Field label="Flight Class" value={staff.level?.flight_class ?? '—'} />
            </div>
          </>
        )}
      </section>
    </div>
  )
}
