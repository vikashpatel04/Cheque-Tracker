import { format, parse, parseISO, isValid } from 'date-fns'

export const DATE_DISPLAY_FORMAT = 'dd-MM-yyyy'
export const DATE_INPUT_FORMAT = 'yyyy-MM-dd'

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, DATE_DISPLAY_FORMAT)
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd-MM-yyyy h:mm a')
}

export function toISODate(date: Date): string {
  return format(date, DATE_INPUT_FORMAT)
}

export function parseDisplayDate(dateStr: string): Date | null {
  const parsed = parse(dateStr.trim(), DATE_DISPLAY_FORMAT, new Date())
  return isValid(parsed) ? parsed : null
}

export function todayISO(): string {
  return format(new Date(), DATE_INPUT_FORMAT)
}

export function formatIndianNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatCurrency(value: number, symbol = '₹'): string {
  return `${symbol}${formatIndianNumber(value, 2)}`
}

export function parseAmount(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}
