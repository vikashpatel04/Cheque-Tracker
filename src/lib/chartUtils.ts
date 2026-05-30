export const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  DEPOSITED: '#3b82f6',
  PASSED: '#6b7280',
  RETURNED: '#ef4444',
  CANCELLED: '#64748b',
}

export const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

export const chartGridStyle = { strokeDasharray: '3 3', stroke: 'hsl(var(--border))' }

export function formatChartCurrency(value: number, symbol = '₹'): string {
  if (value >= 10000000) return `${symbol}${(value / 10000000).toFixed(1)}Cr`
  if (value >= 100000) return `${symbol}${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `${symbol}${(value / 1000).toFixed(1)}K`
  return `${symbol}${value.toLocaleString('en-IN')}`
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}
