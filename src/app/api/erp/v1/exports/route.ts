import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireErpApiKey } from '@/lib/erp/api-auth'
import { enforceErpApiRateLimit } from '@/lib/erp/api-rate-limit'
import { getErpRequestId } from '@/lib/erp/request-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_PAGE_SIZE = 100

const cursorSchema = z.object({
  availableAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
})

function noStoreHeaders(requestId: string) {
  return { 'Cache-Control': 'no-store', 'X-Correlation-ID': requestId }
}

function decodeCursor(value: string | null): { availableAt: string; id: string } | null {
  if (!value) return null
  try {
    const parsed = cursorSchema.safeParse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function encodeCursor(availableAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ availableAt, id })).toString('base64url')
}

/**
 * Business Central collection endpoint.
 * GET is intentionally read-only: an ERP retry must see the same immutable
 * export until a durable acknowledgement is recorded.
 */
export async function GET(request: NextRequest) {
  const requestId = getErpRequestId(request)
  const authError = requireErpApiKey(request, requestId)
  if (authError) return authError
  const rateLimitError = await enforceErpApiRateLimit(request, requestId)
  if (rateLimitError) return rateLimitError

  const params = request.nextUrl.searchParams
  const requestedLimit = Number(params.get('limit') ?? '50')
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > MAX_PAGE_SIZE) {
    return Response.json(
      { error: { code: 'invalid_limit', message: `limit must be an integer between 1 and ${MAX_PAGE_SIZE}` } },
      { status: 400, headers: noStoreHeaders(requestId) }
    )
  }

  const state = params.get('state') ?? 'pending'
  if (state !== 'pending') {
    return Response.json(
      { error: { code: 'invalid_state', message: 'Only pending exports can be collected' } },
      { status: 400, headers: noStoreHeaders(requestId) }
    )
  }

  const cursor = decodeCursor(params.get('cursor'))
  if (params.has('cursor') && !cursor) {
    return Response.json(
      { error: { code: 'invalid_cursor', message: 'The cursor is invalid or expired' } },
      { status: 400, headers: noStoreHeaders(requestId) }
    )
  }

  const supabase = createAdminClient()
  let query = supabase
    .from('erp_exports')
    .select('id, request_id, source_memo_number, revision, schema_version, payload, payload_sha256, delivery_mode, state, last_error_code, last_error_message, available_at, created_at, updated_at')
    .eq('delivery_mode', 'business_central_api')
    .in('state', ['pending', 'error'])
    .order('available_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(requestedLimit + 1)

  // The cursor is page navigation only. The next collection sweep starts
  // from the queue head, so a late committed export cannot be permanently
  // skipped by a previous cursor.
  if (cursor) {
    query = query.or(`available_at.gt.${cursor.availableAt},and(available_at.eq.${cursor.availableAt},id.gt.${cursor.id})`)
  }

  const { data, error } = await query
  if (error) {
    return Response.json(
      { error: { code: 'temporarily_unavailable', message: 'ERP exports are temporarily unavailable' } },
      { status: 503, headers: noStoreHeaders(requestId) }
    )
  }

  if (!data) {
    return Response.json(
      { error: { code: 'temporarily_unavailable', message: 'ERP exports are temporarily unavailable' } },
      { status: 503, headers: noStoreHeaders(requestId) }
    )
  }

  const rows = data
  const hasMore = rows.length > requestedLimit
  const items = hasMore ? rows.slice(0, requestedLimit) : rows
  const last = items[items.length - 1]

  return Response.json(
    {
      schema_version: '1.0',
      items,
      next_cursor: hasMore && last ? encodeCursor(last.available_at, last.id) : null,
      has_more: hasMore,
    },
    { headers: noStoreHeaders(requestId) }
  )
}
