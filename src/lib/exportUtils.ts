import { addDays } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { brandSlug } from '@/config/brand'
import { formatCurrencyCode, formatDate, todayDate } from './formatters'
import { getActiveRegion } from './region'
import { STATUS_LABELS, type Cheque, type Party, type ChequeHistory, type DailyDeposit } from '@/types'
import {
  RECEIVED_STATUS_LABELS,
  SETTLEMENT_METHOD_LABELS,
  type BankAccount,
  type ReceivedCheque,
  type ReceivedChequeHistory,
} from '@/types/received'

interface ExportCheque extends Cheque {
  party?: Party
}

/** A date column that may be empty. */
const optionalDate = (d: string | null) => (d ? formatDate(d) : '')

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

export interface AllData {
  parties: Party[]
  cheques: ExportCheque[]
  history: ChequeHistory[]
  deposits: DailyDeposit[]
  received: ReceivedCheque[]
  receivedHistory: ReceivedChequeHistory[]
  accounts: BankAccount[]
}

/** Everything the user has, one sheet per kind of record. */
export function exportAllData({ parties, cheques, history, deposits, received, receivedHistory, accounts }: AllData) {
  const wb = XLSX.utils.book_new()
  const accountName = new Map(accounts.map((a) => [a.id, a.last4 ? `${a.name} (${a.last4})` : a.name]))

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
    'Given cheques'
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
    'Given history'
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
    'Funds added'
  )

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      received.map((c) => ({
        'Cheque No.': c.cheque_number,
        Party: c.party?.name ?? '',
        Kind: c.kind === 'SECURITY' ? 'Security' : 'Regular',
        'Drawn On': c.bank_name,
        Amount: c.amount == null ? '' : Number(c.amount),
        'Received On': formatDate(c.received_on),
        'Cheque Date': optionalDate(c.cheque_date),
        'Due Date': formatDate(c.due_date),
        Status: RECEIVED_STATUS_LABELS[c.status] ?? c.status,
        'Deposited Into': c.deposit_account_id ? accountName.get(c.deposit_account_id) ?? '' : '',
        'Deposited On': optionalDate(c.deposited_on),
        'Cleared On': optionalDate(c.cleared_on),
        'Bounced On': optionalDate(c.bounced_on),
        'Bounce Reason': c.bounce_reason ?? '',
        'Bank Charges': c.bank_charges == null ? '' : Number(c.bank_charges),
        'Settled On': optionalDate(c.settled_on),
        'Settled Via': c.settled_via ? SETTLEMENT_METHOD_LABELS[c.settled_via] : '',
        'Settlement Ref': c.settlement_ref ?? '',
        'Closed Because': c.close_reason ?? '',
        'Times Deposited Again': c.redeposit_count,
        Notes: c.notes ?? '',
      }))
    ),
    'Received cheques'
  )

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      receivedHistory.map((h) => ({
        'Cheque ID': h.cheque_id,
        From: h.from_status,
        To: h.to_status,
        ChangedBy: h.changed_by,
        Note: h.note,
        Date: formatDate(h.created_at),
      }))
    ),
    'Received history'
  )

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      accounts.map((a) => ({
        Name: a.name,
        Bank: a.bank_name,
        'Last 4': a.last4 ?? '',
        Default: a.is_default,
      }))
    ),
    'Bank accounts'
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
