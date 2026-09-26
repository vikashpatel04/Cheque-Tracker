import { useState, useEffect } from 'react'
import { addMonths, format, parseISO } from 'date-fns'
import { ChevronDown } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { DateInput } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { representCheque } from '@/lib/updateChequeStatus'
import { todayISO, formatCurrency, formatDate } from '@/lib/formatters'
import { getActiveRegion } from '@/lib/region'
import { toast } from 'sonner'
import type { Cheque } from '@/types'

interface RePresentDrawerProps {
  cheque: Cheque | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

/**
 * Re-present a returned cheque: the party deposits the SAME cheque again.
 * It goes back to Pending with the new expected date (or straight to
 * Funded) and then follows the normal life cycle.
 */
export function RePresentDrawer({ cheque, open, onOpenChange, onSuccess }: RePresentDrawerProps) {
  const [newDueDate, setNewDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && cheque) {
      setNewDueDate(todayISO())
      setNotes('')
      setError(null)
    }
  }, [open, cheque])

  if (!cheque) return null

  // Banks refuse cheques older than the validity period set for the user's
  // region (counted from the date written on the cheque).
  const { chequeValidityMonths } = getActiveRegion()
  const chequeDate = cheque.original_due_date ?? cheque.due_date
  const validTill = format(addMonths(parseISO(chequeDate), chequeValidityMonths), 'yyyy-MM-dd')
  const pastValidity = !!newDueDate && newDueDate > validTill

  const save = async (markDeposited: boolean) => {
    if (!newDueDate) {
      setError('Due date is required')
      return
    }
    setSubmitting(true)
    const result = await representCheque(cheque.id, newDueDate, {
      note: notes.trim() || undefined,
      markDeposited,
    })
    setSubmitting(false)
    if (!result.success) {
      toast.error(`Failed to re-present: ${result.error}`)
      return
    }
    toast.success(
      markDeposited
        ? `Cheque #${cheque.cheque_number} re-presented and marked Funded`
        : `Cheque #${cheque.cheque_number} re-presented — due ${formatDate(newDueDate)}`
    )
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Re-present Cheque #{cheque.cheque_number}</SheetTitle>
        </SheetHeader>

        {/* Returned cheque info — read-only */}
        <div className="mt-6 rounded-lg border bg-muted/40 p-4 space-y-1 text-sm">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-2">Returned cheque</p>
          <p><span className="text-muted-foreground">Party:</span> <span className="font-medium">{cheque.party?.name}</span></p>
          <p><span className="text-muted-foreground">Bank:</span> {cheque.bank_name}</p>
          <p><span className="text-muted-foreground">Amount:</span> <span className="font-semibold">{formatCurrency(Number(cheque.amount))}</span></p>
          <p><span className="text-muted-foreground">Cheque date:</span> {formatDate(chequeDate)}</p>
          {cheque.original_due_date && cheque.original_due_date !== cheque.due_date && (
            <p><span className="text-muted-foreground">Last presented for:</span> {formatDate(cheque.due_date)}</p>
          )}
          {cheque.return_reason && (
            <p><span className="text-muted-foreground">Return reason:</span> <span className="text-destructive">{cheque.return_reason}</span></p>
          )}
          {cheque.represent_count > 0 && (
            <p><span className="text-muted-foreground">Re-presented before:</span> {cheque.represent_count}×</p>
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); void save(false) }}
          className="mt-6 space-y-4"
        >
          <div>
            <Label htmlFor="rp-due-date">New due date *</Label>
            <DateInput id="rp-due-date" value={newDueDate} onChange={setNewDueDate} />
            <p className="text-xs text-muted-foreground mt-1">When the party will deposit this cheque again.</p>
            {error && <p className="text-sm text-destructive mt-1">{error}</p>}
            {pastValidity && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                This is after {formatDate(validTill)}, more than {chequeValidityMonths} month{chequeValidityMonths === 1 ? '' : 's'} from the cheque date. The bank may refuse a stale cheque.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="rp-notes">Notes</Label>
            <Textarea
              id="rp-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Funds arranged, party informed..."
              rows={2}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            The same cheque goes back to <span className="font-medium">Pending</span> with the new date and follows the
            normal cycle. Its return details stay in the history.
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
            <div className="flex flex-1">
              <Button type="submit" className="flex-1 rounded-r-none" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save'}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    className="rounded-l-none border-l border-primary-foreground/20 px-2"
                    disabled={submitting}
                    aria-label="More save options"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => void save(false)}>
                    Save (Pending)
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void save(true)}>
                    Save as Funded
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
