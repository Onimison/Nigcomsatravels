/**
 * Router between the two review forms — HR (and Admin) always land on this
 * one component from `/hr/requests/[id]`, and never has to know which shape
 * the request underneath is. `memo_number` set means Phase 0 (ReviewCardV2,
 * notes.md v1.1): multi-traveller, NGN-only, days + per-traveller
 * transport/taxi. Its absence means a pre-Phase-0 request, which still
 * needs the original 5-allowance-field/FX form (ReviewCardLegacy).
 *
 * No hooks live here on purpose — each branch owns its own state, so this
 * stays a plain conditional rather than a component that has to reconcile
 * two very different pieces of local state on every render.
 */

import { ReviewCardLegacy } from './review-card-legacy'
import { ReviewCardV2 } from './review-card-v2'
import type { TravelRequestForHR } from '@/types/database'

export function ReviewCard({ row, fxRate }: { row: TravelRequestForHR; fxRate: number | null }) {
  if (row.memo_number) {
    return <ReviewCardV2 row={row} />
  }
  return <ReviewCardLegacy row={row} fxRate={fxRate} />
}
