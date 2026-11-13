'use client'

/**
 * Shared request card — extracted from staff-dashboard.tsx so it can be
 * reused across the overview, /staff/pending, and /staff/history pages
 * (UI_UX_DESIGN_PLAN.md §3.2).
 */

import { StatusBadge } from '@/components/ui/status-badge'
import { Money } from '@/components/ui/money'
import { Textarea } from '@/components/ui/textarea'
import { formatDate, formatNGN } from '@/lib/utils/formatting'
import { useState } from 'react'
import type { RequestStatus, TravelRequest } from '@/types/database'

interface ApprovalInfo {
  status: string
  reason: string | null
  is_final: boolean
  timestamp: string
}

/** Traveller row shape as embedded by getMyRequests() — enough for a count + unmapped flag, not the full breakdown. */
interface TravelerSummary {
  staff_id: string
  is_requester: boolean
  designation_name: string
  is_unmapped: boolean
  traveller_total: number | null
}

interface RequesterCosting extends TravelerSummary {
  dta_amount: number | null
  local_running_amount: number | null
  transport_amount: number
  airport_taxi_amount: number
}

export type StaffRequestRow = TravelRequest & {
  approvals: ApprovalInfo[] | null
  /** Null on pre-Phase-0 rows (queried before this column existed on the join). Empty array for a Phase-0 row somehow missing its own requester row. */
  request_travelers: TravelerSummary[] | null
  requester_costing: RequesterCosting[] | null
}

export const RESUBMITTABLE_STATUSES: RequestStatus[] = ['hr_rejected', 'md_rejected']

interface WithdrawResult {
  success: boolean
  error?: string
}

export function latestReason(row: StaffRequestRow): string | null {
  if (!row.approvals || row.approvals.length === 0) return null
  const sorted = [...row.approvals].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
  return sorted[0]?.reason ?? null
}

