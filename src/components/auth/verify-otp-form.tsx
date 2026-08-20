'use client'

/**
 * OTP verification form — PRD Section 2.1.
 * Six-digit boxed input with auto-advance, paste support, auto-submit on
 * the 6th digit, a resend cooldown, and a brief "Verification Successful"
 * state before navigating to the role dashboard.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { sendOtp, verifyOtp } from '@/lib/actions/auth.actions'
import { AuthCard, AuthCardIcon, PasswordlessInfoBox } from './auth-card'
import { ArrowRightIcon, CheckIcon } from './icons'
import { OTP_CODE_LENGTH } from '@/lib/utils/constants'
import { Button } from '@/components/ui/button'

const RESEND_COOLDOWN_SECONDS = 60

interface VerifyOtpFormProps {
  email: string
}

export function VerifyOtpForm({ email }: VerifyOtpFormProps) {
  const router = useRouter()
  const [digits, setDigits] = useState<string[]>(() => Array(OTP_CODE_LENGTH).fill(''))
  const [error, setError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS)
  const [resendNotice, setResendNotice] = useState<string | null>(null)
  const [verified, setVerified] = useState<{ done: boolean; redirectTo?: string }>({ done: false })
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  // Once verified, hold on the success state briefly, then navigate.
  useEffect(() => {
    if (!verified.done || !verified.redirectTo) return
    const target = verified.redirectTo
    const timer = setTimeout(() => router.push(target), 1400)
    return () => clearTimeout(timer)
  }, [verified, router])

  async function submitCode(code: string) {
    setError(null)
    setIsVerifying(true)
    const res = await verifyOtp({ email, token: code })
    setIsVerifying(false)

    if (!res.success) {
      setError(res.error ?? 'Invalid or expired code. Please try again.')
      setDigits(Array(OTP_CODE_LENGTH).fill(''))
      inputRefs.current[0]?.focus()
      return
    }

    setVerified({ done: true, redirectTo: res.redirectTo })
  }

  function handleDigitChange(index: number, rawValue: string) {
    const value = rawValue.replace(/\D/g, '')
    const next = [...digits]

    if (!value) {
      next[index] = ''
      setDigits(next)
      return
    }

    // A single keystroke lands one digit; a paste can fill several boxes
    // starting at `index` in one go.
    let cursor = index
    for (const ch of value) {
      if (cursor >= OTP_CODE_LENGTH) break
      next[cursor] = ch
      cursor++
    }
    setDigits(next)

    if (next.every((d) => d !== '')) {
      submitCode(next.join(''))
    } else {
      inputRefs.current[Math.min(cursor, OTP_CODE_LENGTH - 1)]?.focus()
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits]
      next[index - 1] = ''
      setDigits(next)
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const pasted = e.clipboardData.getData('text').trim()
    if (/^\d+$/.test(pasted)) {
      e.preventDefault()
      handleDigitChange(0, pasted)
    }
  }

  async function handleResend() {
    if (cooldown > 0) return
    setError(null)
    const res = await sendOtp({ email })
    setCooldown(RESEND_COOLDOWN_SECONDS)
    setResendNotice(res.success ? 'A new code was sent.' : (res.error ?? 'Could not resend code.'))
  }

  if (verified.done) {
    return (
      <AuthCard
        icon={<AuthCardIcon tone="green" />}
        title="Verification Successful"
        subtitle="Your identity has been verified successfully. Redirecting you to your dashboard…"
      >
        <div className="mb-6 grid grid-cols-6 gap-2">
          {digits.map((_, i) => (
            <div
              key={i}
              className="flex h-12 items-center justify-center rounded-lg border border-green-300 bg-green-50 text-green-600 dark:border-green-800 dark:bg-green-950/50 dark:text-green-400"
            >
              <CheckIcon className="h-5 w-5" />
            </div>
          ))}
        </div>

        <Button
          type="button"
          onClick={() => verified.redirectTo && router.push(verified.redirectTo)}
          className="w-full bg-green-700 py-2.5 text-sm font-semibold hover:bg-green-800 focus:ring-green-600/30"
        >
          Continue to Dashboard
          <ArrowRightIcon className="h-4 w-4" />
        </Button>

        <div className="mt-6 flex gap-3 rounded-xl border border-green-100 bg-green-50 p-4 dark:border-green-900/40 dark:bg-green-950/40">
          <CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400" />
          <div className="text-sm">
            <p className="font-semibold text-green-900 dark:text-green-300">Verification complete</p>
            <p className="mt-0.5 text-green-700 dark:text-green-400/90">
              Your account has been authenticated successfully.
            </p>
          </div>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      icon={<AuthCardIcon />}
      title="Verify Your Identity"
      subtitle="Enter the 6-digit verification code sent to your official company email."
    >
      <div className="grid grid-cols-6 gap-2" onPaste={handlePaste}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            disabled={isVerifying}
            onChange={(e) => handleDigitChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            aria-label={`Digit ${i + 1} of ${OTP_CODE_LENGTH}`}
            aria-invalid={error ? true : undefined}
            className={`h-12 w-full rounded-lg border text-center text-lg font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 dark:text-gray-50 ${
              error
                ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                : 'border-gray-300 bg-white focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800'
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
        Code sent to <span className="font-medium text-blue-600 dark:text-blue-400">{email}</span>
      </p>

      <Button
        type="button"
        onClick={() => submitCode(digits.join(''))}
        disabled={isVerifying || digits.some((d) => !d)}
        className="mt-4 w-full py-2.5 text-sm font-semibold"
      >
        {isVerifying ? 'Verifying…' : (
          <>
            Verify Code
            <ArrowRightIcon className="h-4 w-4" />
          </>
        )}
      </Button>

      <div className="mt-4 text-center text-sm">
        {cooldown > 0 ? (
          <p className="text-gray-500 dark:text-gray-400">
            Resend Code in{' '}
            <span className="font-medium text-gray-700 dark:text-gray-300">{formatCooldown(cooldown)}</span>
          </p>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Resend Code
          </button>
        )}
        {resendNotice && <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">{resendNotice}</p>}
      </div>

      <div className="mt-2 text-center">
        <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
          ‹ Back
        </Link>
      </div>

      <PasswordlessInfoBox />
    </AuthCard>
  )
}

function formatCooldown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
