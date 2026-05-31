import { useMemo } from 'react'
import { addDays, format, isSameDay, startOfDay } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { formatCurrency } from '@/lib/formatters'
import { STATUS_COLORS } from '@/lib/chartUtils'
import { cn } from '@/lib/utils'
import type { Cheque } from '@/types'

interface Next7DaysStripProps {
  cheques: Cheque[]
  currencySymbol?: string
  onDayClick: (date: Date) => void
}

/**
 * Compact horizontal strip showing the next 7 days (today + 6).
 * Each card surfaces the day's cheque count, total amount, and a
 * tiny pending/deposited split bar. Click → opens the day modal.
 */
export function Next7DaysStrip({
  cheques,
  currencySymbol = '₹',
  onDayClick,
}: Next7DaysStripProps) {
  const today = startOfDay(new Date())

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(today, i)
      const dateStr = format(date, 'yyyy-MM-dd')
      const dayCheques = cheques.filter((c) => c.due_date === dateStr)
      const pending = dayCheques
        .filter((c) => c.status === 'PENDING')
        .reduce((s, c) => s + Number(c.amount), 0)
      const deposited = dayCheques
        .filter((c) => c.status === 'DEPOSITED')
        .reduce((s, c) => s + Number(c.amount), 0)
      const total = dayCheques.reduce((s, c) => s + Number(c.amount), 0)
      return {
        date,
        dateStr,
        weekday: format(date, 'EEE'),
        dayOfMonth: format(date, 'd'),
        month: format(date, 'MMM'),
        count: dayCheques.length,
        pending,
        deposited,
        total,
        isToday: isSameDay(date, today),
      }
    })
  }, [cheques, today])

  const maxTotal = Math.max(1, ...days.map((d) => d.total))

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Next 7 days</CardTitle>
        <CardDescription>Tap a day to see all cheques due then</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {days.map((d) => {
            const pendingPct = d.total > 0 ? (d.pending / d.total) * 100 : 0
            const sizePct = (d.total / maxTotal) * 100
            return (
              <button
                key={d.dateStr}
                type="button"
                onClick={() => onDayClick(d.date)}
                className={cn(
                  'group flex-1 min-w-[110px] rounded-lg border p-3 text-left transition-all',
                  'hover:border-primary/60 hover:shadow-sm active:scale-[0.98]',
                  d.isToday
                    ? 'border-primary bg-primary/5'
                    : 'bg-background'
                )}
              >
                <div className="flex items-baseline justify-between">
                  <p
                    className={cn(
                      'text-[11px] font-semibold uppercase tracking-wider',
                      d.isToday ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {d.isToday ? 'Today' : d.weekday}
                  </p>
                  <p className="text-xs text-muted-foreground">{d.month}</p>
                </div>

                <p className="text-2xl font-bold mt-0.5 leading-none tabular-nums">
                  {d.dayOfMonth}
                </p>

                <div className="mt-2 min-h-[14px]">
                  {d.count === 0 ? (
                    <p className="text-[11px] text-muted-foreground">No cheques</p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      {d.count} cheque{d.count !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                <p className="text-sm font-semibold mt-1 tabular-nums truncate">
                  {d.total > 0 ? formatCurrency(d.total, currencySymbol) : '—'}
                </p>

                {/* Mini split bar: pending vs deposited */}
                {d.total > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden flex">
                      <span
                        className="h-full block"
                        style={{
                          width: `${pendingPct}%`,
                          backgroundColor: STATUS_COLORS.PENDING,
                        }}
                      />
                      <span
                        className="h-full block"
                        style={{
                          width: `${100 - pendingPct}%`,
                          backgroundColor: STATUS_COLORS.DEPOSITED,
                        }}
                      />
                    </div>
                    {/* Size indicator relative to busiest day */}
                    <div className="h-0.5 rounded-full bg-muted overflow-hidden">
                      <span
                        className="h-full block bg-foreground/30"
                        style={{ width: `${sizePct}%` }}
                      />
                    </div>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
