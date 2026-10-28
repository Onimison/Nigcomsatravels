import { z } from 'zod'

const amountSchema = z.string().regex(/^\d+\.\d{2}$/)
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i)

const travelerSchema = z
  .object({
    employee_identifier: z.string().min(1),
    name: z.string().min(1),
    designation: z.string().min(1),
    grade_band: z.string().min(1),
    dta_rate: amountSchema,
    dta_amount: amountSchema,
    local_running_rate: amountSchema,
    local_running_amount: amountSchema,
    transport_amount: amountSchema,
    airport_taxi_amount: amountSchema,
    total_amount: amountSchema,
  })
  .strict()

const memoLineSchema = z
  .object({
    line_number: z.number().int().positive(),
    description: z.string().min(1),
    quantity: amountSchema,
    unit_price: amountSchema,
    amount: amountSchema,
  })
  .strict()

const payloadSchema = z
  .object({
    schema_version: z.string().min(1),
    export_id: z.string().uuid(),
    delivery_mode: z.literal('business_central_api'),
    source_memo_number: z.string().min(1),
    costing_memo_revision: z.number().int().positive(),
    costing_memo_subject: z.string().min(1),
    costing_memo_body: z.string().min(1),
    costing_memo_body_format: z.literal('plain_text'),
    costing_memo_template_version: z.string().min(1),
    memo_type: z.literal('Expense Claim'),
    memo_priority: z.literal('Urgent'),
    memo_department: z.string().nullable(),
    memo_addressed_to: z.string().min(1),
    memo_due_date: z.string().date().nullable(),
    memo_approved_by: z.string().min(1).nullable(),
    coverage_percent: z.union([z.literal(75), z.literal(100)]),
    costing_memo_lines: z.array(memoLineSchema).min(1),
    hr_author_name: z.string().min(1),
    hr_author_title: z.string().min(1),
    hr_author_email: z.string().email(),
    hr_authorized_at: z.string().datetime({ offset: true }),
    hr_note: z.string().nullable(),
    trip_origin: z.string().min(1),
    trip_destination: z.string().min(1),
    departure_date: z.string().date(),
    return_date: z.string().date(),
    days: z.number().int().positive(),
    trip_type: z.union([z.literal('return'), z.literal('one_way')]),
    mode: z.union([z.literal('air'), z.literal('road')]),
    reason_for_travel: z.string().min(1),
    travelers: z.array(travelerSchema).min(1),
    total_amount: amountSchema,
    currency: z.literal('NGN'),
  })
  .strict()

const exportItemSchema = z.object({
  id: z.string().uuid(),
  request_id: z.string().uuid(),
  source_memo_number: z.string().min(1),
  revision: z.number().int().positive(),
  schema_version: z.string().min(1),
  payload: payloadSchema,
  payload_sha256: sha256Schema,
  delivery_mode: z.literal('business_central_api'),
  state: z.union([z.literal('pending'), z.literal('acknowledged'), z.literal('error'), z.literal('held')]),
  last_error_code: z.string().nullable().optional(),
  last_error_message: z.string().nullable().optional(),
  available_at: z.string().datetime({ offset: true }),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
})

const collectionSchema = z.object({
  schema_version: z.string().min(1),
  items: z.array(exportItemSchema),
  next_cursor: z.string().nullable(),
  has_more: z.boolean(),
})

const detailSchema = z.object({ item: exportItemSchema })

const acknowledgementSchema = z.object({
  export_id: z.string().uuid(),
  source_memo_number: z.string().min(1),
  erp_company_id: z.string().min(1),
  erp_costing_memo_number: z.string().min(1),
  erp_workflow_reference: z.string().min(1),
  received_payload_sha256: sha256Schema,
})

const acknowledgementResponseSchema = z.object({
  export_id: z.string().uuid(),
  status: z.literal('acknowledged'),
  erp_company_id: z.string().min(1),
  erp_costing_memo_number: z.string().min(1),
  erp_workflow_reference: z.string().min(1),
  acknowledged_at: z.string().datetime({ offset: true }),
})

