import { redirect } from 'next/navigation'
import { VerifyOtpForm } from '@/components/auth/verify-otp-form'

export default async function VerifyOtpPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams

  // Verifying without an email to verify against isn't a valid state —
  // send them back to request a fresh code instead of rendering a dead form.
  if (!email) {
    redirect('/login')
  }

  return <VerifyOtpForm email={email} />
}
