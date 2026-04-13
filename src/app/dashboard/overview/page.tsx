'use client'

import type { ComponentType } from 'react'
import Link from 'next/link'
import { ArrowRight, Landmark, PiggyBank, ReceiptText, Settings2 } from 'lucide-react'
import { useOverview } from '@/hooks/useOverview'
import { useAuth } from '@/contexts/AuthContext'
import { StatsRow } from '@/components/overview/StatsRow'
import { PageSpinner } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { cn } from '@/lib/utils/cn'

type QuickLink = {
  href: string
  label: string
  hint: string
  icon: ComponentType<{ className?: string }>
}

export default function OverviewPage() {
  const { districtId, district, isAdmin } = useAuth()
  const { data, loading } = useOverview(districtId)

  const scopeSummary = isAdmin && !districtId
    ? 'All districts summary'
    : `${district?.name ?? 'Selected district'} summary`

  const quickLinks: QuickLink[] = [
    {
      href: '/dashboard/finance/expenditure',
      label: 'Expenditure',
      hint: 'Track outgoing transactions and spending categories',
      icon: ReceiptText,
    },
    {
      href: '/dashboard/finance/income',
      label: 'Income',
      hint: 'Capture incoming funds and maintain income categories',
      icon: PiggyBank,
    },
    {
      href: '/dashboard/finance/reports',
      label: 'Reports',
      hint: 'Export finance statements as CSV, DOCX, or PDF',
      icon: Landmark,
    },
    {
      href: '/dashboard/settings',
      label: 'Settings',
      hint: 'Manage districts, imports, and finance configuration',
      icon: Settings2,
    },
  ]

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <PageSpinner />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Overview</h1>
        <p className="text-sm text-slate-400 mt-1">{scopeSummary}</p>
      </div>

      <StatsRow stats={data} />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <section className="lg:col-span-3 bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-slate-100">Category Highlights</h2>
          <p className="text-xs text-slate-400 mt-1">Top finance categories in the current scope.</p>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <CategoryPanel
              title="Income"
              tone="emerald"
              emptyLabel="No income categories yet."
              items={data.topIncomeCategories}
            />
            <CategoryPanel
              title="Expenditure"
              tone="red"
              emptyLabel="No expenditure categories yet."
              items={data.topExpenseCategories}
            />
          </div>
        </section>

        <section className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-slate-100">Quick Access</h2>
          <p className="text-xs text-slate-400 mt-1">Jump to the core finance workflows.</p>

          <div className="mt-4 space-y-1.5">
            {quickLinks.map((link) => {
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 border border-transparent hover:border-slate-600 hover:bg-slate-700/30 transition-colors"
                >
                  <Icon className="h-4 w-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{link.label}</p>
                    <p className="text-xs text-slate-500 truncate">{link.hint}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                </Link>
              )
            })}
          </div>
        </section>
      </div>

      <section className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h2 className="text-sm font-semibold text-slate-100">
          {isAdmin && !districtId ? 'District Comparison' : 'District Snapshot'}
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          {isAdmin && !districtId
            ? 'Compare district financial performance across the current workspace.'
            : 'Current district performance summary.'}
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">District</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Income</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Expenditure</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Net</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Entries</th>
              </tr>
            </thead>
            <tbody>
              {data.districtBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No district finance data recorded yet.
                  </td>
                </tr>
              ) : data.districtBreakdown.map((item) => (
                <tr key={item.district_id} className="border-b border-slate-700/50 last:border-0">
                  <td className="px-4 py-3 text-slate-100">{item.district_name}</td>
                  <td className="px-4 py-3 text-right text-emerald-400 font-medium">{formatCurrency(item.income_total)}</td>
                  <td className="px-4 py-3 text-right text-red-400 font-medium">{formatCurrency(item.expense_total)}</td>
                  <td
                    className={cn(
                      'px-4 py-3 text-right font-semibold',
                      item.net_balance >= 0 ? 'text-emerald-300' : 'text-red-300'
                    )}
                  >
                    {formatCurrency(item.net_balance)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400">
                    {item.income_count + item.expense_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function CategoryPanel({
  title,
  items,
  emptyLabel,
  tone,
}: {
  title: string
  items: { category: string; amount: number; count: number }[]
  emptyLabel: string
  tone: 'emerald' | 'red'
}) {
  const total = items.reduce((sum, item) => sum + item.amount, 0)
  const textTone = tone === 'emerald' ? 'text-emerald-400' : 'text-red-400'
  const barTone = tone === 'emerald' ? 'bg-emerald-500' : 'bg-red-500'

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500 mt-4">{emptyLabel}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => {
            const percentage = total > 0 ? (item.amount / total) * 100 : 0
            return (
              <div key={item.category}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-200 truncate">{item.category}</p>
                    <p className="text-xs text-slate-500">{item.count} entr{item.count === 1 ? 'y' : 'ies'}</p>
                  </div>
                  <p className={cn('text-sm font-semibold shrink-0', textTone)}>{formatCurrency(item.amount)}</p>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-700 overflow-hidden">
                  <div className={cn('h-full rounded-full', barTone)} style={{ width: `${percentage}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
