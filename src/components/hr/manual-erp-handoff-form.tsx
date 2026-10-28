'use client'

import { useState } from 'react'
import { recordManualErpHandoff } from '@/lib/actions/costing.actions'
import { Button } from '@/components/ui/button'
import type { ManualHandoff } from '@/lib/actions/costing.actions'

export function ManualErpHandoffForm({ exportId, initialHandoff }: { exportId: string; initialHandoff: ManualHandoff | null }) {
  const [handoff, setHandoff] = useState<ManualHandoff | null>(initialHandoff)
  const [company, setCompany] = useState(initialHandoff?.erp_company_id ?? '')
  const [memoNumber, setMemoNumber] = useState(initialHandoff?.erp_costing_memo_number ?? '')
  const [workflowReference, setWorkflowReference] = useState(initialHandoff?.erp_workflow_reference ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)
    const result = await recordManualErpHandoff({
      export_id: exportId,
      erp_company_id: company,
      erp_costing_memo_number: memoNumber,
      erp_workflow_reference: workflowReference,
    })
    setPending(false)

    if (!result.success || !result.data) {
      setError(result.error ?? 'The ERP handoff could not be recorded')
      return
    }
    setHandoff(result.data)
  }

  if (handoff) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
        <p className="font-semibold">Business Central entry recorded manually</p>
        <p className="mt-1">Company: {handoff.erp_company_id}</p>
        <p className="mt-1">Costing memo: {handoff.erp_costing_memo_number}</p>
        <p className="mt-1">Workflow reference: {handoff.erp_workflow_reference}</p>
        <p className="mt-1 text-xs text-green-800">This confirms manual entry was reported. It does not record MD/CEO approval.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Record manual Business Central entry</h2>
        <p className="mt-1 text-xs text-gray-600">Enter the references created after you copy or attach this costing in Business Central.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-gray-700">
          Company
          <input className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={company} onChange={(event) => setCompany(event.target.value)} required />
        </label>
        <label className="text-sm text-gray-700">
          ERP costing memo number
          <input className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={memoNumber} onChange={(event) => setMemoNumber(event.target.value)} required />
        </label>
        <label className="text-sm text-gray-700">
          Workflow reference
          <input className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={workflowReference} onChange={(event) => setWorkflowReference(event.target.value)} required />
        </label>
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <Button type="submit" variant="outline" disabled={pending}>{pending ? 'Recording…' : 'Record ERP entry'}</Button>
    </form>
  )
}
