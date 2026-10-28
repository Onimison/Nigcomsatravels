import type { ErpExportPayload, ErpMemoLine, TravelMode, TripType } from '@/types/database'
import { z } from 'zod'

/** The renderer version is separate from the Business Central API version. */
export const COSTING_MEMO_TEMPLATE_VERSION = 'NIGCOMSAT-HR-TRAVEL-v2'
export const ERP_MEMO_TYPE = 'Expense Claim' as const
export const ERP_MEMO_PRIORITY = 'Urgent' as const
export const ERP_MEMO_ADDRESSED_TO = 'Managing Director / Chief Executive Officer'

const memoLineSchema = z.object({
  line_number: z.number().int().positive(),
  description: z.string().min(1),
  quantity: z.string().min(1),
  unit_price: z.string().min(1),
  amount: z.string().min(1),
})

const travelerSchema = z.object({
  employee_identifier: z.string().min(1).nullable(),
  name: z.string().min(1),
  designation: z.string().min(1),
  grade_band: z.enum(['B1', 'B2', 'B3', 'B4']),
  dta_rate: z.string().min(1),
  dta_amount: z.string().min(1),
  local_running_rate: z.string().min(1),
  local_running_amount: z.string().min(1),
  transport_amount: z.string().min(1),
  airport_taxi_amount: z.string().min(1),
  total_amount: z.string().min(1),
})

const costingMemoPayloadSchema = z.object({
  schema_version: z.string().min(1),
  export_id: z.string().uuid(),
  delivery_mode: z.enum(['manual', 'business_central_api']).default('business_central_api'),
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
  memo_due_date: z.string().nullable(),
  memo_approved_by: z.string().nullable(),
  coverage_percent: z.union([z.literal(75), z.literal(100)]),
  costing_memo_lines: z.array(memoLineSchema).min(1),
  hr_author_name: z.string().min(1),
  hr_author_title: z.string().min(1),
  hr_author_email: z.string().email(),
  hr_authorized_at: z.string().datetime({ offset: true }),
  hr_note: z.string().nullable(),
  trip_origin: z.string().min(1),
  trip_destination: z.string().min(1),
  departure_date: z.string().min(1),
  return_date: z.string().min(1),
  days: z.number().int().positive(),
  trip_type: z.enum(['return', 'one_way']),
  mode: z.enum(['air', 'road']),
  reason_for_travel: z.string().min(1),
  travelers: z.array(travelerSchema).min(1),
  total_amount: z.string().min(1),
  currency: z.literal('NGN'),
})

export function parseCostingMemoPayload(value: unknown): ErpExportPayload | null {
  const parsed = costingMemoPayloadSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export interface CostingMemoBodyInput {
  sourceMemoNumber: string
  authorName: string
  authorTitle: string
  tripOrigin: string
  tripDestination: string
  departureDate: string
  returnDate: string
  authorizedAt: string
  days: number
  tripType: TripType
  mode: TravelMode
  reasonForTravel: string
  coveragePercent: 75 | 100
  department: string | null
  addressedTo: string
  dueDate: string | null
  approvedBy: string | null
  lines: ErpMemoLine[]
  totalAmount: string
  hrNote: string | null
}

function underThousandToWords(value: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const words: string[] = []
  let remainder = value

  if (remainder >= 100) {
    words.push(`${ones[Math.floor(remainder / 100)]} Hundred`)
    remainder %= 100
  }
  if (remainder >= 20) {
    words.push(tens[Math.floor(remainder / 10)])
    remainder %= 10
  }
  if (remainder >= 10) {
    words.push(teens[remainder - 10])
    remainder = 0
  }
  if (remainder > 0) words.push(ones[remainder])
  return words.join(' ')
}

function nairaAmountInWords(amount: string): string {
  const [nairaPart, koboPart] = amount.split('.')
  const scales = ['', 'Thousand', 'Million', 'Billion', 'Trillion']
  let remainder = BigInt(nairaPart)
  let scaleIndex = 0
  const groups: string[] = []

  while (remainder > BigInt(0)) {
    const group = Number(remainder % BigInt(1000))
    if (group > 0) {
      const groupWords = underThousandToWords(group)
      groups.unshift(`${groupWords}${scales[scaleIndex] ? ` ${scales[scaleIndex]}` : ''}`)
    }
    remainder /= BigInt(1000)
    scaleIndex += 1
  }

  const nairaWords = groups.length > 0 ? groups.join(' ') : 'Zero'
  const kobo = Number(koboPart)
  if (kobo === 0) return `${nairaWords} Naira Only`
  return `${nairaWords} Naira and ${underThousandToWords(kobo)} Kobo Only`
}

export function buildCostingMemoSubject(destination: string, reason: string): string {
  const normalizedDestination = destination.trim()
  const normalizedReason = reason.trim().replace(/[.!?]+$/, '')
  const subjectPrefix = `TRIP TO ${normalizedDestination}`.toUpperCase()
  if (normalizedReason.toUpperCase().startsWith(subjectPrefix)) return normalizedReason.toUpperCase()
  return `${subjectPrefix} TO ${normalizedReason.toUpperCase()}`
}

function formatMemoDate(value: string): string {
  const dateValue = value.length === 10 ? `${value}T12:00:00Z` : value
  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  }).format(new Date(dateValue))
}

