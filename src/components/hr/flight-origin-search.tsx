'use client'

import { useState } from 'react'
import { DUTY_STATIONS } from '@/lib/utils/constants'
import { ExternalLinkIcon } from '@/components/ui/icons'

const ORIGIN_CODES: Record<(typeof DUTY_STATIONS)[number], string> = {
  Abuja: 'ABV',
  Lagos: 'LOS',
  Kaduna: 'KAD',
  Gombe: 'GMO',
}

/** Opens a live external lookup when HR needs a fare from another duty station. */
export function FlightOriginSearch() {
  const [origin, setOrigin] = useState<(typeof DUTY_STATIONS)[number]>('Abuja')
  const lookupUrl = `https://www.google.com/travel/flights?q=${encodeURIComponent(`Domestic flights from ${ORIGIN_CODES[origin]}`)}`

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-end sm:justify-between dark:border-gray-800">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-50">Need another origin?</p>
        <p className="mt-0.5 text-xs text-gray-500">The stored reference starts from Abuja (ABV). Check a live fare from another duty station when needed.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="flight-origin">Flight origin</label>
        <select
          id="flight-origin"
          value={origin}
          onChange={(event) => setOrigin(event.target.value as (typeof DUTY_STATIONS)[number])}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          {DUTY_STATIONS.map((station) => (
            <option key={station} value={station}>{station} ({ORIGIN_CODES[station]})</option>
          ))}
        </select>
        <a
          href={lookupUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950"
        >
          Check live fares <ExternalLinkIcon className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  )
}
