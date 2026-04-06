'use client'

import { useExpenses } from '@/hooks/useExpenses'
import { useDistrictContributions } from '@/hooks/useDistrictContributions'
import { useIncome } from '@/hooks/useIncome'
import { useAuth } from '@/contexts/AuthContext'
import { useDistricts } from '@/hooks/useDistricts'
import { PageSpinner } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Button } from '@/components/ui/Button'
import { TrendingUp, TrendingDown, Scale, Download, FileDown } from 'lucide-react'
import { exportToCsv } from '@/lib/csv'

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
  const total = sorted.reduce((s, [, v]) => s + v, 0)
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

export default function ReportsPage() {
  const { districtId } = useAuth()
  const { data: districts } = useDistricts()

  const { data: expenses, loading: expLoading, total: totalExpenses } = useExpenses({
    district_id: districtId ?? undefined,
  })
  const { data: contributions, loading: contribLoading, total: contribTotal } = useDistrictContributions({
    district_id: districtId ?? undefined,
  })
  const { data: manualIncome, loading: incLoading, total: manualTotal } = useIncome({
    district_id: districtId ?? undefined,
  })

  const loading = expLoading || contribLoading || incLoading
  const totalIncome = contribTotal + manualTotal
  const net = totalIncome - totalExpenses
  const netPositive = net >= 0
  const districtName = districtId
    ? (districts.find((d) => d.id === districtId)?.name ?? 'District')
    : 'All Districts'

  // Group expenses by category for the detailed report table
  const expensesByCategory = expenses.reduce<Record<string, { amount: number; items: typeof expenses }>>((acc, e) => {
    const key = e.category ?? 'Uncategorised'
    if (!acc[key]) acc[key] = { amount: 0, items: [] }
    acc[key].amount += e.amount
    acc[key].items.push(e)
    return acc
  }, {})

  // Group manual income by category
  const incomeByCategory = manualIncome.reduce<Record<string, { amount: number; items: typeof manualIncome }>>((acc, e) => {
    const key = e.category ?? 'Uncategorised'
    if (!acc[key]) acc[key] = { amount: 0, items: [] }
    acc[key].amount += e.amount
    acc[key].items.push(e)
    return acc
  }, {})

  const handleExport = () => {
    const rows: Record<string, string | number | null>[] = []
    const reportDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

    // Header info
    rows.push({ Section: 'Income & Expenditure Report', Date: reportDate, Category: '', Description: '', Amount: '', Type: '' })
    rows.push({ Section: districtName, Date: '', Category: '', Description: '', Amount: '', Type: '' })
    rows.push({ Section: '', Date: '', Category: '', Description: '', Amount: '', Type: '' })

    // INCOME section
    rows.push({ Section: 'INCOME', Date: '', Category: '', Description: '', Amount: '', Type: '' })

    // Contributions
    rows.push({ Section: '', Date: '', Category: 'People\'s Contributions', Description: '', Amount: '', Type: 'income' })
    for (const c of contributions) {
      rows.push({
        Section: '',
        Date: c.date,
        Category: 'Contributions',
        Description: `${c.person_name}${c.note ? ` — ${c.note}` : ''}`,
        Amount: c.amount,
        Type: 'income',
      })
    }
    rows.push({ Section: '', Date: '', Category: '', Description: 'Contributions Subtotal', Amount: contribTotal, Type: 'subtotal' })
    rows.push({ Section: '', Date: '', Category: '', Description: '', Amount: '', Type: '' })

    // Manual income by category
    if (manualIncome.length > 0) {
      rows.push({ Section: '', Date: '', Category: 'Other Income', Description: '', Amount: '', Type: 'income' })
      for (const [cat, { items }] of Object.entries(incomeByCategory).sort(([, a], [, b]) => b.amount - a.amount)) {
        for (const item of items) {
          rows.push({
            Section: '',
            Date: item.date,
            Category: cat,
            Description: item.description,
            Amount: item.amount,
            Type: 'income',
          })
        }
      }
      rows.push({ Section: '', Date: '', Category: '', Description: 'Other Income Subtotal', Amount: manualTotal, Type: 'subtotal' })
      rows.push({ Section: '', Date: '', Category: '', Description: '', Amount: '', Type: '' })
    }

    rows.push({ Section: '', Date: '', Category: '', Description: 'TOTAL INCOME', Amount: totalIncome, Type: 'total' })
    rows.push({ Section: '', Date: '', Category: '', Description: '', Amount: '', Type: '' })

    // EXPENDITURE section
    rows.push({ Section: 'EXPENDITURE', Date: '', Category: '', Description: '', Amount: '', Type: '' })
    for (const [cat, { items }] of Object.entries(expensesByCategory).sort(([, a], [, b]) => b.amount - a.amount)) {
      for (const item of items) {
        rows.push({
          Section: '',
          Date: item.date,
          Category: cat,
          Description: item.description,
          Amount: item.amount,
          Type: 'expense',
        })
      }
    }
    rows.push({ Section: '', Date: '', Category: '', Description: '', Amount: '', Type: '' })
    rows.push({ Section: '', Date: '', Category: '', Description: 'TOTAL EXPENDITURE', Amount: totalExpenses, Type: 'total' })
    rows.push({ Section: '', Date: '', Category: '', Description: '', Amount: '', Type: '' })

    // Net
    rows.push({
      Section: '',
      Date: '',
      Category: '',
      Description: netPositive ? 'SURPLUS' : 'DEFICIT',
      Amount: Math.abs(net),
      Type: 'net',
    })

    const filename = `IE-Report-${districtName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`
    exportToCsv(filename, rows)
  }

  if (loading) return <PageSpinner />

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Reports</h1>
          <p className="text-sm text-slate-400 mt-1">Income & Expenditure — {districtName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={handleExport} disabled={totalIncome === 0 && totalExpenses === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button
            onClick={() => {
              const params = districtId ? `?district_id=${districtId}` : ''
              window.location.href = `/api/reports/ie-pdf${params}`
            }}
            disabled={totalIncome === 0 && totalExpenses === 0}
          >
            <FileDown className="h-4 w-4" /> Download PDF
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-start gap-4">
          <div className="bg-emerald-500/10 rounded-lg p-3 text-emerald-400 shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Total Income</p>
            <p className="text-2xl font-bold text-emerald-400 mt-0.5">{formatCurrency(totalIncome)}</p>
            <p className="text-xs text-slate-500 mt-1">Contributions + other income</p>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-start gap-4">
          <div className="bg-red-500/10 rounded-lg p-3 text-red-400 shrink-0">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Total Expenses</p>
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
      </div>

      {/* Income vs Expenses bar */}
      {(totalIncome > 0 || totalExpenses > 0) && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-300">Income vs Expenses</h3>
          <div className="space-y-2">
            {totalIncome > 0 && (
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Income</span><span>{formatCurrency(totalIncome)}</span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: totalIncome >= totalExpenses ? '100%' : `${(totalIncome / Math.max(totalIncome, totalExpenses)) * 100}%` }} />
                </div>
              </div>
            )}
            {totalExpenses > 0 && (
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Expenses</span><span>{formatCurrency(totalExpenses)}</span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: totalExpenses >= totalIncome ? '100%' : `${(totalExpenses / Math.max(totalIncome, totalExpenses)) * 100}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detailed I&E report */}
      {(totalIncome > 0 || totalExpenses > 0) && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300">Income & Expenditure Statement</h3>
          </div>

          {/* INCOME */}
          <div className="px-5 py-3 bg-emerald-500/5 border-b border-slate-700">
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Income</p>
          </div>

          {contribTotal > 0 && (
            <>
              <div className="px-5 py-2 border-b border-slate-700/50">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">People&apos;s Contributions</p>
              </div>
              <div className="flex justify-between items-center px-5 py-3 bg-slate-900/40 border-y border-slate-700/50 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-slate-300">Total collected contributions</span>
                  <span className="text-xs text-slate-500 shrink-0">
                    {contributions.length} entr{contributions.length === 1 ? 'y' : 'ies'}
                  </span>
                </div>
                <span className="text-emerald-400 font-semibold">{formatCurrency(contribTotal)}</span>
              </div>
            </>
          )}

          {Object.entries(incomeByCategory).sort(([, a], [, b]) => b.amount - a.amount).map(([cat, { items, amount }]) => (
            <div key={cat}>
              <div className="px-5 py-2 border-b border-slate-700/50">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{cat}</p>
              </div>
              <div className="divide-y divide-slate-700/30">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-5 py-2 text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-slate-500 text-xs shrink-0">{new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                      <span className="text-slate-300 truncate">{item.description}</span>
                    </div>
                    <span className="text-emerald-400 font-medium ml-4 shrink-0">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between px-5 py-2.5 bg-slate-900/40 border-y border-slate-700/50 text-sm">
                <span className="text-slate-400">{cat} subtotal</span>
                <span className="text-emerald-400 font-semibold">{formatCurrency(amount)}</span>
              </div>
            </div>
          ))}

          <div className="flex justify-between px-5 py-3 border-b border-slate-700">
            <span className="text-sm font-bold text-slate-200">Total Income</span>
            <span className="text-emerald-400 font-bold">{formatCurrency(totalIncome)}</span>
          </div>

          {/* EXPENDITURE */}
          <div className="px-5 py-3 bg-red-500/5 border-b border-slate-700">
            <p className="text-xs font-bold text-red-400 uppercase tracking-widest">Expenditure</p>
          </div>

          {Object.entries(expensesByCategory).sort(([, a], [, b]) => b.amount - a.amount).map(([cat, { items, amount }]) => (
            <div key={cat}>
              <div className="px-5 py-2 border-b border-slate-700/50">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{cat}</p>
              </div>
              <div className="divide-y divide-slate-700/30">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-5 py-2 text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-slate-500 text-xs shrink-0">{new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                      <span className="text-slate-300 truncate">{item.description}</span>
                    </div>
                    <span className="text-red-400 font-medium ml-4 shrink-0">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between px-5 py-2.5 bg-slate-900/40 border-y border-slate-700/50 text-sm">
                <span className="text-slate-400">{cat} subtotal</span>
                <span className="text-red-400 font-semibold">{formatCurrency(amount)}</span>
              </div>
            </div>
          ))}

          <div className="flex justify-between px-5 py-3 border-b border-slate-700">
            <span className="text-sm font-bold text-slate-200">Total Expenditure</span>
            <span className="text-red-400 font-bold">{formatCurrency(totalExpenses)}</span>
          </div>

          {/* Net */}
          <div className={`flex justify-between px-5 py-4 ${netPositive ? 'bg-emerald-500/5' : 'bg-red-500/5'}`}>
            <span className="font-bold text-slate-100">{netPositive ? 'Surplus' : 'Deficit'}</span>
            <span className={`font-bold text-lg ${netPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {net < 0 ? '-' : ''}{formatCurrency(Math.abs(net))}
            </span>
          </div>
        </div>
      )}

      {/* Category breakdown chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryBreakdown title="Expenses by Category" data={expenses} color="red" />
        <CategoryBreakdown title="Other Income by Category" data={manualIncome} color="emerald" />
      </div>

      {totalIncome === 0 && totalExpenses === 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
          <p className="text-slate-500">No financial data yet. Add income or expenses to see reports.</p>
        </div>
      )}
    </div>
  )
}
