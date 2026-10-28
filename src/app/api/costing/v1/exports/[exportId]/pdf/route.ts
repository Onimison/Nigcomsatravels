import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getHrCostingMemo } from '@/lib/actions/costing.actions'
import { buildCostingMemoPdf } from '@/lib/erp/costing-memo-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ exportId: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { exportId } = await context.params
  const parsedId = z.string().uuid().safeParse(exportId)
  if (!parsedId.success) return new Response('Invalid costing identifier', { status: 400 })

  const result = await getHrCostingMemo(parsedId.data)
  if (!result.success || !result.data) {
    const status = result.error === 'Not authenticated' ? 401 : result.error === 'Insufficient permissions' ? 403 : 404
    return new Response(result.error ?? 'Finalized costing not found', { status })
  }

  const pdf = await buildCostingMemoPdf(result.data)
  const responseBody = new Uint8Array(pdf.byteLength)
  responseBody.set(pdf)
  return new Response(responseBody.buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="nigcomsat-costing-${result.data.export_id}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
