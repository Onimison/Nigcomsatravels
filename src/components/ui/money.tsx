/**
 * Naira-first money display. Every travel-request cost is stored in USD
 * (PRD Section 5.2), but this is a tool used almost entirely in Nigeria —
 * NGN is what people actually read, so it's always the primary figure here,
 * with USD shown small as an "equivalent," never the other way round.
 *
 * Purely presentational — callers work out the NGN/USD figures themselves
 * (from a live FX rate while something is still being entered, or from a
 * request's `locked_fx_rate` once it's been priced) and hand both in.
 */

import { formatNGN, formatUSD } from '@/lib/utils/formatting'

const PRIMARY_SIZE = {
  sm: 'text-sm font-semibold',
  md: 'text-base font-semibold',
  lg: 'text-xl font-bold',
} as const

interface MoneyProps {
  /** Primary figure, always NGN. */
  ngn: number | null
  /** USD equivalent shown as secondary context. Omit to hide that line entirely (e.g. no FX rate on hand). */
  usd?: number | null
  /** Shown in place of both figures when `ngn` is null. */
  emptyLabel?: string
  size?: keyof typeof PRIMARY_SIZE
  /** 'stack' (NGN over USD, for totals) or 'inline' (USD in parens on one line, for tight table cells). */
  layout?: 'stack' | 'inline'
  align?: 'left' | 'right'
  className?: string
}

export function Money({
  ngn,
  usd = null,
  emptyLabel = '—',
  size = 'sm',
  layout = 'stack',
  align = 'left',
  className = '',
}: MoneyProps) {
  const primary = PRIMARY_SIZE[size]

  if (ngn == null) {
    // No FX rate was on hand to derive NGN — fall back to the raw USD
    // figure rather than hiding the amount entirely.
    if (usd != null) {
      return <span className={`${primary} text-gray-900 dark:text-gray-50 ${className}`}>{formatUSD(usd)}</span>
    }
    return <span className={`${primary} text-gray-400 ${className}`}>{emptyLabel}</span>
  }

  if (layout === 'inline') {
    return (
      <span className={`${primary} text-gray-900 dark:text-gray-50 ${className}`}>
        {formatNGN(ngn)}
        {usd != null && <span className="ml-1 text-xs font-normal text-gray-400">(≈ {formatUSD(usd)})</span>}
      </span>
    )
  }

  return (
    <div className={`${align === 'right' ? 'text-right' : ''} ${className}`}>
      <p className={`${primary} text-gray-900 dark:text-gray-50`}>{formatNGN(ngn)}</p>
      {usd != null && <p className="text-xs text-gray-400">≈ {formatUSD(usd)}</p>}
    </div>
  )
}
