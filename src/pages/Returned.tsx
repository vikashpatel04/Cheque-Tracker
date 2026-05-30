import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { useSettings } from '@/hooks/useSettings'
import { ChequeForm } from '@/components/cheques/ChequeForm'
import { useCheques } from '@/hooks/useCheques'
import type { Cheque } from '@/types'

export default function Returned() {
  const { currencySymbol } = useSettings()
  const { createCheque } = useCheques({ status: ['RETURNED'] })
  const [cheques, setCheques] = useState<Cheque[]>([])
  const [partyFilter, setPartyFilter] = useState('')
  const [rePresentCheque, setRePresentCheque] = useState<Cheque | null>(null)

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

  const handleWriteOff = async (cheque: Cheque) => {
    const note = prompt('Write-off note:')
    if (!note) return
    await supabase
      .from('cheques')
      .update({ notes: `[WRITTEN OFF] ${note}` })
      .eq('id', cheque.id)
    setCheques((prev) =>
      prev.map((c) => (c.id === cheque.id ? { ...c, notes: `[WRITTEN OFF] ${note}` } : c))
    )
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
                  <Button size="sm" variant="outline" onClick={() => handleWriteOff(c)}>Write Off</Button>
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
    </div>
  )
}
