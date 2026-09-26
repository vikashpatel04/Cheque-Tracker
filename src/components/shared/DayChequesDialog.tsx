import { addDays, format, subDays } from 'date-fns'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/shared/StatusPill'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { Cheque } from '@/types'

interface DayChequesDialogProps {
  /** All cheques (the dialog filters by selected date itself). */
  cheques: Cheque[]
  /** Date currently shown — `null` keeps the dialog closed. */
  date: Date | null
  currencySymbol?: string
  onChangeDate: (date: Date) => void
  onClose: () => void
  onSelectCheque?: (chequeId: string) => void
}

/**
 * A reusable day-detail modal: shows all cheques due on `date`
 * with previous/next-day navigation and click-through to cheque detail.
 */
export function DayChequesDialog({
  cheques,
  date,
  currencySymbol = '₹',
  onChangeDate,
  onClose,
  onSelectCheque,
}: DayChequesDialogProps) {
  const dateStr = date ? format(date, 'yyyy-MM-dd') : ''
  const dayCheques = date ? cheques.filter((c) => c.due_date === dateStr) : []
  const total = dayCheques.reduce((s, c) => s + Number(c.amount), 0)

  return (
    <Dialog open={!!date} onOpenChange={(open) => !open && onClose()}>
      {/* Hide the Dialog's built-in absolute close button — we render our own
          inline in the header row to avoid the chevron/X collision. */}
      <DialogContent className="max-w-md w-full [&>button.absolute]:hidden">
        <DialogHeader className="space-y-0">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => date && onChangeDate(subDays(date, 1))}
              aria-label="Previous day"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <div className="flex-1 min-w-0 text-center px-1">
              <DialogTitle className="text-base leading-snug">
                {date ? formatDate(dateStr) : ''}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {date ? format(date, 'EEEE') : ''} · {dayCheques.length} cheque
                {dayCheques.length !== 1 ? 's' : ''}
                {total > 0 && ` · ${formatCurrency(total, currencySymbol)}`}
              </p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => date && onChangeDate(addDays(date, 1))}
              aria-label="Next day"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 ml-1"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {dayCheques.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No cheques due on this date.
            </p>
          ) : (
            dayCheques.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onClose()
                  onSelectCheque?.(c.id)
                }}
                className="w-full flex items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-muted/50 active:bg-muted transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.party?.name ?? 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">
                    #{c.cheque_number} · {c.bank_name}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold">
                    {formatCurrency(Number(c.amount), currencySymbol)}
                  </p>
                  <StatusPill status={c.status} />
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
