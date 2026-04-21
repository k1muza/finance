'use client'

import { type ReactNode, useMemo, useState } from 'react'
import { Download, Landmark, Target, TrendingDown, TrendingUp } from 'lucide-react'
import { useCashbook } from '@/hooks/useCashbook'
import { useBudgets } from '@/hooks/useBudgets'
import { useAuth } from '@/contexts/AuthContext'
import { useDistricts } from '@/hooks/useDistricts'
import { PageSpinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { exportToCsv } from '@/lib/csv'
import {
  buildCashbookFundBalances,
  buildCashbookTotalsByCurrency,
  type FundBalanceRow,
} from '@/lib/finance/reporting'
import {
  isIncomingTransactionEffect,
  shouldIncludeInFundReporting,
} from '@/lib/finance/transactions'
import type { CashbookTransaction, Currency } from '@/types'

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

function BudgetVsActualsSection({
  currencies,
  budgetTotalsByCurrency,
  inByCurrency,
  outByCurrency,
}: {
  currencies: Currency[]
  budgetTotalsByCurrency: Record<string, { income: number; expense: number }>
  inByCurrency: Partial<Record<string, number>>
  outByCurrency: Partial<Record<string, number>>
}) {
  return (
    <SectionCard
      title="Budget vs. Actuals"
      description="Compare budget targets with posted cashbook activity by currency."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="px-4 py-3 text-left font-medium text-slate-400">Currency</th>
              <th className="px-4 py-3 text-right font-medium text-slate-400">Budgeted Income</th>
              <th className="px-4 py-3 text-right font-medium text-slate-400">Actual Receipts</th>
              <th className="px-4 py-3 text-right font-medium text-slate-400">Variance</th>
              <th className="px-4 py-3 text-right font-medium text-slate-400">Budgeted Spend</th>
              <th className="px-4 py-3 text-right font-medium text-slate-400">Actual Payments</th>
              <th className="px-4 py-3 text-right font-medium text-slate-400">Variance</th>
            </tr>
          </thead>
          <tbody>
            {currencies.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No budget or cashbook activity available for comparison.
                </td>
              </tr>
            ) : (
              currencies.map((currency) => {
                const budgetIncome = budgetTotalsByCurrency[currency]?.income ?? 0
                const budgetExpense = budgetTotalsByCurrency[currency]?.expense ?? 0
                const actualIncome = inByCurrency[currency] ?? 0
                const actualExpense = outByCurrency[currency] ?? 0
                const incomeVariance = actualIncome - budgetIncome
                const expenseVariance = budgetExpense - actualExpense

                return (
                  <tr key={currency} className="border-b border-slate-700/50 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-100">{currency}</td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {formatCurrency(budgetIncome, currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-400">
                      {formatCurrency(actualIncome, currency)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        incomeVariance >= 0 ? 'text-emerald-300' : 'text-amber-300'
                      }`}
                    >
                      {incomeVariance >= 0 ? '+' : '-'}
                      {formatCurrency(Math.abs(incomeVariance), currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {formatCurrency(budgetExpense, currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-red-400">
                      {formatCurrency(actualExpense, currency)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        expenseVariance >= 0 ? 'text-emerald-300' : 'text-red-300'
                      }`}
                    >
                      {expenseVariance >= 0 ? '+' : '-'}
                      {formatCurrency(Math.abs(expenseVariance), currency)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}

export default function ReportsPage() {
  const { districtId, isAdmin } = useAuth()
  const { data: districts } = useDistricts()
  const { data: budgets } = useBudgets({ district_id: districtId ?? undefined })

  const [preset, setPreset] = useState<PeriodPreset>('this_month')
  const { date_from, date_to, label: periodLabel } = getPeriodBounds(preset)

  const { data: transactions, loading } = useCashbook({
    district_id: districtId === undefined ? undefined : districtId,
    status: 'posted',
    date_from,
    date_to,
  })

  const showDistrictColumn = isAdmin && !districtId
  const districtName = districtId
    ? districts.find((d) => d.id === districtId)?.name ?? 'District'
    : 'All Districts'
  const operationalTransactions = useMemo(
    () => transactions.filter((txn) => shouldIncludeInFundReporting(txn)),
    [transactions],
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
  const budgetTotalsByCurrency = useMemo(
    () =>
      budgets.reduce<Record<string, { income: number; expense: number }>>((acc, b) => {
        if (!acc[b.currency]) acc[b.currency] = { income: 0, expense: 0 }
        if (b.type === 'income') acc[b.currency].income += b.amount
        else acc[b.currency].expense += b.amount
        return acc
      }, {}),
    [budgets],
  )
  const comparisonCurrencies = useMemo(
    () => [...new Set([...allCurrencies, ...Object.keys(budgetTotalsByCurrency)])] as Currency[],
    [allCurrencies, budgetTotalsByCurrency],
  )

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
        Fund: '',
        Account: '',
        Counterparty: '',
        Narration: '',
        Currency: '',
        Kind: '',
        Amount: '',
        Direction: '',
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
        description={`${districtName} · ${periodLabel}`}
        actions={(
          <Button variant="ghost" onClick={handleExport} disabled={operationalTransactions.length === 0}>
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
                icon={<Landmark className="h-5 w-5 text-cyan-400" />}
                title="Budgeted Income"
                values={Object.entries(budgetTotalsByCurrency)
                  .filter(([, totals]) => totals.income > 0)
                  .map(([currency, totals]) => ({
                    currency: currency as Currency,
                    amount: totals.income,
                    className: 'text-cyan-300',
                  }))}
                fallbackClassName="text-cyan-300"
                helper="Across defined income budgets"
              />
              <MetricCard
                icon={<Target className="h-5 w-5 text-amber-400" />}
                title="Budgeted Expenditure"
                values={Object.entries(budgetTotalsByCurrency)
                  .filter(([, totals]) => totals.expense > 0)
                  .map(([currency, totals]) => ({
                    currency: currency as Currency,
                    amount: totals.expense,
                    className: 'text-amber-300',
                  }))}
                fallbackClassName="text-amber-300"
                helper={`${budgets.length} budget line${budgets.length !== 1 ? 's' : ''}`}
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
              currencies={comparisonCurrencies}
              budgetTotalsByCurrency={budgetTotalsByCurrency}
              inByCurrency={inByCurrency}
              outByCurrency={outByCurrency}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
