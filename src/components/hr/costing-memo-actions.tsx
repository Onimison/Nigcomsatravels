'use client'

import { useState } from 'react'
import { Button, LinkButton } from '@/components/ui/button'
import type { ErpExportPayload } from '@/types/database'

function lineItemsText(payload: ErpExportPayload): string {
  return [
    'Line No. | Description | Quantity | Unit Price | Amount',
    ...payload.costing_memo_lines.map(
      (line) => `${line.line_number} | ${line.description} | ${line.quantity} | ${line.unit_price} | ${line.amount}`,
    ),
  ].join('\n')
}

export function CostingMemoActions({ payload }: { payload: ErpExportPayload }) {
  const [copied, setCopied] = useState<'body' | 'lines' | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)

  async function copy(value: string, type: 'body' | 'lines') {
    setCopyError(null)
    try {
      await navigator.clipboard.writeText(value)
      setCopied(type)
      window.setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopyError('Clipboard access failed. Select the text below and copy it manually.')
    }
  }

  return (
    <div className="no-print space-y-3">
      <div className="flex flex-wrap gap-2">
        <LinkButton href={`/api/costing/v1/exports/${payload.export_id}/pdf`} variant="primary">
          Download PDF
        </LinkButton>
        <LinkButton href={`/api/costing/v1/exports/${payload.export_id}/json`} variant="outline">
          Download JSON
        </LinkButton>
        <Button type="button" variant="outline" onClick={() => copy(payload.costing_memo_body, 'body')}>
          {copied === 'body' ? 'Memo body copied' : 'Copy memo body'}
        </Button>
        <Button type="button" variant="outline" onClick={() => copy(lineItemsText(payload), 'lines')}>
          {copied === 'lines' ? 'Line items copied' : 'Copy line items'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => window.print()}>
          Print
        </Button>
      </div>
      {copyError && <p className="text-sm text-amber-700" role="alert">{copyError}</p>}
    </div>
  )
}
