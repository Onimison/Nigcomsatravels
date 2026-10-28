import 'server-only'

import { timingSafeEqual } from 'node:crypto'
import { withErpRequestId } from '@/lib/erp/request-context'

/**
 * Initial machine-auth boundary for the collection API.
 *
 * The secret is server-only and must be provisioned separately for each
 * environment. A database-backed credential and rotation workflow is a
 * production hardening step; keeping this helper isolated prevents API
 * handlers from spreading credential logic.
 */
export function requireErpApiKey(request: Request, requestId: string): Response | null {
  const configuredKeys = [process.env.ERP_INTEGRATION_API_KEY, process.env.ERP_INTEGRATION_API_KEY_PREVIOUS].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  )
  const authorization = request.headers.get('authorization')
  let supplied: string | null = null
  if (authorization) {
    const bearer = authorization.match(/^Bearer\s+(.+)$/i)
    if (bearer && bearer[1]) supplied = bearer[1]
  }

  if (configuredKeys.length === 0 || !supplied) {
    return withErpRequestId(
      Response.json(
        { error: { code: 'unauthorized', message: 'ERP authentication required' } },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      ),
      requestId,
    )
  }

  const actual = Buffer.from(supplied)
  const valid = configuredKeys.some((configured) => {
    const expected = Buffer.from(configured)
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  })

  if (!valid) {
    return withErpRequestId(
      Response.json(
        { error: { code: 'unauthorized', message: 'Invalid ERP credentials' } },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      ),
      requestId,
    )
  }

  return null
}
