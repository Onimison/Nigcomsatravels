'use client'

/**
 * Printable memo + copy-ready breakdown — REVISED_SCOPE.md §7: "the Phase 0
 * deliverable and stays permanently as the fallback." HR prints or copies
 * this straight into the ERP memo once a request has been forwarded — no
 * dependency on the ERP integration existing.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatDate, formatNGN } from '@/lib/utils/formatting'
import type { RequestTravellerWithStaff, TravelRequestForMD } from '@/types/database'

function travellerName(t: RequestTravellerWithStaff): string {
  if (!t.staff) return 'Unknown staff'
  return [t.staff.first_name, t.staff.surname].filter(Boolean).join(' ') || t.staff.email
}

function staffName(row: TravelRequestForMD): string {
  if (!row.staff) return 'Unknown staff'
  return [row.staff.first_name, row.staff.surname].filter(Boolean).join(' ') || row.staff.email
}

/** HR's forwarding note is the reason on the `hr_approved` approvals row, if any. */
function hrNote(row: TravelRequestForMD): string | null {
  const approved = (row.approvals ?? []).filter((a) => a.status === 'hr_approved')
  if (approved.length === 0) return null
  return [...approved].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.reason ?? null
}

function buildPlainTextBreakdown(row: TravelRequestForMD): string {
  const lines = [
    `Memo: ${row.memo_number}`,
    `Requested by: ${staffName(row)} (${row.staff?.department?.name ?? 'Unassigned'})`,
    `Route: ${row.origin} -> ${row.destination} (${row.mode}${row.one_way ? ', one-way' : ''})`,
    `Dates: ${formatDate(row.depart_date)} - ${formatDate(row.return_date)} (${row.days_approved ?? row.days_requested} days)`,
    `Coverage: ${row.coverage_percent_applied ?? '—'}%`,
    '',
    'Traveller breakdown:',
    ...row.travellers.map(
      (t) =>
        `- ${travellerName(t)} [${t.grade_band_code}]: DTA ${formatNGN(t.dta)}, Local Running ${formatNGN(t.local_running)}, Transport ${formatNGN(t.transport_cost)}, Airport Taxi ${formatNGN(t.airport_taxi)} = ${formatNGN(t.traveller_total)}`
    ),
    '',
    `Total: ${formatNGN(row.request_total ?? 0)}`,
  ]

  const note = hrNote(row)
  if (note) lines.push('', `HR note: ${note}`)

  return lines.join('\n')
}

export function PrintableMemo({ row }: { row: TravelRequestForMD }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildPlainTextBreakdown(row))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.alert('Could not copy — your browser may be blocking clipboard access.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <Button onClick={() => window.print()}>Print Memo</Button>
        <Button variant="outline" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy Breakdown'}
        </Button>
      </div>

      <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-8 print:border-0 print:p-0">
        <div className="border-b border-gray-200 pb-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">NIGCOMSAT — Travel Memo</p>
          <p className="mt-1 text-lg font-bold text-gray-900">{row.memo_number}</p>
        </div>

        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Requested By</p>
            <p className="mt-0.5 text-gray-900">{staffName(row)}</p>
            <p className="text-gray-500">{row.staff?.department?.name ?? 'Unassigned'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Route</p>
            <p className="mt-0.5 text-gray-900">{row.origin} → {row.destination}</p>
            <p className="text-gray-500 capitalize">{row.mode}{row.one_way ? ' · one-way' : ''}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Dates</p>
            <p className="mt-0.5 text-gray-900">{formatDate(row.depart_date)} – {formatDate(row.return_date)}</p>
            <p className="text-gray-500">{row.days_approved ?? row.days_requested} days · {row.coverage_percent_applied ?? '—'}% coverage</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Reason for Travel</p>
            <p className="mt-0.5 text-gray-900">{row.reason_for_travel || '—'}</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Traveller Breakdown</p>
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-400">
                <th className="py-1.5 pr-2">Traveller</th>
                <th className="py-1.5 pr-2">Band</th>
                <th className="py-1.5 pr-2">DTA</th>
                <th className="py-1.5 pr-2">Local Running</th>
                <th className="py-1.5 pr-2">Transport</th>
                <th className="py-1.5 pr-2">Taxi</th>
                <th className="py-1.5 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {row.travellers.map((t) => (
                <tr key={t.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-1.5 pr-2 text-gray-900">{travellerName(t)}</td>
                  <td className="py-1.5 pr-2 text-gray-500">{t.grade_band_code}</td>
                  <td className="py-1.5 pr-2 text-gray-700">{formatNGN(t.dta)}</td>
                  <td className="py-1.5 pr-2 text-gray-700">{formatNGN(t.local_running)}</td>
                  <td className="py-1.5 pr-2 text-gray-700">{formatNGN(t.transport_cost)}</td>
                  <td className="py-1.5 pr-2 text-gray-700">{formatNGN(t.airport_taxi)}</td>
                  <td className="py-1.5 text-right font-medium text-gray-900">{formatNGN(t.traveller_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end border-t border-gray-200 pt-3">
          <div className="text-right">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-xl font-bold text-gray-900">{formatNGN(row.request_total ?? 0)}</p>
          </div>
        </div>

        {hrNote(row) && (
          <div className="border-t border-gray-200 pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">HR Note</p>
            <p className="mt-0.5 text-sm text-gray-700">{hrNote(row)}</p>
          </div>
        )}
      </div>
    </div>
  )
}
