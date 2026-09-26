import { addMonths, addWeeks, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { nextChequeNumber } from './formatters'
import type { ReceivedCheque } from '@/types/received'

/**
 * Date rules for received cheques: when they go stale, what needs attention
 * today, and how to lay out a series of cheques. Pure functions, so they're
 * easy to test; the rules (validity, clearing days) come from the user's region.
 */

/** Start warning this many days before a cheque in hand goes stale. */
export const STALE_WARNING_DAYS = 7

const ISO = 'yyyy-MM-dd'

/** Last day the cheque can be deposited: its date plus the region's validity period. */
export function lastValidDay(chequeDate: string, validityMonths: number): string {
  return format(addMonths(parseISO(chequeDate), validityMonths), ISO)
}

/** Whole days from `from` to `to` (both yyyy-MM-dd); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from))
}

export type ReceivedAlert =
  /** Due to be deposited today. */
  | 'deposit_today'
  /** Its deposit date has passed and it's still in hand. */
  | 'deposit_overdue'
  /** It goes stale within STALE_WARNING_DAYS. */
  | 'going_stale'
  /** Past its validity; banks will refuse it. */
  | 'stale'
  /** Deposited longer ago than clearing usually takes: did it clear? */
  | 'check_clearing'
  /** A security cheque whose review date has come. */
  | 'review_security'
  /** Bounced and waiting for a decision. */
  | 'needs_decision'

export interface AlertRules {
  chequeValidityMonths: number
  clearingDays: number
}

/** What needs the user's attention for a cheque today. */
export function receivedAlerts(
  c: Pick<ReceivedCheque, 'status' | 'kind' | 'due_date' | 'cheque_date' | 'deposited_on'>,
  today: string,
  rules: AlertRules
): ReceivedAlert[] {
  if (c.status === 'BOUNCED') return ['needs_decision']

  if (c.status === 'DEPOSITED') {
    return c.deposited_on && daysBetween(c.deposited_on, today) >= rules.clearingDays ? ['check_clearing'] : []
  }

  if (c.status !== 'IN_HAND') return []

  if (c.kind === 'SECURITY') return c.due_date <= today ? ['review_security'] : []

  const alerts: ReceivedAlert[] = []
  if (c.cheque_date) {
    const lastDay = lastValidDay(c.cheque_date, rules.chequeValidityMonths)
    // A stale cheque can't be deposited any more, so nothing else applies.
    if (today > lastDay) return ['stale']
    if (daysBetween(today, lastDay) <= STALE_WARNING_DAYS) alerts.push('going_stale')
  }
  if (c.due_date === today) alerts.push('deposit_today')
  else if (c.due_date < today) alerts.push('deposit_overdue')
  return alerts
}

export type SeriesInterval = 'week' | 'month' | 'quarter' | 'year'

export const SERIES_MAX_CHEQUES = 120

export interface SeriesPlan {
  /** Number of the first cheque; the rest count up from it (000101, 000102, …). */
  firstNumber: string
  /** Date on the first cheque (yyyy-MM-dd). */
  firstDate: string
  count: number
  every: SeriesInterval
}

export interface SeriesCheque {
  series_index: number
  /** Empty when the first number has no digits to count up from. */
  cheque_number: string
  cheque_date: string
}

/**
 * Cheques in a series, such as 12 monthly rent cheques. Dates are counted
 * from the first one, so 31 January is followed by 28 (or 29) February and
 * then 31 March.
 */
export function buildSeries(plan: SeriesPlan): SeriesCheque[] {
  if (!Number.isInteger(plan.count) || plan.count < 1 || plan.count > SERIES_MAX_CHEQUES) {
    throw new Error(`A series has between 1 and ${SERIES_MAX_CHEQUES} cheques`)
  }
  const first = parseISO(plan.firstDate)
  const dateAt = (i: number) => {
    switch (plan.every) {
      case 'week':
        return addWeeks(first, i)
      case 'quarter':
        return addMonths(first, i * 3)
      case 'year':
        return addMonths(first, i * 12)
      default:
        return addMonths(first, i)
    }
  }

  const cheques: SeriesCheque[] = []
  let number = plan.firstNumber.trim()
  for (let i = 0; i < plan.count; i++) {
    if (i > 0) number = number ? nextChequeNumber(number) : ''
    cheques.push({ series_index: i + 1, cheque_number: number, cheque_date: format(dateAt(i), ISO) })
  }
  return cheques
}
