/**
 * OTP Verification Page — PRD Section 2.1
 * User enters the 6-digit code sent to their email.
 */

import { verifyOtp } from '@/lib/actions/auth.actions'

export default async function VerifyOtpPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
          Enter Verification Code
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          We sent a 6-digit code to {email ?? 'your email'}
        </p>
      </div>

      <form action={async (formData) => { 'use server'; await verifyOtp(formData) }} className="space-y-4">
        <input type="hidden" name="email" value={email ?? ''} />

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
            placeholder="000000"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-center text-lg tracking-[0.5em] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-50"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          Verify &amp; Sign In
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-500">
        Didn&apos;t receive a code?{' '}
        <button className="font-medium text-blue-600 hover:underline">
          Resend
        </button>
      </p>
    </div>
  )
}