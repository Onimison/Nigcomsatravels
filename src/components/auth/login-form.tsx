'use client'

/**
 * Login form — PRD Section 2.1.
 * Staff enter their official email to receive a 6-digit OTP, then we
 * navigate to /verify-otp?email=... to enter it.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { sendOtp } from '@/lib/actions/auth.actions'
import { AuthCard, AuthCardIcon, PasswordlessInfoBox } from './auth-card'
import { ArrowRightIcon } from './icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmed = email.trim()
    if (!trimmed) {
      setError('Email is required')
      return
    }

    setIsSubmitting(true)
    const result = await sendOtp({ email: trimmed })
    setIsSubmitting(false)

    if (!result.success) {
      setError(result.error ?? 'Something went wrong. Please try again.')
      return
    }

    router.push(`/verify-otp?email=${encodeURIComponent(trimmed)}`)
  }

  return (
    <AuthCard
      icon={<AuthCardIcon />}
      title="Welcome to NIGCOMSATRAVELS"
      subtitle="Enter your official company email to receive a secure 6-digit verification code."
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          id="email"
          name="email"
          type="email"
          label="Official Company Email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@nigcomsat.gov.ng"
          error={error ?? undefined}
        />

        <Button type="submit" disabled={isSubmitting} className="w-full py-2.5 text-sm font-semibold">
          {isSubmitting ? 'Sending code…' : (
            <>
              Continue
              <ArrowRightIcon className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      <PasswordlessInfoBox />
    </AuthCard>
  )
}
