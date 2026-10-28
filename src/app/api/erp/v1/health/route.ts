import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireErpApiKey } from '@/lib/erp/api-auth'
import { enforceErpApiRateLimit } from '@/lib/erp/api-rate-limit'
import { getErpRequestId } from '@/lib/erp/request-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function noStoreHeaders(requestId: string) {
  return { 'Cache-Control': 'no-store', 'X-Correlation-ID': requestId }
}

export async function GET(request: NextRequest) {
  const requestId = getErpRequestId(request)
  const authError = requireErpApiKey(request, requestId)
  if (authError) return authError
  const rateLimitError = await enforceErpApiRateLimit(request, requestId)
  if (rateLimitError) return rateLimitError

  const supabase = createAdminClient()
  const { error } = await supabase.from('erp_exports').select('id', { head: true, count: 'exact' }).limit(1)
  if (error) {
    return Response.json(
      { status: 'unavailable', service: 'erp-export-api' },
      { status: 503, headers: noStoreHeaders(requestId) },
    )
  }

  return Response.json(
    {
      status: 'ok',
      service: 'erp-export-api',
      schema_version: '1.0',
      checked_at: new Date().toISOString(),
    },
    { headers: noStoreHeaders(requestId) },
  )
}
