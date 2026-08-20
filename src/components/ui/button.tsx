/**
 * Shared Button — visual reference: frontend/components/ui/button.tsx,
 * adapted to the rounded-lg / dark: variant language already established
 * across the app (see login-form.tsx, md-dashboard.tsx) rather than a raw
 * port, per IMPLEMENTATION_PLAN.md §4.
 */

import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'success' | 'danger' | 'outline' | 'secondary'

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  success: 'bg-green-600 text-white hover:bg-green-700',
  danger:
    'border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40',
  outline:
    'border border-blue-200 bg-white text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:bg-transparent dark:text-blue-400 dark:hover:bg-blue-950/40',
  secondary:
    'border border-gray-200 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export function Button({ variant = 'primary', type = 'button', className = '', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  )
}
