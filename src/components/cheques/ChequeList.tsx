import { useState, useMemo } from 'react'
import { Plus, Upload, Search, Download, FileText, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCheques } from '@/hooks/useCheques'
import { useParties } from '@/hooks/useParties'
import { useSettings } from '@/hooks/useSettings'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { exportChequesToPDF, exportChequesToExcel } from '@/lib/exportUtils'
import { StatusPill } from '@/components/shared/StatusPill'
import { DaysUntilDue } from '@/components/shared/DaysUntilDue'
import { ChequeForm } from './ChequeForm'
import { ChequeDetail } from './ChequeDetail'
import { ChequeBulkUpload } from './BulkUpload'
import type { Cheque, ChequeStatus } from '@/types'

const ALL_STATUSES: ChequeStatus[] = ['PENDING', 'DEPOSITED', 'PASSED', 'RETURNED', 'CANCELLED']

export function ChequeList() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ChequeStatus[]>([])
  const [partyFilter, setPartyFilter] = useState('')
  const [bankFilter, setBankFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [editCheque, setEditCheque] = useState<Cheque | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  const filters = useMemo(
    () => ({
      status: statusFilter.length ? statusFilter : undefined,
      partyId: partyFilter || undefined,
      bank: bankFilter || undefined,
      search: search || undefined,
    }),
    [statusFilter, partyFilter, bankFilter, search]
  )

  const { cheques, loading, createCheque, updateCheque, fetchCheques } = useCheques(filters)
  const { parties } = useParties()
  const { currencySymbol } = useSettings()

  const toggleStatus = (status: ChequeStatus) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search cheque or party..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => exportChequesToPDF(cheques, 'Cheques Export', currencySymbol)}>
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportChequesToExcel(cheques, 'cheques_export')}>
            <Download className="h-4 w-4 mr-1" /> Excel
          </Button>
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Upload className="h-4 w-4 mr-1" /> Bulk Upload
          </Button>
          <Button onClick={() => { setEditCheque(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Add Cheque
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {ALL_STATUSES.map((s) => (
          <Button key={s} size="sm" variant={statusFilter.includes(s) ? 'default' : 'outline'} onClick={() => toggleStatus(s)}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </Button>
        ))}
        <Select value={partyFilter || 'all'} onValueChange={(v) => setPartyFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All parties" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All parties</SelectItem>
            {parties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="Bank filter" value={bankFilter} onChange={(e) => setBankFilter(e.target.value)} className="w-40" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-3">Cheque No.</th>
                  <th className="p-3">Party</th>
                  <th className="p-3">Bank</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3">Issue Date</th>
                  <th className="p-3">Due Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Days Until Due</th>
                  <th className="p-3 w-12"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Loading...</td></tr>
                ) : cheques.length === 0 ? (
                  <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">No cheques found</td></tr>
                ) : (
                  cheques.map((c) => (
                    <tr key={c.id} className="border-b cursor-pointer hover:bg-muted/30" onClick={() => setDetailId(c.id)}>
                      <td className="p-3 font-medium">{c.cheque_number}</td>
                      <td className="p-3">{c.party?.name}</td>
                      <td className="p-3">{c.bank_name}</td>
                      <td className="p-3 text-right">{formatCurrency(Number(c.amount), currencySymbol)}</td>
                      <td className="p-3">{formatDate(c.issue_date)}</td>
                      <td className="p-3">{formatDate(c.due_date)}</td>
                      <td className="p-3"><StatusPill status={c.status} /></td>
                      <td className="p-3"><DaysUntilDue dueDate={c.due_date} status={c.status} /></td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={`Edit cheque ${c.cheque_number}`}
                          onClick={() => { setEditCheque(c); setFormOpen(true) }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ChequeForm
        open={formOpen || !!editCheque}
        onOpenChange={(o) => { if (!o) { setFormOpen(false); setEditCheque(null) } }}
        cheque={editCheque}
        onSubmit={async (data) => {
          if (editCheque) {
            await updateCheque(editCheque.id, data)
          } else {
            await createCheque(data)
          }
          fetchCheques()
        }}
        onStatusChange={fetchCheques}
      />

      <ChequeDetail
        chequeId={detailId}
        open={!!detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
        onEdit={(c) => { setDetailId(null); setEditCheque(c); setFormOpen(true) }}
        onRefresh={fetchCheques}
      />

      <ChequeBulkUpload open={bulkOpen} onOpenChange={setBulkOpen} onComplete={fetchCheques} />
    </div>
  )
}
