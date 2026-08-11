'use client'

/**
 * Login Page — PRD Section 2.1
 * Staff enter their official email to receive a 6-digit OTP,
 * then enter the code on the same screen (no page redirect).
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { sendOtp, verifyOtp } from '@/lib/actions/auth.actions'

type Step = 'email' | 'code'

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function requestCode() {
    setError(null)
    setIsSubmitting(true)

    const result = await sendOtp(email)

    setIsSubmitting(false)

    if (!result.success) {
      setError(result.error ?? 'Something went wrong. Please try again.')
      return
    }

    setStep('code')
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    await requestCode()
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const result = await verifyOtp(email, token)

    setIsSubmitting(false)

    if (!result.success) {
      setError(result.error ?? 'Invalid code. Please try again.')
      return
    }

    // verifyOtp redirects server-side on success; this is a fallback
    router.refresh()
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
          NIGCOMSAT Travel
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {step === 'email'
            ? 'Enter your official email to receive a login code'
            : `Enter the 6-digit code sent to ${email}`}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      {step === 'email' ? (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@nigcomsat.gov.ng"
              disabled={isSubmitting}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-50"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Sending code…' : 'Send Login Code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div>
            <label
              htmlFor="token"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Verification Code
            </label>
            <input
              id="token"
              name="token"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              disabled={isSubmitting}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-center text-lg tracking-[0.5em] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-50"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || token.length !== 6}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Verifying…' : 'Verify & Sign In'}
          </button>

          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-500">
            <button
              type="button"
              onClick={() => {
                setStep('email')
                setToken('')
                setError(null)
              }}
              className="font-medium text-blue-600 hover:underline"
            >
              Change email
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={requestCode}
              className="font-medium text-blue-600 hover:underline disabled:opacity-60"
            >
              Resend code
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
