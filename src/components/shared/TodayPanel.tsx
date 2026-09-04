import type { ReactNode } from 'react'
import { format, startOfDay } from 'date-fns'
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusPill } from '@/components/shared/StatusPill'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { getOverdueTag, OVERDUE_TAG_LABELS, OVERDUE_TAG_CLASSES } from '@/lib/chequeTags'
import type { Cheque } from '@/types'

interface TodayPanelProps {
  cheques: Cheque[]
  currencySymbol?: string
  onSelectCheque?: (chequeId: string) => void
}

/**
 * Hero panel — first thing the user sees on the dashboard.
 *
 * Answers: "What cheques need attention today?"
 *
 * Layout:
 * - Single "Cash Needed Today" stat (today's pending + all overdue amounts)
 * - Combined cheque list:
 *   1. "Today's Cheques" — due today, status PENDING or DEPOSITED
 *   2. "Overdue Cheques" — due before today, status PENDING or DEPOSITED
 *     each with an "Overdue" or "Overdue · Deposited" tag and original due date
 *
 * PASSED cheques are completely done — never shown here.
 */
export function TodayPanel({
  cheques,
  currencySymbol = '₹',
  onSelectCheque,
}: TodayPanelProps) {
  const today = startOfDay(new Date())
  const todayStr = format(today, 'yyyy-MM-dd')
  const dayName = format(today, 'EEEE')

  // Today's cheques — due today and still pending or deposited
  const todayCheques = cheques.filter(
    (c) => c.due_date === todayStr && ['PENDING', 'DEPOSITED'].includes(c.status)
  )

  // Overdue cheques — due before today and still pending or deposited
  const overdue = cheques.filter(
    (c) => c.due_date < todayStr && ['PENDING', 'DEPOSITED'].includes(c.status)
  )

  const todayAmount = todayCheques.filter((c) => c.status === 'PENDING').reduce((s, c) => s + Number(c.amount), 0)
  const overdueAmount = overdue.filter((c) => c.status === 'PENDING').reduce((s, c) => s + Number(c.amount), 0)
  const totalCashNeeded = todayAmount + overdueAmount
  const totalCount = todayCheques.length + overdue.length

  type BannerState = 'no-cheques' | 'has-overdue' | 'today-only'
  const bannerState: BannerState =
    totalCount === 0 ? 'no-cheques' : overdue.length > 0 ? 'has-overdue' : 'today-only'

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
          {bannerState === 'has-overdue' && (
            <Badge variant="destructive" className="gap-1.5 self-start">
              <AlertTriangle className="h-3.5 w-3.5" />
              {overdue.length} overdue
            </Badge>
          )}
          {bannerState === 'today-only' && (
            <Badge
              variant="secondary"
              className="bg-amber-100 text-amber-800 hover:bg-amber-100 gap-1.5 self-start"
            >
              <Clock className="h-3.5 w-3.5" />
              {todayCheques.length} cheque{todayCheques.length !== 1 ? 's' : ''} due
            </Badge>
          )}
        </div>

        {/* Single stat block — Cash Needed Today */}
        <div className="mt-5">
          <StatBlock
            label="Cash needed today"
            value={formatCurrency(totalCashNeeded, currencySymbol)}
            sub={
              overdue.length > 0
                ? `${todayCheques.length} today · ${overdue.length} overdue · ${totalCount} total`
                : `${todayCheques.length} cheque${todayCheques.length !== 1 ? 's' : ''} due today`
            }
            tone="amber"
            primary
          />
        </div>

        {/* Today's cheques */}
        {todayCheques.length > 0 && (
          <div className="mt-5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Today's Cheques
            </p>
            <div className="space-y-2">
              {todayCheques.map((c) => (
                <ChequeRow
                  key={c.id}
                  cheque={c}
                  currencySymbol={currencySymbol}
                  onSelect={onSelectCheque}
                />
              ))}
            </div>
          </div>
        )}

        {/* Overdue cheques */}
        {overdue.length > 0 && (
          <div className="mt-5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-orange-600" />
              Overdue Cheques · {formatCurrency(overdueAmount, currencySymbol)}
            </p>
            <div className="space-y-2">
              {overdue.map((c) => (
                <ChequeRow
                  key={c.id}
                  cheque={c}
                  currencySymbol={currencySymbol}
                  onSelect={onSelectCheque}
                  showOverdueTag
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {totalCount === 0 && (
          <p className="mt-4 text-sm text-muted-foreground text-center py-4">
            No pending or overdue cheques — you're all clear! 🎉
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/* ---------- Cheque row component ---------- */

interface ChequeRowProps {
  cheque: Cheque
  currencySymbol: string
  onSelect?: (chequeId: string) => void
  showOverdueTag?: boolean
}

function ChequeRow({ cheque, currencySymbol, onSelect, showOverdueTag }: ChequeRowProps) {
  const overdueTag = showOverdueTag ? getOverdueTag(cheque) : null

  return (
    <button
      type="button"
      onClick={() => onSelect?.(cheque.id)}
      className="w-full flex items-center justify-between gap-3 rounded-lg border bg-background p-3 text-left hover:bg-muted/50 active:bg-muted transition-colors"
    >
      <div className="min-w-0">
        <p className="font-medium truncate">
          {cheque.party?.name ?? 'Unknown'}
        </p>
        <p className="text-xs text-muted-foreground">
          #{cheque.cheque_number} · {cheque.bank_name}
        </p>
        {overdueTag && (
          <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5 flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Was due {formatDate(cheque.due_date)}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <p className="font-semibold">
            {formatCurrency(Number(cheque.amount), currencySymbol)}
          </p>
          {overdueTag ? (
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                OVERDUE_TAG_CLASSES[overdueTag]
              )}
            >
              {OVERDUE_TAG_LABELS[overdueTag]}
            </span>
          ) : (
            <StatusPill status={cheque.status} />
          )}
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
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
