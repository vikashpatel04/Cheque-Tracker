import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import { useParties } from '@/hooks/useParties'
import { useSettings } from '@/hooks/useSettings'
import { useCheques } from '@/hooks/useCheques'
import { todayISO, formatAmountInput, parseAmount, nextChequeNumber } from '@/lib/formatters'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface BulkRow {
  id: string
  party_id: string
  cheque_number: string
  bank_name: string
  amount: string
  issue_date: string
  due_date: string
  notes: string
}

export default function BulkAdd() {
  const navigate = useNavigate()
  const { partyId } = useParams<{ partyId: string }>()
  const isPartyWise = Boolean(partyId)

  const { parties } = useParties()
  const { banks } = useSettings()
  const { createCheque } = useCheques()
  
  const [rows, setRows] = useState<BulkRow[]>([])
  const [loading, setLoading] = useState(false)

  const partyOptions = parties.map((p) => ({ value: p.id, label: p.name }))
  const bankOptions = banks.map((b) => ({ value: b, label: b }))

  useEffect(() => {
    // Fetch last cheque number from DB to seed the first row
    supabase
      .from('cheques')
      .select('cheque_number')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.cheque_number) {
          handleAddRow(data.cheque_number)
        } else {
          handleAddRow()
        }
      })
  }, [])

  const handleAddRow = (lastDbChequeNumber?: string) => {
    let newChequeNumber = ''
    if (rows.length > 0) {
      const lastRowNumber = rows[rows.length - 1].cheque_number
      newChequeNumber = nextChequeNumber(lastRowNumber)
    } else if (lastDbChequeNumber) {
      newChequeNumber = nextChequeNumber(lastDbChequeNumber)
    }

    const newRow: BulkRow = {
      id: crypto.randomUUID(),
      party_id: isPartyWise ? partyId! : '',
      cheque_number: newChequeNumber,
      bank_name: banks.length > 0 ? banks[0] : '',
      amount: '',
      issue_date: todayISO(),
      due_date: todayISO(),
      notes: '',
    }
    setRows((prev) => [...prev, newRow])
  }

  const updateRow = (id: string, field: keyof BulkRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        
        // Auto-format amount if that's the field
        if (field === 'amount') {
          return { ...r, amount: formatAmountInput(value) }
        }

        const newRow = { ...r, [field]: value }
        
        // If changing issue date, maybe sync due date if they were same? (optional)
        return newRow
      })
    )
  }

  const removeRow = (id: string) => {
    if (rows.length === 1) return
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  const handleSubmit = async () => {
    // Validation
    const invalid = rows.find(
      (r) => !r.party_id || !r.cheque_number || !r.bank_name || !parseAmount(r.amount) || !r.issue_date || !r.due_date
    )
    if (invalid) {
      toast.error('Please fill all required fields in all rows.')
      return
    }

    setLoading(true)
    let added = 0
    for (const row of rows) {
      const result = await createCheque({
        party_id: row.party_id,
        cheque_number: row.cheque_number,
        bank_name: row.bank_name,
        amount: parseAmount(row.amount),
        issue_date: row.issue_date,
        due_date: row.due_date,
        notes: row.notes || undefined,
      })
      if (result.error) {
        toast.error(`Error saving cheque ${row.cheque_number}: ${result.error}`)
      } else {
        added++
      }
    }
    setLoading(false)
    if (added > 0) {
      toast.success(`Successfully added ${added} cheques.`)
      navigate('/cheques')
    }
  }

  const selectedParty = parties.find((p) => p.id === partyId)

  return (
    <div className="space-y-4 pb-12">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">
              {isPartyWise ? 'Party-wise Bulk Add' : 'Bulk Add Cheques'}
            </h2>
            {isPartyWise && selectedParty && (
              <p className="text-muted-foreground mt-0.5">
                Adding multiple cheques for <strong>{selectedParty.name}</strong>
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => handleAddRow()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Row
          </Button>
          <Button onClick={handleSubmit} disabled={loading || rows.length === 0}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Saving...' : 'Save All'}
          </Button>
        </div>
      </div>

      <div className="space-y-4 mt-6">
        {rows.map((row) => (
          <Card key={row.id} className="relative group">
            <CardContent className="p-4">
              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-start">
                {!isPartyWise && (
                  <div className="space-y-1.5 lg:col-span-1">
                    <Label className="text-xs">Party *</Label>
                    <Combobox
                      options={partyOptions}
                      value={row.party_id}
                      onChange={(v) => updateRow(row.id, 'party_id', v)}
                      placeholder="Select party"
                      emptyText="No party found"
                    />
                  </div>
                )}
                
                <div className="space-y-1.5 lg:col-span-1">
                  <Label className="text-xs">Cheque No. *</Label>
                  <Input
                    value={row.cheque_number}
                    onChange={(e) => updateRow(row.id, 'cheque_number', e.target.value)}
                  />
                </div>

                <div className="space-y-1.5 lg:col-span-1">
                  <Label className="text-xs">Bank *</Label>
                  <Combobox
                    options={bankOptions}
                    value={row.bank_name}
                    onChange={(v) => updateRow(row.id, 'bank_name', v)}
                    placeholder="Select bank"
                    emptyText="No bank found"
                  />
                </div>

                <div className="space-y-1.5 lg:col-span-1">
                  <Label className="text-xs">Amount *</Label>
                  <Input
                    value={row.amount}
                    onChange={(e) => updateRow(row.id, 'amount', e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-1.5 lg:col-span-1">
                  <Label className="text-xs">Issue Date *</Label>
                  <Input
                    type="date"
                    value={row.issue_date}
                    onChange={(e) => updateRow(row.id, 'issue_date', e.target.value)}
                  />
                </div>

                <div className="space-y-1.5 lg:col-span-1">
                  <Label className="text-xs">Due Date *</Label>
                  <Input
                    type="date"
                    value={row.due_date}
                    onChange={(e) => updateRow(row.id, 'due_date', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
