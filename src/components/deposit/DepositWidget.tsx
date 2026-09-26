import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useDeposits } from '@/hooks/useDeposits'
import { formatCurrency } from '@/lib/formatters'
import { AllocationModal } from './AllocationModal'

export function DepositWidget() {
  const { todayTotal, addDeposit } = useDeposits()
  const [showAmountModal, setShowAmountModal] = useState(false)
  const [showAllocation, setShowAllocation] = useState(false)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [pendingAmount, setPendingAmount] = useState(0)

  const handleAmountConfirm = () => {
    const num = parseFloat(amount)
    if (isNaN(num) || num <= 0) return
    setPendingAmount(num)
    setShowAmountModal(false)
    setShowAllocation(true)
  }

  const handleAllocationConfirm = async (selectedIds: string[]) => {
    const result = await addDeposit(pendingAmount, selectedIds, notes || undefined)
    if (result.error) return result
    setAmount('')
    setNotes('')
    setPendingAmount(0)
    return {}
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="rounded-lg border bg-card px-3 py-1.5 text-sm font-medium">
          <span className="text-muted-foreground font-normal">Funds added today:</span> {formatCurrency(todayTotal)}
        </div>
        <Button size="sm" onClick={() => setShowAmountModal(true)} className="gap-1">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add funds</span>
        </Button>
      </div>

      <Dialog open={showAmountModal} onOpenChange={setShowAmountModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add funds to bank</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount added to the bank today</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAmountModal(false)}>Cancel</Button>
            <Button onClick={handleAmountConfirm}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showAllocation && (
        <AllocationModal
          depositAmount={pendingAmount}
          onClose={() => setShowAllocation(false)}
          onConfirm={handleAllocationConfirm}
        />
      )}
    </>
  )
}
