import type { Metadata } from 'next'
import { BrandPanel } from '@/components/auth/brand-panel'

export const metadata: Metadata = {
  title: 'Login — NIGCOMSAT Travel',
  description: 'Sign in to the NIGCOMSAT Travel Request Tool',
}

/**
 * Auth layout — wraps login and verify-otp pages.
 * Split screen: brand panel (lg+) on the left, the page's card on the right.
 * Matches the reference design in ui-images/.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-white dark:bg-gray-950">
      <BrandPanel />

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>

        <p className="mt-8 text-center text-xs text-gray-400 dark:text-gray-600">
          © 2026 NIGCOMSAT Limited · Internal Use Only.
        </p>
      </div>
    </div>
  )
}
