/**
 * Shared status pill for travel-request rows.
 *
 * Previously copy-pasted verbatim into staff-dashboard.tsx, hr-dashboard.tsx,
 * and md-dashboard.tsx — centralized here (PRD-aligned Day 3 UI convergence,
 * see IMPLEMENTATION_PLAN.md §3/§4). Always reads from
 * `REQUEST_STATUS_COLORS`/`REQUEST_STATUS_LABELS` (the real 6-state enum in
 * `src/lib/utils/constants.ts`), not the stale generic set that lived in
 * `frontend/constants/requeststatus.ts`.
 */

import { REQUEST_STATUS_COLORS, REQUEST_STATUS_LABELS } from '@/lib/utils/constants'
import type { RequestStatus } from '@/types/database'

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${REQUEST_STATUS_COLORS[status]}`}>
      {REQUEST_STATUS_LABELS[status]}
    </span>
  )
}
