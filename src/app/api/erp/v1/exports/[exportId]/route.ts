import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireErpApiKey } from '@/lib/erp/api-auth'
import { enforceErpApiRateLimit } from '@/lib/erp/api-rate-limit'
import { getErpRequestId } from '@/lib/erp/request-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const exportIdSchema = z.string().uuid()

function noStoreHeaders(requestId: string) {
  return { 'Cache-Control': 'no-store', 'X-Correlation-ID': requestId }
}

interface RouteContext {
  params: Promise<{ exportId: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const requestId = getErpRequestId(request)
  const authError = requireErpApiKey(request, requestId)
  if (authError) return authError
  const rateLimitError = await enforceErpApiRateLimit(request, requestId)
  if (rateLimitError) return rateLimitError

  const { exportId: rawExportId } = await context.params
  const exportIdResult = exportIdSchema.safeParse(rawExportId)
  if (!exportIdResult.success) {
    return Response.json(
      { error: { code: 'invalid_export_id', message: 'The export identifier is invalid' } },
      { status: 400, headers: noStoreHeaders(requestId) },
    )
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('erp_exports')
    .select('id, request_id, source_memo_number, revision, schema_version, payload, payload_sha256, delivery_mode, state, available_at, acknowledged_at, created_at, updated_at')
    .eq('id', exportIdResult.data)
    .eq('delivery_mode', 'business_central_api')
    .maybeSingle()

  if (error) {
    return Response.json(
      { error: { code: 'temporarily_unavailable', message: 'ERP exports are temporarily unavailable' } },
      { status: 503, headers: noStoreHeaders(requestId) },
    )
  }

  if (!data) {
    return Response.json(
      { error: { code: 'export_not_found', message: 'The ERP export was not found' } },
      { status: 404, headers: noStoreHeaders(requestId) },
    )
  }

  return Response.json({ item: data }, { headers: noStoreHeaders(requestId) })
}
