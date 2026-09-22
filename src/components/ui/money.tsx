/**
 * NGN money display — every travel-request cost is stored and priced in
 * Naira, so this just formats it consistently everywhere.
 */

import { formatNGN } from '@/lib/utils/formatting'

const PRIMARY_SIZE = {
  sm: 'text-sm font-semibold',
  md: 'text-base font-semibold',
  lg: 'text-xl font-bold',
} as const

interface MoneyProps {
  ngn: number | null
  /** Shown in place of the figure when `ngn` is null. */
  emptyLabel?: string
  size?: keyof typeof PRIMARY_SIZE
  layout?: 'stack' | 'inline'
  align?: 'left' | 'right'
  className?: string
}

export function Money({
  ngn,
  emptyLabel = '—',
  size = 'sm',
  layout = 'stack',
  align = 'left',
  className = '',
}: MoneyProps) {
  const primary = PRIMARY_SIZE[size]

  if (ngn == null) {
    return <span className={`${primary} text-gray-400 ${className}`}>{emptyLabel}</span>
  }

  if (layout === 'inline') {
    return <span className={`${primary} text-gray-900 dark:text-gray-50 ${className}`}>{formatNGN(ngn)}</span>
  }

  return (
    <div className={`${align === 'right' ? 'text-right' : ''} ${className}`}>
      <p className={`${primary} text-gray-900 dark:text-gray-50`}>{formatNGN(ngn)}</p>
    </div>
  )
}
