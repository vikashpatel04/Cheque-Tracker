import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Plus,
  Search,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { useParties } from '@/hooks/useParties'
import { useCheques } from '@/hooks/useCheques'
import { formatCurrency } from '@/lib/formatters'
import { useSettings } from '@/hooks/useSettings'
import { cn } from '@/lib/utils'
import { PartyForm } from './PartyForm'
import { PartyBulkUpload } from './BulkUpload'

type SortKey = 'name' | 'count' | 'outstanding'
type SortDir = 'asc' | 'desc'

// Default direction when a column is first selected.
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  name: 'asc',
  count: 'desc',
  outstanding: 'desc',
}

export function PartyList() {
  const navigate = useNavigate()
  const [showInactive, setShowInactive] = useState(false)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { parties, loading, createParty, fetchParties } = useParties(showInactive)
  const { cheques } = useCheques()
  const { currencySymbol } = useSettings()

  // Pre-compute stats per party once, then filter + sort
  const rows = useMemo(() => {
    const statsByParty: Record<string, { count: number; outstanding: number }> = {}
    cheques.forEach((c) => {
      if (!['PENDING', 'DEPOSITED'].includes(c.status)) return
      const s = (statsByParty[c.party_id] ??= { count: 0, outstanding: 0 })
      s.count += 1
      s.outstanding += Number(c.amount)
    })

    const term = search.trim().toLowerCase()
    const filtered = parties.filter((p) =>
      term === '' ? true : p.name.toLowerCase().includes(term)
    )

    const sorted = [...filtered].sort((a, b) => {
      const aStats = statsByParty[a.id] ?? { count: 0, outstanding: 0 }
      const bStats = statsByParty[b.id] ?? { count: 0, outstanding: 0 }

      let cmp = 0
      if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      } else if (sortKey === 'count') {
        cmp = aStats.count - bStats.count
      } else {
        cmp = aStats.outstanding - bStats.outstanding
      }
      // Name as the tiebreaker so the order is stable
      if (cmp === 0 && sortKey !== 'name') {
        cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return sorted.map((p) => ({
      ...p,
      stats: statsByParty[p.id] ?? { count: 0, outstanding: 0 },
    }))
  }, [parties, cheques, search, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(DEFAULT_DIR[key])
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
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} id="inactive" />
            <Label htmlFor="inactive" className="text-sm">
              Show inactive
            </Label>
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
                  <SortableTh
                    label="Name"
                    column="name"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onClick={toggleSort}
                  />
                  <th className="p-3 font-medium">Contact</th>
                  <th className="p-3 font-medium">Phone</th>
                  <th className="p-3 font-medium">Bank</th>
                  <SortableTh
                    label="Active Cheques"
                    column="count"
                    align="right"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onClick={toggleSort}
                  />
                  <SortableTh
                    label="Outstanding"
                    column="outstanding"
                    align="right"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onClick={toggleSort}
                  />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No parties found
                    </td>
                  </tr>
                ) : (
                  rows.map((party) => (
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
                      <td className="p-3 text-right tabular-nums">{party.stats.count}</td>
                      <td className="p-3 text-right tabular-nums">
                        {formatCurrency(party.stats.outstanding, currencySymbol)}
                      </td>
                    </tr>
                  ))
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

/* ---------- Sortable column header ---------- */

interface SortableThProps {
  label: string
  column: SortKey
  align?: 'left' | 'right'
  sortKey: SortKey
  sortDir: SortDir
  onClick: (column: SortKey) => void
}

function SortableTh({ label, column, align = 'left', sortKey, sortDir, onClick }: SortableThProps) {
  const active = sortKey === column
  const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown

  return (
    <th className={cn('p-0 font-medium', align === 'right' && 'text-right')}>
      <button
        type="button"
        onClick={() => onClick(column)}
        aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={cn(
          'group flex w-full items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors',
          'hover:bg-muted/70',
          align === 'right' && 'justify-end',
          active && 'text-foreground'
        )}
      >
        <span>{label}</span>
        <Icon
          className={cn(
            'h-3.5 w-3.5 transition-opacity',
            active ? 'opacity-100' : 'opacity-40 group-hover:opacity-80'
          )}
        />
      </button>
    </th>
  )
}
