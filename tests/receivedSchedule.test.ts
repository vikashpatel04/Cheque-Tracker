import { describe, expect, it } from 'vitest'
import { SERIES_MAX_CHEQUES, buildSeries, lastValidDay, receivedAlerts } from '@/lib/receivedSchedule'

describe('buildSeries', () => {
  it('counts monthly dates from the first cheque, keeping month ends', () => {
    const series = buildSeries({ firstNumber: '000101', firstDate: '2026-01-31', count: 4, every: 'month' })
    expect(series.map((c) => c.cheque_date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
    expect(series.map((c) => c.cheque_number)).toEqual(['000101', '000102', '000103', '000104'])
    expect(series.map((c) => c.series_index)).toEqual([1, 2, 3, 4])
  })

  it('handles weekly, quarterly and yearly series', () => {
    const dates = (every: 'week' | 'quarter' | 'year') =>
      buildSeries({ firstNumber: '1', firstDate: '2026-01-15', count: 3, every }).map((c) => c.cheque_date)
    expect(dates('week')).toEqual(['2026-01-15', '2026-01-22', '2026-01-29'])
    expect(dates('quarter')).toEqual(['2026-01-15', '2026-04-15', '2026-07-15'])
    expect(dates('year')).toEqual(['2026-01-15', '2027-01-15', '2028-01-15'])
  })

  it('keeps prefixes and zero padding when counting up', () => {
    const numbers = buildSeries({ firstNumber: 'CHQ-0998', firstDate: '2026-01-01', count: 3, every: 'month' }).map(
      (c) => c.cheque_number
    )
    expect(numbers).toEqual(['CHQ-0998', 'CHQ-0999', 'CHQ-1000'])
  })

  it('leaves later numbers blank when the first has no digits to count from', () => {
    const numbers = buildSeries({ firstNumber: 'ABC', firstDate: '2026-01-01', count: 3, every: 'month' }).map(
      (c) => c.cheque_number
    )
    expect(numbers).toEqual(['ABC', '', ''])
  })

  it('rejects empty or oversized series', () => {
    const plan = { firstNumber: '1', firstDate: '2026-01-01', every: 'month' as const }
    expect(() => buildSeries({ ...plan, count: 0 })).toThrow()
    expect(() => buildSeries({ ...plan, count: SERIES_MAX_CHEQUES + 1 })).toThrow()
    expect(() => buildSeries({ ...plan, count: 2.5 })).toThrow()
  })
})

describe('lastValidDay', () => {
  it('adds the validity period to the cheque date', () => {
    expect(lastValidDay('2026-01-31', 3)).toBe('2026-04-30')
    expect(lastValidDay('2026-09-26', 6)).toBe('2027-03-26')
  })
})

describe('receivedAlerts', () => {
  const rules = { chequeValidityMonths: 3, clearingDays: 2 }
  const inHand = {
    status: 'IN_HAND',
    kind: 'REGULAR',
    cheque_date: '2026-09-26',
    due_date: '2026-09-26',
    deposited_on: null,
  } as const

  it('flags cheques to deposit today, and overdue ones', () => {
    expect(receivedAlerts(inHand, '2026-09-20', rules)).toEqual([])
    expect(receivedAlerts(inHand, '2026-09-26', rules)).toEqual(['deposit_today'])
    expect(receivedAlerts(inHand, '2026-09-30', rules)).toEqual(['deposit_overdue'])
  })

  it('warns before a cheque goes stale, and once it has', () => {
    // Valid until 2026-12-26 with 3 months' validity.
    expect(receivedAlerts(inHand, '2026-12-20', rules)).toEqual(['going_stale', 'deposit_overdue'])
    expect(receivedAlerts(inHand, '2026-12-26', rules)).toEqual(['going_stale', 'deposit_overdue'])
    expect(receivedAlerts(inHand, '2026-12-27', rules)).toEqual(['stale'])
  })

  it('asks whether a deposit cleared once the usual clearing time has passed', () => {
    const deposited = { ...inHand, status: 'DEPOSITED', deposited_on: '2026-09-26' } as const
    expect(receivedAlerts(deposited, '2026-09-27', rules)).toEqual([])
    expect(receivedAlerts(deposited, '2026-09-28', rules)).toEqual(['check_clearing'])
  })

  it('handles security, bounced and finished cheques', () => {
    const security = { ...inHand, kind: 'SECURITY', cheque_date: null, due_date: '2027-03-31' } as const
    expect(receivedAlerts(security, '2027-01-01', rules)).toEqual([])
    expect(receivedAlerts(security, '2027-03-31', rules)).toEqual(['review_security'])
    expect(receivedAlerts({ ...inHand, status: 'BOUNCED' }, '2026-10-01', rules)).toEqual(['needs_decision'])
    expect(receivedAlerts({ ...inHand, status: 'CLEARED' }, '2026-10-01', rules)).toEqual([])
  })
})
