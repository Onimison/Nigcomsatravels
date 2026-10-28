import 'server-only'

import { randomUUID } from 'node:crypto'
import { z } from 'zod'

const requestIdSchema = z.string().uuid()

export function getErpRequestId(request: Request): string {
  const supplied = request.headers.get('x-correlation-id') ?? request.headers.get('x-request-id')
  if (supplied) {
    const parsed = requestIdSchema.safeParse(supplied)
    if (parsed.success) return parsed.data
  }
  return randomUUID()
}

export function withErpRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers)
  headers.set('X-Correlation-ID', requestId)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