export function renderCostingMemoBody(input: CostingMemoBodyInput): string {
  const subject = buildCostingMemoSubject(input.tripDestination, input.reasonForTravel)
  const lines = [
    'Nigerian Communications Satellite Limited',
    '2221st Avenue, FHA, Sector, ABUJA, NG',
    'Tel: +234906 254710 | Email: info@nigcomsat.gov.ng',
    '',
    'MEMO REPORT',
    '',
    `Source HOD memo: ${input.sourceMemoNumber}`,
    subject,
    '',
    `Type: ${ERP_MEMO_TYPE}    Priority: ${ERP_MEMO_PRIORITY}`,
    `Created By: ${input.authorName}    Date: ${formatMemoDate(input.authorizedAt)}`,
    `Addressed To: ${input.addressedTo}`,
  ]

  if (input.department !== null) lines.push(`Department: ${input.department}`)
  if (input.dueDate !== null) lines.push(`Due Date: ${formatMemoDate(input.dueDate)}`)
  if (input.approvedBy !== null) lines.push(`Approved By: ${input.approvedBy}`)

  lines.push(
    `Amount: NGN ${input.totalAmount}`,
    '',
    'Description:',
    `In line with the directive from the Chief Executive Officer, below is the cost implication and recommendation for NIGCOMSAT LTD. staff to travel from ${input.tripOrigin} to ${input.tripDestination} for ${input.reasonForTravel} from ${formatMemoDate(input.departureDate)} to ${formatMemoDate(input.returnDate)}.`,
    '',
    `May you wish to consider and recommend for Management approval the sum of ${nairaAmountInWords(input.totalAmount)} (N${input.totalAmount}) to facilitate this trip.`,
    '',
    `${input.authorName}`,
    `${input.authorTitle}`,
    '',
    'Line Items:',
    'Line No. | Description | Quantity | Unit Price | Amount',
    ...input.lines.map(
      (line) => `${line.line_number} | ${line.description} | ${line.quantity} | ${line.unit_price} | ${line.amount}`,
    ),
    '',
    `Coverage applied to DTA and local running: ${input.coveragePercent}%`,
    `Travel dates: ${formatMemoDate(input.departureDate)} to ${formatMemoDate(input.returnDate)} (${input.days} day${input.days === 1 ? '' : 's'}, ${input.tripType}, ${input.mode})`,
    `Approval History: HR costing memo submitted by ${input.authorName}`,
  )

  if (input.hrNote !== null && input.hrNote.trim().length > 0) {
    lines.push('', `HR note: ${input.hrNote.trim()}`)
  }

  return lines.join('\n')
}
