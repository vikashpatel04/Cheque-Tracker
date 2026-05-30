import { useEffect, useState, useMemo } from 'react'
import {
  addDays,
  startOfDay,
  differenceInDays,
  parseISO,
  format,
  subDays,
} from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/formatters'
import { useSettings } from '@/hooks/useSettings'
import { ChequeDetail } from '@/components/cheques/ChequeDetail'
import { ChequeCalendar } from '@/components/shared/ChequeCalendar'
import { CurrencyTooltip } from '@/components/shared/ChartTooltip'
import { STATUS_COLORS, CHART_COLORS, formatChartCurrency, formatMonthLabel } from '@/lib/chartUtils'
import type { Cheque, ChequeHistory } from '@/types'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
} from 'recharts'

export default function Dashboard() {
  const { currencySymbol } = useSettings()
  const [cheques, setCheques] = useState<Cheque[]>([])
  const [history, setHistory] = useState<ChequeHistory[]>([])
  const [detailId, setDetailId] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('cheques')
      .select('*, party:parties(*)')
      .is('deleted_at', null)
      .then(({ data }) => {
        if (data) setCheques(data as Cheque[])
      })
    supabase
      .from('cheque_history')
      .select('*, cheque:cheques(*, party:parties(*))')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setHistory(data as ChequeHistory[])
      })
  }, [])

  const today = startOfDay(new Date())

  const urgentCheques = cheques.filter((c) => {
    if (c.status !== 'PENDING') return false
    const days = differenceInDays(startOfDay(parseISO(c.due_date)), today)
    return days <= 3
  })

  const outstanding = cheques
    .filter((c) => ['PENDING', 'DEPOSITED'].includes(c.status))
    .reduce((s, c) => s + Number(c.amount), 0)

  const weekEnd = addDays(today, 7)
  const monthEnd = addDays(today, 30)

  const dueThisWeek = cheques.filter((c) => {
    if (!['PENDING', 'DEPOSITED'].includes(c.status)) return false
    const d = parseISO(c.due_date)
    return d >= today && d <= weekEnd
  })

  const dueThisMonth = cheques.filter((c) => {
    if (!['PENDING', 'DEPOSITED'].includes(c.status)) return false
    const d = parseISO(c.due_date)
    return d >= today && d <= monthEnd
  })

  const returnedCount = cheques.filter((c) => c.status === 'RETURNED').length

  const calendarDays = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const date = addDays(today, i)
      const dateStr = format(date, 'yyyy-MM-dd')
      const dayCheques = cheques.filter(
        (c) => c.due_date === dateStr && ['PENDING', 'DEPOSITED'].includes(c.status)
      )
      const pending = dayCheques.filter((c) => c.status === 'PENDING').reduce((s, c) => s + Number(c.amount), 0)
      const deposited = dayCheques.filter((c) => c.status === 'DEPOSITED').reduce((s, c) => s + Number(c.amount), 0)
      const total = pending + deposited
      return { date: dateStr, label: format(date, 'dd MMM'), pending, deposited, total, count: dayCheques.length }
    })
  }, [cheques, today])

  const cumulativeData = useMemo(() => {
    let running = 0
    return calendarDays.map((d) => {
      running += d.total
      return { ...d, cumulative: running }
    })
  }, [calendarDays])

  const statusBreakdown = useMemo(() => {
    const statuses: Record<string, { count: number; amount: number }> = {}
    cheques.forEach((c) => {
      if (!statuses[c.status]) statuses[c.status] = { count: 0, amount: 0 }
      statuses[c.status].count++
      statuses[c.status].amount += Number(c.amount)
    })
    return Object.entries(statuses).map(([status, data]) => ({
      status,
      name: status.charAt(0) + status.slice(1).toLowerCase(),
      ...data,
      fill: STATUS_COLORS[status] ?? '#6b7280',
    }))
  }, [cheques])

  const monthlyTrend = useMemo(() => {
    const months: Record<string, { issued: number; due: number; cleared: number }> = {}
    const start = subDays(today, 180)
    cheques.forEach((c) => {
      const issueMonth = c.issue_date.slice(0, 7)
      const dueMonth = c.due_date.slice(0, 7)
      if (parseISO(c.issue_date) >= start) {
        if (!months[issueMonth]) months[issueMonth] = { issued: 0, due: 0, cleared: 0 }
        months[issueMonth].issued += Number(c.amount)
      }
      if (parseISO(c.due_date) >= start) {
        if (!months[dueMonth]) months[dueMonth] = { issued: 0, due: 0, cleared: 0 }
        months[dueMonth].due += Number(c.amount)
      }
      if (c.status === 'PASSED') {
        const clearMonth = (c.updated_at ?? c.due_date).slice(0, 7)
        if (!months[clearMonth]) months[clearMonth] = { issued: 0, due: 0, cleared: 0 }
        months[clearMonth].cleared += Number(c.amount)
      }
    })
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, data]) => ({ month: formatMonthLabel(month), ...data }))
  }, [cheques, today])

  const topParties = useMemo(() => {
    const parties: Record<string, { name: string; outstanding: number }> = {}
    cheques
      .filter((c) => ['PENDING', 'DEPOSITED'].includes(c.status))
      .forEach((c) => {
        const id = c.party_id
        if (!parties[id]) parties[id] = { name: c.party?.name ?? 'Unknown', outstanding: 0 }
        parties[id].outstanding += Number(c.amount)
      })
    return Object.values(parties)
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 6)
  }, [cheques])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Cash flow overview and upcoming cheque liabilities</p>
      </div>

      {urgentCheques.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Urgent — Due in 3 days</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {urgentCheques.map((c) => {
              const days = differenceInDays(startOfDay(parseISO(c.due_date)), today)
              return (
                <Card
                  key={c.id}
                  className="min-w-[200px] cursor-pointer shrink-0 hover:shadow-md transition-shadow"
                  onClick={() => setDetailId(c.id)}
                >
                  <CardContent className="p-4">
                    <p className="font-medium truncate">{c.party?.name}</p>
                    <p className="text-lg font-semibold">{formatCurrency(Number(c.amount), currencySymbol)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(c.due_date)}</p>
                    <Badge
                      variant={days <= 1 ? 'destructive' : 'secondary'}
                      className={days === 2 || days === 3 ? 'bg-amber-100 text-amber-800' : ''}
                    >
                      {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`}
                    </Badge>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Outstanding', value: formatCurrency(outstanding, currencySymbol), sub: `${dueThisMonth.length} due this month` },
          {
            label: 'Due This Week',
            value: formatCurrency(dueThisWeek.reduce((s, c) => s + Number(c.amount), 0), currencySymbol),
            sub: `${dueThisWeek.length} cheques`,
          },
          {
            label: 'Due This Month',
            value: formatCurrency(dueThisMonth.reduce((s, c) => s + Number(c.amount), 0), currencySymbol),
            sub: `${dueThisMonth.length} cheques`,
          },
          { label: 'Needs Attention', value: `${returnedCount}`, sub: 'returned cheques' },
        ].map(({ label, value, sub }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-semibold mt-0.5">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly calendar */}
      <ChequeCalendar
        cheques={cheques}
        currencySymbol={currencySymbol}
        onSelectCheque={setDetailId}
        title="Monthly Cheque Calendar"
      />

      {/* Charts row 1 */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">30-Day Liability Forecast</CardTitle>
            <CardDescription>Stacked daily outflow — pending vs deposited</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={calendarDays}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} />
                <YAxis tickFormatter={(v) => formatChartCurrency(v, currencySymbol)} tick={{ fontSize: 10 }} width={55} />
                <Tooltip content={<CurrencyTooltip currencySymbol={currencySymbol} />} />
                <Legend />
                <Bar dataKey="pending" stackId="a" fill={STATUS_COLORS.PENDING} name="Pending" radius={[0, 0, 0, 0]} />
                <Bar dataKey="deposited" stackId="a" fill={STATUS_COLORS.DEPOSITED} name="Deposited" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cumulative Liability Curve</CardTitle>
            <CardDescription>Running total of upcoming outflows over 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={cumulativeData}>
                <defs>
                  <linearGradient id="cumGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} />
                <YAxis tickFormatter={(v) => formatChartCurrency(v, currencySymbol)} tick={{ fontSize: 10 }} width={55} />
                <Tooltip content={<CurrencyTooltip currencySymbol={currencySymbol} />} />
                <Area type="monotone" dataKey="cumulative" stroke="#3b82f6" fill="url(#cumGradient)" name="Cumulative" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Breakdown</CardTitle>
            <CardDescription>By amount across all cheques</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={statusBreakdown}
                  dataKey="amount"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {statusBreakdown.map((entry) => (
                    <Cell key={entry.status} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CurrencyTooltip currencySymbol={currencySymbol} />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">6-Month Cash Flow Trend</CardTitle>
            <CardDescription>Issued vs due vs cleared amounts by month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatChartCurrency(v, currencySymbol)} tick={{ fontSize: 10 }} width={55} />
                <Tooltip content={<CurrencyTooltip currencySymbol={currencySymbol} />} />
                <Legend />
                <Bar dataKey="issued" fill="#3b82f6" name="Issued" barSize={16} radius={[3, 3, 0, 0]} />
                <Bar dataKey="due" fill="#f59e0b" name="Due" barSize={16} radius={[3, 3, 0, 0]} />
                <Line type="monotone" dataKey="cleared" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Cleared" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top parties */}
      {topParties.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Outstanding by Party</CardTitle>
            <CardDescription>Largest pending + deposited amounts</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(180, topParties.length * 40)}>
              <BarChart data={topParties} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => formatChartCurrency(v, currencySymbol)} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip content={<CurrencyTooltip currencySymbol={currencySymbol} />} />
                <Bar dataKey="outstanding" fill="#8b5cf6" name="Outstanding" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {history.length === 0 ? (
            <p className="text-muted-foreground text-sm">No recent activity</p>
          ) : (
            history.map((h) => {
              const cheque = h.cheque as Cheque | undefined
              const partyName = cheque?.party?.name ?? 'Unknown'
              const amount = cheque ? formatCurrency(Number(cheque.amount), currencySymbol) : ''
              const via = h.changed_by === 'deposit_allocation' ? ' via deposit allocation' : h.changed_by === 'auto' ? ' (auto)' : ''
              return (
                <div key={h.id} className="flex items-start gap-3 text-sm border-b pb-2 last:border-0">
                  <span
                    className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: STATUS_COLORS[h.to_status] ?? CHART_COLORS[0] }}
                  />
                  <p>
                    <span className="font-medium">{amount}</span> cheque to {partyName} marked{' '}
                    {h.to_status.charAt(0) + h.to_status.slice(1).toLowerCase()}
                    {via} — <span className="text-muted-foreground">{formatDateTime(h.created_at)}</span>
                  </p>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <ChequeDetail
        chequeId={detailId}
        open={!!detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
        onEdit={() => {}}
        onRefresh={() => {}}
      />
    </div>
  )
}