function parseOptions(args) {
  let baseUrl = process.env.ERP_API_BASE_URL ?? 'http://localhost:3000'
  let apiKey = process.env.ERP_INTEGRATION_API_KEY
  let limit = 50
  let exportId = null
  let acknowledge = false
  let conflict = false
  let requireExport = false
  let help = false

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--base-url') {
      baseUrl = args[index + 1]
      index += 1
      continue
    }
    if (argument === '--api-key') {
      apiKey = args[index + 1]
      index += 1
      continue
    }
    if (argument === '--limit') {
      limit = Number(args[index + 1])
      index += 1
      continue
    }
    if (argument === '--export-id') {
      exportId = args[index + 1]
      index += 1
      continue
    }
    if (argument === '--ack') {
      acknowledge = true
      continue
    }
    if (argument === '--conflict') {
      conflict = true
      continue
    }
    if (argument === '--require-export') {
      requireExport = true
      continue
    }
    if (argument === '--help' || argument === '-h') {
      help = true
      continue
    }
    throw new Error(`Unknown argument: ${argument}`)
  }

  if (help) return { help }
  if (!apiKey) {
    throw new Error('Set ERP_INTEGRATION_API_KEY or pass --api-key.')
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('--limit must be an integer between 1 and 100.')
  }
  if (conflict && !acknowledge) {
    throw new Error('--conflict requires --ack.')
  }

  const parsedBaseUrl = new URL(baseUrl)
  if (parsedBaseUrl.protocol !== 'http:' && parsedBaseUrl.protocol !== 'https:') {
    throw new Error('--base-url must use http or https.')
  }

  return { baseUrl: parsedBaseUrl, apiKey, limit, exportId, acknowledge, conflict, requireExport, help }
}

function toCents(amount) {
  return BigInt(amount.replace('.', ''))
}

function assertPayloadTotals(payload) {
  const travelerTotal = payload.travelers.reduce((sum, traveler) => sum + toCents(traveler.total_amount), 0n)
  if (travelerTotal !== toCents(payload.total_amount)) {
    throw new Error(`Traveler totals do not reconcile for export ${payload.export_id}.`)
  }

  for (const traveler of payload.travelers) {
    const dta = toCents(traveler.dta_amount)
    const localRunning = toCents(traveler.local_running_amount)
    const transport = toCents(traveler.transport_amount)
    const taxi = toCents(traveler.airport_taxi_amount)
    if (dta + localRunning + transport + taxi !== toCents(traveler.total_amount)) {
      throw new Error(`Traveler total does not reconcile for export ${payload.export_id}.`)
    }
  }
}

function parseJson(text, url) {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`ERP endpoint returned non-JSON data: ${url}`)
  }
}

function apiErrorMessage(body, status) {
  const parsed = z.object({ error: z.object({ code: z.string(), message: z.string() }) }).safeParse(body)
  if (parsed.success) return `${status} ${parsed.data.error.code}: ${parsed.data.error.message}`
  return `ERP endpoint returned HTTP ${status}.`
}

async function requestJson(url, apiKey, init = {}) {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  headers.set('Authorization', `Bearer ${apiKey}`)
  const response = await fetch(url, {
    ...init,
    headers,
    signal: AbortSignal.timeout(15_000),
  })
  const body = parseJson(await response.text(), url)
  return { response, body }
}

async function checkAuthentication(baseUrl) {
  const response = await fetch(new URL('/api/erp/v1/health', baseUrl), {
    signal: AbortSignal.timeout(15_000),
  })
  if (response.status !== 401) {
    throw new Error(`Authentication check expected 401 but received ${response.status}.`)
  }
}

function validateExport(item) {
  const parsed = exportItemSchema.safeParse(item)
  if (!parsed.success) {
    throw new Error(`Export payload does not match the contract: ${parsed.error.issues[0].message}`)
  }
  const exportItem = parsed.data
  const payload = exportItem.payload
  if (payload.export_id !== exportItem.id) throw new Error(`Payload export_id does not match ${exportItem.id}.`)
  if (payload.source_memo_number !== exportItem.source_memo_number) {
    throw new Error(`Payload source memo does not match export ${exportItem.id}.`)
  }
  if (payload.costing_memo_revision !== exportItem.revision) {
    throw new Error(`Payload revision does not match export ${exportItem.id}.`)
  }
  assertPayloadTotals(payload)
  return exportItem
}

