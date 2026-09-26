'use client'

/**
 * Thin client wrapper around TravelRequestForm for the standalone
 * /staff/request page — "cancel resubmit" navigates back to a blank form
 * instead of toggling local parent state.
 */

import { useRouter } from 'next/navigation'
import { TravelRequestForm, type ResubmitTarget } from './travel-request-form'
import type { PolicyDefaults } from '@/lib/utils/policy-calculator'
import type { AirportOption, GradeBand, GradeBandCode, StaffDirectoryEntry } from '@/types/database'

export function RequestFormClient({
  airports,
  gradeBands,
  policyDefaults,
  staffDirectory,
  currentUser,
  resubmitTarget,
}: {
  airports: AirportOption[]
  gradeBands: GradeBand[]
  policyDefaults: PolicyDefaults
  staffDirectory: StaffDirectoryEntry[]
  currentUser: { id: string; name: string; designation: string | null; gradeBandCode: GradeBandCode | null }
  resubmitTarget: ResubmitTarget | null
}) {
  const router = useRouter()

  return (
    <TravelRequestForm
      key={resubmitTarget?.id ?? 'new'}
      airports={airports}
      gradeBands={gradeBands}
      policyDefaults={policyDefaults}
      staffDirectory={staffDirectory}
      currentUser={currentUser}
      resubmitTarget={resubmitTarget}
      onCancelResubmit={() => router.push('/staff/request')}
    />
  )
}
