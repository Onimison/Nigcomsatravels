'use client' // Error boundaries must be Client Components

import { DashboardError } from '@/components/ui/dashboard-error'

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return <DashboardError error={error} retry={unstable_retry} title="Couldn't load your dashboard" />
}
