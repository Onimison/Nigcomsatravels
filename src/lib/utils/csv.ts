/**
 * Minimal CSV parser for the staff bulk-import roster (RFC4180-ish):
 * handles quoted fields, embedded commas/newlines inside quotes, escaped
 * `""`, and both CRLF and LF line endings. No dependency — the input is a
 * small, human-edited roster, not arbitrary CSV.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i]

    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  // Last field/row (files don't always end with a trailing newline)
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // Drop fully blank trailing lines
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0))
}
