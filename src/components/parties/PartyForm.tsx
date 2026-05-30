import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { Party } from '@/types'

const partySchema = z.object({
  name: z.string().min(1, 'Party name is required'),
  contact_name: z.string().optional(),
  phone: z.string().optional(),
  bank_name: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean(),
})

type PartyFormData = z.infer<typeof partySchema>

interface PartyFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  party?: Party | null
  onSubmit: (data: PartyFormData) => Promise<void>
}

export function PartyForm({ open, onOpenChange, party, onSubmit }: PartyFormProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, watch, setValue } = useForm<PartyFormData>({
    resolver: zodResolver(partySchema),
    defaultValues: party
      ? {
          name: party.name,
          contact_name: party.contact_name ?? '',
          phone: party.phone ?? '',
          bank_name: party.bank_name ?? '',
          notes: party.notes ?? '',
          is_active: party.is_active,
        }
      : { is_active: true },
  })

  const isActive = watch('is_active')

  const handleFormSubmit = async (data: PartyFormData) => {
    await onSubmit(data)
    reset()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{party ? 'Edit Party' : 'Add Party'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="name">Party Name *</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="contact_name">Contact Person</Label>
            <Input id="contact_name" {...register('contact_name')} />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...register('phone')} />
          </div>
          <div>
            <Label htmlFor="bank_name">Bank Name</Label>
            <Input id="bank_name" {...register('bank_name')} />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register('notes')} rows={3} />
          </div>
          {party && (
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={(v) => setValue('is_active', v)} />
              <Label>Active</Label>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : party ? 'Update Party' : 'Add Party'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
