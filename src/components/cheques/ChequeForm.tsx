import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useParties } from '@/hooks/useParties'
import { updateChequeStatus } from '@/lib/updateChequeStatus'
import { todayISO } from '@/lib/formatters'
import type { Cheque, ChequeStatus } from '@/types'
import { VALID_STATUS_TRANSITIONS } from '@/types'
import { useState, useEffect } from 'react'

const chequeSchema = z.object({
  party_id: z.string().min(1, 'Party is required'),
  cheque_number: z.string().min(1, 'Cheque number is required'),
  bank_name: z.string().min(1, 'Bank name is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  issue_date: z.string().min(1),
  due_date: z.string().min(1),
  notes: z.string().optional(),
})

type ChequeFormData = z.infer<typeof chequeSchema>

interface ChequeFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cheque?: Cheque | null
  prefill?: Partial<ChequeFormData>
  onSubmit: (data: ChequeFormData) => Promise<void>
  onStatusChange?: () => void
}

export function ChequeForm({ open, onOpenChange, cheque, prefill, onSubmit, onStatusChange }: ChequeFormProps) {
  const { parties } = useParties()
  const [newStatus, setNewStatus] = useState<ChequeStatus | ''>('')
  const [returnReason, setReturnReason] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, watch, reset } = useForm<ChequeFormData>({
    resolver: zodResolver(chequeSchema),
    defaultValues: {
      issue_date: todayISO(),
      due_date: todayISO(),
    },
  })

  useEffect(() => {
    if (!open) {
      setNewStatus('')
      setReturnReason('')
      return
    }
    if (cheque) {
      reset({
        party_id: cheque.party_id,
        cheque_number: cheque.cheque_number,
        bank_name: cheque.bank_name,
        amount: Number(cheque.amount),
        issue_date: cheque.issue_date,
        due_date: cheque.due_date,
        notes: cheque.notes ?? '',
      })
    } else {
      reset(
        prefill
          ? { issue_date: todayISO(), due_date: todayISO(), ...prefill }
          : { issue_date: todayISO(), due_date: todayISO() }
      )
    }
  }, [open, cheque, prefill, reset])

  const partyId = watch('party_id')
  const validTransitions = cheque ? VALID_STATUS_TRANSITIONS[cheque.status] : []

  const handleFormSubmit = async (data: ChequeFormData) => {
    if (cheque && newStatus && newStatus !== cheque.status) {
      if (newStatus === 'RETURNED' && !returnReason.trim()) return
      const result = await updateChequeStatus(cheque.id, newStatus, {
        changedBy: 'manual',
        returnReason: newStatus === 'RETURNED' ? returnReason : undefined,
      })
      if (!result.success) return
      onStatusChange?.()
    }
    await onSubmit(data)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{cheque ? 'Edit Cheque' : 'Add Cheque'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="mt-6 space-y-4">
          <div>
            <Label>Party *</Label>
            <Select value={partyId} onValueChange={(v) => setValue('party_id', v)}>
              <SelectTrigger><SelectValue placeholder="Select party" /></SelectTrigger>
              <SelectContent>
                {parties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.party_id && <p className="text-sm text-destructive">{errors.party_id.message}</p>}
          </div>
          <div>
            <Label htmlFor="cheque_number">Cheque Number *</Label>
            <Input id="cheque_number" {...register('cheque_number')} />
            {errors.cheque_number && <p className="text-sm text-destructive">{errors.cheque_number.message}</p>}
          </div>
          <div>
            <Label htmlFor="bank_name">Bank Name *</Label>
            <Input id="bank_name" {...register('bank_name')} />
          </div>
          <div>
            <Label htmlFor="amount">Amount *</Label>
            <Input id="amount" type="number" step="0.01" {...register('amount')} />
            {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="issue_date">Issue Date</Label>
              <Input id="issue_date" type="date" {...register('issue_date')} />
            </div>
            <div>
              <Label htmlFor="due_date">Due Date</Label>
              <Input id="due_date" type="date" {...register('due_date')} />
            </div>
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register('notes')} rows={2} />
          </div>

          {cheque && validTransitions.length > 0 && (
            <div>
              <Label>Change Status</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as ChequeStatus)}>
                <SelectTrigger><SelectValue placeholder="Keep current status" /></SelectTrigger>
                <SelectContent>
                  {validTransitions.map((s) => (
                    <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {newStatus === 'RETURNED' && (
                <div className="mt-2">
                  <Label htmlFor="return_reason">Return Reason *</Label>
                  <Textarea
                    id="return_reason"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : cheque ? 'Update Cheque' : 'Add Cheque'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
