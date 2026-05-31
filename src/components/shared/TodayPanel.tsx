import type { ReactNode } from 'react'
import { format, startOfDay } from 'date-fns'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Info,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusPill } from '@/components/shared/StatusPill'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { Cheque } from '@/types'

interface TodayPanelProps {
  cheques: Cheque[]
  /** Sum of `daily_deposits` already logged for today. */
  depositedToday: number
  currencySymbol?: string
  onSelectCheque?: (chequeId: string) => void
}

/**
 * Hero panel — first thing the user sees on the dashboard.
 *
 * Answers: "How much cash do I need today, and am I covered?"
 *
 * - Cash needed = sum of cheques due today still in PENDING.
 * - Deposited today = sum of `daily_deposits` rows logged today
 *   (manually entered or via allocation).
 * - Already in bank = cheques due today that are already DEPOSITED.
 * - Overdue = PENDING cheques whose due_date is before today.
 */
export function TodayPanel({
  cheques,
  depositedToday,
  currencySymbol = '₹',
  onSelectCheque,
}: TodayPanelProps) {
  const today = startOfDay(new Date())
  const todayStr = format(today, 'yyyy-MM-dd')
  const dayName = format(today, 'EEEE')

  const todayPending = cheques.filter(
    (c) => c.due_date === todayStr && c.status === 'PENDING'
  )
  const todayDeposited = cheques.filter(
    (c) => c.due_date === todayStr && c.status === 'DEPOSITED'
  )
  const overdue = cheques.filter(
    (c) => c.status === 'PENDING' && c.due_date < todayStr
  )

  const cashNeeded = todayPending.reduce((s, c) => s + Number(c.amount), 0)
  const inBank = todayDeposited.reduce((s, c) => s + Number(c.amount), 0)
  const overdueAmount = overdue.reduce((s, c) => s + Number(c.amount), 0)
  const gap = depositedToday - cashNeeded // positive = surplus

  type BannerState = 'no-cheques' | 'covered' | 'short'
  const bannerState: BannerState =
    cashNeeded === 0 ? 'no-cheques' : gap >= 0 ? 'covered' : 'short'

  return (
    <Card className="border-2">
      <CardContent className="p-5 sm:p-6">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Today · {dayName}
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold mt-0.5 leading-tight">
              {formatDate(todayStr)}
            </h2>
          </div>

          {bannerState === 'no-cheques' && (
            <Badge
              variant="secondary"
              className="bg-muted text-muted-foreground gap-1.5 self-start"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> No cheques due today
            </Badge>
          )}
          {bannerState === 'covered' && (
            <Badge
              variant="secondary"
              className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 gap-1.5 self-start"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Covered
              {gap > 0 && ` · ${formatCurrency(gap, currencySymbol)} surplus`}
            </Badge>
          )}
          {bannerState === 'short' && (
            <Badge variant="destructive" className="gap-1.5 self-start">
              <TrendingDown className="h-3.5 w-3.5" />
              Short by {formatCurrency(Math.abs(gap), currencySymbol)}
            </Badge>
          )}
        </div>

        {/* Big numbers — the answer to the core question.
            Two cards only; we intentionally do NOT show a "bank balance" card
            because daily_deposits is not the actual bank balance (cash may be
            spent elsewhere). Cheques already submitted to the bank for today
            are surfaced as a small inline note below instead. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
          <StatBlock
            label="Cash needed today"
            value={formatCurrency(cashNeeded, currencySymbol)}
            sub={`${todayPending.length} pending cheque${todayPending.length !== 1 ? 's' : ''}`}
            tone="amber"
            primary
          />
          <StatBlock
            label="Deposited today"
            value={formatCurrency(depositedToday, currencySymbol)}
            sub="From daily deposit log"
            tone="emerald"
            icon={<Wallet className="h-3.5 w-3.5" />}
          />
        </div>

        {/* Awaiting clearance — shown only when relevant, as a low-emphasis line */}
        {todayDeposited.length > 0 && (
          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-600" />
            <span>
              <span className="font-medium text-foreground">
                {todayDeposited.length} cheque{todayDeposited.length !== 1 ? 's' : ''}
              </span>{' '}
              for today already submitted to the bank ·{' '}
              {formatCurrency(inBank, currencySymbol)} awaiting clearance
            </span>
          </p>
        )}

        {/* Today's pending cheques — actionable list */}
        {todayPending.length > 0 && (
          <div className="mt-5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Pending cheques due today
            </p>
            <div className="space-y-2">
              {todayPending.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectCheque?.(c.id)}
                  className="w-full flex items-center justify-between gap-3 rounded-lg border bg-background p-3 text-left hover:bg-muted/50 active:bg-muted transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {c.party?.name ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      #{c.cheque_number} · {c.bank_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatCurrency(Number(c.amount), currencySymbol)}
                      </p>
                      <StatusPill status={c.status} />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Overdue alert */}
        {overdue.length > 0 && (
          <div className="mt-4 rounded-lg border border-red-300/70 bg-red-50 dark:bg-red-950/20 p-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                  {overdue.length} overdue cheque
                  {overdue.length !== 1 ? 's' : ''} ·{' '}
                  {formatCurrency(overdueAmount, currencySymbol)}
                </p>
                <p className="text-xs text-red-600/80 dark:text-red-300/80 mt-0.5">
                  Still pending past their due date. Review and update status.
                </p>
                <div className="mt-2 space-y-1">
                  {overdue.slice(0, 3).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSelectCheque?.(c.id)}
                      className="block text-xs text-red-700 dark:text-red-300 hover:underline text-left"
                    >
                      <span className="font-medium">{c.party?.name}</span> ·{' '}
                      {formatCurrency(Number(c.amount), currencySymbol)} (was due{' '}
                      {formatDate(c.due_date)})
                    </button>
                  ))}
                  {overdue.length > 3 && (
                    <p className="text-xs text-red-600/70 dark:text-red-300/70">
                      + {overdue.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ---------- Tiny stat block, kept inline to avoid extra files ---------- */

interface StatBlockProps {
  label: string
  value: string
  sub?: string
  tone: 'amber' | 'emerald'
  icon?: ReactNode
  primary?: boolean
}

function StatBlock({ label, value, sub, tone, icon, primary }: StatBlockProps) {
  const tones = {
    amber: {
      wrap: 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40',
      text: 'text-amber-700 dark:text-amber-300',
    },
    emerald: {
      wrap: 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40',
      text: 'text-emerald-700 dark:text-emerald-300',
    },
  }[tone]

  return (
    <div className={cn('rounded-lg border p-4', tones.wrap)}>
      <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <p className={cn('font-bold mt-1 tabular-nums', primary ? 'text-3xl' : 'text-2xl', tones.text)}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}
