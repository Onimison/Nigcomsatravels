/**
 * Routes HR review to the DTA workflow. Pre-Phase-0 rows are kept visible
 * for auditability, but cannot enter the retired allowance/FX workflow.
 */

import { LegacyReviewNotice } from './legacy-review-notice'
import { ReviewCardV2 } from './review-card-v2'
import type { TravelRequestForHR } from '@/types/database'

export function ReviewCard({ row }: { row: TravelRequestForHR }) {
  if (row.memo_number) {
    return <ReviewCardV2 row={row} />
  }
  return <LegacyReviewNotice origin={row.origin} destination={row.destination} submittedAt={row.submitted_at} />
}
