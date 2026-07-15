import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { todayISO } from '@/lib/formatters'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { useSettings } from '@/hooks/useSettings'
import { toast } from 'sonner'
import type { Cheque } from '@/types'

interface RePresentDrawerProps {
  cheque: Cheque | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function RePresentDrawer({ cheque, open, onOpenChange, onSuccess }: RePresentDrawerProps) {
  const { currencySymbol } = useSettings()
  const [newChequeNumber, setNewChequeNumber] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<{ cheque_number?: string; due_date?: string }>({})

  useEffect(() => {
    if (open && cheque) {
      setNewChequeNumber('')
      setNewDueDate(todayISO())
      setNotes('')
      setErrors({})
    }
  }, [open, cheque])

  const validate = () => {
    const e: typeof errors = {}
    if (!newChequeNumber.trim()) e.cheque_number = 'Cheque number is required'
    if (!newDueDate) e.due_date = 'Due date is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cheque || !validate()) return
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Not authenticated')
      setSubmitting(false)
      return
    }

    const newNotes = ['[FROM_RETURN]', notes.trim()].filter(Boolean).join('\n')

    const { error: insertError } = await supabase.from('cheques').insert({
      user_id: user.id,
      party_id: cheque.party_id,
      cheque_number: newChequeNumber.trim(),
      bank_name: cheque.bank_name,
      amount: Number(cheque.amount),
      issue_date: todayISO(),
      due_date: newDueDate,
      status: 'PENDING',
      notes: newNotes,
    })

    if (insertError) {
      toast.error('Failed to create re-presented cheque')
      setSubmitting(false)
      return
    }

    const existingNotes = cheque.notes ?? ''
    const updatedNotes = existingNotes.includes('[RE_PRESENTED]')
      ? existingNotes
      : ['[RE_PRESENTED]', existingNotes].filter(Boolean).join('\n')

    await supabase.from('cheques').update({ notes: updatedNotes }).eq('id', cheque.id)

    toast.success('Cheque re-presented successfully')
    setSubmitting(false)
    onOpenChange(false)
    onSuccess()
  }

  if (!cheque) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Re-present Cheque</SheetTitle>
        </SheetHeader>

        {/* Original cheque info — read-only */}
        <div className="mt-6 rounded-lg border bg-muted/40 p-4 space-y-1 text-sm">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-2">Original cheque</p>
          <p><span className="text-muted-foreground">Party:</span> <span className="font-medium">{cheque.party?.name}</span></p>
          <p><span className="text-muted-foreground">Bank:</span> {cheque.bank_name}</p>
          <p><span className="text-muted-foreground">Amount:</span> <span className="font-semibold">{formatCurrency(Number(cheque.amount), currencySymbol)}</span></p>
          <p><span className="text-muted-foreground">Original due:</span> {formatDate(cheque.due_date)}</p>
          {cheque.return_reason && (
            <p><span className="text-muted-foreground">Return reason:</span> <span className="text-destructive">{cheque.return_reason}</span></p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="rp-cheque-number">New Cheque Number *</Label>
            <Input
              id="rp-cheque-number"
              value={newChequeNumber}
              onChange={(e) => setNewChequeNumber(e.target.value)}
              placeholder="Enter new cheque number"
              autoFocus
            />
            {errors.cheque_number && <p className="text-sm text-destructive mt-1">{errors.cheque_number}</p>}
          </div>

          <div>
            <Label htmlFor="rp-due-date">New Due Date *</Label>
            <DatePicker
              id="rp-due-date"
              value={newDueDate}
              onChange={setNewDueDate}
              placeholder="Pick a due date"
            />
            {errors.due_date && <p className="text-sm text-destructive mt-1">{errors.due_date}</p>}
          </div>

          <div>
            <Label htmlFor="rp-notes">Notes</Label>
            <Textarea
              id="rp-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes for the re-presented cheque..."
              rows={2}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            A new PENDING cheque will be created with the same party, bank, and amount. The original returned cheque will be tagged as re-presented.
          </p>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? 'Creating...' : 'Re-present'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
