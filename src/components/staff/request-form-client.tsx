'use client'

/**
 * Thin client wrapper around TravelRequestForm for the standalone
 * /staff/request page — "cancel resubmit" navigates back to a blank form
 * instead of toggling local parent state (UI_UX_DESIGN_PLAN.md §3.2).
 */

import { useRouter } from 'next/navigation'
import { TravelRequestForm, type ResubmitTarget } from './travel-request-form'

export function RequestFormClient({ resubmitTarget }: { resubmitTarget: ResubmitTarget | null }) {
  const router = useRouter()

  return (
    <TravelRequestForm
      key={resubmitTarget?.id ?? 'new'}
      resubmitTarget={resubmitTarget}
      onCancelResubmit={() => router.push('/staff/request')}
    />
  )
}
