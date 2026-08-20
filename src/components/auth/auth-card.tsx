import type { ReactNode } from 'react'
import { EyeMark } from './icons'

/** Default header icon: the blue "eye" mark used across the brand panel. */
export function AuthCardIcon({ tone = 'blue' }: { tone?: 'blue' | 'green' }) {
  const toneClass =
    tone === 'green'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
      : 'bg-blue-600 text-white'

  return (
    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${toneClass}`}>
      <EyeMark className="h-6 w-6" />
    </div>
  )
}

interface AuthCardProps {
  icon: ReactNode
  title: string
  subtitle?: ReactNode
  children: ReactNode
}

/** Shared card shell for the login / verify-otp / success states. */
export function AuthCard({ icon, title, subtitle, children }: AuthCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-6">
        {icon}
        <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-50">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

/** The blue "Passwordless secure login" info box repeated on both auth cards. */
export function PasswordlessInfoBox() {
  return (
    <div className="mt-6 flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/40">
      <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true">
        <path
          d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="text-sm">
        <p className="font-semibold text-blue-900 dark:text-blue-300">Passwordless secure login</p>
        <p className="mt-0.5 text-blue-700 dark:text-blue-400/90">
          A 6-digit verification code will be sent to your official company email. Codes expire in 10 minutes and can only be used once.
        </p>
      </div>
    </div>
  )
}
