import { format, startOfDay } from 'date-fns'
import type { Cheque } from '@/types'

export type ChequeTag = 'RE_PRESENTED' | 'FROM_RETURN' | 'WRITTEN_OFF'

/** Computed display tag for overdue cheques — not stored in DB. */
export type OverdueTag = 'OVERDUE' | 'OVERDUE_DEPOSITED'

export function extractTags(notes: string | null): ChequeTag[] {
  if (!notes) return []
  const tags: ChequeTag[] = []
  if (notes.includes('[RE_PRESENTED]')) tags.push('RE_PRESENTED')
  if (notes.includes('[FROM_RETURN]')) tags.push('FROM_RETURN')
  if (notes.includes('[WRITTEN_OFF]')) tags.push('WRITTEN_OFF')
  return tags
}

export function stripTagLines(notes: string | null): string {
  if (!notes) return ''
  return notes
    .split('\n')
    .filter((line) => !['[RE_PRESENTED]', '[FROM_RETURN]', '[WRITTEN_OFF]'].some((t) => line.startsWith(t)))
    .join('\n')
    .trim()
}

/**
 * Compute an overdue tag for a cheque based on its due_date vs today.
 * Returns null if the cheque is not overdue.
 */
export function getOverdueTag(cheque: Cheque): OverdueTag | null {
  const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd')
  if (cheque.due_date >= todayStr) return null
  if (cheque.status === 'PENDING') return 'OVERDUE'
  if (cheque.status === 'DEPOSITED') return 'OVERDUE_DEPOSITED'
  return null
}

export interface DisplayTag {
  key: string
  label: string
  className: string
}

/**
 * All badges for a cheque. New-style info comes from columns: re-presented
 * count and replacement link. Legacy tags come from markers in notes, which
 * the old re-present flow wrote and which older records still carry.
 */
export function getChequeTags(cheque: Cheque): DisplayTag[] {
  const tags: DisplayTag[] = []
  if (cheque.represent_count > 0) {
    tags.push({
      key: 'represented',
      label: cheque.represent_count > 1 ? `Re-presented ×${cheque.represent_count}` : 'Re-presented',
      className: TAG_CLASSES.RE_PRESENTED,
    })
  }
  if (cheque.replaces_cheque_id) {
    tags.push({ key: 'replacement', label: 'Replacement', className: TAG_CLASSES.FROM_RETURN })
  }
  for (const tag of extractTags(cheque.notes)) {
    tags.push({ key: `legacy-${tag}`, label: TAG_LABELS[tag], className: TAG_CLASSES[tag] })
  }
  return tags
}

/** Returned cheque re-presented with the old flow (a separate cheque row was created). */
export function isLegacyRepresented(cheque: Cheque): boolean {
  return extractTags(cheque.notes).includes('RE_PRESENTED')
}

export const TAG_LABELS: Record<ChequeTag, string> = {
  RE_PRESENTED: 'Re-presented',
  FROM_RETURN: 'From Return',
  WRITTEN_OFF: 'Written Off',
}

export const OVERDUE_TAG_LABELS: Record<OverdueTag, string> = {
  OVERDUE: 'Overdue',
  OVERDUE_DEPOSITED: 'Overdue · Deposited',
}

export const TAG_CLASSES: Record<ChequeTag, string> = {
  RE_PRESENTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  FROM_RETURN: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  WRITTEN_OFF: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

export const OVERDUE_TAG_CLASSES: Record<OverdueTag, string> = {
  OVERDUE: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300',
  OVERDUE_DEPOSITED: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300',
}

/** Route that opens Add Cheque pre-filled as a replacement for the given (written-off) cheque. */
export function replacementChequePath(chequeId: string) {
  return `/cheques?replace=${chequeId}`
}

/**
 * Whether a cheque counts as a separate issued amount in totals. The old
 * re-present flow created a second row for the same payment; the returned
 * original is settled by that copy, so only the copy counts.
 */
export function countsAsIssued(cheque: Cheque): boolean {
  return !isLegacyRepresented(cheque)
}

/** Amount we still have to pay: scheduled (pending/deposited) or bounced and not yet resolved. */
export function isStillToPay(cheque: Cheque): boolean {
  if (!countsAsIssued(cheque)) return false
  return ['PENDING', 'DEPOSITED', 'RETURNED'].includes(cheque.status)
}
