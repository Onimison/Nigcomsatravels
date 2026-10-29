import Link from 'next/link'
import { formatDate } from '@/lib/utils/formatting'

export function LegacyReviewNotice({
  origin,
  destination,
  submittedAt,
}: {
  origin: string | null
  destination: string | null
  submittedAt: string | null
}) {
  return (
    <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-5">
      <div>
        <p className="font-medium text-amber-950">
          {origin ? origin : 'Origin unavailable'} → {destination ? destination : 'Destination unavailable'}
        </p>
        <p className="mt-1 text-sm text-amber-800">
          {submittedAt ? `Submitted ${formatDate(submittedAt)}` : 'Submission date unavailable'}
        </p>
      </div>
      <div className="space-y-2 text-sm text-amber-900">
        <p>This request was created before the DTA costing workflow was introduced and has no ERP source memo number.</p>
        <p>The retired allowance and FX form cannot be used for a new HR costing. Create a new request from the approved ERP memo so the DTA calculation and audit trail are preserved.</p>
      </div>
      <Link
        href="/hr/requests"
        className="inline-flex rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
      >
        Return to review queue
      </Link>
    </div>
  )
}
