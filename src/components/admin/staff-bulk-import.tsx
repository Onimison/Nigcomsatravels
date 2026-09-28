'use client'

/**
 * Staff Bulk Import — CSV upload path alongside AddStaffForm in
 * staff-management.tsx. Parses and validates the CSV entirely in the
 * browser (never uploads the raw file) so an Admin sees exactly what will
 * happen — row by row — before anything is written, then sends only the
 * already-valid rows to bulkAddStaff().
 */

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { parseCsv } from '@/lib/utils/csv'
import { staffCsvRowSchema, MAX_BULK_IMPORT_ROWS, type StaffCsvRow } from '@/lib/validations/staff.schema'
import { bulkAddStaff, type BulkAddResult } from '@/lib/actions/staff.actions'
import { Button } from '@/components/ui/button'
import type { Department, Level } from '@/types/database'

const TEMPLATE_HEADERS = ['first_name', 'surname', 'email', 'role', 'department', 'level']
const TEMPLATE_EXAMPLE = ['Ada', 'Okafor', 'ada.okafor@nigcomsat.gov.ng', 'staff', 'Engineering', 'Manager']
const REQUIRED_HEADERS = TEMPLATE_HEADERS

interface PreviewRow {
  email: string
  parsed?: StaffCsvRow
  errors: string[]
}

function downloadTemplate() {
  const csv = [TEMPLATE_HEADERS, TEMPLATE_EXAMPLE].map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'staff-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function buildPreview(rows: string[][], departments: Department[], levels: Level[]): { header: string[]; preview: PreviewRow[] } {
  if (rows.length === 0) return { header: [], preview: [] }

  const [headerRow, ...dataRows] = rows
  const header = headerRow.map((h) => h.trim().toLowerCase())

  const emailCounts = new Map<string, number>()
  for (const cells of dataRows) {
    const email = (cells[header.indexOf('email')] ?? '').trim().toLowerCase()
    if (email) emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1)
  }

  const preview = dataRows.map((cells) => {
    const raw: Record<string, string> = {}
    header.forEach((key, i) => {
      raw[key] = (cells[i] ?? '').trim()
    })

    const candidate = {
      first_name: raw.first_name ?? '',
      surname: raw.surname ?? '',
      email: raw.email ?? '',
      role: (raw.role ?? '').toLowerCase(),
      department: raw.department ?? '',
      level: raw.level ?? '',
    }

    const errors: string[] = []
    const parsed = staffCsvRowSchema.safeParse(candidate)

    if (!parsed.success) {
      for (const issue of parsed.error.issues) errors.push(issue.message)
    } else {
      const deptOk = departments.some((d) => d.name.toLowerCase() === parsed.data.department.trim().toLowerCase())
      const levelOk = levels.some((l) => l.name.toLowerCase() === parsed.data.level.trim().toLowerCase())
      if (!deptOk) errors.push(`Unknown department "${parsed.data.department}"`)
      if (!levelOk) errors.push(`Unknown level "${parsed.data.level}"`)

      const email = parsed.data.email.trim().toLowerCase()
      if ((emailCounts.get(email) ?? 0) > 1) errors.push('Duplicate email elsewhere in this file')
    }

    return { email: candidate.email || '(blank)', parsed: parsed.success ? parsed.data : undefined, errors }
  })

  return { header, preview }
}

export function StaffBulkImport({ departments, levels }: { departments: Department[]; levels: Level[] }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [headerWarning, setHeaderWarning] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<BulkAddResult | null>(null)

  async function handleFile(file: File) {
    setResult(null)
    setFileName(file.name)

    const text = await file.text()
    const rows = parseCsv(text)

    if (rows.length === 0) {
      setPreview([])
      setHeaderWarning('This file is empty.')
      return
    }

    const missingHeaders = REQUIRED_HEADERS.filter((h) => !rows[0].map((c) => c.trim().toLowerCase()).includes(h))
    setHeaderWarning(
      missingHeaders.length > 0
        ? `This file's header row is missing: ${missingHeaders.join(', ')}. Download the template below and match its column names.`
        : null
    )

    const { preview: rowsPreview } = buildPreview(rows, departments, levels)
    setPreview(rowsPreview.slice(0, MAX_BULK_IMPORT_ROWS))
  }

  function reset() {
    setFileName(null)
    setPreview(null)
    setHeaderWarning(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleImport() {
    if (!preview) return
    const validRows = preview.filter((r) => r.errors.length === 0 && r.parsed).map((r) => r.parsed as StaffCsvRow)
    if (validRows.length === 0) return

    setIsImporting(true)
    const res = await bulkAddStaff(validRows)
    setIsImporting(false)
    setResult(res)

    if (res.success) router.refresh()
  }

  const validCount = preview?.filter((r) => r.errors.length === 0).length ?? 0
  const errorCount = (preview?.length ?? 0) - validCount

  return (
    <div className="mt-4 space-y-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          Upload a CSV of staff to add in one go. Each row needs a first name, surname, email, role, department, and
          level — department and level must match names already set up in Levels/Departments.
        </p>
        <Button type="button" variant="secondary" onClick={downloadTemplate}>
          Download CSV template
        </Button>
      </div>

      {!result && (
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
            className="text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700"
          />
          {fileName && (
            <Button type="button" variant="secondary" onClick={reset}>
              Clear
            </Button>
          )}
        </div>
      )}

      {headerWarning && (
        <p className="text-sm text-amber-600" role="alert">
          {headerWarning}
        </p>
      )}

      {preview && preview.length > 0 && !result && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-900">
            {validCount} ready to import
            {errorCount > 0 && <span className="text-amber-600"> · {errorCount} need fixing</span>}
          </p>

          <div className="max-h-80 overflow-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-400">
                  <th className="py-2 pl-3 pr-4">Email</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Department</th>
                  <th className="py-2 pr-4">Level</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={`${row.email}-${i}`} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pl-3 pr-4 text-gray-900">{row.email}</td>
                    <td className="py-2 pr-4 text-gray-700">{row.parsed?.role ?? '—'}</td>
                    <td className="py-2 pr-4 text-gray-700">{row.parsed?.department ?? '—'}</td>
                    <td className="py-2 pr-4 text-gray-700">{row.parsed?.level ?? '—'}</td>
                    <td className="py-2 pr-3">
                      {row.errors.length === 0 ? (
                        <span className="text-green-700">Ready</span>
                      ) : (
                        <span className="text-red-600">{row.errors.join('; ')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Button type="button" onClick={handleImport} disabled={isImporting || validCount === 0}>
              {isImporting ? 'Importing…' : `Import ${validCount} staff`}
            </Button>
            <Button type="button" variant="secondary" onClick={reset} disabled={isImporting}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {result.success ? (
            <p className="text-sm text-gray-900">
              <span className="font-medium text-green-700">{result.created} added</span>
              {result.repaired > 0 && <span>, {result.repaired} updated (already existed)</span>}
              {result.failed > 0 && <span className="text-red-600">, {result.failed} failed</span>}
            </p>
          ) : (
            <p className="text-sm text-red-600" role="alert">
              {result.error ?? 'Import failed.'}
            </p>
          )}

          {result.results.some((r) => r.status === 'failed') && (
            <div className="max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Failed rows</p>
              <ul className="space-y-1 text-sm">
                {result.results
                  .filter((r) => r.status === 'failed')
                  .map((r, i) => (
                    <li key={`${r.email}-${i}`} className="text-red-600">
                      {r.email}: {r.error}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <Button type="button" variant="secondary" onClick={reset}>
            Done
          </Button>
        </div>
      )}
    </div>
  )
}
