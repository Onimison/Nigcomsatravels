import 'server-only'

import { createHash } from 'node:crypto'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { withErpRequestId } from '@/lib/erp/request-context'

const rateLimitResultSchema = z.object({
  allowed: z.boolean(),
  remaining: z.number().int().nonnegative(),
  retry_after_seconds: z.number().int().nonnegative(),
})

function noStoreHeaders() {
  return { 'Cache-Control': 'no-store' }
}

function getConfiguredLimit(): number | null {
  const configured = process.env.ERP_API_RATE_LIMIT_PER_MINUTE ?? '120'
  const parsed = z.coerce.number().int().min(1).max(100_000).safeParse(configured)
  return parsed.success ? parsed.data : null
}

function getSuppliedCredential(request: Request): string | null {
  const authorization = request.headers.get('authorization')
  if (!authorization) return null
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)
  if (!bearer || !bearer[1]) return null
  return bearer[1]
}

/**
 * The limiter is feature-flagged until the shared bucket migration is applied
 * in each environment. The bucket key is a hash so the credential never lands
 * in the database or logs.
 */
export async function enforceErpApiRateLimit(request: Request, requestId: string): Promise<Response | null> {
  if (process.env.ERP_API_RATE_LIMIT_ENABLED !== 'true') return null

  const limit = getConfiguredLimit()
  if (limit === null) {
    return withErpRequestId(
      Response.json(
        { error: { code: 'rate_limit_unavailable', message: 'ERP rate-limit configuration is invalid' } },
        { status: 503, headers: noStoreHeaders() },
      ),
      requestId,
    )
  }

  const credential = getSuppliedCredential(request)
  if (credential === null) {
    return withErpRequestId(
      Response.json(
        { error: { code: 'rate_limit_unavailable', message: 'ERP rate-limit subject is unavailable' } },
        { status: 503, headers: noStoreHeaders() },
      ),
      requestId,
    )
  }

  const subjectHash = createHash('sha256').update(credential).digest('hex')
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('consume_erp_api_rate_limit', {
    p_subject_hash: subjectHash,
    p_limit: limit,
    p_window_seconds: 60,
  })

  if (error) {
    return withErpRequestId(
      Response.json(
        { error: { code: 'rate_limit_unavailable', message: 'ERP rate limiting is temporarily unavailable' } },
        { status: 503, headers: noStoreHeaders() },
      ),
      requestId,
    )
  }

  const parsed = rateLimitResultSchema.safeParse(data)
  if (!parsed.success) {
    return withErpRequestId(
      Response.json(
        { error: { code: 'rate_limit_unavailable', message: 'ERP rate limiting returned an invalid result' } },
        { status: 503, headers: noStoreHeaders() },
      ),
      requestId,
    )
  }

  if (parsed.data.allowed) return null

  return withErpRequestId(
    Response.json(
      { error: { code: 'rate_limited', message: 'Too many ERP requests; retry later' } },
      {
        status: 429,
        headers: {
          ...noStoreHeaders(),
          'Retry-After': String(parsed.data.retry_after_seconds),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
        },
      },
    ),
    requestId,
  )
}
