import { addDays } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { brandSlug } from '@/config/brand'
import { formatCurrencyCode, formatDate, todayDate } from './formatters'
import { getActiveRegion } from './region'
import { STATUS_LABELS, type Cheque, type Party, type ChequeHistory, type DailyDeposit } from '@/types'

interface ExportCheque extends Cheque {
  party?: Party
}

export function exportChequesToPDF(cheques: ExportCheque[], title: string) {
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(16)
  doc.text(title, 14, 15)

  // Amounts carry the currency code: the built-in PDF fonts can't draw
  // symbols such as ₹.
  const rows = cheques.map((c) => [
    c.cheque_number,
    c.party?.name ?? '',
    c.bank_name,
    formatCurrencyCode(Number(c.amount)),
    formatDate(c.issue_date),
    formatDate(c.due_date),
    STATUS_LABELS[c.status] ?? c.status,
  ])

  autoTable(doc, {
    head: [['Cheque No.', 'Party', 'Bank', 'Amount', 'Issue Date', 'Due Date', 'Status']],
    body: rows,
    startY: 22,
  })

  const total = cheques.reduce((sum, c) => sum + Number(c.amount), 0)
  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  doc.setFontSize(12)
  doc.text(`Total: ${formatCurrencyCode(total)} (${cheques.length} cheques)`, 14, finalY)

  doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}.pdf`)
}

export function exportChequesToExcel(cheques: ExportCheque[], filename: string) {
  const data = cheques.map((c) => ({
    'Cheque No.': c.cheque_number,
    Party: c.party?.name ?? '',
    Bank: c.bank_name,
    Amount: Number(c.amount),
    'Issue Date': formatDate(c.issue_date),
    'Due Date': formatDate(c.due_date),
    Status: STATUS_LABELS[c.status] ?? c.status,
    Notes: c.notes ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Cheques')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

export function exportAllData(
  parties: Party[],
  cheques: ExportCheque[],
  history: ChequeHistory[],
  deposits: DailyDeposit[]
) {
  const wb = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      parties.map((p) => ({
        Name: p.name,
        Contact: p.contact_name,
        Phone: p.phone,
        Bank: p.bank_name,
        Active: p.is_active,
        Notes: p.notes,
      }))
    ),
    'Parties'
  )

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      cheques.map((c) => ({
        'Cheque No.': c.cheque_number,
        Party: c.party?.name ?? '',
        Bank: c.bank_name,
        Amount: Number(c.amount),
        'Issue Date': formatDate(c.issue_date),
        'Due Date': formatDate(c.due_date),
        Status: STATUS_LABELS[c.status] ?? c.status,
        'Cheque Date': c.original_due_date ? formatDate(c.original_due_date) : '',
        'Times Re-presented': c.represent_count ?? 0,
        'Write-off Reason': c.write_off_reason ?? '',
        Notes: c.notes,
      }))
    ),
    'Cheques'
  )

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      history.map((h) => ({
        'Cheque ID': h.cheque_id,
        From: h.from_status,
        To: h.to_status,
        ChangedBy: h.changed_by,
        Note: h.note,
        Date: formatDate(h.created_at),
      }))
    ),
    'History'
  )

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      deposits.map((d) => ({
        Amount: Number(d.amount),
        Date: formatDate(d.deposit_date),
        Notes: d.notes,
      }))
    ),
    'Deposits'
  )

  XLSX.writeFile(wb, `${brandSlug()}_export.xlsx`)
}

/** Column header for a date in the user's format, e.g. "Due Date (DD/MM/YYYY)". */
function dateHeader(label: string): string {
  return `${label} (${getActiveRegion().dateFormat.toUpperCase()})`
}

/** `sampleBank` fills the example row, usually the first bank in the user's list. */
export function downloadPartyTemplate(sampleBank?: string) {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Party Name', 'Contact Name', 'Phone', 'Bank Name', 'Notes'],
    ['Example Party', 'Contact person', '', sampleBank || 'Your bank', ''],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Parties')
  XLSX.writeFile(wb, 'party_upload_template.xlsx')
}

/** `sampleBank` fills the example row, usually the first bank in the user's list. */
export function downloadChequeTemplate(sampleBank?: string) {
  const issued = todayDate()
  const ws = XLSX.utils.aoa_to_sheet([
    ['Party Name', 'Cheque Number', 'Bank Name', 'Amount', dateHeader('Issue Date'), dateHeader('Due Date'), 'Notes'],
    ['Example Party', '000001', sampleBank || 'Your bank', 50000, formatDate(issued), formatDate(addDays(issued, 14)), ''],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Cheques')
  XLSX.writeFile(wb, 'cheque_upload_template.xlsx')
}

export function parseExcelFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
        resolve(json)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Value of the first column whose header starts with `prefix`. Templates put
 * the date format in the header ("Due Date (DD/MM/YYYY)"), and it differs
 * between regions and older templates.
 */
export function columnValue(row: Record<string, unknown>, prefix: string): unknown {
  const wanted = prefix.toLowerCase()
  const key = Object.keys(row).find((k) => k.trim().toLowerCase().startsWith(wanted))
  return key === undefined ? undefined : row[key]
}
