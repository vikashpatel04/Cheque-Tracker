import type { AllocationSort, Cheque, Party } from '@/types'

export interface AllocationItem {
  cheque: Cheque & { party: Party }
  selected: boolean
}

export function sortChequesForAllocation(
  cheques: (Cheque & { party: Party })[],
  sortOrder: AllocationSort
): (Cheque & { party: Party })[] {
  const sorted = [...cheques]
  switch (sortOrder) {
    case 'amount_asc':
      return sorted.sort((a, b) => Number(a.amount) - Number(b.amount))
    case 'amount_desc':
      return sorted.sort((a, b) => Number(b.amount) - Number(a.amount))
    case 'due_date_asc':
    default:
      return sorted.sort(
        (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      )
  }
}

export function suggestAllocation(
  cheques: (Cheque & { party: Party })[],
  depositAmount: number,
  sortOrder: AllocationSort
): AllocationItem[] {
  const sorted = sortChequesForAllocation(cheques, sortOrder)
  let remaining = depositAmount

  return sorted.map((cheque) => {
    const amount = Number(cheque.amount)
    const canCover = remaining >= amount
    const selected = canCover
    if (selected) {
      remaining -= amount
    }
    return { cheque, selected }
  })
}

export function calculateAllocationTotals(items: AllocationItem[]) {
  const allocated = items
    .filter((i) => i.selected)
    .reduce((sum, i) => sum + Number(i.cheque.amount), 0)
  const selectedCount = items.filter((i) => i.selected).length

  return { allocated, selectedCount }
}

export function getRemainingBalance(
  items: AllocationItem[],
  depositAmount: number
): { allocated: number; remaining: number; exceeds: number } {
  const allocated = items
    .filter((i) => i.selected)
    .reduce((sum, i) => sum + Number(i.cheque.amount), 0)
  const remaining = depositAmount - allocated
  const exceeds = remaining < 0 ? Math.abs(remaining) : 0
  return { allocated, remaining: Math.max(0, remaining), exceeds }
}