export function RequestCard({
  row,
  onResubmit,
  onWithdraw,
  versionLabel,
}: {
  row: StaffRequestRow
  /** Called with the request id to resubmit — the /staff/request page re-fetches full details server-side. */
  onResubmit?: (id: string) => void
  /** Withdraw is offered only by the pending-request list while HR has not started processing. */
  onWithdraw?: (id: string, reason: string) => Promise<WithdrawResult>
  versionLabel?: string
}) {
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawReason, setWithdrawReason] = useState('')
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const reason = latestReason(row)
  const canResubmit = RESUBMITTABLE_STATUSES.includes(row.status) && Boolean(row.memo_number)
  const canWithdraw = row.status === 'pending_hr' && Boolean(onWithdraw)
  const travelerCount = row.request_travelers?.length ?? 0
  const hasUnmapped = row.request_travelers?.some((t) => t.is_unmapped) ?? false
  const requesterCosting = row.requester_costing?.[0] ?? null
  const hasHrReviewedCosting = ['pending_md', 'approved', 'md_rejected', 'rejected_final'].includes(row.status)
  const costingLabel = hasHrReviewedCosting ? 'HR-reviewed costing' : 'Estimated costing'
  const approvalLabel = row.approval_source === 'erp'
    ? 'Final approval recorded in ERP'
    : row.status === 'approved'
      ? 'Final approval recorded'
      : 'Subject to final approval'

  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-50">
            {row.origin} → {row.destination}
            {versionLabel && (
              <span className="ml-2 text-xs font-normal text-gray-400">{versionLabel}</span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {formatDate(row.depart_date)} – {formatDate(row.return_date)} · {row.mode}
            {row.memo_number && <> · Memo {row.memo_number}</>}
            {travelerCount > 1 && <> · {travelerCount} travellers</>}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge status={row.status} />
          {row.memo_number && (
            <Money
              ngn={row.total_ngn}
              size="sm"
              layout="inline"
              emptyLabel={hasUnmapped ? 'Pending HR pricing' : '—'}
            />
          )}
        </div>
      </div>

      {reason && (row.status === 'hr_rejected' || row.status === 'md_rejected' || row.status === 'rejected_final') && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Reason: <span className="italic">“{reason}”</span>
        </p>
      )}

      {row.status === 'withdrawn' && row.withdrawal_reason && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Withdrawal reason: <span className="italic">“{row.withdrawal_reason}”</span>
        </p>
      )}

      {row.memo_number && requesterCosting && (
        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-300">
              {costingLabel}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-400">
              {hasHrReviewedCosting ? approvalLabel : 'Subject to HR verification'}
            </p>
          </div>
          {requesterCosting.is_unmapped ? (
            <p className="mt-2 text-sm text-blue-800 dark:text-blue-300">Your designation is awaiting HR pricing.</p>
          ) : (
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-blue-900 dark:text-blue-200 sm:grid-cols-4">
              <div>
                <dt>DTA</dt>
                <dd className="mt-0.5 font-medium">{requesterCosting.dta_amount === null ? 'Pending HR' : formatNGN(requesterCosting.dta_amount)}</dd>
              </div>
              <div>
                <dt>Local running</dt>
                <dd className="mt-0.5 font-medium">{requesterCosting.local_running_amount === null ? 'Pending HR' : formatNGN(requesterCosting.local_running_amount)}</dd>
              </div>
              <div>
                <dt>Transport</dt>
                <dd className="mt-0.5 font-medium">{formatNGN(requesterCosting.transport_amount)}</dd>
              </div>
              <div>
                <dt>Airport taxi</dt>
                <dd className="mt-0.5 font-medium">{formatNGN(requesterCosting.airport_taxi_amount)}</dd>
              </div>
            </dl>
          )}
        </div>
      )}

      {canResubmit && onResubmit && (
        <button
          type="button"
          onClick={() => onResubmit(row.id)}
          className="mt-3 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-950/40"
        >
          Resubmit
        </button>
      )}

      {canWithdraw && !withdrawOpen && (
        <button
          type="button"
          onClick={() => {
            setWithdrawError(null)
            setWithdrawOpen(true)
          }}
          className="mt-3 ml-2 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          Withdraw request
        </button>
      )}

      {canWithdraw && withdrawOpen && onWithdraw && (
        <form
          className="mt-3 rounded-lg border border-red-200 bg-red-50/60 p-3 dark:border-red-900/60 dark:bg-red-950/20"
          onSubmit={async (event) => {
            event.preventDefault()
            const trimmedReason = withdrawReason.trim()
            if (!trimmedReason) {
              setWithdrawError('Please explain why you are withdrawing this request')
              return
            }

            setIsWithdrawing(true)
            setWithdrawError(null)
            const result = await onWithdraw(row.id, trimmedReason)
            setIsWithdrawing(false)

            if (!result.success) {
              setWithdrawError(result.error ?? 'The request could not be withdrawn')
              return
            }

            setWithdrawOpen(false)
            setWithdrawReason('')
          }}
        >
          <p className="text-sm font-medium text-red-900 dark:text-red-300">Withdraw this request?</p>
          <p className="mt-1 text-xs text-red-800 dark:text-red-300">
            This removes it from HR review and keeps it in your history. You can submit a corrected request afterward.
          </p>
          <Textarea
            id={`withdrawal-reason-${row.id}`}
            label="Reason"
            value={withdrawReason}
            onChange={(event) => setWithdrawReason(event.target.value)}
            placeholder="e.g. I entered the wrong travel dates"
            maxLength={500}
            required
            autoFocus
            className="mt-3 bg-white dark:bg-gray-900"
            error={withdrawError ?? undefined}
          />
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={isWithdrawing}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isWithdrawing ? 'Withdrawing…' : 'Confirm withdrawal'}
            </button>
            <button
              type="button"
              onClick={() => {
                setWithdrawOpen(false)
                setWithdrawError(null)
              }}
              disabled={isWithdrawing}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Keep request
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
