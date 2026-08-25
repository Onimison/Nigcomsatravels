'use client'

/**
 * The full Review Queue — every request awaiting HR verification, as a
 * filterable/sortable list of compact rows. Each row links to its own
 * `/hr/requests/[id]` page for the actual review/allowance-entry form; this
 * component never renders that form itself (see `review-card.tsx`), so
 * opening one request doesn't cost N requests' worth of client state.
 */

import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { RequestRow, departmentName } from '@/components/hr/request-row'
import type { TravelRequestForHR } from '@/types/database'

type SortKey = 'earliest' | 'department' | 'destination'

export function HRRequestQueue({ pending }: { pending: TravelRequestForHR[] }) {
  const [department, setDepartment] = useState('all')
  const [destination, setDestination] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('earliest')

  const departments = useMemo(() => [...new Set(pending.map(departmentName))].sort(), [pending])

  const visible = useMemo(() => {
    const filtered = pending.filter((row) => {
      if (department !== 'all' && departmentName(row) !== department) return false
      if (destination.trim() && !row.destination.toLowerCase().includes(destination.trim().toLowerCase())) {
        return false
      }
      return true
    })

    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'department':
          return departmentName(a).localeCompare(departmentName(b))
        case 'destination':
          return a.destination.localeCompare(b.destination)
        case 'earliest':
        default:
          return a.depart_date.localeCompare(b.depart_date)
      }
    })
  }, [pending, department, destination, sortKey])

  const filterRow = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-44">
        <Select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          aria-label="Filter by department"
        >
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </Select>
      </div>
      <div className="w-48">
        <Input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="Filter by destination"
          aria-label="Filter by destination"
        />
      </div>
      <div className="w-56">
        <Select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          aria-label="Sort requests"
        >
          <option value="earliest">Sort: Earliest Departure</option>
          <option value="department">Sort: Department</option>
          <option value="destination">Sort: Destination</option>
        </Select>
      </div>
    </div>
  )

  return (
    <Card title={`Awaiting Review (${visible.length})`} action={filterRow}>
      {visible.length === 0 ? (
        <p className="text-sm text-gray-500">
          {pending.length === 0 ? 'No requests pending HR review.' : 'No requests match the current filters.'}
        </p>
      ) : (
        <div className="divide-y divide-gray-100">
          {visible.map((row) => (
            <RequestRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </Card>
  )
}
