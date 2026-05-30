import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { downloadChequeTemplate, parseExcelFile } from '@/lib/exportUtils'
import { useParties } from '@/hooks/useParties'
import { useCheques } from '@/hooks/useCheques'
import { parseDisplayDate, toISODate } from '@/lib/formatters'
import { toast } from 'sonner'

interface BulkUploadProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

interface PreviewRow {
  party_name: string
  cheque_number: string
  bank_name: string
  amount: number
  issue_date: string
  due_date: string
  notes: string
  party_id?: string
  error?: string
}

export function ChequeBulkUpload({ open, onOpenChange, onComplete }: BulkUploadProps) {
  const { parties } = useParties()
  const { createCheque } = useCheques()
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [step, setStep] = useState<'upload' | 'preview'>('upload')
  const [submitting, setSubmitting] = useState(false)

  const partyMap = new Map(parties.map((p) => [p.name.toLowerCase(), p.id]))

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const rows = await parseExcelFile(file)
    const previewRows: PreviewRow[] = rows.map((row) => {
      const party_name = String(row['Party Name'] ?? '').trim()
      const cheque_number = String(row['Cheque Number'] ?? '').trim()
      const bank_name = String(row['Bank Name'] ?? '').trim()
      const amount = Number(row['Amount'] ?? 0)
      const issueStr = String(row['Issue Date (DD-MM-YYYY)'] ?? '').trim()
      const dueStr = String(row['Due Date (DD-MM-YYYY)'] ?? '').trim()
      const notes = String(row['Notes'] ?? '').trim()

      let error: string | undefined
      const party_id = partyMap.get(party_name.toLowerCase())
      if (!party_name) error = 'Missing party name'
      else if (!party_id) error = 'Party not found'
      if (!cheque_number) error = error ?? 'Missing cheque number'
      if (!bank_name) error = error ?? 'Missing bank name'
      if (!amount || amount <= 0) error = error ?? 'Invalid amount'

      const issueDate = parseDisplayDate(issueStr)
      const dueDate = parseDisplayDate(dueStr)
      if (!issueDate) error = error ?? 'Invalid issue date'
      if (!dueDate) error = error ?? 'Invalid due date'

      return {
        party_name,
        cheque_number,
        bank_name,
        amount,
        issue_date: issueDate ? toISODate(issueDate) : '',
        due_date: dueDate ? toISODate(dueDate) : '',
        notes,
        party_id,
        error,
      }
    })

    setPreview(previewRows)
    setStep('preview')
  }

  const handleConfirm = async () => {
    setSubmitting(true)
    const valid = preview.filter((r) => !r.error && r.party_id)
    let inserted = 0
    for (const row of valid) {
      const result = await createCheque({
        party_id: row.party_id!,
        cheque_number: row.cheque_number,
        bank_name: row.bank_name,
        amount: row.amount,
        issue_date: row.issue_date,
        due_date: row.due_date,
        notes: row.notes || undefined,
      })
      if (!result.error) inserted++
    }
    toast.success(`${inserted} cheques imported`)
    setSubmitting(false)
    setStep('upload')
    setPreview([])
    onComplete()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload Cheques</DialogTitle>
        </DialogHeader>

        {step === 'upload' ? (
          <div className="space-y-4">
            <Button variant="outline" onClick={downloadChequeTemplate}>Download Template</Button>
            <input type="file" accept=".xlsx,.xls" onChange={handleFile} />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left">Party</th>
                    <th className="p-2 text-left">Cheque No.</th>
                    <th className="p-2 text-left">Amount</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className={row.error ? 'bg-red-50' : ''}>
                      <td className="p-2">{row.party_name}</td>
                      <td className="p-2">{row.cheque_number}</td>
                      <td className="p-2">{row.amount}</td>
                      <td className="p-2 text-destructive text-xs">{row.error ?? 'Valid'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
              <Button onClick={handleConfirm} disabled={submitting}>
                Import {preview.filter((r) => !r.error).length} Cheques
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
