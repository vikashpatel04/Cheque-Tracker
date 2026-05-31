import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { useSettings } from '@/hooks/useSettings'
import { ChequeForm } from '@/components/cheques/ChequeForm'
import { useCheques } from '@/hooks/useCheques'
import { toast } from 'sonner'
import type { Cheque } from '@/types'

export default function Returned() {
  const { currencySymbol } = useSettings()
  const { createCheque } = useCheques({ status: ['RETURNED'] })
  const [cheques, setCheques] = useState<Cheque[]>([])
  const [partyFilter, setPartyFilter] = useState('')
  const [rePresentCheque, setRePresentCheque] = useState<Cheque | null>(null)
  const [writeOffCheque, setWriteOffCheque] = useState<Cheque | null>(null)
  const [writeOffNote, setWriteOffNote] = useState('')
  const [writeOffSubmitting, setWriteOffSubmitting] = useState(false)

  useEffect(() => {
    let query = supabase
      .from('cheques')
      .select('*, party:parties(*)')
      .eq('status', 'RETURNED')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })

    query.then(({ data }) => {
      if (data) setCheques(data as Cheque[])
    })
  }, [])

  const filtered = partyFilter
    ? cheques.filter((c) => c.party?.name?.toLowerCase().includes(partyFilter.toLowerCase()))
    : cheques

  const totalReturned = filtered.reduce((s, c) => s + Number(c.amount), 0)

  const openWriteOff = (cheque: Cheque) => {
    setWriteOffCheque(cheque)
    setWriteOffNote('')
  }

  const handleConfirmWriteOff = async () => {
    if (!writeOffCheque) return
    const note = writeOffNote.trim()
    if (!note) return
    setWriteOffSubmitting(true)
    const { error } = await supabase
      .from('cheques')
      .update({ notes: `[WRITTEN OFF] ${note}` })
      .eq('id', writeOffCheque.id)
    setWriteOffSubmitting(false)
    if (error) {
      toast.error('Failed to write off cheque')
      return
    }
    setCheques((prev) =>
      prev.map((c) => (c.id === writeOffCheque.id ? { ...c, notes: `[WRITTEN OFF] ${note}` } : c))
    )
    toast.success('Cheque written off')
    setWriteOffCheque(null)
    setWriteOffNote('')
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Returned Cheques</h2>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-4 items-center">
          <div>
            <p className="text-xs text-muted-foreground">Total Returned</p>
            <p className="text-xl font-semibold">{formatCurrency(totalReturned, currencySymbol)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Count</p>
            <p className="text-xl font-semibold">{filtered.length}</p>
          </div>
          <Input
            placeholder="Filter by party..."
            value={partyFilter}
            onChange={(e) => setPartyFilter(e.target.value)}
            className="max-w-xs ml-auto"
          />
        </CardContent>
      </Card>

      <div className="space-y-3">
        {filtered.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{c.party?.name} · #{c.cheque_number}</p>
                  <p className="text-lg font-semibold">{formatCurrency(Number(c.amount), currencySymbol)}</p>
                  <p className="text-sm text-muted-foreground">Due: {formatDate(c.due_date)}</p>
                  {c.return_reason && (
                    <p className="text-sm text-destructive mt-1">Reason: {c.return_reason}</p>
                  )}
                  {c.notes?.startsWith('[WRITTEN OFF]') && (
                    <p className="text-sm text-muted-foreground mt-1">{c.notes}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setRePresentCheque(c)}>Re-present</Button>
                  <Button size="sm" variant="outline" onClick={() => openWriteOff(c)}>Write Off</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {rePresentCheque && (
        <ChequeForm
          open
          onOpenChange={(o) => !o && setRePresentCheque(null)}
          prefill={{
            party_id: rePresentCheque.party_id,
            bank_name: rePresentCheque.bank_name,
            amount: Number(rePresentCheque.amount),
          }}
          onSubmit={async (data) => {
            const result = await createCheque(data)
            if (!result.error) {
              await supabase
                .from('cheques')
                .update({ notes: `${rePresentCheque.notes ?? ''}\nRe-presented as new cheque`.trim() })
                .eq('id', rePresentCheque.id)
            }
            setRePresentCheque(null)
          }}
        />
      )}

      <Dialog
        open={!!writeOffCheque}
        onOpenChange={(o) => {
          if (writeOffSubmitting) return
          if (!o) {
            setWriteOffCheque(null)
            setWriteOffNote('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Write off cheque {writeOffCheque ? `#${writeOffCheque.cheque_number}` : ''}</DialogTitle>
            <DialogDescription>
              Add a write-off note. This will be saved to the cheque's notes and prefixed with
              <span className="font-medium"> [WRITTEN OFF]</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="writeoff-note">Note</Label>
            <Textarea
              id="writeoff-note"
              value={writeOffNote}
              onChange={(e) => setWriteOffNote(e.target.value)}
              placeholder="e.g. Party closed business, marked unrecoverable..."
              rows={3}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setWriteOffCheque(null)
                setWriteOffNote('')
              }}
              disabled={writeOffSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmWriteOff}
              disabled={!writeOffNote.trim() || writeOffSubmitting}
            >
              {writeOffSubmitting ? 'Saving...' : 'Write Off'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
