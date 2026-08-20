'use client'

/**
 * Staff Dashboard — overview page (/staff), rebuilt to match the reference
 * design in ui-images/Screenshot 2026-08-20 at 11.15.17.png: welcome banner,
 * 4 stat tiles, a Pending Requests table, an Ongoing Trip card, and a Recent
 * Travel History list. See UI_UX_DESIGN_PLAN.md §3.2.
 *
 * The request form, full pending list, and full history now live on their
 * own routes (/staff/request, /staff/pending, /staff/history) — the
 * reference screenshot shows a pure overview with no form on it.
 */

import Link from 'next/link'
import { useMemo } from 'react'
import { StatTile } from '@/components/ui/stat-tile'
import { StatusBadge } from '@/components/ui/status-badge'
import { ClockIcon, CheckCircleIcon, XCircleIcon, HomeIcon, PlaneIcon } from '@/components/ui/icons'
import { formatDate, formatRequestId } from '@/lib/utils/formatting'
import type { RequestStatus } from '@/types/database'
import type { StaffRequestRow } from './request-card'

const ACTIVE_STATUSES: RequestStatus[] = ['pending_hr', 'pending_md', 'hr_rejected', 'md_rejected']
const RETURNED_STATUSES: RequestStatus[] = ['hr_rejected', 'md_rejected']

function latestVersionsOnly(requests: StaffRequestRow[]): StaffRequestRow[] {
  const groups = new Map<string, StaffRequestRow[]>()
  for (const row of requests) {
    const list = groups.get(row.travel_group_id) ?? []
    list.push(row)
    groups.set(row.travel_group_id, list)
  }
  return [...groups.values()].map(
    (versions) => versions.sort((a, b) => a.created_at.localeCompare(b.created_at))[versions.length - 1]
  )
}

function HistoryDot({ status }: { status: RequestStatus }) {
  const color = status === 'approved' ? 'bg-green-500' : status === 'rejected_final' ? 'bg-red-500' : 'bg-gray-400'
  return <span className={`h-2 w-2 flex-shrink-0 rounded-full ${color}`} />
}

export function StaffDashboard({ requests, staffFirstName }: { requests: StaffRequestRow[]; staffFirstName: string }) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const latest = useMemo(() => latestVersionsOnly(requests), [requests])

  const pendingCount = latest.filter((r) => r.status === 'pending_hr' || r.status === 'pending_md').length
  const approvedCount = latest.filter((r) => r.status === 'approved').length
  const returnedCount = latest.filter((r) => RETURNED_STATUSES.includes(r.status)).length

  const ongoingTrip = latest.find(
    (r) => r.status === 'approved' && r.depart_date <= today && today <= r.return_date
  )

  const pendingRows = useMemo(
    () =>
      latest
        .filter((r) => ACTIVE_STATUSES.includes(r.status))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 5),
    [latest]
  )

  const recentHistory = useMemo(
    () => [...requests].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5),
    [requests]
  )

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            Welcome back, <span className="text-blue-600 dark:text-blue-400">{staffFirstName}</span>.
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage your travel requests, track approvals, and stay on top of your upcoming trips.
          </p>
        </div>
        <Link
          href="/staff/request"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <PlaneIcon className="h-4 w-4" />
          Request Travel
        </Link>
      </section>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={ClockIcon} value={pendingCount} label="Pending Requests" tone="amber" />
        <StatTile icon={CheckCircleIcon} value={approvedCount} label="Approved Trips" tone="green" />
        <StatTile icon={XCircleIcon} value={returnedCount} label="Returned for Revision" tone="red" />
        <StatTile icon={HomeIcon} value={ongoingTrip ? '1' : 'None'} label="Ongoing Trip" tone="blue" />
      </div>

      {/* Pending Requests table */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Pending Requests</h2>
            <p className="mt-0.5 text-sm text-gray-500">Your active travel requests awaiting review.</p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
            {pendingRows.length} active
          </span>
        </div>

        {pendingRows.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No pending requests right now.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-400 dark:border-gray-800">
                  <th className="py-2 pr-4">Request ID</th>
                  <th className="py-2 pr-4">Destination</th>
                  <th className="py-2 pr-4">Departure</th>
                  <th className="py-2 pr-4">Return</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {pendingRows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                    <td className="whitespace-nowrap py-3 pr-4 text-sm text-gray-500">{formatRequestId(row)}</td>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-gray-900 dark:text-gray-50">{row.destination}</p>
                      <p className="text-xs text-gray-500">{row.reason_for_travel?.slice(0, 40) || '—'}</p>
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-sm text-gray-700 dark:text-gray-300">
                      {formatDate(row.depart_date)}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-sm text-gray-700 dark:text-gray-300">
                      {formatDate(row.return_date)}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="whitespace-nowrap py-3 text-right">
                      <Link href="/staff/pending" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Ongoing Trip + Recent History */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Ongoing Trip</h2>
          <p className="mt-0.5 text-sm text-gray-500">Your current approved journey.</p>
          {ongoingTrip ? (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-950/30">
              <p className="font-medium text-green-900 dark:text-green-300">
                {ongoingTrip.origin} → {ongoingTrip.destination}
              </p>
              <p className="mt-1 text-sm text-green-800 dark:text-green-400">
                Returning {formatDate(ongoingTrip.return_date)}
              </p>
            </div>
          ) : (
            <div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/40">
                <PlaneIcon className="h-5 w-5 text-blue-500" />
              </div>
              <p className="mt-3 text-sm font-medium text-gray-900 dark:text-gray-50">No ongoing trip</p>
              <p className="mt-1 text-xs text-gray-500">
                You have no active trip at the moment. Approved trips will appear here.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Recent Travel History</h2>
              <p className="mt-0.5 text-sm text-gray-500">Your last 5 requests.</p>
            </div>
            <Link href="/staff/history" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
              View All →
            </Link>
          </div>
          {recentHistory.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">Your travel history will appear here.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {recentHistory.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <HistoryDot status={row.status} />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{row.destination}</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(row.depart_date)} — {formatDate(row.return_date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={row.status} />
                    <Link href="/staff/history" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                      View
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
