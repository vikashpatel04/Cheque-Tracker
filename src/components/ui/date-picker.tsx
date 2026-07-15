import { useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { CalendarIcon } from 'lucide-react'
import { parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatDate, toISODate } from '@/lib/formatters'

function toDate(iso?: string | null): Date | undefined {
  if (!iso) return undefined
  const d = parseISO(iso)
  return isNaN(d.getTime()) ? undefined : d
}

interface DatePickerProps {
  value?: string | null
  onChange: (iso: string) => void
  placeholder?: string
  id?: string
  className?: string
  disabled?: boolean
}

/** Single-date picker. Works with ISO (yyyy-MM-dd) strings, displays DD/MM/YYYY. */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  id,
  className,
  disabled,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = toDate(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? formatDate(selected) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            if (d) onChange(toISODate(d))
            setOpen(false)
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

interface DateRangePickerProps {
  from?: string | null
  to?: string | null
  onChange: (range: { from: string; to: string }) => void
  placeholder?: string
  id?: string
  className?: string
  disabled?: boolean
  /** Show two months side by side. Defaults to true. */
  numberOfMonths?: number
}

/**
 * From–to date range picker. Works with ISO (yyyy-MM-dd) strings, displays
 * DD/MM/YYYY – DD/MM/YYYY.
 */
export function DateRangePicker({
  from,
  to,
  onChange,
  placeholder = 'Pick a date range',
  id,
  className,
  disabled,
  numberOfMonths = 2,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const range: DateRange | undefined = from
    ? { from: toDate(from), to: toDate(to) }
    : undefined

  const label = range?.from
    ? range.to
      ? `${formatDate(range.from)} – ${formatDate(range.to)}`
      : formatDate(range.from)
    : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !label && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {label ?? <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={range}
          defaultMonth={range?.from}
          numberOfMonths={numberOfMonths}
          onSelect={(r) => {
            onChange({
              from: r?.from ? toISODate(r.from) : '',
              to: r?.to ? toISODate(r.to) : '',
            })
            if (r?.from && r?.to) setOpen(false)
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
