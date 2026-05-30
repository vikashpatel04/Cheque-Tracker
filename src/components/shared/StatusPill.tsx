import type { ChequeStatus } from '@/types'
import { cn } from '@/lib/utils'

const statusStyles: Record<ChequeStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  DEPOSITED: 'bg-blue-100 text-blue-800 border-blue-200',
  PASSED: 'bg-gray-100 text-gray-700 border-gray-200',
  RETURNED: 'bg-red-100 text-red-800 border-red-200',
  CANCELLED: 'bg-slate-100 text-slate-700 border-slate-200',
}

interface StatusPillProps {
  status: ChequeStatus
  className?: string
}

export function StatusPill({ status, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        statusStyles[status],
        className
      )}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  )
}
