/**
 * One-shot "toast" message handed off across a client-side redirect, e.g.
 * confirming a travel request was submitted right before navigating away
 * from the form to the pending-requests queue. Backed by sessionStorage so
 * it survives the navigation but never leaks between tabs/sessions.
 */

const TOAST_KEY = 'nigcomsat:toast'

/** Queue a message to be shown once by the next page that calls `consumeToast()`. */
export function queueToast(message: string) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(TOAST_KEY, message)
  } catch {
    // sessionStorage unavailable (private mode, storage disabled) — skip the toast
  }
}

/** Read and clear the queued message, if any. Safe to call on every mount. */
export function consumeToast(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const message = sessionStorage.getItem(TOAST_KEY)
    if (message) sessionStorage.removeItem(TOAST_KEY)
    return message
  } catch {
    return null
  }
}
