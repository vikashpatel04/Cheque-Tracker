import { differenceInDays, parseISO, startOfDay } from 'date-fns'
import { cn } from '@/lib/utils'

interface DaysUntilDueProps {
  dueDate: string
  status: string
  className?: string
}

export function DaysUntilDue({ dueDate, status, className }: DaysUntilDueProps) {
  if (status === 'PASSED' || status === 'RETURNED' || status === 'CANCELLED') {
    return <span className={cn('text-sm text-muted-foreground', className)}>—</span>
  }

  const days = differenceInDays(startOfDay(parseISO(dueDate)), startOfDay(new Date()))
  const label = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`

  const colorClass =
    days < 0
      ? 'text-gray-500'
      : days <= 3
        ? 'text-red-600 font-medium'
        : days <= 7
          ? 'text-amber-600'
          : 'text-green-600'

  return <span className={cn('text-sm', colorClass, className)}>{label}</span>
}
