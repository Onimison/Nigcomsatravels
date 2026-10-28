import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireErpApiKey } from '@/lib/erp/api-auth'
import { enforceErpApiRateLimit } from '@/lib/erp/api-rate-limit'
import { getErpRequestId } from '@/lib/erp/request-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const exportIdSchema = z.string().uuid()
const acknowledgementSchema = z.object({
  export_id: z.string().uuid(),
  source_memo_number: z.string().trim().min(1).max(50),
  erp_company_id: z.string().trim().min(1).max(200),
  erp_costing_memo_number: z.string().trim().min(1).max(100),
  erp_workflow_reference: z.string().trim().min(1).max(200),
  received_payload_sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/i, 'received_payload_sha256 must be a SHA-256 hex digest')
    .transform((value) => value.toLowerCase()),
})

function noStoreHeaders(requestId: string) {
  return { 'Cache-Control': 'no-store', 'X-Correlation-ID': requestId }
}

interface RouteContext {
  params: Promise<{ exportId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
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

  const bodyText = await request.text()
  if (bodyText.length > 32_768) {
    return Response.json(
      { error: { code: 'payload_too_large', message: 'The acknowledgement payload is too large' } },
      { status: 413, headers: noStoreHeaders(requestId) },
    )
  }

  let bodyResult: ReturnType<typeof acknowledgementSchema.safeParse>
  try {
    bodyResult = acknowledgementSchema.safeParse(JSON.parse(bodyText))
  } catch {
    return Response.json(
      { error: { code: 'invalid_json', message: 'The acknowledgement body must be valid JSON' } },
      { status: 400, headers: noStoreHeaders(requestId) },
    )
  }

  if (!bodyResult.success) {
    return Response.json(
      { error: { code: 'invalid_acknowledgement', message: 'The acknowledgement body is invalid' } },
      { status: 400, headers: noStoreHeaders(requestId) },
    )
  }

  if (bodyResult.data.export_id !== exportIdResult.data) {
    return Response.json(
      { error: { code: 'export_id_mismatch', message: 'The path and body export identifiers do not match' } },
      { status: 409, headers: noStoreHeaders(requestId) },
    )
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('acknowledge_erp_export', {
    p_export_id: exportIdResult.data,
    p_source_memo_number: bodyResult.data.source_memo_number,
    p_erp_company_id: bodyResult.data.erp_company_id,
    p_erp_costing_memo_number: bodyResult.data.erp_costing_memo_number,
    p_erp_workflow_reference: bodyResult.data.erp_workflow_reference,
    p_received_payload_sha256: bodyResult.data.received_payload_sha256,
  })

  if (error) {
    if (error.code === 'P0002') {
      return Response.json(
        { error: { code: 'export_not_found', message: 'The ERP export was not found' } },
        { status: 404, headers: noStoreHeaders(requestId) },
      )
    }
    if (error.code === 'P0009') {
      return Response.json(
        { error: { code: 'acknowledgement_conflict', message: 'The acknowledgement conflicts with the stored export state' } },
        { status: 409, headers: noStoreHeaders(requestId) },
      )
    }
    return Response.json(
      { error: { code: 'temporarily_unavailable', message: 'The ERP acknowledgement could not be recorded' } },
      { status: 503, headers: noStoreHeaders(requestId) },
    )
  }

  if (!data) {
    return Response.json(
      { error: { code: 'temporarily_unavailable', message: 'The ERP acknowledgement could not be recorded' } },
      { status: 503, headers: noStoreHeaders(requestId) },
    )
  }

  return Response.json(data, { headers: noStoreHeaders(requestId) })
}
