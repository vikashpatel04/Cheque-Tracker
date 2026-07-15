import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/formatters'
import { useSettings } from '@/hooks/useSettings'
import { StatusPill } from '@/components/shared/StatusPill'
import { DaysUntilDue } from '@/components/shared/DaysUntilDue'
import { Skeleton } from '@/components/ui/skeleton'
import { extractTags, stripTagLines, TAG_LABELS, TAG_CLASSES } from '@/lib/chequeTags'
import { RePresentDrawer } from './RePresentDrawer'
import { ChequeStatusActions } from './StatusActions'
import type { Cheque, ChequeHistory } from '@/types'
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

  // Re-present drawer state
  const [rePresentOpen, setRePresentOpen] = useState(false)

  // Write-off dialog state
  const [writeOffOpen, setWriteOffOpen] = useState(false)
  const [writeOffNote, setWriteOffNote] = useState('')
  const [writeOffSubmitting, setWriteOffSubmitting] = useState(false)

  // Delete confirmation state — replaces native confirm()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleConfirmWriteOff = async () => {
    if (!cheque) return
    const note = writeOffNote.trim()
    if (!note) return
    setWriteOffSubmitting(true)
    const existingNotes = cheque.notes ?? ''
    const updatedNotes = existingNotes.includes('[WRITTEN_OFF]')
      ? existingNotes
      : ['[WRITTEN_OFF]', note, stripTagLines(existingNotes)].filter(Boolean).join('\n')
    const { error } = await supabase.from('cheques').update({ notes: updatedNotes }).eq('id', cheque.id)
    setWriteOffSubmitting(false)
    if (error) { toast.error('Failed to write off cheque'); return }
    toast.success('Cheque written off')
    setWriteOffOpen(false)
    setWriteOffNote('')
    setCheque({ ...cheque, notes: updatedNotes })
    onRefresh()
  }

  useEffect(() => {
    if (!open) {
      setCheque(null)
      setHistory([])
      setRePresentOpen(false)
      setWriteOffOpen(false)
      setWriteOffNote('')
      setDeleteOpen(false)
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

  const handleDelete = async () => {
    if (!cheque) return
    setDeleting(true)
    await supabase
      .from('cheques')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', cheque.id)
    setDeleting(false)
    setDeleteOpen(false)
    toast.success('Cheque deleted')
    onRefresh()
    onOpenChange(false)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{cheque ? `Cheque #${cheque.cheque_number}` : 'Cheque Details'}</SheetTitle>
          </SheetHeader>
          {!cheque ? (
            <div className="mt-6 space-y-4">
              <div className="flex justify-between">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-24" />
              </div>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <StatusPill status={cheque.status} />
                <DaysUntilDue dueDate={cheque.due_date} status={cheque.status} />
              </div>
              {extractTags(cheque.notes).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {extractTags(cheque.notes).map((tag) => (
                    <span key={tag} className={`text-xs font-medium px-2 py-0.5 rounded-full ${TAG_CLASSES[tag]}`}>
                      {TAG_LABELS[tag]}
                    </span>
                  ))}
                </div>
              )}
              <div className="grid gap-2">
                <p><span className="text-muted-foreground">Party:</span> {cheque.party?.name}</p>
                <p><span className="text-muted-foreground">Bank:</span> {cheque.bank_name}</p>
                <p><span className="text-muted-foreground">Amount:</span> {formatCurrency(Number(cheque.amount), currencySymbol)}</p>
                <p><span className="text-muted-foreground">Issue Date:</span> {formatDate(cheque.issue_date)}</p>
                <p><span className="text-muted-foreground">Due Date:</span> {formatDate(cheque.due_date)}</p>
                {cheque.return_reason && (
                  <p><span className="text-muted-foreground">Return Reason:</span> {cheque.return_reason}</p>
                )}
                {stripTagLines(cheque.notes) && (
                  <p><span className="text-muted-foreground">Notes:</span> {stripTagLines(cheque.notes)}</p>
                )}
              </div>

              <ChequeStatusActions
                cheque={cheque}
                onChanged={() => { onRefresh(); onOpenChange(false) }}
              />


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

              {cheque.status === 'RETURNED' && (() => {
                const tags = extractTags(cheque.notes)
                const isWrittenOff = tags.includes('WRITTEN_OFF')
                const isRePresentedTag = tags.includes('RE_PRESENTED')
                return !isWrittenOff && !isRePresentedTag ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setRePresentOpen(true)}>Re-present</Button>
                    <Button size="sm" variant="outline" onClick={() => { setWriteOffNote(''); setWriteOffOpen(true) }}>Write Off</Button>
                  </div>
                ) : null
              })()}

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => onEdit(cheque)}>Edit</Button>
                <Button variant="destructive" onClick={() => setDeleteOpen(true)}>Delete</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Re-present drawer */}
      <RePresentDrawer
        cheque={cheque}
        open={rePresentOpen}
        onOpenChange={(o) => setRePresentOpen(o)}
        onSuccess={() => { setRePresentOpen(false); onRefresh(); onOpenChange(false) }}
      />

      {/* Write-off dialog */}
      <Dialog open={writeOffOpen} onOpenChange={(o) => { if (writeOffSubmitting) return; if (!o) { setWriteOffOpen(false); setWriteOffNote('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Write off cheque {cheque ? `#${cheque.cheque_number}` : ''}</DialogTitle>
            <DialogDescription>
              Add a write-off reason. The cheque will be tagged as <span className="font-medium">Written Off</span> and actions will be disabled.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="detail-writeoff-note">Reason *</Label>
            <Textarea
              id="detail-writeoff-note"
              value={writeOffNote}
              onChange={(e) => setWriteOffNote(e.target.value)}
              placeholder="e.g. Party closed business, marked unrecoverable..."
              rows={3}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setWriteOffOpen(false); setWriteOffNote('') }} disabled={writeOffSubmitting}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmWriteOff} disabled={!writeOffNote.trim() || writeOffSubmitting}>
              {writeOffSubmitting ? 'Saving...' : 'Write Off'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={(o) => !deleting && setDeleteOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete cheque #{cheque?.cheque_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This soft-deletes the cheque. Its history is preserved, but it will no
              longer appear in lists, calendars, or reports.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
