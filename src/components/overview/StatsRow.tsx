'use client'

import { StatCard } from '@/components/ui/StatCard'
import { OverviewStats } from '@/types'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { ArrowDownCircle, ArrowUpCircle, Landmark, Receipt, TrendingUp } from 'lucide-react'

export function StatsRow({ stats }: { stats: OverviewStats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      <StatCard
        label="Total Income"
        value={formatCurrency(stats.totalIncome)}
        icon={<ArrowUpCircle className="h-5 w-5" />}
      />
      <StatCard
        label="Total Expenditure"
        value={formatCurrency(stats.totalExpenses)}
        icon={<ArrowDownCircle className="h-5 w-5" />}
      />
      <StatCard
        label="Net Balance"
        value={formatCurrency(stats.netBalance)}
        icon={<TrendingUp className="h-5 w-5" />}
        sub={stats.netBalance >= 0 ? 'Surplus' : 'Deficit'}
      />
      <StatCard
        label="Income Entries"
        value={stats.incomeCount.toLocaleString()}
        icon={<Landmark className="h-5 w-5" />}
      />
      <StatCard
        label="Expense Entries"
        value={stats.expenseCount.toLocaleString()}
        icon={<Receipt className="h-5 w-5" />}
      />
      <StatCard
        label="Income Categories"
        value={stats.topIncomeCategories.length.toLocaleString()}
        icon={<ArrowUpCircle className="h-5 w-5" />}
        sub="Active category groups"
      />
    </div>
  )
}
