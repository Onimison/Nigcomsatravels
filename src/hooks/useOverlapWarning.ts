'use client'

/**
 * Custom hook to check if new travel dates overlap with existing trips.
 * PRD Section 3.1 — Date-Overlap Warning
 *
 * "If new travel dates overlap with any existing pending_hr, pending_md,
 *  or approved request, the system displays a warning."
 *
 * Usage:
 *   const { overlaps, isChecking } = useOverlapWarning(departDate, returnDate)
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { datesOverlap } from '@/lib/utils/formatting'
import type { TravelRequest } from '@/types/database'

interface OverlapResult {
  /** List of overlapping requests */
  overlaps: Pick<TravelRequest, 'id' | 'destination' | 'depart_date' | 'return_date'>[]
  /** Whether the check is in progress */
  isChecking: boolean
}

export function useOverlapWarning(
  departDate: string | null,
  returnDate: string | null,
  /** Optionally exclude a specific request ID (e.g., when resubmitting) */
  excludeRequestId?: string
): OverlapResult {
  const [overlaps, setOverlaps] = useState<OverlapResult['overlaps']>([])
  const [isChecking, setIsChecking] = useState(false)

  // Derive empty state outside of useEffect to avoid synchronous setState
  const hasValidDates = Boolean(departDate && returnDate)

  useEffect(() => {
    if (!hasValidDates) return

    const controller = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsChecking(true)

    async function checkOverlaps() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          setOverlaps([])
          setIsChecking(false)
          return
        }

        // Fetch active requests that could overlap
        const { data: requests } = await supabase
          .from('travel_requests')
          .select('id, destination, depart_date, return_date')
          .eq('staff_id', user.id)
          .in('status', ['pending_hr', 'pending_md', 'approved'])

        if (!requests || controller.signal.aborted) {
          setOverlaps([])
          setIsChecking(false)
          return
        }

        const matching = requests.filter(
          (req) =>
            req.id !== excludeRequestId &&
            datesOverlap(departDate!, returnDate!, req.depart_date, req.return_date)
        )

        if (!controller.signal.aborted) {
          setOverlaps(matching)
          setIsChecking(false)
        }
      } catch {
        if (!controller.signal.aborted) {
          setOverlaps([])
          setIsChecking(false)
        }
      }
    }

    checkOverlaps()

    return () => controller.abort()
  }, [departDate, returnDate, excludeRequestId, hasValidDates])

  return { overlaps, isChecking }
}
