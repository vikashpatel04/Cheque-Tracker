import { useState, useMemo } from 'react'
import { Plus, Upload, Search, Download, FileText, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="p-3 text-foreground">Cheque No.</TableHead>
                <TableHead className="p-3 text-foreground">Party</TableHead>
                <TableHead className="p-3 text-foreground">Bank</TableHead>
                <TableHead className="p-3 text-right text-foreground">Amount</TableHead>
                <TableHead className="p-3 text-foreground">Issue Date</TableHead>
                <TableHead className="p-3 text-foreground">Due Date</TableHead>
                <TableHead className="p-3 text-foreground">Status</TableHead>
                <TableHead className="p-3 text-foreground">Days Until Due</TableHead>
                <TableHead className="p-3 w-12"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="p-6 text-center text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : cheques.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="p-6 text-center text-muted-foreground">No cheques found</TableCell>
                </TableRow>
              ) : (
                cheques.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => setDetailId(c.id)}>
                    <TableCell className="p-3 font-medium">{c.cheque_number}</TableCell>
                    <TableCell className="p-3">{c.party?.name}</TableCell>
                    <TableCell className="p-3">{c.bank_name}</TableCell>
                    <TableCell className="p-3 text-right">{formatCurrency(Number(c.amount), currencySymbol)}</TableCell>
                    <TableCell className="p-3">{formatDate(c.issue_date)}</TableCell>
                    <TableCell className="p-3">{formatDate(c.due_date)}</TableCell>
                    <TableCell className="p-3"><StatusPill status={c.status} /></TableCell>
                    <TableCell className="p-3"><DaysUntilDue dueDate={c.due_date} status={c.status} /></TableCell>
                    <TableCell className="p-3" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Edit cheque ${c.cheque_number}`}
                        onClick={() => { setEditCheque(c); setFormOpen(true) }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
