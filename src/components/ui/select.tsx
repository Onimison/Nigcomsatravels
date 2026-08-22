/**
 * Shared Select — visual reference: frontend/components/ui/select.tsx,
 * light-mode only, per globals.css.
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
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-lg border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
          error ? 'border-red-300' : 'border-gray-300 focus:border-blue-500'
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
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
