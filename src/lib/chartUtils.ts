import { formatCurrencyCompact } from './formatters'

export { formatMonthLabel } from './formatters'

export const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  DEPOSITED: '#3b82f6',
  PASSED: '#6b7280',
  RETURNED: '#ef4444',
  CANCELLED: '#64748b',
  WRITTEN_OFF: '#a1a1aa',
}

export const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

export const chartGridStyle = { strokeDasharray: '3 3', stroke: 'hsl(var(--border))' }

/** Axis and tile amounts in the user's currency, shortened (₹1.2L, $1.2M). */
export function formatChartCurrency(value: number): string {
  return formatCurrencyCompact(value)
}
