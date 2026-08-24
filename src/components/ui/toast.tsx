'use client'

/**
 * Shows a one-shot confirmation message queued by `queueToast()` (see
 * lib/utils/toast.ts) — used to replace an inline "submitted" message with a
 * pop-up that appears on the page a redirect lands on, e.g. after a travel
 * request is submitted and the user is sent to /staff/pending. Renders
 * nothing once there's no queued message.
 */

import { useEffect, useState } from 'react'
import { consumeToast } from '@/lib/utils/toast'

const AUTO_DISMISS_MS = 6000

export function ToastOnMount() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    // Reads a browser-only sessionStorage value, so it can only happen after
    // mount — never available during the server render this hydrates from.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot read of a client-only value, not derivable during SSR
    setMessage(consumeToast())
  }, [])

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [message])

  if (!message) return null

  return (
    <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4 sm:left-auto sm:right-4 sm:justify-end">
      <div
        role="status"
        className="flex items-start gap-3 rounded-lg border border-green-200 bg-white px-4 py-3 shadow-lg dark:border-green-900 dark:bg-gray-900"
      >
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs text-green-600 dark:bg-green-900 dark:text-green-400">
          ✓
        </span>
        <p className="text-sm text-gray-700 dark:text-gray-200">{message}</p>
        <button
          type="button"
          onClick={() => setMessage(null)}
          className="ml-1 shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
