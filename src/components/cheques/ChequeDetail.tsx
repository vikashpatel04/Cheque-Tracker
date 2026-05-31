import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/formatters'
import { useSettings } from '@/hooks/useSettings'
import { StatusPill } from '@/components/shared/StatusPill'
import { DaysUntilDue } from '@/components/shared/DaysUntilDue'
import { updateChequeStatus } from '@/lib/updateChequeStatus'
import type { Cheque, ChequeHistory, ChequeStatus } from '@/types'
import { VALID_STATUS_TRANSITIONS } from '@/types'
import { toast } from 'sonner'

interface ChequeDetailProps {
  chequeId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (cheque: Cheque) => void
  onRefresh: () => void
}

export function ChequeDetail({ chequeId, open, onOpenChange, onEdit, onRefresh }: ChequeDetailProps) {
  const { currencySymbol } = useSettings()
  const [cheque, setCheque] = useState<Cheque | null>(null)
  const [history, setHistory] = useState<ChequeHistory[]>([])

  useEffect(() => {
    if (!open) {
      setCheque(null)
      setHistory([])
      return
    }
    if (!chequeId) return
    setCheque(null)
    supabase
      .from('cheques')
      .select('*, party:parties(*)')
      .eq('id', chequeId)
      .single()
      .then(({ data }) => {
        if (data) setCheque(data as Cheque)
      })
    supabase
      .from('cheque_history')
      .select('*')
      .eq('cheque_id', chequeId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setHistory(data)
      })
  }, [chequeId, open])

  const handleStatusChange = async (newStatus: ChequeStatus) => {
    if (!cheque) return
    let returnReason: string | undefined
    if (newStatus === 'RETURNED') {
      returnReason = prompt('Enter return reason:') ?? undefined
      if (!returnReason) return
    }
    const result = await updateChequeStatus(cheque.id, newStatus, {
      changedBy: 'manual',
      returnReason,
    })
    if (result.success) {
      toast.success(`Status updated to ${newStatus}`)
      onRefresh()
      onOpenChange(false)
    } else {
      toast.error(result.error)
    }
  }

  const handleDelete = async () => {
    if (!cheque || !confirm('Soft delete this cheque?')) return
    await supabase
      .from('cheques')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', cheque.id)
    toast.success('Cheque deleted')
    onRefresh()
    onOpenChange(false)
  }

  const transitions = cheque ? VALID_STATUS_TRANSITIONS[cheque.status] : []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="responsive" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{cheque ? `Cheque #${cheque.cheque_number}` : 'Cheque Details'}</SheetTitle>
        </SheetHeader>
        {!cheque ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading...</p>
        ) : (
        <div className="mt-6 space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <StatusPill status={cheque.status} />
            <DaysUntilDue dueDate={cheque.due_date} status={cheque.status} />
          </div>
          <div className="grid gap-2">
            <p><span className="text-muted-foreground">Party:</span> {cheque.party?.name}</p>
            <p><span className="text-muted-foreground">Bank:</span> {cheque.bank_name}</p>
            <p><span className="text-muted-foreground">Amount:</span> {formatCurrency(Number(cheque.amount), currencySymbol)}</p>
            <p><span className="text-muted-foreground">Issue Date:</span> {formatDate(cheque.issue_date)}</p>
            <p><span className="text-muted-foreground">Due Date:</span> {formatDate(cheque.due_date)}</p>
            {cheque.return_reason && (
              <p><span className="text-muted-foreground">Return Reason:</span> {cheque.return_reason}</p>
            )}
            {cheque.notes && <p><span className="text-muted-foreground">Notes:</span> {cheque.notes}</p>}
          </div>

          {transitions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {transitions.map((s) => (
                <Button key={s} size="sm" variant="outline" onClick={() => handleStatusChange(s)}>
                  Mark {s.charAt(0) + s.slice(1).toLowerCase()}
                </Button>
              ))}
            </div>
          )}

          <div>
            <h4 className="font-medium mb-2">Status History</h4>
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="border-l-2 border-muted pl-3 py-1">
                  <p>{h.from_status} → {h.to_status}</p>
                  <p className="text-xs text-muted-foreground">
                    {h.changed_by} · {formatDateTime(h.created_at)}
                  </p>
                  {h.note && <p className="text-xs">{h.note}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => onEdit(cheque)}>Edit</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </div>
        </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
