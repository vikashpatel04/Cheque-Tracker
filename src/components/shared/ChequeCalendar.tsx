import { useMemo, useState, useCallback } from 'react'
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar'
import {
  format,
  parse,
  startOfWeek,
  getDay,
  parseISO,
  startOfDay,
  endOfDay,
} from 'date-fns'
import { enIN } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { STATUS_COLORS } from '@/lib/chartUtils'
import { StatusPill } from '@/components/shared/StatusPill'
import type { Cheque } from '@/types'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { 'en-IN': enIN },
})

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  resource: Cheque
}

interface ChequeCalendarProps {
  cheques: Cheque[]
  currencySymbol?: string
  onSelectCheque?: (chequeId: string) => void
  title?: string
  defaultView?: View
  height?: number
}

export function ChequeCalendar({
  cheques,
  currencySymbol = '₹',
  onSelectCheque,
  title = 'Cheque Due Calendar',
  defaultView = 'month',
  height = 520,
}: ChequeCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<View>(defaultView)
  const [selectedDay, setSelectedDay] = useState<{ date: Date; cheques: Cheque[] } | null>(null)

  const events = useMemo<CalendarEvent[]>(() => {
    return cheques
      .filter((c) => ['PENDING', 'DEPOSITED', 'PASSED', 'RETURNED'].includes(c.status))
      .map((c) => {
        const day = startOfDay(parseISO(c.due_date))
        const party = c.party?.name ?? 'Unknown'
        const shortAmount = formatCurrency(Number(c.amount), currencySymbol)
        return {
          id: c.id,
          title: `${party} · ${shortAmount}`,
          start: day,
          end: endOfDay(day),
          resource: c,
        }
      })
  }, [cheques, currencySymbol])

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const status = event.resource.status
    const color = STATUS_COLORS[status] ?? '#6b7280'
    return {
      style: {
        backgroundColor: color,
        borderColor: color,
        color: '#fff',
        borderRadius: '4px',
        border: 'none',
        fontSize: '11px',
        padding: '1px 4px',
      },
    }
  }, [])

  const handleSelectEvent = useCallback(
    (event: CalendarEvent) => {
      onSelectCheque?.(event.resource.id)
    },
    [onSelectCheque]
  )

  const handleSelectSlot = useCallback(
    ({ start }: { start: Date }) => {
      const dateStr = format(start, 'yyyy-MM-dd')
      const dayCheques = cheques.filter((c) => c.due_date === dateStr)
      setSelectedDay({ date: start, cheques: dayCheques })
    },
    [cheques]
  )

  const dayTotal = selectedDay
    ? selectedDay.cheques.reduce((s, c) => s + Number(c.amount), 0)
    : 0

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-base">{title}</CardTitle>
            <div className="flex flex-wrap gap-3 text-xs">
              {Object.entries(STATUS_COLORS)
                .filter(([s]) => ['PENDING', 'DEPOSITED', 'PASSED', 'RETURNED'].includes(s))
                .map(([status, color]) => (
                  <span key={status} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                    {status.charAt(0) + status.slice(1).toLowerCase()}
                  </span>
                ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="cheque-calendar" style={{ height }}>
            <Calendar
              localizer={localizer}
              events={events}
              date={currentDate}
              view={view}
              onNavigate={setCurrentDate}
              onView={setView}
              views={['month', 'week', 'agenda']}
              eventPropGetter={eventStyleGetter}
              onSelectEvent={handleSelectEvent}
              onSelectSlot={handleSelectSlot}
              selectable
              popup
              showMultiDayTimes={false}
              components={{
                toolbar: ({ label, onNavigate, onView }) => (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onNavigate('PREV')}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => onNavigate('TODAY')}>
                        Today
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onNavigate('NEXT')}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <span className="ml-2 font-semibold text-sm">{label}</span>
                    </div>
                    <div className="flex gap-1">
                      {(['month', 'week', 'agenda'] as View[]).map((v) => (
                        <Button
                          key={v}
                          variant={view === v ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => onView(v)}
                          className="capitalize"
                        >
                          {v}
                        </Button>
                      ))}
                    </div>
                  </div>
                ),
              }}
            />
          </div>
        </CardContent>
      </Card>

      {selectedDay && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <div>
              <CardTitle className="text-base">{formatDate(format(selectedDay.date, 'yyyy-MM-dd'))}</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {selectedDay.cheques.length} cheque{selectedDay.cheques.length !== 1 ? 's' : ''} ·{' '}
                {formatCurrency(dayTotal, currencySymbol)} total
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedDay(null)}>
              Close
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {selectedDay.cheques.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cheques due on this date.</p>
            ) : (
              <div className="space-y-2">
                {selectedDay.cheques.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectCheque?.(c.id)}
                    className="w-full flex items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{c.party?.name}</p>
                      <p className="text-xs text-muted-foreground">#{c.cheque_number} · {c.bank_name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold">{formatCurrency(Number(c.amount), currencySymbol)}</p>
                      <StatusPill status={c.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
