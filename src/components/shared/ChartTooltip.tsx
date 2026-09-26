import { formatCurrency } from '@/lib/formatters'

interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>
  label?: string
  currencySymbol?: string
}

export function CurrencyTooltip({ active, payload, label, currencySymbol = '₹' }: ChartTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm">
      {label && <p className="font-medium mb-1.5 text-foreground">{label}</p>}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name ?? entry.dataKey}:</span>
            <span className="font-medium">{formatCurrency(Number(entry.value ?? 0), currencySymbol)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
