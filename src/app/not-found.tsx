import Link from 'next/link'
import { EyeMark } from '@/components/auth/icons'

/**
 * Root 404. Covers genuinely unmatched URLs and the `/__blocked` rewrite
 * `src/proxy.ts` issues when a signed-in user's role isn't allowed into the
 * route they typed — both cases render this exact page, so a wrong-role
 * visit and a mistyped URL are indistinguishable.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
          <EyeMark className="h-6 w-6 text-white" />
        </div>
        <p className="mt-5 text-sm font-semibold tracking-widest text-gray-400">404</p>
        <h1 className="mt-1 text-xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-2 text-sm text-gray-600">
          This page doesn&apos;t exist, or you don&apos;t have access to it.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
