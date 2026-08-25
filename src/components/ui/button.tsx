/**
 * Shared Button — visual reference: frontend/components/ui/button.tsx,
 * matches the rounded-lg variant language already established
 * across the app (see login-form.tsx, md-dashboard.tsx) rather than a raw
 * port, per IMPLEMENTATION_PLAN.md §4.
 */

import Link from 'next/link'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'success' | 'danger' | 'outline' | 'secondary'

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  success: 'bg-green-600 text-white hover:bg-green-700',
  danger: 'border border-red-200 text-red-700 hover:bg-red-50',
  outline: 'border border-blue-200 bg-white text-blue-700 hover:bg-blue-50',
  secondary: 'border border-gray-200 text-gray-700 hover:bg-gray-100',
}

const BASE_CLASSES =
  'flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export function Button({ variant = 'primary', type = 'button', className = '', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`${BASE_CLASSES} disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  )
}

interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  variant?: Variant
}

/**
 * A same-styled `<Link>` for when the action navigates rather than submits
 * — e.g. a Card's "View all" action. Deliberately not a `<Button>` wrapping
 * a `<Link>` (or vice versa): nesting an interactive `<button>` inside an
 * `<a>` is invalid HTML and confuses screen readers.
 */
export function LinkButton({ variant = 'primary', className = '', ...props }: LinkButtonProps) {
  return <Link className={`${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${className}`} {...props} />
}
