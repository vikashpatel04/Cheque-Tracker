import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { DateRangePicker } from '@/components/ui/date-picker'
import { STATUS_ACTION_META } from './StatusActions'
import { useParties } from '@/hooks/useParties'
import { updateChequeStatus } from '@/lib/updateChequeStatus'
import { todayISO, formatAmountInput, parseAmount, nextChequeNumber } from '@/lib/formatters'
import { supabase } from '@/lib/supabase'
import type { Cheque, ChequeStatus } from '@/types'
import { VALID_STATUS_TRANSITIONS } from '@/types'
import { useState, useEffect, useMemo } from 'react'

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
  const [amountDisplay, setAmountDisplay] = useState('')

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
      setAmountDisplay('')
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
      setAmountDisplay(formatAmountInput(String(cheque.amount)))
    } else {
      reset(
        prefill
          ? { issue_date: todayISO(), due_date: todayISO(), ...prefill }
          : { issue_date: todayISO(), due_date: todayISO() }
      )
      setAmountDisplay(prefill?.amount != null ? formatAmountInput(String(prefill.amount)) : '')

      // Predict the next cheque number from the last one used (editable).
      if (!prefill?.cheque_number) {
        supabase
          .from('cheques')
          .select('cheque_number')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(({ data }) => {
            const next = nextChequeNumber(data?.cheque_number)
            if (next) setValue('cheque_number', next)
          })
      }
    }
  }, [open, cheque, prefill, reset, setValue])

  const partyId = watch('party_id')
  const issueDate = watch('issue_date')
  const dueDate = watch('due_date')

  const partyOptions = useMemo<ComboboxOption[]>(
    () => parties.map((p) => ({ value: p.id, label: p.name, hint: p.bank_name ?? undefined })),
    [parties]
  )
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
            <Label htmlFor="party_id">Party *</Label>
            <Combobox
              id="party_id"
              options={partyOptions}
              value={partyId}
              onChange={(v) => setValue('party_id', v, { shouldValidate: true })}
              placeholder="Select party"
              searchPlaceholder="Search party..."
              emptyText="No party found."
            />
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
            <Input
              id="amount"
              inputMode="decimal"
              placeholder="0"
              value={amountDisplay}
              onChange={(e) => {
                const formatted = formatAmountInput(e.target.value)
                setAmountDisplay(formatted)
                setValue('amount', parseAmount(formatted), { shouldValidate: true })
              }}
            />
            {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
          </div>
          <div>
            <Label htmlFor="issue_date">Issue Date &ndash; Due Date</Label>
            <DateRangePicker
              id="issue_date"
              from={issueDate}
              to={dueDate}
              onChange={({ from, to }) => {
                setValue('issue_date', from, { shouldValidate: true })
                setValue('due_date', to, { shouldValidate: true })
              }}
              placeholder="Pick issue &amp; due dates"
            />
            {(errors.issue_date || errors.due_date) && (
              <p className="text-sm text-destructive">Select both issue and due dates</p>
            )}
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register('notes')} rows={2} />
          </div>

          {cheque && validTransitions.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Change status
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">
                Applied when you save. Currently{' '}
                <span className="font-medium">{STATUS_ACTION_META[cheque.status].label}</span>.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={newStatus === '' ? 'default' : 'outline'}
                  onClick={() => setNewStatus('')}
                >
                  Keep {STATUS_ACTION_META[cheque.status].label}
                </Button>
                {validTransitions.map((s) => {
                  const { label, Icon, tone } = STATUS_ACTION_META[s]
                  const active = newStatus === s
                  return (
                    <Button
                      key={s}
                      type="button"
                      size="sm"
                      variant={active ? 'default' : 'outline'}
                      onClick={() => setNewStatus(s)}
                      className={active ? undefined : tone}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Button>
                  )
                })}
              </div>
              {newStatus === 'RETURNED' && (
                <div className="mt-3">
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
