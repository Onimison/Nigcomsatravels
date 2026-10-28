import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getHrCostingMemo } from '@/lib/actions/costing.actions'

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

  return Response.json(result.data, {
    headers: {
      'Content-Disposition': `attachment; filename="nigcomsat-costing-${result.data.export_id}.json"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
