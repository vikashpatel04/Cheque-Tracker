import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
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
import { RePresentDrawer } from '@/components/cheques/RePresentDrawer'
import { extractTags, stripTagLines, TAG_LABELS, TAG_CLASSES } from '@/lib/chequeTags'
import { toast } from 'sonner'
import type { Cheque } from '@/types'

export default function Returned() {
  const { currencySymbol } = useSettings()
  const [cheques, setCheques] = useState<Cheque[]>([])
  const [loading, setLoading] = useState(true)
  const [partyFilter, setPartyFilter] = useState('')
  const [rePresentCheque, setRePresentCheque] = useState<Cheque | null>(null)
  const [writeOffCheque, setWriteOffCheque] = useState<Cheque | null>(null)
  const [writeOffNote, setWriteOffNote] = useState('')
  const [writeOffSubmitting, setWriteOffSubmitting] = useState(false)

  const fetchCheques = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('cheques')
      .select('*, party:parties(*)')
      .eq('status', 'RETURNED')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
    if (data) setCheques(data as Cheque[])
    setLoading(false)
  }

  useEffect(() => {
    fetchCheques()
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

    const existingNotes = writeOffCheque.notes ?? ''
    const alreadyTagged = existingNotes.includes('[WRITTEN_OFF]')
    const updatedNotes = alreadyTagged
      ? existingNotes
      : ['[WRITTEN_OFF]', note, stripTagLines(existingNotes)].filter(Boolean).join('\n')

    const { error } = await supabase
      .from('cheques')
      .update({ notes: updatedNotes })
      .eq('id', writeOffCheque.id)

    setWriteOffSubmitting(false)
    if (error) {
      toast.error('Failed to write off cheque')
      return
    }
    setCheques((prev) =>
      prev.map((c) => (c.id === writeOffCheque.id ? { ...c, notes: updatedNotes } : c))
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
          {loading ? (
            <>
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-16" />
              <Skeleton className="h-9 w-48 ml-auto" />
            </>
          ) : (
            <>
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
            </>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">No returned cheques</p>
        ) : (
          filtered.map((c) => {
            const tags = extractTags(c.notes)
            const visibleNotes = stripTagLines(c.notes)
            const isWrittenOff = tags.includes('WRITTEN_OFF')
            const isRePresentedTag = tags.includes('RE_PRESENTED')

            return (
              <Card key={c.id} className={isWrittenOff ? 'opacity-70' : ''}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-medium">{c.party?.name} · #{c.cheque_number}</p>
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${TAG_CLASSES[tag]}`}
                          >
                            {TAG_LABELS[tag]}
                          </span>
                        ))}
                      </div>
                      <p className="text-lg font-semibold">{formatCurrency(Number(c.amount), currencySymbol)}</p>
                      <p className="text-sm text-muted-foreground">Due: {formatDate(c.due_date)}</p>
                      {c.return_reason && (
                        <p className="text-sm text-destructive mt-1">Reason: {c.return_reason}</p>
                      )}
                      {visibleNotes && (
                        <p className="text-sm text-muted-foreground mt-1">{visibleNotes}</p>
                      )}
                    </div>
                    {!isWrittenOff && !isRePresentedTag && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => setRePresentCheque(c)}>Re-present</Button>
                        <Button size="sm" variant="outline" onClick={() => openWriteOff(c)}>Write Off</Button>
                      </div>
                    )}
                    {isWrittenOff && (
                      <p className="text-xs text-muted-foreground italic">Written off</p>
                    )}
                    {isRePresentedTag && !isWrittenOff && (
                      <p className="text-xs text-muted-foreground italic">Re-presented</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <RePresentDrawer
        cheque={rePresentCheque}
        open={!!rePresentCheque}
        onOpenChange={(o) => !o && setRePresentCheque(null)}
        onSuccess={fetchCheques}
      />

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
              Add a write-off reason. The cheque will be tagged as{' '}
              <span className="font-medium">Written Off</span> and actions will be disabled.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="writeoff-note">Reason *</Label>
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
              variant="destructive"
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
