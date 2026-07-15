import { format, parse, parseISO, isValid } from 'date-fns'

export const DATE_DISPLAY_FORMAT = 'dd/MM/yyyy'
export const DATE_INPUT_FORMAT = 'yyyy-MM-dd'

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, DATE_DISPLAY_FORMAT)
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd/MM/yyyy h:mm a')
}

export function toISODate(date: Date): string {
  return format(date, DATE_INPUT_FORMAT)
}

/**
 * Parse a date coming from a spreadsheet cell, which may arrive as a JS Date
 * (when read with cellDates), an Excel serial number, or a string in a variety
 * of DD/MM/YYYY-style formats. Returns null when nothing usable is found.
 */
export function parseFlexibleDate(value: unknown): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date) return isValid(value) ? value : null
  if (typeof value === 'number') {
    // Excel serial date: days since 1899-12-30. Build a local midnight date
    // from the UTC components to avoid timezone-induced off-by-one shifts.
    const utc = new Date(Math.round((value - 25569) * 86400000))
    if (!isValid(utc)) return null
    return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate())
  }
  const str = String(value).trim()
  if (!str) return null
  const formats = ['dd/MM/yyyy', 'dd-MM-yyyy', 'd/M/yyyy', 'd-M-yyyy', 'yyyy-MM-dd', 'yyyy/MM/dd']
  for (const fmt of formats) {
    const parsed = parse(str, fmt, new Date())
    if (isValid(parsed)) return parsed
  }
  const iso = parseISO(str)
  return isValid(iso) ? iso : null
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

/** Group a digits-only integer string with the Indian numbering system (1,00,000). */
function groupIndian(intDigits: string): string {
  if (intDigits.length <= 3) return intDigits
  const last3 = intDigits.slice(-3)
  const rest = intDigits.slice(0, -3)
  return `${rest.replace(/\B(?=(\d\d)+(?!\d))/g, ',')},${last3}`
}

/**
 * Format a raw amount string for live display in an input, using Indian
 * grouping (e.g. "100000" -> "1,00,000", "1234.5" -> "1,234.5"). Keeps a
 * trailing "." while the user is still typing the decimal part and caps
 * decimals at 2 places.
 */
export function formatAmountInput(raw: string): string {
  let cleaned = raw.replace(/[^0-9.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '')
  }
  const hasDot = cleaned.includes('.')
  const [intRaw = '', decRaw = ''] = cleaned.split('.')
  const intClean = intRaw.replace(/^0+(?=\d)/, '')
  const grouped = groupIndian(intClean)
  if (!hasDot) return grouped
  return `${grouped}.${decRaw.slice(0, 2)}`
}

/**
 * Predict the next cheque number by incrementing the trailing numeric run of
 * the last used number, preserving any prefix/suffix and zero-padding
 * (e.g. "100234" -> "100235", "CHQ-000999" -> "CHQ-001000"). Returns '' when
 * there is no usable number to increment.
 */
export function nextChequeNumber(last?: string | null): string {
  if (!last) return ''
  const m = last.match(/^(.*?)(\d+)(\D*)$/)
  if (!m) return ''
  const [, prefix, digits, suffix] = m
  const incremented = (BigInt(digits) + 1n).toString().padStart(digits.length, '0')
  return `${prefix}${incremented}${suffix}`
}
