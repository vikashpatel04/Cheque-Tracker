import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ChequeStatus } from '@/types'

export interface ExistingCheque {
  id: string
  cheque_number: string
  bank_name: string
  status: ChequeStatus
  party_name: string
}

/**
 * Look up live cheques that already use any of the given numbers, so forms can
 * warn about likely duplicate entry. Numbers can legitimately repeat (a
 * re-presented cheque reuses its number), so this is advisory only.
 *
 * Returns a map of cheque_number -> existing cheques (excluding `excludeId`).
 */
export function useExistingChequeNumbers(numbers: string[], excludeId?: string) {
  const [existing, setExisting] = useState<Map<string, ExistingCheque[]>>(new Map())
  const key = [...new Set(numbers.map((n) => n.trim()).filter(Boolean))].sort().join('|')

  useEffect(() => {
    const wanted = key ? key.split('|') : []
    if (wanted.length === 0) {
      setExisting(new Map())
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('cheques')
        .select('id, cheque_number, bank_name, status, party:parties(name)')
        .in('cheque_number', wanted)
        .is('deleted_at', null)
      if (cancelled || !data) return
      const map = new Map<string, ExistingCheque[]>()
      for (const row of data as unknown as (Omit<ExistingCheque, 'party_name'> & { party: { name: string } | null })[]) {
        if (row.id === excludeId) continue
        const list = map.get(row.cheque_number) ?? []
        list.push({ ...row, party_name: row.party?.name ?? 'Unknown party' })
        map.set(row.cheque_number, list)
      }
      setExisting(map)
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [key, excludeId])

  return existing
}

export function describeExisting(list: ExistingCheque[] | undefined): string | null {
  if (!list?.length) return null
  const first = list[0]
  const more = list.length > 1 ? ` (+${list.length - 1} more)` : ''
  return `Already used: ${first.party_name}, ${first.bank_name}, ${first.status.toLowerCase()}${more}`
}
