'use client'

/**
 * App-wide top progress bar for client-side route transitions. The various
 * `loading.tsx` files already give each destination route an instant
 * skeleton once Next starts rendering it; this covers the gap right after
 * a click, before that kicks in, so navigation always reads as "in
 * progress" rather than unresponsive. No new dependency — it watches
 * internal `<a>` clicks and waits for the pathname/search params to
 * settle on the new route.
 */

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

type Phase = 'idle' | 'loading' | 'done'

export function RouteProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const routeKey = `${pathname}?${searchParams.toString()}`
  const previousKey = useRef(routeKey)
  const [phase, setPhase] = useState<Phase>('idle')

  // The route landed — finish the bar, then hide it.
  useEffect(() => {
    if (previousKey.current === routeKey) return
    previousKey.current = routeKey
    setPhase((p) => (p === 'loading' ? 'done' : p))
  }, [routeKey])

  useEffect(() => {
    if (phase !== 'done') return
    const timeout = setTimeout(() => setPhase('idle'), 500)
    return () => clearTimeout(timeout)
  }, [phase])

  // Start the bar the moment an internal link is clicked, not after the
  // navigation resolves — that's the whole point of a top-of-page hint.
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const anchor = (event.target as HTMLElement | null)?.closest('a')
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) return

      let url: URL
      try {
        url = new URL(href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return

      setPhase('loading')
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  if (phase === 'idle') return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 bg-blue-600/10" aria-hidden="true">
      <div className="route-progress-bar" data-phase={phase} />
    </div>
  )
}
