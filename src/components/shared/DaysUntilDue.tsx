import { differenceInDays, parseISO, startOfDay } from 'date-fns'
import { cn } from '@/lib/utils'

interface DaysUntilDueProps {
  dueDate: string
  status: string
  className?: string
}

export function DaysUntilDue({ dueDate, status, className }: DaysUntilDueProps) {
  // Terminal statuses — the cheque's outcome is already decided.
  if (status === 'PASSED' || status === 'RETURNED' || status === 'CANCELLED') {
    return <span className={cn('text-sm text-muted-foreground', className)}>—</span>
  }

  const days = differenceInDays(startOfDay(parseISO(dueDate)), startOfDay(new Date()))

  // DEPOSITED — the cheque has been handed to the bank; the user's action is
  // done. Never label it as "overdue" (that just creates anxiety). Show a
  // neutral "Awaiting clearance" instead, with optional days-until-due context
  // for cheques still in the future.
  if (status === 'DEPOSITED') {
    const suffix =
      days > 0 ? ` · ${days}d` : days === 0 ? ' · today' : ''
    return (
      <span className={cn('text-sm text-blue-700', className)}>
        Awaiting{suffix}
      </span>
    )
  }

  const label =
    days === 0
      ? 'Today'
      : days === 1
        ? 'Tomorrow'
        : days < 0
          ? `${Math.abs(days)}d overdue`
          : `${days}d`

  const colorClass =
    days < 0
      ? 'text-red-600 font-medium'
      : days <= 3
        ? 'text-red-600 font-medium'
        : days <= 7
          ? 'text-amber-600'
          : 'text-green-600'

  return <span className={cn('text-sm', colorClass, className)}>{label}</span>
}
