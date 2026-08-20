/**
 * Shared Input — visual reference: frontend/components/ui/input.tsx,
 * adapted to the dark:-aware pattern from login-form.tsx.
 */

import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-gray-800 dark:text-gray-50 dark:placeholder:text-gray-500 ${
          error
            ? 'border-red-300 dark:border-red-800'
            : 'border-gray-300 focus:border-blue-500 dark:border-gray-700'
        } ${className}`}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
