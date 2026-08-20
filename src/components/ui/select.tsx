/**
 * Shared Select — visual reference: frontend/components/ui/select.tsx,
 * adapted to the dark:-aware pattern from md-dashboard.tsx's filter selects.
 */

import type { ReactNode, SelectHTMLAttributes } from 'react'

interface Option {
  label: string
  value: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options?: Option[]
  error?: string
  children?: ReactNode
}

export function Select({ label, options, error, id, className = '', children, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-gray-800 dark:text-gray-50 ${
          error
            ? 'border-red-300 dark:border-red-800'
            : 'border-gray-300 focus:border-blue-500 dark:border-gray-700'
        } ${className}`}
        {...props}
      >
        {options
          ? options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          : children}
      </select>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
