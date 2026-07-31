/**
 * Login Page — PRD Section 2.1
 * Staff enter their official email to receive a 6-digit OTP.
 *
 * TODO (Sprint 1 — Frontend):
 * - Style the form with ShadCN/Radix components
 * - Add loading state during OTP send
 * - Handle error display from sendOtp action
 * - Redirect to /verify-otp on success, passing email via query param or state
 */

import { sendOtp } from '@/lib/actions/auth.actions'

export default function LoginPage() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
          NIGCOMSAT Travel
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Enter your official email to receive a login code
        </p>
      </div>

      <form action={async (formData) => { 'use server'; await sendOtp(formData) }} className="space-y-4">
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
            placeholder="you@nigcomsat.gov.ng"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-50"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          Send Login Code
        </button>
      </form>
    </div>
  )
}
