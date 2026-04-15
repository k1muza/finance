'use client'

import { useMemo } from 'react'
import { useCashbook } from '@/hooks/useCashbook'
import { useBudgets } from '@/hooks/useBudgets'
import { useAuth } from '@/contexts/AuthContext'
import { useDistricts } from '@/hooks/useDistricts'
import { PageSpinner } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Button } from '@/components/ui/Button'
import { TrendingUp, TrendingDown, Download, Landmark, Target } from 'lucide-react'
import { exportToCsv } from '@/lib/csv'
import { buildCashbookFundBalances, buildCashbookTotalsByCurrency, type FundBalanceRow } from '@/lib/finance/reporting'
import type { Currency } from '@/types'

const IN_KINDS = new Set(['receipt', 'opening_balance', 'adjustment'])

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
        <p className="text-xs text-slate-500 mt-1">Track how each fund is performing across receipts and payments.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              {showDistrict && <th className="text-left px-4 py-3 text-slate-400 font-medium">District</th>}
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Fund</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Currency</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Receipts</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Payments</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={showDistrict ? 6 : 5} className="px-4 py-8 text-center text-slate-500">
                  No fund activity recorded yet.
                </td>
              </tr>
            ) : rows.map((row) => (
              <tr key={`${row.district_id}:${row.fund_id ?? 'unassigned'}:${row.currency}`} className="border-b border-slate-700/50 last:border-0">
                {showDistrict && <td className="px-4 py-3 text-slate-300">{row.district_name}</td>}
                <td className="px-4 py-3 text-slate-100">{row.fund_name}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-medium text-slate-400 bg-slate-700 px-1.5 py-0.5 rounded">{row.currency}</span>
                </td>
                <td className="px-4 py-3 text-right text-emerald-400 font-medium">{formatCurrency(row.income_total, row.currency)}</td>
                <td className="px-4 py-3 text-right text-red-400 font-medium">{formatCurrency(row.expense_total, row.currency)}</td>
                <td className={`px-4 py-3 text-right font-semibold ${row.net_balance >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {formatCurrency(row.net_balance, row.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const { districtId, isAdmin } = useAuth()
  const { data: districts } = useDistricts()
  const { data: budgets } = useBudgets({ district_id: districtId ?? undefined })

  const { data: transactions, loading } = useCashbook({
    district_id: districtId === undefined ? undefined : districtId,
    status: 'posted',
  })

  const showDistrictColumn = isAdmin && !districtId
  const districtName = districtId
    ? (districts.find((d) => d.id === districtId)?.name ?? 'District')
    : 'All Districts'

  const { inByCurrency, outByCurrency } = useMemo(
    () => buildCashbookTotalsByCurrency(transactions),
    [transactions]
  )

  const fundBalances = useMemo(
    () => buildCashbookFundBalances(transactions),
    [transactions]
  )

  const allCurrencies = useMemo(() => {
    return [...new Set([...Object.keys(inByCurrency), ...Object.keys(outByCurrency)])] as Currency[]
  }, [inByCurrency, outByCurrency])

  const budgetTotalsByCurrency = useMemo(() => {
    return budgets.reduce<Record<string, { income: number; expense: number }>>((acc, b) => {
      if (!acc[b.currency]) acc[b.currency] = { income: 0, expense: 0 }
      if (b.type === 'income') acc[b.currency].income += b.amount
      else acc[b.currency].expense += b.amount
      return acc
    }, {})
  }, [budgets])

  const handleExport = () => {
    const rows: Record<string, string | number | null>[] = []
    const reportDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

    const pushRow = (row: Record<string, string | number | null>) => {
      rows.push({
        Section: '', Date: '', Reference: '', District: '', Fund: '', Account: '',
        Counterparty: '', Narration: '', Currency: '', Kind: '', Amount: '',
        Direction: '', ...row,
      })
    }

    pushRow({ Section: 'Cashbook Report', Date: reportDate, District: districtName })
    pushRow({})

    for (const currency of allCurrencies) {
      const totalIn = inByCurrency[currency] ?? 0
      const totalOut = outByCurrency[currency] ?? 0
      const net = totalIn - totalOut

      pushRow({ Section: `RECEIPTS (${currency})` })
      for (const txn of transactions.filter((t) => t.currency === currency && IN_KINDS.has(t.kind))) {
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
      for (const txn of transactions.filter((t) => t.currency === currency && !IN_KINDS.has(t.kind))) {
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
      pushRow({ Section: net >= 0 ? `SURPLUS (${currency})` : `DEFICIT (${currency})`, Currency: currency, Amount: Math.abs(net) })
      pushRow({})
    }

    if (fundBalances.length > 0) {
      pushRow({ Section: 'FUND BALANCES' })
      for (const row of fundBalances) {
        pushRow({
          District: showDistrictColumn ? row.district_name : '',
          Fund: row.fund_name,
          Currency: row.currency,
          Narration: 'Net fund position',
          Amount: row.net_balance,
          Kind: 'fund_balance',
        })
      }
    }

    const filename = `cashbook-report-${districtName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`
    exportToCsv(filename, rows)
  }

  if (loading) return <PageSpinner />

  const hasData = transactions.length > 0

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Reports</h1>
          <p className="text-sm text-slate-400 mt-1">Cashbook Summary — {districtName}</p>
        </div>
        <Button variant="ghost" onClick={handleExport} disabled={!hasData}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Stat cards — per-currency */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-start gap-4">
          <div className="bg-emerald-500/10 rounded-lg p-3 text-emerald-400 shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Total Receipts</p>
            {Object.keys(inByCurrency).length === 0 ? (
              <p className="text-2xl font-bold text-emerald-400 mt-0.5">—</p>
            ) : Object.entries(inByCurrency).map(([currency, amount]) => (
              <p key={currency} className="text-xl font-bold text-emerald-400 mt-0.5">{formatCurrency(amount!, currency as Currency)}</p>
            ))}
            <p className="text-xs text-slate-500 mt-1">
              {transactions.filter((t) => IN_KINDS.has(t.kind)).length} transaction(s)
            </p>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-start gap-4">
          <div className="bg-red-500/10 rounded-lg p-3 text-red-400 shrink-0">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Total Payments</p>
            {Object.keys(outByCurrency).length === 0 ? (
              <p className="text-2xl font-bold text-red-400 mt-0.5">—</p>
            ) : Object.entries(outByCurrency).map(([currency, amount]) => (
              <p key={currency} className="text-xl font-bold text-red-400 mt-0.5">{formatCurrency(amount!, currency as Currency)}</p>
            ))}
            <p className="text-xs text-slate-500 mt-1">
              {transactions.filter((t) => !IN_KINDS.has(t.kind)).length} transaction(s)
            </p>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-start gap-4">
          <div className="bg-cyan-500/10 rounded-lg p-3 text-cyan-400 shrink-0">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Budgeted Income</p>
            {Object.keys(budgetTotalsByCurrency).length === 0 ? (
              <p className="text-2xl font-bold text-cyan-300 mt-0.5">—</p>
            ) : Object.entries(budgetTotalsByCurrency).map(([currency, totals]) => (
              totals.income > 0 && (
                <p key={currency} className="text-xl font-bold text-cyan-300 mt-0.5">{formatCurrency(totals.income, currency as Currency)}</p>
              )
            ))}
            <p className="text-xs text-slate-500 mt-1">Across defined income budgets</p>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-start gap-4">
          <div className="bg-amber-500/10 rounded-lg p-3 text-amber-400 shrink-0">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Budgeted Expenditure</p>
            {Object.keys(budgetTotalsByCurrency).length === 0 ? (
              <p className="text-2xl font-bold text-amber-300 mt-0.5">—</p>
            ) : Object.entries(budgetTotalsByCurrency).map(([currency, totals]) => (
              totals.expense > 0 && (
                <p key={currency} className="text-xl font-bold text-amber-300 mt-0.5">{formatCurrency(totals.expense, currency as Currency)}</p>
              )
            ))}
            <p className="text-xs text-slate-500 mt-1">{budgets.length} budget line{budgets.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Cashbook summary table — per currency */}
      {hasData && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300">Cashbook Summary</h3>
          </div>
          {allCurrencies.map((currency) => {
            const totalIn = inByCurrency[currency] ?? 0
            const totalOut = outByCurrency[currency] ?? 0
            const net = totalIn - totalOut
            const netPositive = net >= 0
            const inTxns = transactions.filter((t) => t.currency === currency && IN_KINDS.has(t.kind))
            const outTxns = transactions.filter((t) => t.currency === currency && !IN_KINDS.has(t.kind))

            return (
              <div key={currency}>
                <div className="px-5 py-2 bg-slate-700/40 border-b border-slate-700">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">{currency}</span>
                </div>

                {inTxns.length > 0 && (
                  <>
                    <div className="px-5 py-2 bg-emerald-500/5 border-b border-slate-700">
                      <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Receipts</p>
                    </div>
                    <div className="divide-y divide-slate-700/30">
                      {inTxns.map((txn) => (
                        <div key={txn.id} className="flex items-center justify-between px-5 py-2 text-sm gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-slate-500 text-xs shrink-0">
                              {new Date(txn.transaction_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                            </span>
                            {txn.reference_number && (
                              <span className="text-xs text-slate-500 shrink-0 font-mono">{txn.reference_number}</span>
                            )}
                            <span className="text-slate-300 truncate">{txn.narration ?? txn.counterparty ?? '—'}</span>
                            {txn.fund && (
                              <span className="text-xs text-slate-500 shrink-0">
                                {(txn.fund as { name?: string }).name}
                              </span>
                            )}
                          </div>
                          <span className="text-emerald-400 font-medium shrink-0">{formatCurrency(Number(txn.total_amount), currency)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between px-5 py-3 border-b border-slate-700">
                      <span className="text-sm font-bold text-slate-200">Total Receipts ({currency})</span>
                      <span className="text-emerald-400 font-bold">{formatCurrency(totalIn, currency)}</span>
                    </div>
                  </>
                )}

                {outTxns.length > 0 && (
                  <>
                    <div className="px-5 py-2 bg-red-500/5 border-b border-slate-700">
                      <p className="text-xs font-bold text-red-400 uppercase tracking-widest">Payments</p>
                    </div>
                    <div className="divide-y divide-slate-700/30">
                      {outTxns.map((txn) => (
                        <div key={txn.id} className="flex items-center justify-between px-5 py-2 text-sm gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-slate-500 text-xs shrink-0">
                              {new Date(txn.transaction_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                            </span>
                            {txn.reference_number && (
                              <span className="text-xs text-slate-500 shrink-0 font-mono">{txn.reference_number}</span>
                            )}
                            <span className="text-slate-300 truncate">{txn.narration ?? txn.counterparty ?? '—'}</span>
                            {txn.fund && (
                              <span className="text-xs text-slate-500 shrink-0">
                                {(txn.fund as { name?: string }).name}
                              </span>
                            )}
                          </div>
                          <span className="text-red-400 font-medium shrink-0">{formatCurrency(Number(txn.total_amount), currency)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between px-5 py-3 border-b border-slate-700">
                      <span className="text-sm font-bold text-slate-200">Total Payments ({currency})</span>
                      <span className="text-red-400 font-bold">{formatCurrency(totalOut, currency)}</span>
                    </div>
                  </>
                )}

                <div className={`flex justify-between px-5 py-4 ${netPositive ? 'bg-emerald-500/5' : 'bg-red-500/5'} border-b border-slate-700`}>
                  <span className="font-bold text-slate-100">{netPositive ? 'Surplus' : 'Deficit'} ({currency})</span>
                  <span className={`font-bold text-lg ${netPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {net < 0 ? '-' : ''}{formatCurrency(Math.abs(net), currency)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <FundBalanceSection rows={fundBalances} showDistrict={showDistrictColumn} />

      {!hasData && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
          <p className="text-slate-500">No posted transactions yet. Record cashbook entries to unlock reporting.</p>
        </div>
      )}
    </div>
  )
}
