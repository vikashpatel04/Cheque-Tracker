import { useEffect, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { CalendarIcon } from 'lucide-react'
import { isValid, parse, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DATE_DISPLAY_FORMAT, formatDate, toISODate } from '@/lib/formatters'

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

/** Insert slashes as the user types digits: "2309" -> "23/09", "23092026" -> "23/09/2026". */
function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

/** Parse a complete DD/MM/YYYY string, rejecting impossible dates like 31/02/2026. */
function parseDisplayDate(text: string): Date | null {
  if (text.length !== 10) return null
  const d = parse(text, DATE_DISPLAY_FORMAT, new Date())
  return isValid(d) && d.getFullYear() >= 1900 ? d : null
}

interface DateInputProps {
  value?: string | null
  onChange: (iso: string) => void
  id?: string
  className?: string
  disabled?: boolean
  'aria-invalid'?: boolean
}

/**
 * Typeable date field that always shows DD/MM/YYYY regardless of the
 * browser/OS locale (unlike <input type="date">). Slashes are inserted
 * automatically; a calendar button offers point-and-click selection.
 * Works with ISO (yyyy-MM-dd) strings like the other pickers.
 */
export function DateInput({ value, onChange, id, className, disabled, ...rest }: DateInputProps) {
  const [text, setText] = useState(() => (toDate(value) ? formatDate(toDate(value)!) : ''))
  const [open, setOpen] = useState(false)
  const selected = toDate(value)

  // Keep the text in sync when the value changes from outside (form reset, calendar pick).
  useEffect(() => {
    const d = toDate(value)
    setText(d ? formatDate(d) : '')
  }, [value])

  const handleChange = (raw: string) => {
    const masked = maskDate(raw)
    setText(masked)
    const d = parseDisplayDate(masked)
    if (d) onChange(toISODate(d))
  }

  // Leaving the field with an incomplete/invalid date restores the last valid one.
  const handleBlur = () => {
    if (!parseDisplayDate(text)) setText(selected ? formatDate(selected) : '')
  }

  return (
    <div className={cn('relative', className)}>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD/MM/YYYY"
        maxLength={10}
        value={text}
        disabled={disabled}
        aria-invalid={rest['aria-invalid']}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        className="pr-10"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground"
            aria-label="Open calendar"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            weekStartsOn={1}
            onSelect={(d) => {
              if (d) onChange(toISODate(d))
              setOpen(false)
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
