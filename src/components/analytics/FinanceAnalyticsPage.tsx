'use client'

import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { PageSpinner } from '@/components/ui/Spinner'
import { StatCard } from '@/components/ui/StatCard'
import { SelectDistrictHint } from '@/components/layout/SelectDistrictHint'
import { BarList, ChartCard, ColumnChart } from '@/components/analytics/Charts'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useFinanceAnalytics } from '@/hooks/useFinanceAnalytics'
import {
  buildFinanceAnalytics,
  formatMonthLong,
  formatMonthShort,
  monthKeys,
} from '@/lib/analytics'
import { addDays, addMonths, startOfMonth, todayIso } from '@/lib/calendar'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import type { Currency } from '@/types'

const TITLE = 'Finance analytics'
const DESCRIPTION = 'Trends in posted receipts and payments. Transfers, adjustments, opening balances and reversed entries are left out.'

const PERIOD_OPTIONS = [
  { value: '6', label: 'Last 6 months' },
  { value: '12', label: 'Last 12 months' },
  { value: '24', label: 'Last 24 months' },
]

export function FinanceAnalyticsPage() {
  const { districtId } = useAuth()
  const { can } = usePermissions()
  const canView = can('reports.view')

  const [period, setPeriod] = useState(12)
  const [chosenCurrency, setChosenCurrency] = useState<string | null>(null)
  const [showTable, setShowTable] = useState(false)

  const today = todayIso()
  const months = useMemo(() => monthKeys(addMonths(today, -(period - 1)), period), [period, today])
  const from = `${months[0]}-01`
  const to = addDays(addMonths(startOfMonth(today), 1), -1)

  const { data: rows, loading, error } = useFinanceAnalytics(canView ? districtId : null, from, to)
  const currencies = useMemo(() => buildFinanceAnalytics(rows, months, '').currencies, [rows, months])
  const currency = chosenCurrency && currencies.includes(chosenCurrency) ? chosenCurrency : currencies[0] ?? 'USD'
  const analytics = useMemo(() => buildFinanceAnalytics(rows, months, currency), [rows, months, currency])

  const money = (value: number) => formatCurrency(value, currency as Currency)

  if (!districtId) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <SelectDistrictHint description="Choose a district to see its finance trends." />
      </div>
    )
  }

  if (!canView) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <SelectDistrictHint title="No access" description="Your role can't view finance reports for this district." />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeader
        title={TITLE}
        description={DESCRIPTION}
        actions={(
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Select
                aria-label="Period"
                value={String(period)}
                options={PERIOD_OPTIONS}
                onChange={(e) => setPeriod(Number(e.target.value))}
              />
            </div>
            {currencies.length > 1 && (
              <div className="w-28">
                <Select
                  aria-label="Currency"
                  value={currency}
                  options={currencies.map((c) => ({ value: c, label: c }))}
                  onChange={(e) => setChosenCurrency(e.target.value)}
                />
              </div>
            )}
          </div>
        )}
      />

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <PageSpinner />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Receipts" value={money(analytics.totals.receipts)} icon={<ArrowDownLeft className="h-5 w-5" />} sub={`${formatMonthLong(months[0])} – ${formatMonthLong(months[months.length - 1])}`} />
            <StatCard label="Payments" value={money(analytics.totals.payments)} icon={<ArrowUpRight className="h-5 w-5" />} />
            <StatCard label="Net" value={money(analytics.totals.net)} icon={<Scale className="h-5 w-5" />} sub={analytics.totals.net >= 0 ? 'More in than out' : 'More out than in'} />
          </div>

          <ChartCard
            title="Receipts and payments by month"
            description={`In ${currency}. Hover a month for exact amounts.`}
            actions={(
              <Button variant="ghost" size="sm" onClick={() => setShowTable((v) => !v)}>
                {showTable ? 'Show chart' : 'Show table'}
              </Button>
            )}
          >
            <ColumnChart
              categories={months}
              categoryLabels={months.map(formatMonthShort)}
              categoryTitles={months.map(formatMonthLong)}
              series={[
                { key: 'receipts', label: 'Receipts', color: 'var(--viz-series-1)', values: analytics.monthly.map((m) => m.receipts) },
                { key: 'payments', label: 'Payments', color: 'var(--viz-series-2)', values: analytics.monthly.map((m) => m.payments) },
              ]}
              formatValue={money}
              showTable={showTable}
            />
          </ChartCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Receipts by fund" description={`Where income was directed, in ${currency}.`}>
              <BarList rows={analytics.receiptsByFund} color="var(--viz-series-1)" formatValue={money} />
            </ChartCard>
            <ChartCard title="Payments by fund" description={`Which funds money was spent from, in ${currency}.`}>
              <BarList rows={analytics.paymentsByFund} color="var(--viz-series-2)" formatValue={money} />
            </ChartCard>
          </div>

          <ChartCard title="Receipts by assembly" description={`Top contributing assemblies, in ${currency}.`}>
            <BarList rows={analytics.receiptsByAssembly} color="var(--viz-series-1)" formatValue={money} />
          </ChartCard>
        </>
      )}
    </div>
  )
}
