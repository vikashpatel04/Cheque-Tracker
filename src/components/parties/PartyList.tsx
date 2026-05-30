import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Upload, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { useParties } from '@/hooks/useParties'
import { useCheques } from '@/hooks/useCheques'
import { formatCurrency } from '@/lib/formatters'
import { useSettings } from '@/hooks/useSettings'
import { PartyForm } from './PartyForm'
import { PartyBulkUpload } from './BulkUpload'

export function PartyList() {
  const navigate = useNavigate()
  const [showInactive, setShowInactive] = useState(false)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const { parties, loading, createParty, fetchParties } = useParties(showInactive)
  const { cheques } = useCheques()
  const { currencySymbol } = useSettings()

  const filtered = parties.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const getPartyStats = (partyId: string) => {
    const partyCheques = cheques.filter(
      (c) => c.party_id === partyId && ['PENDING', 'DEPOSITED'].includes(c.status)
    )
    return {
      count: partyCheques.length,
      outstanding: partyCheques.reduce((s, c) => s + Number(c.amount), 0),
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search parties..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} id="inactive" />
            <Label htmlFor="inactive" className="text-sm">Show inactive</Label>
          </div>
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Upload className="h-4 w-4 mr-1" /> Bulk Upload
          </Button>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Party
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium">Contact</th>
                  <th className="p-3 font-medium">Phone</th>
                  <th className="p-3 font-medium">Bank</th>
                  <th className="p-3 font-medium text-right">Active Cheques</th>
                  <th className="p-3 font-medium text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No parties found</td></tr>
                ) : (
                  filtered.map((party) => {
                    const stats = getPartyStats(party.id)
                    return (
                      <tr
                        key={party.id}
                        className="border-b cursor-pointer hover:bg-muted/30"
                        onClick={() => navigate(`/parties/${party.id}`)}
                      >
                        <td className="p-3 font-medium">
                          {party.name}
                          {!party.is_active && (
                            <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>
                          )}
                        </td>
                        <td className="p-3">{party.contact_name ?? '—'}</td>
                        <td className="p-3">{party.phone ?? '—'}</td>
                        <td className="p-3">{party.bank_name ?? '—'}</td>
                        <td className="p-3 text-right">{stats.count}</td>
                        <td className="p-3 text-right">{formatCurrency(stats.outstanding, currencySymbol)}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <PartyForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={async (data) => {
          await createParty({
            name: data.name,
            contact_name: data.contact_name || null,
            phone: data.phone || null,
            bank_name: data.bank_name || null,
            notes: data.notes || null,
            is_active: true,
          })
        }}
      />

      <PartyBulkUpload open={bulkOpen} onOpenChange={setBulkOpen} onComplete={fetchParties} />
    </div>
  )
}
