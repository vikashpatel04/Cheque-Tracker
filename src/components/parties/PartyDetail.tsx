import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Party, Cheque, ChequeStatus } from '@/types'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { useSettings } from '@/hooks/useSettings'
import { StatusPill } from '@/components/shared/StatusPill'
import { PartyForm } from './PartyForm'
import { useParties } from '@/hooks/useParties'

export function PartyDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currencySymbol } = useSettings()
  const { updateParty, softDeleteParty } = useParties(true)
  const [party, setParty] = useState<Party | null>(null)
  const [cheques, setCheques] = useState<Cheque[]>([])
  const [statusFilter, setStatusFilter] = useState<ChequeStatus | 'ALL'>('ALL')
  const [formOpen, setFormOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    supabase.from('parties').select('*').eq('id', id).single().then(({ data }) => {
      if (data) setParty(data)
    })
    supabase
      .from('cheques')
      .select('*')
      .eq('party_id', id)
      .is('deleted_at', null)
      .order('due_date')
      .then(({ data }) => {
        if (data) setCheques(data)
      })
  }, [id])

  if (!party) return <p className="text-muted-foreground">Loading...</p>

  const filtered = statusFilter === 'ALL' ? cheques : cheques.filter((c) => c.status === statusFilter)

  const totalIssued = cheques.reduce((s, c) => s + Number(c.amount), 0)
  const totalCleared = cheques.filter((c) => c.status === 'PASSED').reduce((s, c) => s + Number(c.amount), 0)
  const totalOutstanding = cheques
    .filter((c) => ['PENDING', 'DEPOSITED'].includes(c.status))
    .reduce((s, c) => s + Number(c.amount), 0)
  const totalReturned = cheques.filter((c) => c.status === 'RETURNED').reduce((s, c) => s + Number(c.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/parties')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-2xl font-bold">{party.name}</h2>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Party Info</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
            <Edit className="h-4 w-4 mr-1" /> Edit
          </Button>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 text-sm">
          <p><span className="text-muted-foreground">Contact:</span> {party.contact_name ?? '—'}</p>
          <p><span className="text-muted-foreground">Phone:</span> {party.phone ?? '—'}</p>
          <p><span className="text-muted-foreground">Bank:</span> {party.bank_name ?? '—'}</p>
          <p><span className="text-muted-foreground">Notes:</span> {party.notes ?? '—'}</p>
          <div className="flex items-center gap-2">
            <Switch
              checked={party.is_active}
              onCheckedChange={async (v) => {
                await updateParty(party.id, { is_active: v })
                setParty({ ...party, is_active: v })
              }}
            />
            <Label>Active</Label>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Issued', value: totalIssued },
          { label: 'Total Cleared', value: totalCleared },
          { label: 'Outstanding', value: totalOutstanding },
          { label: 'Returned', value: totalReturned },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold">{formatCurrency(value, currencySymbol)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['ALL', 'PENDING', 'DEPOSITED', 'PASSED', 'RETURNED', 'CANCELLED'] as const).map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-3">Cheque No.</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Due Date</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b">
                    <td className="p-3">{c.cheque_number}</td>
                    <td className="p-3">{formatCurrency(Number(c.amount), currencySymbol)}</td>
                    <td className="p-3">{formatDate(c.due_date)}</td>
                    <td className="p-3"><StatusPill status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <PartyForm
        open={formOpen}
        onOpenChange={setFormOpen}
        party={party}
        onSubmit={async (data) => {
          const result = await updateParty(party.id, {
            name: data.name,
            contact_name: data.contact_name || null,
            phone: data.phone || null,
            bank_name: data.bank_name || null,
            notes: data.notes || null,
            is_active: data.is_active,
          })
          if (result.error) {
            toast.error(result.error)
            return
          }
          toast.success('Party updated')
          setParty({ ...party, ...data, contact_name: data.contact_name || null, phone: data.phone || null, bank_name: data.bank_name || null, notes: data.notes || null })
        }}
        onDelete={async () => {
          const result = await softDeleteParty(party.id)
          if (result.error) {
            toast.error(result.error)
            throw new Error(result.error)
          }
          toast.success(`${party.name} deleted`)
          navigate('/parties')
        }}
      />
    </div>
  )
}
