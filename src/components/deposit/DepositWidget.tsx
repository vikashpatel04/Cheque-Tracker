import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useDeposits } from '@/hooks/useDeposits'
import { useSettings } from '@/hooks/useSettings'
import { formatCurrency } from '@/lib/formatters'
import { AllocationModal } from './AllocationModal'

export function DepositWidget() {
  const { todayTotal, addDeposit } = useDeposits()
  const { currencySymbol } = useSettings()
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

  const handleAllocationComplete = async (selectedIds: string[]) => {
    await addDeposit(pendingAmount, notes || undefined)
    setShowAllocation(false)
    setAmount('')
    setNotes('')
    setPendingAmount(0)
    return selectedIds
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="rounded-lg border bg-card px-3 py-1.5 text-sm font-medium">
          Bank: {formatCurrency(todayTotal, currencySymbol)}
        </div>
        <Button size="sm" onClick={() => setShowAmountModal(true)} className="gap-1">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Deposited</span>
        </Button>
      </div>

      <Dialog open={showAmountModal} onOpenChange={setShowAmountModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Deposit Amount</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount available in bank today</Label>
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
          notes={notes}
          onClose={() => setShowAllocation(false)}
          onComplete={handleAllocationComplete}
        />
      )}
    </>
  )
}
