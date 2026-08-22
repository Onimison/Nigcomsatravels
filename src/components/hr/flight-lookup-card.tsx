/**
 * Inline "check live fares" card for the HR review screen.
 *
 * Sits next to the Flight allowance input so HR can confirm a fare without
 * leaving the request, retyping the route, or re-picking the dates. It is
 * deliberately a link and not a number: nothing here can be stale, wrong, or
 * down, because it asserts nothing about price.
 *
 * When cached quotes exist this card is where they render — above the link,
 * with their own `fetched_at`. The link stays either way (a quote is an
 * anchor to sanity-check, not an authority to defer to), and the card must
 * never gate the approval flow: if there's no route to search, it renders a
 * plain instruction to check manually and HR carries on.
 */

import { PlaneIcon, ExternalLinkIcon } from '@/components/ui/icons'
import { buildFlightSearchUrl, formatRoute, formatCabin } from '@/lib/utils/flight-search'
import type { FlightSearchParams } from '@/lib/utils/flight-search'

export function FlightLookupCard(params: FlightSearchParams) {
  const url = buildFlightSearchUrl(params)
  const route = formatRoute(params)
  const cabin = formatCabin(params.cabin)

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
          <PlaneIcon className="h-3.5 w-3.5" />
        </span>
        <span>
          <span className="font-medium text-gray-900">{route ?? 'Route unavailable'}</span>
          {cabin && <span className="text-gray-500"> · {cabin}</span>}
          <span className="block text-gray-500">
            No tracked fare yet — confirm the current price before entering an amount.
          </span>
        </span>
      </div>

      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          Check live fares
          <ExternalLinkIcon className="h-3 w-3" />
        </a>
      ) : (
        <span className="text-xs text-gray-400">Check manually</span>
      )}
    </div>
  )
}
