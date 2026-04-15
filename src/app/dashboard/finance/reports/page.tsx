'use client'

import { useIncome } from '@/hooks/useIncome'
import { useExpenses } from '@/hooks/useExpenses'
import { useBudgets } from '@/hooks/useBudgets'
import { useAuth } from '@/contexts/AuthContext'
import { useDistricts } from '@/hooks/useDistricts'
import { PageSpinner } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Button } from '@/components/ui/Button'
import { TrendingUp, TrendingDown, Scale, Download, FileDown, FileType2, Landmark, Target } from 'lucide-react'
import { exportToCsv } from '@/lib/csv'
import { buildBudgetComparisons, buildFundBalances, type BudgetComparisonRow, type FundBalanceRow } from '@/lib/finance/reporting'

function CategoryBreakdown({
  title,
  data,
  color,
}: {
  title: string
  data: { category: string | null; amount: number }[]
  color: 'emerald' | 'red'
}) {
  const grouped = data.reduce<Record<string, number>>((acc, row) => {
    const key = row.category ?? 'Uncategorised'
    acc[key] = (acc[key] ?? 0) + row.amount
    return acc
  }, {})

  const sorted = Object.entries(grouped).sort(([, a], [, b]) => b - a)
  const total = sorted.reduce((sum, [, value]) => sum + value, 0)
  if (sorted.length === 0) return null

  const barColor = color === 'emerald' ? 'bg-emerald-500' : 'bg-red-500'
  const textColor = color === 'emerald' ? 'text-emerald-400' : 'text-red-400'

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
      <div className="space-y-3">
        {sorted.map(([category, amount]) => {
          const pct = total > 0 ? (amount / total) * 100 : 0
          return (
            <div key={category}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-300">{category}</span>
                <span className={`font-medium ${textColor}`}>{formatCurrency(amount)}</span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{pct.toFixed(1)}% of total</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FundBalanceSection({
  rows,
  showDistrict,
}: {
  rows: FundBalanceRow[]
  showDistrict: boolean
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300">Fund Balances</h3>
        <p className="text-xs text-slate-500 mt-1">Track how each fund is performing across income and expenditure.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              {showDistrict && <th className="text-left px-4 py-3 text-slate-400 font-medium">District</th>}
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Fund</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Income</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Expenditure</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={showDistrict ? 5 : 4} className="px-4 py-8 text-center text-slate-500">
                  No fund activity recorded yet.
                </td>
              </tr>
            ) : rows.map((row) => (
              <tr key={`${row.district_id}:${row.fund_id ?? 'unassigned'}`} className="border-b border-slate-700/50 last:border-0">
                {showDistrict && <td className="px-4 py-3 text-slate-300">{row.district_name}</td>}
                <td className="px-4 py-3 text-slate-100">{row.fund_name}</td>
                <td className="px-4 py-3 text-right text-emerald-400 font-medium">{formatCurrency(row.income_total)}</td>
                <td className="px-4 py-3 text-right text-red-400 font-medium">{formatCurrency(row.expense_total)}</td>
                <td className={`px-4 py-3 text-right font-semibold ${row.net_balance >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {formatCurrency(row.net_balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BudgetComparisonSection({
  rows,
  showDistrict,
}: {
  rows: BudgetComparisonRow[]
  showDistrict: boolean
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300">Budget vs Actual</h3>
        <p className="text-xs text-slate-500 mt-1">Compare current spending and income against planned budgets.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              {showDistrict && <th className="text-left px-4 py-3 text-slate-400 font-medium">District</th>}
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Type</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Fund</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Category</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Period</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Budget</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Actual</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Variance</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={showDistrict ? 9 : 8} className="px-4 py-8 text-center text-slate-500">
                  No budgets defined yet. Add budgets in Settings to unlock variance reporting.
                </td>
              </tr>
            ) : rows.map((row) => {
              const isPositive = row.status === 'met_target' || row.status === 'within_budget'
              return (
                <tr key={row.id} className="border-b border-slate-700/50 last:border-0">
                  {showDistrict && <td className="px-4 py-3 text-slate-300">{row.district_name}</td>}
                  <td className="px-4 py-3 text-slate-300 capitalize">{row.type}</td>
                  <td className="px-4 py-3 text-slate-100">{row.fund_name}</td>
                  <td className="px-4 py-3 text-slate-300">{row.category}</td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                    {new Date(row.period_start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {' '}–{' '}
                    {new Date(row.period_end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-200 font-medium">{formatCurrency(row.amount)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${row.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(row.actual)}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${isPositive ? 'text-emerald-300' : 'text-red-300'}`}>
                    {formatCurrency(row.variance)}
                  </td>
                  <td className={`px-4 py-3 font-medium ${isPositive ? 'text-emerald-300' : 'text-red-300'}`}>
                    {row.status === 'met_target' && 'Met target'}
                    {row.status === 'below_target' && 'Below target'}
                    {row.status === 'within_budget' && 'Within budget'}
                    {row.status === 'over_budget' && 'Over budget'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const { districtId, isAdmin } = useAuth()
  const { data: districts } = useDistricts()
  const { data: budgets, loading: budgetLoading } = useBudgets({
    district_id: districtId ?? undefined,
  })

  const { data: expenses, loading: expLoading, total: totalExpenses } = useExpenses({
    district_id: districtId ?? undefined,
  })
  const { data: income, loading: incLoading, total: totalIncome } = useIncome({
    district_id: districtId ?? undefined,
  })

  const loading = expLoading || incLoading || budgetLoading
  const net = totalIncome - totalExpenses
  const netPositive = net >= 0
  const showDistrictColumn = isAdmin && !districtId
  const districtName = districtId
    ? (districts.find((district) => district.id === districtId)?.name ?? 'District')
    : 'All Districts'

  const expensesByCategory = expenses.reduce<Record<string, { amount: number; items: typeof expenses }>>((acc, expense) => {
    const key = expense.category ?? 'Uncategorised'
    if (!acc[key]) acc[key] = { amount: 0, items: [] }
    acc[key].amount += expense.amount
    acc[key].items.push(expense)
    return acc
  }, {})

  const incomeByCategory = income.reduce<Record<string, { amount: number; items: typeof income }>>((acc, entry) => {
    const key = entry.category ?? 'Uncategorised'
    if (!acc[key]) acc[key] = { amount: 0, items: [] }
    acc[key].amount += entry.amount
    acc[key].items.push(entry)
    return acc
  }, {})

  const fundBalances = buildFundBalances(income, expenses)
  const budgetComparisons = buildBudgetComparisons(budgets, income, expenses)
  const totalBudgetIncome = budgetComparisons.filter((row) => row.type === 'income').reduce((sum, row) => sum + row.amount, 0)
  const totalBudgetExpenses = budgetComparisons.filter((row) => row.type === 'expense').reduce((sum, row) => sum + row.amount, 0)

  const handleExport = () => {
    const rows: Record<string, string | number | null>[] = []
    const reportDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

    const pushRow = (row: Record<string, string | number | null>) => {
      rows.push({
        Section: '',
        Date: '',
        District: '',
        Fund: '',
        Category: '',
        Description: '',
        Amount: '',
        Type: '',
        Period: '',
        Budget: '',
        Actual: '',
        Variance: '',
        Status: '',
        ...row,
      })
    }

    pushRow({ Section: 'Income & Expenditure Statement', Date: reportDate, District: districtName })
    pushRow({})
    pushRow({ Section: 'INCOME' })

    for (const [category, { items, amount }] of Object.entries(incomeByCategory).sort(([, a], [, b]) => b.amount - a.amount)) {
      for (const item of items) {
        pushRow({
          Date: item.date,
          District: showDistrictColumn ? (item.district?.name ?? '') : '',
          Fund: item.fund?.name ?? 'Unassigned',
          Category: category,
          Description: item.description,
          Amount: item.amount,
          Type: 'income',
        })
      }
      pushRow({ Description: `${category} subtotal`, Amount: amount, Type: 'subtotal' })
    }

    pushRow({ Description: 'TOTAL INCOME', Amount: totalIncome, Type: 'total' })
    pushRow({})
    pushRow({ Section: 'EXPENDITURE' })

    for (const [category, { items, amount }] of Object.entries(expensesByCategory).sort(([, a], [, b]) => b.amount - a.amount)) {
      for (const item of items) {
        pushRow({
          Date: item.date,
          District: showDistrictColumn ? (item.district?.name ?? '') : '',
          Fund: item.fund?.name ?? 'Unassigned',
          Category: category,
          Description: item.description,
          Amount: item.amount,
          Type: 'expense',
        })
      }
      pushRow({ Description: `${category} subtotal`, Amount: amount, Type: 'subtotal' })
    }

    pushRow({ Description: 'TOTAL EXPENDITURE', Amount: totalExpenses, Type: 'total' })
    pushRow({ Description: netPositive ? 'SURPLUS' : 'DEFICIT', Amount: Math.abs(net), Type: 'net' })

    if (fundBalances.length > 0) {
      pushRow({})
      pushRow({ Section: 'FUND BALANCES' })
      for (const row of fundBalances) {
        pushRow({
          District: showDistrictColumn ? row.district_name : '',
          Fund: row.fund_name,
          Description: 'Net fund position',
          Amount: row.net_balance,
          Type: 'fund_balance',
        })
      }
    }

    if (budgetComparisons.length > 0) {
      pushRow({})
      pushRow({ Section: 'BUDGET VS ACTUAL' })
      for (const row of budgetComparisons) {
        pushRow({
          District: showDistrictColumn ? row.district_name : '',
          Fund: row.fund_name,
          Category: row.category,
          Type: row.type,
          Period: `${row.period_start} to ${row.period_end}`,
          Budget: row.amount,
          Actual: row.actual,
          Variance: row.variance,
          Status:
            row.status === 'met_target' ? 'Met target'
              : row.status === 'below_target' ? 'Below target'
                : row.status === 'within_budget' ? 'Within budget'
                  : 'Over budget',
        })
      }
    }

    const filename = `income-expenditure-${districtName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`
    exportToCsv(filename, rows)
  }

  if (loading) return <PageSpinner />

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Reports</h1>
          <p className="text-sm text-slate-400 mt-1">Income & Expenditure Statement — {districtName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={handleExport} disabled={totalIncome === 0 && totalExpenses === 0 && budgetComparisons.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              const params = districtId ? `?district_id=${districtId}` : ''
              window.location.href = `/api/reports/ie-pdf${params}`
            }}
            disabled={totalIncome === 0 && totalExpenses === 0}
          >
            <FileType2 className="h-4 w-4" /> Download PDF
          </Button>
          <Button
            onClick={() => {
              const params = districtId ? `?district_id=${districtId}` : ''
              window.location.href = `/api/reports/ie-docx${params}`
            }}
            disabled={totalIncome === 0 && totalExpenses === 0}
          >
            <FileDown className="h-4 w-4" /> Download Doc
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-start gap-4">
          <div className="bg-emerald-500/10 rounded-lg p-3 text-emerald-400 shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Total Income</p>
            <p className="text-2xl font-bold text-emerald-400 mt-0.5">{formatCurrency(totalIncome)}</p>
            <p className="text-xs text-slate-500 mt-1">{income.length} transaction{income.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-start gap-4">
          <div className="bg-red-500/10 rounded-lg p-3 text-red-400 shrink-0">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Total Expenditure</p>
            <p className="text-2xl font-bold text-red-400 mt-0.5">{formatCurrency(totalExpenses)}</p>
            <p className="text-xs text-slate-500 mt-1">{expenses.length} transaction{expenses.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className={`bg-slate-800 border rounded-xl p-5 flex items-start gap-4 ${netPositive ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
          <div className={`rounded-lg p-3 shrink-0 ${netPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Net Balance</p>
            <p className={`text-2xl font-bold mt-0.5 ${netPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {net < 0 ? '-' : ''}{formatCurrency(Math.abs(net))}
            </p>
            <p className="text-xs text-slate-500 mt-1">{netPositive ? 'Surplus' : 'Deficit'}</p>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-start gap-4">
          <div className="bg-cyan-500/10 rounded-lg p-3 text-cyan-400 shrink-0">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Budgeted Income</p>
            <p className="text-2xl font-bold text-cyan-300 mt-0.5">{formatCurrency(totalBudgetIncome)}</p>
            <p className="text-xs text-slate-500 mt-1">Across defined income budgets</p>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-start gap-4">
          <div className="bg-amber-500/10 rounded-lg p-3 text-amber-400 shrink-0">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Budgeted Expenditure</p>
            <p className="text-2xl font-bold text-amber-300 mt-0.5">{formatCurrency(totalBudgetExpenses)}</p>
            <p className="text-xs text-slate-500 mt-1">{budgetComparisons.length} budget line{budgetComparisons.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {(totalIncome > 0 || totalExpenses > 0) && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300">Income & Expenditure Statement</h3>
          </div>

          <div className="px-5 py-3 bg-emerald-500/5 border-b border-slate-700">
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Income</p>
          </div>

          {Object.entries(incomeByCategory).sort(([, a], [, b]) => b.amount - a.amount).map(([category, { items, amount }]) => (
            <div key={category}>
              <div className="px-5 py-2 border-b border-slate-700/50">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{category}</p>
              </div>
              <div className="divide-y divide-slate-700/30">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-5 py-2 text-sm gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-slate-500 text-xs shrink-0">{new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                        <span className="text-slate-300 truncate">{item.description}</span>
                        <span className="text-xs text-slate-500 shrink-0">{item.fund?.name ?? 'Unassigned'}</span>
                        {showDistrictColumn && <span className="text-xs text-slate-500 shrink-0">{item.district?.name}</span>}
                      </div>
                    </div>
                    <span className="text-emerald-400 font-medium shrink-0">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between px-5 py-2.5 bg-slate-900/40 border-y border-slate-700/50 text-sm">
                <span className="text-slate-400">{category} subtotal</span>
                <span className="text-emerald-400 font-semibold">{formatCurrency(amount)}</span>
              </div>
            </div>
          ))}

          <div className="flex justify-between px-5 py-3 border-b border-slate-700">
            <span className="text-sm font-bold text-slate-200">Total Income</span>
            <span className="text-emerald-400 font-bold">{formatCurrency(totalIncome)}</span>
          </div>

          <div className="px-5 py-3 bg-red-500/5 border-b border-slate-700">
            <p className="text-xs font-bold text-red-400 uppercase tracking-widest">Expenditure</p>
          </div>

          {Object.entries(expensesByCategory).sort(([, a], [, b]) => b.amount - a.amount).map(([category, { items, amount }]) => (
            <div key={category}>
              <div className="px-5 py-2 border-b border-slate-700/50">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{category}</p>
              </div>
              <div className="divide-y divide-slate-700/30">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-5 py-2 text-sm gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-slate-500 text-xs shrink-0">{new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                        <span className="text-slate-300 truncate">{item.description}</span>
                        <span className="text-xs text-slate-500 shrink-0">{item.fund?.name ?? 'Unassigned'}</span>
                        {showDistrictColumn && <span className="text-xs text-slate-500 shrink-0">{item.district?.name}</span>}
                      </div>
                    </div>
                    <span className="text-red-400 font-medium shrink-0">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between px-5 py-2.5 bg-slate-900/40 border-y border-slate-700/50 text-sm">
                <span className="text-slate-400">{category} subtotal</span>
                <span className="text-red-400 font-semibold">{formatCurrency(amount)}</span>
              </div>
            </div>
          ))}

          <div className="flex justify-between px-5 py-3 border-b border-slate-700">
            <span className="text-sm font-bold text-slate-200">Total Expenditure</span>
            <span className="text-red-400 font-bold">{formatCurrency(totalExpenses)}</span>
          </div>

          <div className={`flex justify-between px-5 py-4 ${netPositive ? 'bg-emerald-500/5' : 'bg-red-500/5'}`}>
            <span className="font-bold text-slate-100">{netPositive ? 'Surplus' : 'Deficit'}</span>
            <span className={`font-bold text-lg ${netPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {net < 0 ? '-' : ''}{formatCurrency(Math.abs(net))}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryBreakdown title="Income by Category" data={income} color="emerald" />
        <CategoryBreakdown title="Expenditure by Category" data={expenses} color="red" />
      </div>

      <FundBalanceSection rows={fundBalances} showDistrict={showDistrictColumn} />
      <BudgetComparisonSection rows={budgetComparisons} showDistrict={showDistrictColumn} />

      {totalIncome === 0 && totalExpenses === 0 && budgetComparisons.length === 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
          <p className="text-slate-500">No financial data yet. Add income, expenditure, or budgets to unlock reporting.</p>
        </div>
      )}
    </div>
  )
}
