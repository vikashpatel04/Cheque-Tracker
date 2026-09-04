import { useState, useMemo } from 'react'
import { Plus, Upload, Search, Download, FileText, Pencil, ArrowUp, ArrowDown, MoreVertical, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { useCheques } from '@/hooks/useCheques'
import { useParties } from '@/hooks/useParties'
import { useSettings } from '@/hooks/useSettings'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { exportChequesToPDF, exportChequesToExcel } from '@/lib/exportUtils'
import { extractTags, TAG_LABELS, TAG_CLASSES } from '@/lib/chequeTags'
import { StatusPill } from '@/components/shared/StatusPill'
import { DaysUntilDue } from '@/components/shared/DaysUntilDue'
import { ChequeForm } from './ChequeForm'
import { ChequeDetail } from './ChequeDetail'
import { ChequeBulkUpload } from './BulkUpload'
import { useChequeStatusActions, STATUS_ACTION_META, canChainDepositedAndPassed } from './StatusActions'
import type { Cheque, ChequeStatus } from '@/types'
import { VALID_STATUS_TRANSITIONS } from '@/types'

const ALL_STATUSES: ChequeStatus[] = ['PENDING', 'DEPOSITED', 'PASSED', 'RETURNED', 'CANCELLED']

type SortKey = 'due_date' | 'issue_date' | 'amount' | 'party_name'
type SortDir = 'asc' | 'desc'

export function ChequeList() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ChequeStatus[]>([])
  const [partyFilter, setPartyFilter] = useState('')
  const [bankFilter, setBankFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('due_date')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
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

  const { cheques: rawCheques, loading, createCheque, updateCheque, fetchCheques } = useCheques(filters)
  const { parties } = useParties()
  const { currencySymbol } = useSettings()
  const { requestStatus, requestChained, submitting: statusSubmitting, returnDialog } =
    useChequeStatusActions(fetchCheques)

  const cheques = useMemo(() => {
    return [...rawCheques].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'due_date') cmp = a.due_date.localeCompare(b.due_date)
      else if (sortKey === 'issue_date') cmp = a.issue_date.localeCompare(b.issue_date)
      else if (sortKey === 'amount') cmp = Number(a.amount) - Number(b.amount)
      else if (sortKey === 'party_name') cmp = (a.party?.name ?? '').localeCompare(b.party?.name ?? '')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rawCheques, sortKey, sortDir])

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
            <Upload className="h-4 w-4 mr-1" /> Excel Upload
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/bulk-add'}>
            <Plus className="h-4 w-4 mr-1" /> Bulk Add
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
        <div className="flex items-center gap-1 ml-auto">
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="due_date">Due Date</SelectItem>
              <SelectItem value="issue_date">Issue Date</SelectItem>
              <SelectItem value="amount">Amount</SelectItem>
              <SelectItem value="party_name">Party Name</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')}
            aria-label={sortDir === 'asc' ? 'Sort descending' : 'Sort ascending'}
          >
            {sortDir === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </Button>
        </div>
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
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="p-3"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="p-3"><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell className="p-3"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="p-3 text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell className="p-3"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="p-3"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="p-3"><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell className="p-3"><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell className="p-3"><Skeleton className="h-8 w-8 rounded" /></TableCell>
                  </TableRow>
                ))
              ) : cheques.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="p-6 text-center text-muted-foreground">No cheques found</TableCell>
                </TableRow>
              ) : (
                cheques.map((c) => {
                  const tags = extractTags(c.notes)
                  return (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => setDetailId(c.id)}>
                    <TableCell className="p-3 font-medium">{c.cheque_number}</TableCell>
                    <TableCell className="p-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <span>{c.party?.name}</span>
                        {tags.map((tag) => (
                          <span key={tag} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TAG_CLASSES[tag]}`}>
                            {TAG_LABELS[tag]}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="p-3">{c.bank_name}</TableCell>
                    <TableCell className="p-3 text-right">{formatCurrency(Number(c.amount), currencySymbol)}</TableCell>
                    <TableCell className="p-3">{formatDate(c.issue_date)}</TableCell>
                    <TableCell className="p-3">{formatDate(c.due_date)}</TableCell>
                    <TableCell className="p-3"><StatusPill status={c.status} /></TableCell>
                    <TableCell className="p-3"><DaysUntilDue dueDate={c.due_date} status={c.status} /></TableCell>
                    <TableCell className="p-3" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Actions for cheque ${c.cheque_number}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          {VALID_STATUS_TRANSITIONS[c.status].length > 0 && (
                            <>
                              <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Update status
                              </DropdownMenuLabel>
                              {VALID_STATUS_TRANSITIONS[c.status].map((s) => {
                                const { label, Icon, tone } = STATUS_ACTION_META[s]
                                return (
                                  <DropdownMenuItem
                                    key={s}
                                    disabled={statusSubmitting}
                                    onSelect={() => requestStatus(c, s)}
                                    className={tone}
                                  >
                                    <Icon className="h-4 w-4" />
                                    Mark {label}
                                  </DropdownMenuItem>
                                )
                              })}
                              {canChainDepositedAndPassed(c.status) && (
                                <DropdownMenuItem
                                  disabled={statusSubmitting}
                                  onSelect={() => requestChained(c)}
                                  className="font-medium"
                                >
                                  <CheckCheck className="h-4 w-4" />
                                  Mark Deposited &amp; Passed
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem onSelect={() => { setEditCheque(c); setFormOpen(true) }}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  )
                })
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

      {returnDialog}
    </div>
  )
}
