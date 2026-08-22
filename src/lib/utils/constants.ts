/**
 * Application constants and status mappings.
 * PRD Section 4 — Status Enum mapped to UI-friendly labels.
 */

import type { RequestStatus, ApprovalStatus } from '@/types/database'

// ============================================================
// Status Label Mappings (PRD Section 4)
// ============================================================

/** Key used in the app_settings table for the daily USD→NGN FX rate. */
export const FX_RATE_SETTING_KEY = 'fx_rate_usd_ngn'

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending_hr: 'Awaiting HR Review',
  pending_md: 'Awaiting MD Approval',
  hr_rejected: 'Returned by HR for Revision',
  md_rejected: 'Returned by MD for Revision',
  rejected_final: 'Rejected (Final)',
  approved: 'Approved',
} as const

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  hr_approved: 'HR Approved',
  md_approved: 'MD Approved',
  hr_rejected: 'HR Rejected',
  md_rejected: 'MD Rejected',
} as const

// ============================================================
// Status Color Mappings (for UI badges)
// ============================================================

/**
 * Semantic palette: 4 fixed roles, not 5+ ad hoc hues.
 *   attention (amber) — pending review, returned-for-revision (recoverable),
 *     resubmission/overlap warnings, stale data
 *   info (blue)        — in-flight, no action needed from the viewer yet
 *   error (red)        — final/hard rejection only
 *   success (green)    — approved
 * Reuse these class strings anywhere else in the UI that needs the same
 * meaning (banners, flags) instead of picking a color ad hoc.
 */
export const REQUEST_STATUS_COLORS: Record<RequestStatus, string> = {
  pending_hr: 'bg-amber-100 text-amber-800',
  pending_md: 'bg-blue-100 text-blue-800',
  hr_rejected: 'bg-amber-100 text-amber-800',
  md_rejected: 'bg-amber-100 text-amber-800',
  rejected_final: 'bg-red-100 text-red-800',
  approved: 'bg-green-100 text-green-800',
} as const

// ============================================================
// Role Routing (PRD Section 2.2 — role-based dashboard paths)
// ============================================================

export const ROLE_DASHBOARD_PATHS = {
  staff: '/staff',
  hr: '/hr',
  md: '/md',
  admin: '/admin',
} as const

// ============================================================
// App Configuration
// ============================================================

/** Session timeout in hours (PRD Section 2.1) */
export const SESSION_TIMEOUT_HOURS = 8

/** OTP code length (PRD Section 2.1) */
export const OTP_CODE_LENGTH = 6

// ============================================================
// Feature Flags (for incremental rollout)
// ============================================================

export const FEATURE_FLAGS = {
  /** PRD Section 3.3 — Deferred to v1.5 */
  BUDGET_AWARENESS: false,
  /** PRD Section 5.3 — Deferred to v1.5 */
  DIFF_VIEW: false,
  /** PRD Section 8 — Sprint 5 (Optional) */
  AI_RATE_SUGGESTIONS: false,
} as const
