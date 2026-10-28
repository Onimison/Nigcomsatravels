import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getHrCostingMemo } from '@/lib/actions/costing.actions'
import { getManualErpHandoff } from '@/lib/actions/costing.actions'
import { CostingMemoActions } from '@/components/hr/costing-memo-actions'
import { ManualErpHandoffForm } from '@/components/hr/manual-erp-handoff-form'
import { PageHeader } from '@/components/ui/page-header'

export const metadata: Metadata = {
  title: 'Finalized Costing — NIGCOMSAT Travel',
  description: 'Review and export an immutable HR travel costing',
}

interface CostingPageProps {
  params: Promise<{ exportId: string }>
}

export default async function FinalizedCostingPage({ params }: CostingPageProps) {
  const { exportId } = await params
  const [result, handoffResult] = await Promise.all([
    getHrCostingMemo(exportId),
    getManualErpHandoff(exportId),
  ])

  if (!result.success) {
    if (result.error === 'Not authenticated') redirect('/login')
    if (result.error === 'Insufficient permissions') redirect('/')
    notFound()
  }
  if (!result.data) notFound()

  const payload = result.data

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finalized Costing"
        subtitle="This document is generated from the immutable HR-approved snapshot."
      />

      <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold">HR verified costing — final approval handled in Business Central</p>
        <p className="mt-1">Source HOD memo: {payload.source_memo_number}</p>
        <p className="mt-1">Costing ID: {payload.export_id} · Revision {payload.costing_memo_revision}</p>
      </section>

      <CostingMemoActions payload={payload} />

      <ManualErpHandoffForm exportId={payload.export_id} initialHandoff={handoffResult.data} />

      <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-gray-800">{payload.costing_memo_body}</pre>
      </article>

      <section className="rounded-xl border border-gray-200 bg-white p-6 print:break-before-page">
        <h2 className="text-lg font-semibold text-gray-900">Structured line items</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-2 py-2">Line</th>
                <th className="px-2 py-2">Description</th>
                <th className="px-2 py-2">Quantity</th>
                <th className="px-2 py-2">Unit price</th>
                <th className="px-2 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payload.costing_memo_lines.map((line) => (
                <tr key={line.line_number} className="border-b border-gray-100">
                  <td className="px-2 py-2 text-gray-600">{line.line_number}</td>
                  <td className="px-2 py-2 text-gray-800">{line.description}</td>
                  <td className="px-2 py-2 text-gray-600">{line.quantity}</td>
                  <td className="px-2 py-2 text-gray-600">NGN {line.unit_price}</td>
                  <td className="px-2 py-2 text-right font-medium text-gray-900">NGN {line.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-right text-sm font-semibold text-gray-900">Total: NGN {payload.total_amount}</p>
      </section>
    </div>
  )
}