function buildAcknowledgement(item, companyId, memoSuffix = '') {
  const shortId = item.id.slice(0, 8)
  return {
    export_id: item.id,
    source_memo_number: item.source_memo_number,
    erp_company_id: companyId,
    erp_costing_memo_number: `MOCK-COST-${shortId}${memoSuffix}`,
    erp_workflow_reference: `MOCK-WF-${shortId}${memoSuffix}`,
    received_payload_sha256: item.payload_sha256,
  }
}

async function acknowledge(item, options, acknowledgement) {
  const validatedAcknowledgement = acknowledgementSchema.safeParse(acknowledgement)
  if (!validatedAcknowledgement.success) throw new Error(`Acknowledgement request is invalid for export ${item.id}.`)
  const url = new URL(`/api/erp/v1/exports/${item.id}/acknowledgements`, options.baseUrl)
  const { response, body } = await requestJson(url, options.apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validatedAcknowledgement.data),
  })
  if (response.status !== 200) throw new Error(apiErrorMessage(body, response.status))
  const parsed = acknowledgementResponseSchema.safeParse(body)
  if (!parsed.success) throw new Error(`Acknowledgement response is invalid for export ${item.id}.`)
  return parsed.data
}

async function run() {
  const options = parseOptions(process.argv.slice(2))
  if (options.help) {
    console.log('Usage: npm run erp:uat -- [--base-url URL] [--api-key KEY] [--limit N] [--export-id UUID] [--ack] [--conflict] [--require-export]')
    return
  }
  await checkAuthentication(options.baseUrl)

  let items
  if (options.exportId) {
    const detailUrl = new URL(`/api/erp/v1/exports/${options.exportId}`, options.baseUrl)
    const { response, body } = await requestJson(detailUrl, options.apiKey)
    if (response.status !== 200) throw new Error(apiErrorMessage(body, response.status))
    const detail = detailSchema.safeParse(body)
    if (!detail.success) throw new Error('Export detail response does not match the contract.')
    items = [validateExport(detail.data.item)]
  } else {
    const collectionUrl = new URL('/api/erp/v1/exports', options.baseUrl)
    collectionUrl.searchParams.set('state', 'pending')
    collectionUrl.searchParams.set('limit', String(options.limit))
    const { response, body } = await requestJson(collectionUrl, options.apiKey)
    if (response.status !== 200) throw new Error(apiErrorMessage(body, response.status))
    const collection = collectionSchema.safeParse(body)
    if (!collection.success) throw new Error('Export collection response does not match the contract.')
    items = collection.data.items.map(validateExport)
  }

  if (items.length === 0) {
    if (options.requireExport || options.acknowledge) {
      throw new Error('No export was available. Create one controlled sandbox request before running acknowledgement UAT.')
    }
    console.log('ERP UAT passed: authentication and an empty export queue are healthy.')
    return
  }

  console.log(`Validated ${items.length} export${items.length === 1 ? '' : 's'} and NGN totals.`)
  if (!options.acknowledge) return

  const companyId = process.env.ERP_UAT_COMPANY_ID ?? 'NIGCOMSAT-SANDBOX'
  for (const item of items) {
    const acknowledgement = buildAcknowledgement(item, companyId)
    await acknowledge(item, options, acknowledgement)
    await acknowledge(item, options, acknowledgement)
    console.log(`Acknowledgement replay passed for ${item.id}.`)

    if (options.conflict) {
      const conflictAcknowledgement = buildAcknowledgement(item, companyId, '-CONFLICT')
      const url = new URL(`/api/erp/v1/exports/${item.id}/acknowledgements`, options.baseUrl)
      const { response } = await requestJson(url, options.apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conflictAcknowledgement),
      })
      if (response.status !== 409) throw new Error(`Conflict check expected 409 but received ${response.status}.`)
      console.log(`Conflicting acknowledgement correctly rejected for ${item.id}.`)
    }
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : 'ERP UAT failed.'
  console.error(`ERP UAT failed: ${message}`)
  process.exitCode = 1
})
