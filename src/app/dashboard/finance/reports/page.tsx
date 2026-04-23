'use client'

import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Download, Landmark, TrendingDown, TrendingUp } from 'lucide-react'
import { useCashbook } from '@/hooks/useCashbook'
import { useBudgets } from '@/hooks/useBudgets'
import { useAuth } from '@/contexts/AuthContext'
import { useDistricts } from '@/hooks/useDistricts'
import { PageSpinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { exportToCsv } from '@/lib/csv'
import {
  buildBudgetComparisonRows,
  buildBudgetComparisonSummaryByCurrency,
  buildCashbookFundBalances,
  buildCashbookTotalsByCurrency,
  type BudgetComparisonCurrencySummary,
  type BudgetComparisonLineRow,
  type FundBalanceRow,
} from '@/lib/finance/reporting'
import {
  isIncomingTransactionEffect,
  shouldIncludeInFundReporting,
} from '@/lib/finance/transactions'
import {
  type Budget,
  BUDGET_STATUS_LABELS,
  type CashbookTransaction,
  type Currency,
  MEMBER_TYPE_LABELS,
} from '@/types'

type PeriodPreset = 'this_month' | 'last_month' | 'this_year' | 'all_time'

const PRESET_LABELS: Record<PeriodPreset, string> = {
  this_month: 'This Month',
  last_month: 'Last Month',
  this_year: 'This Year',
  all_time: 'All Time',
}

function getPeriodBounds(
  preset: PeriodPreset,
): { date_from: string | null; date_to: string | null; label: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()

  if (preset === 'this_month') {
    return {
      date_from: new Date(y, m, 1).toISOString().split('T')[0],
      date_to: new Date(y, m + 1, 0).toISOString().split('T')[0],
      label: now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    }
  }

  if (preset === 'last_month') {
    const d = new Date(y, m - 1, 1)
    return {
      date_from: new Date(y, m - 1, 1).toISOString().split('T')[0],
      date_to: new Date(y, m, 0).toISOString().split('T')[0],
      label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    }
  }

  if (preset === 'this_year') {
    return { date_from: `${y}-01-01`, date_to: `${y}-12-31`, label: `${y}` }
  }

  return { date_from: null, date_to: null, label: 'All Time' }
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-slate-700">
        <CardTitle>{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      {children}
    </Card>
  )
}

function MetricCard({
  icon,
  title,
  values,
  fallbackClassName,
  helper,
}: {
  icon: React.ReactNode
  title: string
  values: Array<{ currency: Currency; amount: number; className: string }>
  fallbackClassName: string
  helper: string
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4">
        <div className="shrink-0 rounded-lg bg-slate-900/60 p-3">{icon}</div>
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          {values.length === 0 ? (
            <p className={`mt-0.5 text-2xl font-bold ${fallbackClassName}`}>-</p>
          ) : (
            values.map(({ currency, amount, className }) => (
              <p key={currency} className={`mt-0.5 text-xl font-bold ${className}`}>
                {formatCurrency(amount, currency)}
              </p>
            ))
          )}
          <p className="mt-1 text-xs text-slate-500">{helper}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function CashbookStatement({
  transactions,
  currencies,
  inByCurrency,
  outByCurrency,
  periodLabel,
}: {
  transactions: CashbookTransaction[]
  currencies: Currency[]
  inByCurrency: Partial<Record<string, number>>
  outByCurrency: Partial<Record<string, number>>
  periodLabel: string
}) {
  return (
    <SectionCard title="Cashbook Statement" description={periodLabel}>
      {currencies.length === 0 ? (
        <div className="p-12 text-center text-slate-500">No posted transactions in this period.</div>
      ) : (
        currencies.map((currency) => {
          const totalIn = inByCurrency[currency] ?? 0
          const totalOut = outByCurrency[currency] ?? 0
          const net = totalIn - totalOut
          const netPositive = net >= 0
          const inTxns = transactions.filter((t) => t.currency === currency && isIncomingTransactionEffect(t))
          const outTxns = transactions.filter((t) => t.currency === currency && !isIncomingTransactionEffect(t))

          return (
            <div key={currency}>
              <div className="border-b border-slate-700 bg-slate-700/40 px-5 py-2">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-300">{currency}</span>
              </div>

              {inTxns.length > 0 && (
                <>
                  <div className="border-b border-slate-700 bg-emerald-500/5 px-5 py-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Income</p>
                  </div>
                  <div className="divide-y divide-slate-700/30">
                    {inTxns.map((txn) => (
                      <div key={txn.id} className="flex items-center justify-between gap-4 px-5 py-2 text-sm">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="shrink-0 text-xs text-slate-500">
                            {new Date(txn.transaction_date).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </span>
                          {txn.reference_number && (
                            <span className="shrink-0 font-mono text-xs text-slate-500">{txn.reference_number}</span>
                          )}
                          <span className="truncate text-slate-300">
                            {txn.narration ?? txn.counterparty ?? '-'}
                          </span>
                          {txn.fund && (
                            <span className="shrink-0 text-xs text-slate-500">
                              {(txn.fund as { name?: string }).name}
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 font-medium text-emerald-400">
                          {formatCurrency(Number(txn.total_amount), currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between border-b border-slate-700 px-5 py-3">
                    <span className="text-sm font-bold text-slate-200">Total Income ({currency})</span>
                    <span className="font-bold text-emerald-400">{formatCurrency(totalIn, currency)}</span>
                  </div>
                </>
              )}

              {outTxns.length > 0 && (
                <>
                  <div className="border-b border-slate-700 bg-red-500/5 px-5 py-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-red-400">Expenditure</p>
                  </div>
                  <div className="divide-y divide-slate-700/30">
                    {outTxns.map((txn) => (
                      <div key={txn.id} className="flex items-center justify-between gap-4 px-5 py-2 text-sm">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="shrink-0 text-xs text-slate-500">
                            {new Date(txn.transaction_date).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </span>
                          {txn.reference_number && (
                            <span className="shrink-0 font-mono text-xs text-slate-500">{txn.reference_number}</span>
                          )}
                          <span className="truncate text-slate-300">
                            {txn.narration ?? txn.counterparty ?? '-'}
                          </span>
                          {txn.fund && (
                            <span className="shrink-0 text-xs text-slate-500">
                              {(txn.fund as { name?: string }).name}
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 font-medium text-red-400">
                          {formatCurrency(Number(txn.total_amount), currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between border-b border-slate-700 px-5 py-3">
                    <span className="text-sm font-bold text-slate-200">Total Expenditure ({currency})</span>
                    <span className="font-bold text-red-400">{formatCurrency(totalOut, currency)}</span>
                  </div>
                </>
              )}

              <div
                className={`flex justify-between border-b border-slate-700 px-5 py-4 ${
                  netPositive ? 'bg-emerald-500/5' : 'bg-red-500/5'
                }`}
              >
                <span className="font-bold text-slate-100">
                  {netPositive ? 'Surplus' : 'Deficit'} ({currency})
                </span>
                <span className={`text-lg font-bold ${netPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {net < 0 ? '-' : ''}
                  {formatCurrency(Math.abs(net), currency)}
                </span>
              </div>
            </div>
          )
        })
      )}
    </SectionCard>
  )
}

function FundSummarySection({
  rows,
  showDistrict,
}: {
  rows: FundBalanceRow[]
  showDistrict: boolean
}) {
  return (
    <SectionCard title="Fund Summary" description="An overview of balances for all district funds.">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              {showDistrict && <th className="px-4 py-3 text-left font-medium text-slate-400">District</th>}
              <th className="px-4 py-3 text-left font-medium text-slate-400">Fund</th>
              <th className="px-4 py-3 text-left font-medium text-slate-400">Currency</th>
              <th className="px-4 py-3 text-right font-medium text-slate-400">Receipts</th>
              <th className="px-4 py-3 text-right font-medium text-slate-400">Payments</th>
              <th className="px-4 py-3 text-right font-medium text-slate-400">Closing Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={showDistrict ? 6 : 5} className="px-4 py-8 text-center text-slate-500">
                  No fund activity in this period.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={`${row.district_id}:${row.fund_id ?? 'unassigned'}:${row.currency}`}
                  className="border-b border-slate-700/50 last:border-0"
                >
                  {showDistrict && <td className="px-4 py-3 text-slate-300">{row.district_name}</td>}
                  <td className="px-4 py-3 font-medium text-slate-100">{row.fund_name}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs font-medium text-slate-400">
                      {row.currency}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-emerald-400">
                    {formatCurrency(row.income_total, row.currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-red-400">
                    {formatCurrency(row.expense_total, row.currency)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      row.net_balance >= 0 ? 'text-emerald-300' : 'text-red-300'
                    }`}
                  >
                    {formatCurrency(row.net_balance, row.currency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}

function budgetOptionLabel(budget: Budget, includeDistrict: boolean) {
  const districtPrefix = includeDistrict && budget.district?.name
    ? `${budget.district.name} - `
    : ''

  return `${districtPrefix}${budget.name} (${budget.start_date} to ${budget.end_date})`
}

function memberScopeLabel(row: BudgetComparisonLineRow) {
  if (!row.scope_member_id) return 'District-wide'
  if (!row.scope_member_name || !row.scope_member_type) return 'Member-scoped'
  return `${MEMBER_TYPE_LABELS[row.scope_member_type]} - ${row.scope_member_name}`
}

function BudgetVsActualsSection({
  budgets,
  selectedBudgetId,
  onSelectBudgetId,
  rows,
  summaries,
  showDistrictInOptions,
}: {
  budgets: Budget[]
  selectedBudgetId: string | null
  onSelectBudgetId: (budgetId: string) => void
  rows: BudgetComparisonLineRow[]
  summaries: BudgetComparisonCurrencySummary[]
  showDistrictInOptions: boolean
}) {
  const selectedBudget = budgets.find((budget) => budget.id === selectedBudgetId) ?? null
  const statusVariant = selectedBudget?.status === 'active'
    ? 'green'
    : selectedBudget?.status === 'closed'
      ? 'yellow'
      : 'default'

  return (
    <SectionCard
      title="Budget vs. Actuals"
      description="Compare a selected expense budget against posted payments and outgoing adjustments matched by period, fund, currency, and optional member scope."
    >
      <div className="space-y-6 p-5">
        {budgets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 p-10 text-center text-slate-500">
            No budgets available for comparison.
          </div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,340px),1fr]">
              <Select
                label="Budget"
                value={selectedBudgetId ?? ''}
                onChange={(e) => onSelectBudgetId(e.target.value)}
                options={budgets.map((budget) => ({
                  value: budget.id,
                  label: budgetOptionLabel(budget, showDistrictInOptions),
                }))}
              />
              {selectedBudget ? (
                <div className="rounded-lg border border-slate-700 bg-slate-900/40 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-100">{selectedBudget.name}</p>
                    <Badge variant={statusVariant}>{BUDGET_STATUS_LABELS[selectedBudget.status]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">
                    {selectedBudget.start_date} to {selectedBudget.end_date}
                  </p>
                  {selectedBudget.description && (
                    <p className="mt-2 text-sm text-slate-300">{selectedBudget.description}</p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-4 py-3 text-left font-medium text-slate-400">Currency</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-400">Budget</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-400">Actual</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-400">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        This budget has no lines to compare yet.
                      </td>
                    </tr>
                  ) : (
                    summaries.map((summary) => (
                      <tr key={summary.currency} className="border-b border-slate-700/50 last:border-0">
                        <td className="px-4 py-3 font-medium text-slate-100">{summary.currency}</td>
                        <td className="px-4 py-3 text-right text-slate-300">
                          {formatCurrency(summary.budget_total, summary.currency)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-red-400">
                          {formatCurrency(summary.actual_total, summary.currency)}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${summary.variance_total >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                          {summary.variance_total >= 0 ? '+' : '-'}
                          {formatCurrency(Math.abs(summary.variance_total), summary.currency)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-4 py-3 text-left font-medium text-slate-400">Fund</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-400">Line</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-400">Currency</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-400">Member Scope</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-400">Budgeted</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-400">Actual</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-400">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        No budget lines available for detailed comparison.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.budget_line_id} className="border-b border-slate-700/50 last:border-0">
                        <td className="px-4 py-3 text-slate-100">{row.fund_name}</td>
                        <td className="px-4 py-3 text-slate-300">{row.line_description}</td>
                        <td className="px-4 py-3 text-slate-300">{row.currency}</td>
                        <td className="px-4 py-3 text-slate-300">{memberScopeLabel(row)}</td>
                        <td className="px-4 py-3 text-right text-slate-300">
                          {formatCurrency(row.budget_amount, row.currency)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-red-400">
                          {formatCurrency(row.actual_amount, row.currency)}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${row.variance_amount >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                          {row.variance_amount >= 0 ? '+' : '-'}
                          {formatCurrency(Math.abs(row.variance_amount), row.currency)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </SectionCard>
  )
}

export default function ReportsPage() {
  const { districtId, isAdmin } = useAuth()
  const { data: districts } = useDistricts()
  const { data: budgets, loading: budgetsLoading } = useBudgets({ district_id: districtId ?? undefined })
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null)

  const [preset, setPreset] = useState<PeriodPreset>('this_month')
  const { date_from, date_to, label: periodLabel } = getPeriodBounds(preset)

  const { data: periodTransactions, loading: periodLoading } = useCashbook({
    district_id: districtId === undefined ? undefined : districtId,
    status: 'posted',
    date_from,
    date_to,
  })
  const { data: budgetTransactions, loading: budgetTransactionsLoading } = useCashbook({
    district_id: districtId === undefined ? undefined : districtId,
    status: 'posted',
  })

  useEffect(() => {
    if (selectedBudgetId && budgets.some((budget) => budget.id === selectedBudgetId)) {
      return
    }

    const nextBudget = budgets.find((budget) => budget.status === 'active') ?? budgets[0] ?? null
    setSelectedBudgetId(nextBudget?.id ?? null)
  }, [budgets, selectedBudgetId])

  const showDistrictColumn = isAdmin && !districtId
  const districtName = districtId
    ? districts.find((d) => d.id === districtId)?.name ?? 'District'
    : 'All Districts'
  const operationalTransactions = useMemo(
    () => periodTransactions.filter((txn) => shouldIncludeInFundReporting(txn)),
    [periodTransactions],
  )
  const budgetOperationalTransactions = useMemo(
    () => budgetTransactions.filter((txn) => shouldIncludeInFundReporting(txn)),
    [budgetTransactions],
  )

  const { inByCurrency, outByCurrency } = useMemo(
    () => buildCashbookTotalsByCurrency(operationalTransactions),
    [operationalTransactions],
  )
  const fundBalances = useMemo(() => buildCashbookFundBalances(operationalTransactions), [operationalTransactions])
  const allCurrencies = useMemo(
    () => [...new Set([...Object.keys(inByCurrency), ...Object.keys(outByCurrency)])] as Currency[],
    [inByCurrency, outByCurrency],
  )
  const activeBudgetTotalsByCurrency = useMemo(
    () =>
      budgets
        .filter((budget) => budget.status === 'active')
        .reduce<Record<string, number>>((acc, budget) => {
          for (const line of budget.lines ?? []) {
            if (!acc[line.currency]) acc[line.currency] = 0
            acc[line.currency] += Number(line.amount)
          }
          return acc
        }, {}),
    [budgets],
  )
  const activeBudgetLineCount = useMemo(
    () => budgets
      .filter((budget) => budget.status === 'active')
      .reduce((total, budget) => total + (budget.lines?.length ?? 0), 0),
    [budgets],
  )
  const selectedBudget = useMemo(
    () => budgets.find((budget) => budget.id === selectedBudgetId) ?? null,
    [budgets, selectedBudgetId],
  )
  const budgetComparisonRows = useMemo(
    () => buildBudgetComparisonRows(selectedBudget, budgetOperationalTransactions),
    [budgetOperationalTransactions, selectedBudget],
  )
  const budgetComparisonSummary = useMemo(
    () => buildBudgetComparisonSummaryByCurrency(budgetComparisonRows),
    [budgetComparisonRows],
  )

  const loading = periodLoading || budgetTransactionsLoading || budgetsLoading

  const handleExport = () => {
    const rows: Record<string, string | number | null>[] = []
    const reportDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
    const pushRow = (row: Record<string, string | number | null>) =>
      rows.push({
        Section: '',
        Date: '',
        Reference: '',
        District: '',
        Budget: '',
        'Budget Status': '',
        Fund: '',
        'Budget Line': '',
        Account: '',
        Counterparty: '',
        Narration: '',
        Currency: '',
        Kind: '',
        Amount: '',
        Direction: '',
        'Budget Scope': '',
        'Budget Amount': '',
        'Actual Amount': '',
        Variance: '',
        ...row,
      })

    pushRow({ Section: `Cashbook Report - ${periodLabel}`, Date: reportDate, District: districtName })
    pushRow({})

    for (const currency of allCurrencies) {
      const totalIn = inByCurrency[currency] ?? 0
      const totalOut = outByCurrency[currency] ?? 0
      const net = totalIn - totalOut

      pushRow({ Section: `RECEIPTS (${currency})` })
      for (const txn of operationalTransactions.filter((t) => t.currency === currency && isIncomingTransactionEffect(t))) {
        pushRow({
          Date: txn.transaction_date,
          Reference: txn.reference_number ?? '',
          District: showDistrictColumn ? txn.district_id : '',
          Fund: (txn.fund as { name?: string } | null)?.name ?? 'Unassigned',
          Account: (txn.account as { name?: string } | null)?.name ?? '',
          Counterparty: txn.counterparty ?? '',
          Narration: txn.narration ?? '',
          Currency: currency,
          Kind: txn.kind,
          Amount: txn.total_amount,
          Direction: 'in',
        })
      }
      pushRow({ Section: `TOTAL RECEIPTS (${currency})`, Currency: currency, Amount: totalIn })

      pushRow({})
      pushRow({ Section: `PAYMENTS (${currency})` })
      for (const txn of operationalTransactions.filter((t) => t.currency === currency && !isIncomingTransactionEffect(t))) {
        pushRow({
          Date: txn.transaction_date,
          Reference: txn.reference_number ?? '',
          District: showDistrictColumn ? txn.district_id : '',
          Fund: (txn.fund as { name?: string } | null)?.name ?? 'Unassigned',
          Account: (txn.account as { name?: string } | null)?.name ?? '',
          Counterparty: txn.counterparty ?? '',
          Narration: txn.narration ?? '',
          Currency: currency,
          Kind: txn.kind,
          Amount: txn.total_amount,
          Direction: 'out',
        })
      }
      pushRow({ Section: `TOTAL PAYMENTS (${currency})`, Currency: currency, Amount: totalOut })
      pushRow({
        Section: net >= 0 ? `SURPLUS (${currency})` : `DEFICIT (${currency})`,
        Currency: currency,
        Amount: Math.abs(net),
      })
      pushRow({})
    }

    for (const row of fundBalances) {
      pushRow({
        Section: 'FUND BALANCES',
        District: showDistrictColumn ? row.district_name : '',
        Fund: row.fund_name,
        Currency: row.currency,
        Narration: 'Net fund position',
        Amount: row.net_balance,
        Kind: 'fund_balance',
      })
    }

    if (selectedBudget) {
      pushRow({})
      pushRow({
        Section: `BUDGET VS ACTUAL - ${selectedBudget.name}`,
        District: showDistrictColumn ? selectedBudget.district?.name ?? selectedBudget.district_id : '',
        Budget: selectedBudget.name,
        'Budget Status': BUDGET_STATUS_LABELS[selectedBudget.status],
        Date: `${selectedBudget.start_date} to ${selectedBudget.end_date}`,
      })

      for (const summary of budgetComparisonSummary) {
        pushRow({
          Section: 'BUDGET SUMMARY',
          Budget: selectedBudget.name,
          'Budget Status': BUDGET_STATUS_LABELS[selectedBudget.status],
          Currency: summary.currency,
          Kind: 'expense_budget',
          'Budget Amount': summary.budget_total,
          'Actual Amount': summary.actual_total,
          Variance: summary.variance_total,
        })
      }

      for (const row of budgetComparisonRows) {
        pushRow({
          Section: 'BUDGET LINE',
          Budget: row.budget_name,
          'Budget Status': BUDGET_STATUS_LABELS[row.budget_status],
          District: showDistrictColumn ? selectedBudget.district?.name ?? selectedBudget.district_id : '',
          Fund: row.fund_name,
          'Budget Line': row.line_description,
          Currency: row.currency,
          Kind: 'expense_budget',
          'Budget Scope': memberScopeLabel(row),
          'Budget Amount': row.budget_amount,
          'Actual Amount': row.actual_amount,
          Variance: row.variance_amount,
        })
      }
    }

    const filename = `cashbook-${periodLabel.replace(/\s+/g, '-').toLowerCase()}-${districtName.replace(
      /\s+/g,
      '-',
    ).toLowerCase()}.csv`
    exportToCsv(filename, rows)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader
        title="Reports"
        description={`${districtName} - ${periodLabel}`}
        actions={(
          <Button variant="ghost" onClick={handleExport} disabled={operationalTransactions.length === 0 && budgetComparisonRows.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        )}
      />

      <div className="flex flex-wrap gap-2">
        {(Object.keys(PRESET_LABELS) as PeriodPreset[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPreset(p)}
            className={`rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors ${
              preset === p
                ? 'border-cyan-500/40 bg-cyan-500/20 text-cyan-300'
                : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'
            }`}
          >
            {PRESET_LABELS[p]}
          </button>
        ))}
      </div>

      {loading ? (
        <PageSpinner />
      ) : (
        <Tabs defaultValue="cashbook">
          <TabsList className="w-fit">
            <TabsTrigger value="cashbook">Cashbook</TabsTrigger>
            <TabsTrigger value="fund_summary">Fund Summary</TabsTrigger>
            <TabsTrigger value="budget">Budget vs. Actuals</TabsTrigger>
          </TabsList>

          <TabsContent value="cashbook" className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={<TrendingUp className="h-5 w-5 text-emerald-400" />}
                title="Total Receipts"
                values={Object.entries(inByCurrency).map(([currency, amount]) => ({
                  currency: currency as Currency,
                  amount: amount ?? 0,
                  className: 'text-emerald-400',
                }))}
                fallbackClassName="text-emerald-400"
                helper={`${operationalTransactions.filter((t) => isIncomingTransactionEffect(t)).length} transaction(s)`}
              />
              <MetricCard
                icon={<TrendingDown className="h-5 w-5 text-red-400" />}
                title="Total Payments"
                values={Object.entries(outByCurrency).map(([currency, amount]) => ({
                  currency: currency as Currency,
                  amount: amount ?? 0,
                  className: 'text-red-400',
                }))}
                fallbackClassName="text-red-400"
                helper={`${operationalTransactions.filter((t) => !isIncomingTransactionEffect(t)).length} transaction(s)`}
              />
              <MetricCard
                icon={<Landmark className="h-5 w-5 text-amber-400" />}
                title="Active Budgeted Expenses"
                values={Object.entries(activeBudgetTotalsByCurrency)
                  .filter(([, total]) => total > 0)
                  .map(([currency, total]) => ({
                    currency: currency as Currency,
                    amount: total,
                    className: 'text-amber-300',
                  }))}
                fallbackClassName="text-amber-300"
                helper={`${activeBudgetLineCount} active budget line${activeBudgetLineCount === 1 ? '' : 's'}`}
              />
            </div>

            <CashbookStatement
              transactions={operationalTransactions}
              currencies={allCurrencies}
              inByCurrency={inByCurrency}
              outByCurrency={outByCurrency}
              periodLabel={periodLabel}
            />
          </TabsContent>

          <TabsContent value="fund_summary">
            <FundSummarySection rows={fundBalances} showDistrict={showDistrictColumn} />
          </TabsContent>

          <TabsContent value="budget">
            <BudgetVsActualsSection
              budgets={budgets}
              selectedBudgetId={selectedBudgetId}
              onSelectBudgetId={setSelectedBudgetId}
              rows={budgetComparisonRows}
              summaries={budgetComparisonSummary}
              showDistrictInOptions={showDistrictColumn}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
