import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadChequeTemplate, parseExcelFile } from '@/lib/exportUtils'
import { useParties } from '@/hooks/useParties'
import { supabase } from '@/lib/supabase'
import { useExistingChequeNumbers, describeExisting } from '@/hooks/useExistingChequeNumbers'
import { parseFlexibleDate, toISODate } from '@/lib/formatters'
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
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [step, setStep] = useState<'upload' | 'preview'>('upload')
  const [submitting, setSubmitting] = useState(false)

  const existingNumbers = useExistingChequeNumbers(preview.map((r) => r.cheque_number))
  const partyMap = new Map(parties.map((p) => [p.name.toLowerCase(), p.id]))

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const rows = await parseExcelFile(file)
    const previewRows: PreviewRow[] = rows.map((row) => {
      const party_name = String(row['Party Name'] ?? '').trim()
      const cheque_number = String(row['Cheque Number'] ?? '').trim()
      const bank_name = String(row['Bank Name'] ?? '').trim()
      const amount = Number(String(row['Amount'] ?? 0).replace(/,/g, ''))
      // Accept both the new DD/MM/YYYY headers and older DD-MM-YYYY templates.
      const issueRaw = row['Issue Date (DD/MM/YYYY)'] ?? row['Issue Date (DD-MM-YYYY)']
      const dueRaw = row['Due Date (DD/MM/YYYY)'] ?? row['Due Date (DD-MM-YYYY)']
      const notes = String(row['Notes'] ?? '').trim()

      let error: string | undefined
      const party_id = partyMap.get(party_name.toLowerCase())
      if (!party_name) error = 'Missing party name'
      else if (!party_id) error = 'Party not found'
      if (!cheque_number) error = error ?? 'Missing cheque number'
      if (!bank_name) error = error ?? 'Missing bank name'
      if (!amount || amount <= 0) error = error ?? 'Invalid amount'

      const issueDate = parseFlexibleDate(issueRaw)
      const dueDate = parseFlexibleDate(dueRaw)
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
    const valid = preview.filter((r) => !r.error && r.party_id)
    if (valid.length === 0) return
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSubmitting(false)
      toast.error('Not authenticated')
      return
    }
    // One request for all rows: the import either fully succeeds or saves
    // nothing, so it can be retried without creating duplicates.
    const { error } = await supabase.from('cheques').insert(
      valid.map((row) => ({
        user_id: user.id,
        status: 'PENDING',
        party_id: row.party_id!,
        cheque_number: row.cheque_number,
        bank_name: row.bank_name,
        amount: row.amount,
        issue_date: row.issue_date,
        due_date: row.due_date,
        notes: row.notes || null,
      }))
    )
    setSubmitting(false)
    if (error) {
      toast.error(`Import failed, nothing was saved: ${error.message}`)
      return
    }
    toast.success(`${valid.length} cheques imported`)
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
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="cheque-bulk-file">Excel file</Label>
              <Input
                id="cheque-bulk-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFile}
              />
            </div>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="p-2">Party</TableHead>
                  <TableHead className="p-2">Cheque No.</TableHead>
                  <TableHead className="p-2">Amount</TableHead>
                  <TableHead className="p-2">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((row, i) => (
                  <TableRow key={i} className={row.error ? 'bg-red-50 dark:bg-red-950/30' : undefined}>
                    <TableCell className="p-2">{row.party_name}</TableCell>
                    <TableCell className="p-2">{row.cheque_number}</TableCell>
                    <TableCell className="p-2">{row.amount}</TableCell>
                    <TableCell className="p-2 text-xs">
                      {row.error ? (
                        <span className="text-destructive">{row.error}</span>
                      ) : describeExisting(existingNumbers.get(row.cheque_number)) ? (
                        <span className="text-amber-600 dark:text-amber-400">
                          {describeExisting(existingNumbers.get(row.cheque_number))}
                        </span>
                      ) : (
                        'Valid'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
              <Button onClick={handleConfirm} disabled={submitting || preview.every((r) => r.error)}>
                Import {preview.filter((r) => !r.error).length} Cheques
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
