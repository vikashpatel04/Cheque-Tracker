import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { formatDate } from './formatters'
import { formatCurrency } from './formatters'
import type { Cheque, Party, ChequeHistory, DailyDeposit } from '@/types'

interface ExportCheque extends Cheque {
  party?: Party
}

export function exportChequesToPDF(
  cheques: ExportCheque[],
  title: string,
  currencySymbol = '₹'
) {
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(16)
  doc.text(title, 14, 15)

  const rows = cheques.map((c) => [
    c.cheque_number,
    c.party?.name ?? '',
    c.bank_name,
    formatCurrency(Number(c.amount), currencySymbol),
    formatDate(c.issue_date),
    formatDate(c.due_date),
    c.status,
  ])

  autoTable(doc, {
    head: [['Cheque No.', 'Party', 'Bank', 'Amount', 'Issue Date', 'Due Date', 'Status']],
    body: rows,
    startY: 22,
  })

  const total = cheques.reduce((sum, c) => sum + Number(c.amount), 0)
  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  doc.setFontSize(12)
  doc.text(`Total: ${formatCurrency(total, currencySymbol)} (${cheques.length} cheques)`, 14, finalY)

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
    Status: c.status,
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
        Status: c.status,
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

  XLSX.writeFile(wb, 'cheque_tracker_export.xlsx')
}

export function downloadPartyTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Party Name', 'Contact Name', 'Phone', 'Bank Name', 'Notes'],
    ['Example Supplier', 'John Doe', '9876543210', 'HDFC Bank', ''],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Parties')
  XLSX.writeFile(wb, 'party_upload_template.xlsx')
}

export function downloadChequeTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Party Name', 'Cheque Number', 'Bank Name', 'Amount', 'Issue Date (DD-MM-YYYY)', 'Due Date (DD-MM-YYYY)', 'Notes'],
    ['Example Supplier', 'CHQ001', 'HDFC Bank', '50000', '01-01-2025', '15-01-2025', ''],
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
        const workbook = XLSX.read(data, { type: 'array' })
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
