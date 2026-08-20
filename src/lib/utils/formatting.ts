/**
 * Currency, date, and number formatting helpers.
 * PRD Section 5.1 — Cost Calculation
 * PRD Section 5.2 — FX Handling (NGN/USD display)
 */

// ============================================================
// Currency Formatting
// ============================================================

/**
 * Format a number as Nigerian Naira.
 * @example formatNGN(150000) => "₦150,000.00"
 */
export function formatNGN(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format a number as US Dollars.
 * @example formatUSD(1200) => "$1,200.00"
 */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

/**
 * Convert USD to NGN using a given exchange rate.
 * PRD Section 5.2: Costs stored in USD, displayed with NGN equivalent.
 */
export function usdToNgn(amountUsd: number, fxRate: number): number {
  return amountUsd * fxRate
}

// ============================================================
// Cost Calculation (PRD Section 5.1)
// ============================================================

interface AllowanceFields {
  allowance_local: number
  allowance_flight: number
  allowance_taxi: number
  accommodation: number
  per_diem: number
}

/**
 * Calculate the total raw allowance before coverage is applied.
 * PRD: Total_Raw_Allowance = local + flight + taxi + accommodation + per_diem
 */
export function calculateTotalRawAllowance(fields: AllowanceFields): number {
  return (
    fields.allowance_local +
    fields.allowance_flight +
    fields.allowance_taxi +
    fields.accommodation +
    fields.per_diem
  )
}

/**
 * Calculate the final cost after coverage percentage is applied.
 * PRD: Final_Cost = Total_Raw_Allowance × (coverage_percent / 100)
 */
export function calculateFinalCost(
  totalRawAllowance: number,
  coveragePercent: number
): number {
  return totalRawAllowance * (coveragePercent / 100)
}

// ============================================================
// Date Formatting
// ============================================================

/**
 * Format a date string for display.
 * @example formatDate('2026-08-15') => "15 Aug 2026"
 */
export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateString))
}

/**
 * Format a date string with time for audit logs.
 * @example formatDateTime('2026-08-15T10:30:00Z') => "15 Aug 2026, 10:30"
 */
export function formatDateTime(dateString: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

/**
 * Human-readable staleness label for a `rate_reference.updated_at` value —
 * drives the Flight Price Reference "Updated N days ago" note (PRD 3.2 /
 * UI_UX_DESIGN_PLAN.md §4). Null means it's never been touched since the
 * original seed.
 */
export function formatStaleness(updatedAt: string | null): string {
  if (!updatedAt) return 'Never updated'
  const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86_400_000)
  if (days <= 0) return 'Updated today'
  if (days === 1) return 'Updated yesterday'
  return `Updated ${days} days ago`
}

/** True once a reference price is old enough that HR should double-check it before trusting it. */
export function isStale(updatedAt: string | null, thresholdDays = 30): boolean {
  if (!updatedAt) return true
  const days = (Date.now() - new Date(updatedAt).getTime()) / 86_400_000
  return days > thresholdDays
}

/**
 * Cosmetic display label for a travel request, e.g. "TRQ-2026-A1B2C3".
 * Purely presentational — nothing downstream depends on it being sequential,
 * it's derived from the submission year + a slice of the UUID.
 */
export function formatRequestId(row: { id: string; submitted_at: string }): string {
  const year = new Date(row.submitted_at).getFullYear()
  return `TRQ-${year}-${row.id.slice(0, 6).toUpperCase()}`
}

/**
 * Check if two date ranges overlap.
 * Used by the Date-Overlap Warning (PRD Section 3.1).
 */
export function datesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = new Date(start1).getTime()
  const e1 = new Date(end1).getTime()
  const s2 = new Date(start2).getTime()
  const e2 = new Date(end2).getTime()
  return s1 <= e2 && s2 <= e1
}
