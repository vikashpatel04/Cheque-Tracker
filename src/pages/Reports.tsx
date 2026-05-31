import { useEffect, useState, useMemo } from 'react'
import { addDays, format, startOfDay, subDays } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { useSettings } from '@/hooks/useSettings'
import { useDeposits } from '@/hooks/useDeposits'
import { CurrencyTooltip } from '@/components/shared/ChartTooltip'
import { STATUS_COLORS, CHART_COLORS, formatChartCurrency, formatMonthLabel } from '@/lib/chartUtils'
import type { Cheque } from '@/types'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Line,
  ComposedChart,
  Area,
  RadialBarChart,
  RadialBar,
  ReferenceLine,
} from 'recharts'

export default function Reports() {
  const { currencySymbol } = useSettings()
  const { deposits } = useDeposits()
  const [cheques, setCheques] = useState<Cheque[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    supabase
      .from('cheques')
      .select('*, party:parties(*)')
      .is('deleted_at', null)
      .then(({ data }) => {
        if (data) setCheques(data as Cheque[])
      })
  }, [])

  const filtered = useMemo(() => {
    return cheques.filter((c) => {
      if (dateFrom && c.issue_date < dateFrom) return false
      if (dateTo && c.issue_date > dateTo) return false
      return true
    })
  }, [cheques, dateFrom, dateTo])

  const monthlyData = useMemo(() => {
    const months: Record<string, { issued: number; cleared: number; returned: number; count: number }> = {}
    filtered.forEach((c) => {
      const month = c.issue_date.slice(0, 7)
      if (!months[month]) months[month] = { issued: 0, cleared: 0, returned: 0, count: 0 }
      months[month].issued += Number(c.amount)
      months[month].count++
      if (c.status === 'PASSED') months[month].cleared += Number(c.amount)
      if (c.status === 'RETURNED') months[month].returned += Number(c.amount)
    })
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month: formatMonthLabel(month),
        monthKey: month,
        ...data,
        netFlow: data.cleared - data.returned,
      }))
  }, [filtered])

  const partyData = useMemo(() => {
    const parties: Record<string, { name: string; issued: number; cleared: number; returned: number; outstanding: number }> = {}
    filtered.forEach((c) => {
      const id = c.party_id
      if (!parties[id]) parties[id] = { name: c.party?.name ?? 'Unknown', issued: 0, cleared: 0, returned: 0, outstanding: 0 }
      parties[id].issued += Number(c.amount)
      if (c.status === 'PASSED') parties[id].cleared += Number(c.amount)
      if (c.status === 'RETURNED') parties[id].returned += Number(c.amount)
      if (['PENDING', 'DEPOSITED'].includes(c.status)) parties[id].outstanding += Number(c.amount)
    })
    return Object.values(parties).sort((a, b) => b.outstanding - a.outstanding)
  }, [filtered])

  const topPartyChart = partyData.slice(0, 8).map((p) => ({
    name: p.name.length > 18 ? p.name.slice(0, 16) + '…' : p.name,
    Outstanding: p.outstanding,
    Cleared: p.cleared,
    Returned: p.returned,
  }))

  const bankData = useMemo(() => {
    const banks: Record<string, number> = {}
    filtered.forEach((c) => {
      banks[c.bank_name] = (banks[c.bank_name] ?? 0) + Number(c.amount)
    })
    return Object.entries(banks)
      .map(([bank, total]) => ({ bank, total, name: bank }))
      .sort((a, b) => b.total - a.total)
  }, [filtered])

  const statusData = useMemo(() => {
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
      fill: STATUS_COLORS[status] ?? CHART_COLORS[0],
    }))
  }, [cheques])

  const statusCountData = statusData.map((s) => ({ ...s, value: s.count }))

  const depositVsOutflow = useMemo(() => {
    const byDate: Record<string, { deposits: number; outflow: number }> = {}

    deposits.forEach((d) => {
      if (!byDate[d.deposit_date]) byDate[d.deposit_date] = { deposits: 0, outflow: 0 }
      byDate[d.deposit_date].deposits += Number(d.amount)
    })

    cheques
      .filter((c) => ['PASSED', 'DEPOSITED'].includes(c.status))
      .forEach((c) => {
        const date = c.due_date
        if (!byDate[date]) byDate[date] = { deposits: 0, outflow: 0 }
        byDate[date].outflow += Number(c.amount)
      })

    let cumDeposits = 0
    let cumOutflow = 0
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-60)
      .map(([date, data]) => {
        cumDeposits += data.deposits
        cumOutflow += data.outflow
        return {
          date: formatDate(date),
          deposits: data.deposits,
          outflow: data.outflow,
          cumDeposits,
          cumOutflow,
        }
      })
  }, [deposits, cheques])

  const summaryStats = useMemo(() => {
    const totalIssued = filtered.reduce((s, c) => s + Number(c.amount), 0)
    const totalCleared = filtered.filter((c) => c.status === 'PASSED').reduce((s, c) => s + Number(c.amount), 0)
    const totalReturned = filtered.filter((c) => c.status === 'RETURNED').reduce((s, c) => s + Number(c.amount), 0)
    const totalOutstanding = filtered
      .filter((c) => ['PENDING', 'DEPOSITED'].includes(c.status))
      .reduce((s, c) => s + Number(c.amount), 0)
    return { totalIssued, totalCleared, totalReturned, totalOutstanding, count: filtered.length }
  }, [filtered])

  /**
   * 28-day rolling daily cash flow — 14 days back + 14 days forward.
   * Each row aggregates cheque liabilities and deposits made on that date.
   */
  const dailyCashFlow = useMemo(() => {
    const today = startOfDay(new Date())
    const todayStr = format(today, 'yyyy-MM-dd')

    // Pre-index deposits by deposit_date for O(1) lookup
    const depositsByDate: Record<string, number> = {}
    deposits.forEach((d) => {
      depositsByDate[d.deposit_date] = (depositsByDate[d.deposit_date] ?? 0) + Number(d.amount)
    })

    return Array.from({ length: 28 }, (_, i) => {
      const date = addDays(subDays(today, 14), i)
      const dateStr = format(date, 'yyyy-MM-dd')
      const isPast = dateStr < todayStr
      const isToday = dateStr === todayStr
      const dayCheques = cheques.filter((c) => c.due_date === dateStr)

      const pending = dayCheques
        .filter((c) => c.status === 'PENDING')
        .reduce((s, c) => s + Number(c.amount), 0)
      const deposited = dayCheques
        .filter((c) => c.status === 'DEPOSITED')
        .reduce((s, c) => s + Number(c.amount), 0)
      const passed = dayCheques
        .filter((c) => c.status === 'PASSED')
        .reduce((s, c) => s + Number(c.amount), 0)
      const returned = dayCheques
        .filter((c) => c.status === 'RETURNED')
        .reduce((s, c) => s + Number(c.amount), 0)

      const totalCheques = pending + deposited + passed + returned
      const depositLog = depositsByDate[dateStr] ?? 0
      // Gap = cash needed for the day minus cash logged as deposited that day.
      // For past dates: liability = passed (actually paid that day).
      // For future dates: liability = pending + deposited (still need funds).
      const cashRequired = isPast ? passed : pending + deposited
      const gap = depositLog - cashRequired

      return {
        date: dateStr,
        label: format(date, 'dd MMM'),
        weekday: format(date, 'EEE'),
        isPast,
        isToday,
        count: dayCheques.length,
        pending,
        deposited,
        passed,
        returned,
        totalCheques,
        depositLog,
        cashRequired,
        gap,
      }
    })
  }, [cheques, deposits])

  const dailySummary = useMemo(() => {
    const today = startOfDay(new Date())
    const todayStr = format(today, 'yyyy-MM-dd')
    const upcoming = dailyCashFlow.filter((d) => d.date >= todayStr)
    const past = dailyCashFlow.filter((d) => d.date < todayStr)
    return {
      next14Required: upcoming.reduce((s, d) => s + d.cashRequired, 0),
      next14Cheques: upcoming.reduce((s, d) => s + d.count, 0),
      past14Required: past.reduce((s, d) => s + d.cashRequired, 0),
      past14Deposited: past.reduce((s, d) => s + d.depositLog, 0),
      todayRequired: dailyCashFlow.find((d) => d.isToday)?.cashRequired ?? 0,
      todayDeposited: dailyCashFlow.find((d) => d.isToday)?.depositLog ?? 0,
    }
  }, [dailyCashFlow])

  const todayLabel = useMemo(() => dailyCashFlow.find((d) => d.isToday)?.label, [dailyCashFlow])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Reports</h2>
        <p className="text-sm text-muted-foreground">Detailed analytics and export-ready summaries</p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total Issued', value: formatCurrency(summaryStats.totalIssued, currencySymbol) },
          { label: 'Cleared', value: formatCurrency(summaryStats.totalCleared, currencySymbol) },
          { label: 'Outstanding', value: formatCurrency(summaryStats.totalOutstanding, currencySymbol) },
          { label: 'Returned', value: formatCurrency(summaryStats.totalReturned, currencySymbol) },
          { label: 'Cheques', value: String(summaryStats.count) },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <Label>From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <Label>To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <Button variant="outline" onClick={() => { setDateFrom(''); setDateTo('') }}>Clear filters</Button>
      </div>

      <Tabs defaultValue="daily">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="daily">Daily Cash Flow</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="party">Party-wise</TabsTrigger>
          <TabsTrigger value="bank">Bank-wise</TabsTrigger>
          <TabsTrigger value="deposits">Deposits</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4 mt-4">
          {/* Quick stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: 'Today',
                value: formatCurrency(dailySummary.todayRequired, currencySymbol),
                sub: `${formatCurrency(dailySummary.todayDeposited, currencySymbol)} deposited`,
                tone:
                  dailySummary.todayRequired > 0 &&
                  dailySummary.todayDeposited < dailySummary.todayRequired
                    ? 'danger'
                    : undefined,
              },
              {
                label: 'Next 14 days',
                value: formatCurrency(dailySummary.next14Required, currencySymbol),
                sub: `${dailySummary.next14Cheques} cheques`,
              },
              {
                label: 'Past 14 days — required',
                value: formatCurrency(dailySummary.past14Required, currencySymbol),
                sub: 'cleared cheques',
              },
              {
                label: 'Past 14 days — deposited',
                value: formatCurrency(dailySummary.past14Deposited, currencySymbol),
                sub: 'logged deposits',
              },
            ].map(({ label, value, sub, tone }) => (
              <Card key={label} className={tone === 'danger' ? 'border-red-300/70' : ''}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p
                    className={cn(
                      'text-lg font-semibold mt-0.5 tabular-nums',
                      tone === 'danger' && 'text-red-600'
                    )}
                  >
                    {value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Combined 28-day chart */}
          <Card>
            <CardHeader>
              <CardTitle>28-Day Cash Flow</CardTitle>
              <CardDescription>
                Cheque liability vs deposits logged — past 14 days and next 14 days, with today marked
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={dailyCashFlow}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={1} />
                  <YAxis
                    tickFormatter={(v) => formatChartCurrency(v, currencySymbol)}
                    tick={{ fontSize: 10 }}
                    width={55}
                  />
                  <Tooltip content={<CurrencyTooltip currencySymbol={currencySymbol} />} />
                  <Legend />
                  {todayLabel && (
                    <ReferenceLine
                      x={todayLabel}
                      stroke="#ef4444"
                      strokeDasharray="3 3"
                      label={{ value: 'Today', fill: '#ef4444', fontSize: 10, position: 'top' }}
                    />
                  )}
                  <Bar dataKey="pending" stackId="cheques" fill={STATUS_COLORS.PENDING} name="Pending" />
                  <Bar
                    dataKey="deposited"
                    stackId="cheques"
                    fill={STATUS_COLORS.DEPOSITED}
                    name="Deposited"
                  />
                  <Bar
                    dataKey="passed"
                    stackId="cheques"
                    fill={STATUS_COLORS.PASSED}
                    name="Passed"
                    radius={[3, 3, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="depositLog"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Deposit Log"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Day-by-day table */}
          <Card>
            <CardHeader>
              <CardTitle>Day-by-day Breakdown</CardTitle>
              <CardDescription>
                Past 14 days show cleared amounts; next 14 days show cash you'll need
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="p-3 text-foreground">Date</TableHead>
                    <TableHead className="p-3 text-foreground">Day</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Cheques</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Pending</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Deposited</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Required</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Deposit Log</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Gap</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyCashFlow.map((d) => {
                    const shortfall = d.cashRequired > 0 && d.depositLog < d.cashRequired
                    return (
                      <TableRow
                        key={d.date}
                        className={cn(
                          d.isToday && 'bg-primary/5 font-medium',
                          d.isPast && 'text-muted-foreground'
                        )}
                      >
                        <TableCell className="p-3">
                          {formatDate(d.date)}
                          {d.isToday && (
                            <span className="ml-2 text-[10px] uppercase tracking-wider text-primary font-semibold">
                              Today
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="p-3">{d.weekday}</TableCell>
                        <TableCell className="p-3 text-right tabular-nums">{d.count || '—'}</TableCell>
                        <TableCell className="p-3 text-right tabular-nums">
                          {d.pending > 0 ? formatCurrency(d.pending, currencySymbol) : '—'}
                        </TableCell>
                        <TableCell className="p-3 text-right tabular-nums">
                          {d.deposited > 0 ? formatCurrency(d.deposited, currencySymbol) : '—'}
                        </TableCell>
                        <TableCell className="p-3 text-right font-medium tabular-nums">
                          {d.cashRequired > 0 ? formatCurrency(d.cashRequired, currencySymbol) : '—'}
                        </TableCell>
                        <TableCell className="p-3 text-right tabular-nums text-emerald-600">
                          {d.depositLog > 0 ? formatCurrency(d.depositLog, currencySymbol) : '—'}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'p-3 text-right tabular-nums font-medium',
                            d.gap < 0 && shortfall && 'text-red-600',
                            d.gap > 0 && 'text-emerald-600'
                          )}
                        >
                          {d.cashRequired === 0 && d.depositLog === 0
                            ? '—'
                            : formatCurrency(d.gap, currencySymbol)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4 mt-4">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Comparison</CardTitle>
                <CardDescription>Issued, cleared, and returned by month</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => formatChartCurrency(v, currencySymbol)} tick={{ fontSize: 10 }} width={55} />
                    <Tooltip content={<CurrencyTooltip currencySymbol={currencySymbol} />} />
                    <Legend />
                    <Bar dataKey="issued" fill="#3b82f6" name="Issued" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="cleared" fill="#22c55e" name="Cleared" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="returned" fill="#ef4444" name="Returned" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Net Cash Flow</CardTitle>
                <CardDescription>Cleared minus returned per month</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => formatChartCurrency(v, currencySymbol)} tick={{ fontSize: 10 }} width={55} />
                    <Tooltip content={<CurrencyTooltip currencySymbol={currencySymbol} />} />
                    <Legend />
                    <Area type="monotone" dataKey="netFlow" fill="#22c55e" stroke="#22c55e" fillOpacity={0.15} name="Net Flow" />
                    <Line type="monotone" dataKey="issued" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Issued" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Monthly Data Table</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="p-3 text-foreground">Month</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Cheques</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Issued</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Cleared</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Returned</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Net Flow</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyData.map((m) => (
                    <TableRow key={m.monthKey}>
                      <TableCell className="p-3 font-medium">{m.month}</TableCell>
                      <TableCell className="p-3 text-right">{m.count}</TableCell>
                      <TableCell className="p-3 text-right">{formatCurrency(m.issued, currencySymbol)}</TableCell>
                      <TableCell className="p-3 text-right text-green-600">{formatCurrency(m.cleared, currencySymbol)}</TableCell>
                      <TableCell className="p-3 text-right text-red-600">{formatCurrency(m.returned, currencySymbol)}</TableCell>
                      <TableCell className="p-3 text-right">{formatCurrency(m.netFlow, currencySymbol)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="party" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Parties — Stacked Breakdown</CardTitle>
              <CardDescription>Outstanding, cleared, and returned for top 8 parties</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={topPartyChart} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => formatChartCurrency(v, currencySymbol)} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CurrencyTooltip currencySymbol={currencySymbol} />} />
                  <Legend />
                  <Bar dataKey="Outstanding" stackId="a" fill={STATUS_COLORS.PENDING} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Cleared" stackId="a" fill={STATUS_COLORS.PASSED} />
                  <Bar dataKey="Returned" stackId="a" fill={STATUS_COLORS.RETURNED} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="p-3 text-foreground">Party</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Issued</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Cleared</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Returned</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partyData.map((p) => (
                    <TableRow key={p.name}>
                      <TableCell className="p-3 font-medium">{p.name}</TableCell>
                      <TableCell className="p-3 text-right">{formatCurrency(p.issued, currencySymbol)}</TableCell>
                      <TableCell className="p-3 text-right">{formatCurrency(p.cleared, currencySymbol)}</TableCell>
                      <TableCell className="p-3 text-right">{formatCurrency(p.returned, currencySymbol)}</TableCell>
                      <TableCell className="p-3 text-right font-medium">{formatCurrency(p.outstanding, currencySymbol)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank" className="space-y-4 mt-4">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Bank Outflow Distribution</CardTitle>
                <CardDescription>Share of total cheque amounts by bank</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={bankData} dataKey="total" nameKey="bank" cx="50%" cy="50%" outerRadius={100} label={({ bank, percent }) => `${bank} (${(percent * 100).toFixed(0)}%)`}>
                      {bankData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CurrencyTooltip currencySymbol={currencySymbol} />} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bank Rankings</CardTitle>
                <CardDescription>Total outflow per bank account</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={bankData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => formatChartCurrency(v, currencySymbol)} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="bank" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CurrencyTooltip currencySymbol={currencySymbol} />} />
                    <Bar dataKey="total" fill="#3b82f6" name="Total Outflow" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="deposits" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Deposits vs Cheque Outflow</CardTitle>
              <CardDescription>Daily bank deposits compared to cleared/deposited cheque amounts</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={depositVsOutflow}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={6} />
                  <YAxis tickFormatter={(v) => formatChartCurrency(v, currencySymbol)} tick={{ fontSize: 10 }} width={55} />
                  <Tooltip content={<CurrencyTooltip currencySymbol={currencySymbol} />} />
                  <Legend />
                  <Bar dataKey="deposits" fill="#22c55e" name="Deposits" barSize={8} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="outflow" fill="#f59e0b" name="Outflow" barSize={8} radius={[2, 2, 0, 0]} />
                  <Line type="monotone" dataKey="cumDeposits" stroke="#16a34a" strokeWidth={2} dot={false} name="Cum. Deposits" />
                  <Line type="monotone" dataKey="cumOutflow" stroke="#d97706" strokeWidth={2} dot={false} name="Cum. Outflow" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deposit Trend</CardTitle>
              <CardDescription>Daily deposit amounts over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={depositVsOutflow}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={6} />
                  <YAxis tickFormatter={(v) => formatChartCurrency(v, currencySymbol)} tick={{ fontSize: 10 }} width={55} />
                  <Tooltip content={<CurrencyTooltip currencySymbol={currencySymbol} />} />
                  <Area type="monotone" dataKey="deposits" fill="#22c55e" stroke="#22c55e" fillOpacity={0.2} name="Deposits" />
                  <Line type="monotone" dataKey="deposits" stroke="#22c55e" strokeWidth={2} dot={{ r: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="space-y-4 mt-4">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Status by Amount</CardTitle>
                <CardDescription>Donut chart of current cheque values</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={statusData} dataKey="amount" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3}>
                      {statusData.map((entry) => (
                        <Cell key={entry.status} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<CurrencyTooltip currencySymbol={currencySymbol} />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status by Count</CardTitle>
                <CardDescription>Number of cheques in each status</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" data={statusCountData} startAngle={180} endAngle={0}>
                    <RadialBar background dataKey="value" cornerRadius={4}>
                      {statusCountData.map((entry) => (
                        <Cell key={entry.status} fill={entry.fill} />
                      ))}
                    </RadialBar>
                    <Legend />
                    <Tooltip />
                  </RadialBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {statusData.map((s) => (
              <Card key={s.status}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.fill }} />
                    <p className="font-medium text-sm">{s.name}</p>
                  </div>
                  <p className="text-lg font-semibold">{formatCurrency(s.amount, currencySymbol)}</p>
                  <p className="text-xs text-muted-foreground">{s.count} cheques</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
