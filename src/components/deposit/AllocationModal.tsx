import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { suggestAllocation, getRemainingBalance, type AllocationItem } from '@/lib/allocationEngine'
import { updateChequeStatusBatch } from '@/lib/updateChequeStatus'
import { useSettings } from '@/hooks/useSettings'
import type { Cheque, Party } from '@/types'

interface AllocationModalProps {
  depositAmount: number
  notes?: string
  onClose: () => void
  onComplete: (selectedIds: string[]) => Promise<string[]>
}

export function AllocationModal({ depositAmount, notes, onClose, onComplete }: AllocationModalProps) {
  const { currencySymbol, allocationSort } = useSettings()
  const [items, setItems] = useState<AllocationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function loadPending() {
      const { data } = await supabase
        .from('cheques')
        .select('*, party:parties(*)')
        .eq('status', 'PENDING')
        .is('deleted_at', null)

      if (data) {
        const cheques = data as (Cheque & { party: Party })[]
        setItems(suggestAllocation(cheques, depositAmount, allocationSort))
      }
      setLoading(false)
    }
    loadPending()
  }, [depositAmount, allocationSort])

  const toggleItem = (index: number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item))
    )
  }

  const { allocated, remaining, exceeds } = getRemainingBalance(items, depositAmount)
  const selectedIds = items.filter((i) => i.selected).map((i) => i.cheque.id)

  const handleConfirm = async () => {
    setSubmitting(true)
    if (selectedIds.length > 0) {
      const result = await updateChequeStatusBatch(selectedIds, 'DEPOSITED', {
        changedBy: 'deposit_allocation',
        note: notes ? `Deposit allocation: ${notes}` : 'Deposit allocation',
      })
      if (!result.success) {
        toast.error(result.error ?? 'Failed to update cheques')
        setSubmitting(false)
        return
      }
    }
    await onComplete(selectedIds)
    toast.success(
      `${formatCurrency(depositAmount, currencySymbol)} deposited — ${selectedIds.length} cheque${selectedIds.length !== 1 ? 's' : ''} marked as Deposited`
    )
    setSubmitting(false)
    onClose()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {formatCurrency(depositAmount, currencySymbol)} entered — here's how it covers your pending cheques
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-muted-foreground">Loading pending cheques...</p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground">No pending cheques to allocate.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="p-2 w-10"></TableHead>
                <TableHead className="p-2">Party</TableHead>
                <TableHead className="p-2">Cheque No.</TableHead>
                <TableHead className="p-2 text-right">Amount</TableHead>
                <TableHead className="p-2">Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={item.cheque.id}>
                  <TableCell className="p-2">
                    <Checkbox checked={item.selected} onCheckedChange={() => toggleItem(index)} />
                  </TableCell>
                  <TableCell className="p-2">{item.cheque.party.name}</TableCell>
                  <TableCell className="p-2">{item.cheque.cheque_number}</TableCell>
                  <TableCell className="p-2 text-right">{formatCurrency(Number(item.cheque.amount), currencySymbol)}</TableCell>
                  <TableCell className="p-2">{formatDate(item.cheque.due_date)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="space-y-1 text-sm">
          <p>
            Allocated: {formatCurrency(allocated, currencySymbol)} / Remaining:{' '}
            {formatCurrency(remaining, currencySymbol)}
          </p>
          {exceeds > 0 && (
            <p className="text-destructive font-medium">
              Selection exceeds deposit by {formatCurrency(exceeds, currencySymbol)}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Confirming...' : 'Confirm Allocation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
