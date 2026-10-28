import { PDFDocument, PageSizes, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib'
import type { ErpExportPayload } from '@/types/database'

const PAGE_MARGIN = 42
const BODY_SIZE = 9
const BODY_LINE_HEIGHT = 12

function pdfSafeText(value: string): string {
  return value
    .replaceAll('₦', 'NGN ')
    .replaceAll('—', '-')
    .replaceAll('–', '-')
    .replaceAll('’', "'")
    .replaceAll('“', '"')
    .replaceAll('”', '"')
    .replace(/[^\x20-\x7E\n\t]/g, '')
}

function wrapText(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = value.split(/\s+/).filter((word) => word.length > 0)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate
      continue
    }
    if (current.length > 0) lines.push(current)
    current = word
  }
  if (current.length > 0) lines.push(current)
  return lines
}

function drawFooter(page: PDFPage, regular: PDFFont, payload: ErpExportPayload, pageNumber: number, pageCount: number) {
  const { width } = page.getSize()
  page.drawLine({
    start: { x: PAGE_MARGIN, y: 32 },
    end: { x: width - PAGE_MARGIN, y: 32 },
    thickness: 0.5,
    color: undefined,
  })
  page.drawText(`Costing ID: ${payload.export_id} · Revision ${payload.costing_memo_revision}`, {
    x: PAGE_MARGIN,
    y: 19,
    size: 7,
    font: regular,
  })
  page.drawText(`Page ${pageNumber} of ${pageCount}`, {
    x: width - PAGE_MARGIN - regular.widthOfTextAtSize(`Page ${pageNumber} of ${pageCount}`, 7),
    y: 19,
    size: 7,
    font: regular,
  })
}

export async function buildCostingMemoPdf(payload: ErpExportPayload): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  document.setTitle(payload.costing_memo_subject)
  document.setAuthor(payload.hr_author_name)
  document.setSubject('HR verified travel costing; final approval handled in Business Central')

  const regular = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  const [pageWidth, pageHeight] = PageSizes.A4
  const contentWidth = pageWidth - PAGE_MARGIN * 2
  const sourceLines = pdfSafeText(payload.costing_memo_body).split('\n')
  const renderedLines: { text: string; bold: boolean }[] = []

  for (const sourceLine of sourceLines) {
    const isHeading = /^(MEMO REPORT|Description:|Line Items:|Approval History:|Amount:|Type:|Created By:|Addressed To:)/.test(sourceLine)
    for (const wrapped of wrapText(sourceLine, isHeading ? bold : regular, BODY_SIZE, contentWidth)) {
      renderedLines.push({ text: wrapped, bold: isHeading })
    }
  }

  const linesPerPage = Math.floor((pageHeight - 90) / BODY_LINE_HEIGHT)
  const pageCount = Math.max(1, Math.ceil(renderedLines.length / linesPerPage))

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const page = document.addPage(PageSizes.A4)
    let y = pageHeight - PAGE_MARGIN
    const start = pageIndex * linesPerPage
    const end = Math.min(renderedLines.length, start + linesPerPage)

    for (let index = start; index < end; index += 1) {
      const line = renderedLines[index]
      const font = line.bold ? bold : regular
      page.drawText(line.text, { x: PAGE_MARGIN, y, size: BODY_SIZE, font })
      y -= BODY_LINE_HEIGHT
    }

    page.drawText('HR VERIFIED COSTING - FINAL APPROVAL HANDLED IN BUSINESS CENTRAL', {
      x: PAGE_MARGIN,
      y: pageHeight - 25,
      size: 7,
      font: bold,
    })
    drawFooter(page, regular, payload, pageIndex + 1, pageCount)
  }

  return document.save()
}
