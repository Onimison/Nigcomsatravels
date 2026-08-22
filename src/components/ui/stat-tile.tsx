/**
 * Stat tile — icon badge + big number + label. The 4-tile row pattern from
 * the Staff Dashboard reference (ui-images/), reused with different metrics
 * across HR/MD/Admin. See UI_UX_DESIGN_PLAN.md §2.
 */

type Tone = 'amber' | 'green' | 'red' | 'blue' | 'gray'

const TONE_CLASSES: Record<Tone, string> = {
  amber: 'bg-amber-100 text-amber-600',
  green: 'bg-green-100 text-green-600',
  red: 'bg-red-100 text-red-600',
  blue: 'bg-blue-100 text-blue-600',
  gray: 'bg-gray-100 text-gray-600',
}

export function StatTile({
  icon: Icon,
  value,
  label,
  tone = 'gray',
}: {
  icon: React.ComponentType<{ className?: string }>
  value: string | number
  label: string
  tone?: Tone
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:gap-4 sm:p-5">
      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${TONE_CLASSES[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold leading-none text-gray-900">{value}</p>
        <p className="mt-1 text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}
