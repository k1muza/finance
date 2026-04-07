'use client'

import { StatCard } from '@/components/ui/StatCard'
import { OverviewStats } from '@/types'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Users, DollarSign, TrendingDown, TrendingUp, Calendar, Briefcase } from 'lucide-react'

export function StatsRow({ stats }: { stats: OverviewStats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      <StatCard
        label="Total Attendees"
        value={stats.totalPeople.toLocaleString()}
        icon={<Users className="h-5 w-5" />}
      />
      <StatCard
        label="Total Income"
        value={formatCurrency(stats.totalFunds)}
        icon={<DollarSign className="h-5 w-5" />}
      />
      <StatCard
        label="Total Expenses"
        value={formatCurrency(stats.totalExpenses)}
        icon={<TrendingDown className="h-5 w-5" />}
      />
      <StatCard
        label="Net Balance"
        value={formatCurrency(stats.netBalance)}
        icon={<TrendingUp className="h-5 w-5" />}
        sub={stats.netBalance >= 0 ? 'Surplus' : 'Deficit'}
      />
      <StatCard
        label="Conference Days"
        value={stats.totalDays}
        icon={<Calendar className="h-5 w-5" />}
      />
      <StatCard
        label="Departments"
        value={stats.totalDepartments}
        icon={<Briefcase className="h-5 w-5" />}
      />
    </div>
  )
}
