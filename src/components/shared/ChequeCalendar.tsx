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
import { DayChequesDialog } from '@/components/shared/DayChequesDialog'
import { formatCurrency } from '@/lib/formatters'
import { STATUS_COLORS } from '@/lib/chartUtils'
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
  /**
   * If provided, clicking a date (or an event in month view) calls this
   * callback instead of opening the internal day modal. Use this to let a
   * parent own a shared day-detail dialog.
   */
  onDayClick?: (date: Date) => void
  title?: string
  defaultView?: View
  height?: number
}

export function ChequeCalendar({
  cheques,
  currencySymbol = '₹',
  onSelectCheque,
  onDayClick,
  title = 'Cheque Due Calendar',
  defaultView = 'month',
  height = 520,
}: ChequeCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<View>(defaultView)
  const [internalDay, setInternalDay] = useState<Date | null>(null)

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

  // Either delegate to parent or open internal modal
  const openDay = useCallback(
    (date: Date) => {
      const day = startOfDay(date)
      if (onDayClick) {
        onDayClick(day)
      } else {
        setInternalDay(day)
      }
    },
    [onDayClick]
  )

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
        cursor: 'pointer',
      },
    }
  }, [])

  // Month view: clicking an event opens the DAY modal (same as date click).
  // Week / agenda view: clicking an event opens the cheque detail.
  const handleSelectEvent = useCallback(
    (event: CalendarEvent) => {
      if (view === 'month') {
        openDay(parseISO(event.resource.due_date))
      } else {
        onSelectCheque?.(event.resource.id)
      }
    },
    [view, openDay, onSelectCheque]
  )

  const handleSelectSlot = useCallback(
    ({ start }: { start: Date }) => openDay(start),
    [openDay]
  )

  return (
    <>
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
              views={['month', 'agenda']}
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
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onNavigate('PREV')}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => onNavigate('TODAY')}>
                        Today
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onNavigate('NEXT')}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <span className="ml-2 font-semibold text-sm">{label}</span>
                    </div>
                    <div className="flex gap-1">
                      {(['month', 'agenda'] as View[]).map((v) => (
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

      {/* Only render the internal dialog if the parent didn't take over */}
      {!onDayClick && (
        <DayChequesDialog
          cheques={cheques}
          date={internalDay}
          currencySymbol={currencySymbol}
          onChangeDate={setInternalDay}
          onClose={() => setInternalDay(null)}
          onSelectCheque={onSelectCheque}
        />
      )}
    </>
  )
}
