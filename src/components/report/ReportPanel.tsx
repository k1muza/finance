'use client'

import { useReport } from '@/hooks/useReport'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Spinner } from '@/components/ui/Spinner'
import {
  Users, DollarSign, TrendingDown, TrendingUp,
  Calendar, List, Zap, Globe, Briefcase,
} from 'lucide-react'

function pct(part: number, total: number) {
  if (total === 0) return '0.0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

function SummaryCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-4 flex items-start gap-3">
      <div className="p-2 rounded-lg bg-slate-700 text-slate-300 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 truncate">{label}</p>
        <p className="text-lg font-bold text-slate-100 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mt-8 mb-3">{title}</h2>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: (string | number | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-900 border-b border-slate-700">
            {headers.map((h) => (
              <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-slate-400 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-6 text-center text-slate-500 text-xs">
                No data
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/50 transition-colors">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2.5 text-slate-200 whitespace-nowrap">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

interface ReportPanelProps {
  districtId?: string | null
}

export function ReportPanel({ districtId }: ReportPanelProps) {
  const { data, loading } = useReport(districtId)

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  if (!data) return null

  const { totalContributions, totalExpenses, netBalance, totalPeople, byRegion, byDepartment, byGender, days, totalSessions, totalEvents, expenses } = data

  return (
    <div className="space-y-2">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <SummaryCard label="Attendees" value={totalPeople.toLocaleString()} icon={<Users className="h-4 w-4" />} />
        <SummaryCard label="Total Contributed" value={formatCurrency(totalContributions)} icon={<DollarSign className="h-4 w-4" />} />
        <SummaryCard label="Total Expenses" value={formatCurrency(totalExpenses)} icon={<TrendingDown className="h-4 w-4" />} />
        <SummaryCard
          label="Net Balance"
          value={formatCurrency(netBalance)}
          sub={netBalance >= 0 ? 'Surplus' : 'Deficit'}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <SummaryCard label="Conference Days" value={days.length} icon={<Calendar className="h-4 w-4" />} />
        <SummaryCard label="Sessions" value={totalSessions} icon={<List className="h-4 w-4" />} />
        <SummaryCard label="Events" value={totalEvents} icon={<Zap className="h-4 w-4" />} />
      </div>

      {/* Schedule */}
      {days.length > 0 && (
        <>
          <SectionHeader title="Conference Schedule" />
          <Table
            headers={['Date', 'Label', 'Sessions', 'Events']}
            rows={days.map((d) => [
              new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
              d.label ?? '—',
              d.sessions_count,
              d.events_count,
            ])}
          />
        </>
      )}

      {/* Contributions by Region */}
      <SectionHeader title="Contributions by Region" />
      <Table
        headers={['Region', 'People', 'Contributed', '% of Total']}
        rows={byRegion.map((r) => [
          <span key={r.region_id} className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            {r.region_name}
          </span>,
          r.people_count,
          formatCurrency(r.total),
          <span key="pct" className={r.total > 0 ? 'text-cyan-400' : 'text-slate-500'}>
            {pct(r.total, totalContributions)}
          </span>,
        ])}
      />

      {/* Contributions by Department */}
      {byDepartment.length > 0 && (
        <>
          <SectionHeader title="Contributions by Department" />
          <Table
            headers={['Department', 'Members', 'Contributed', '% of Total']}
            rows={byDepartment.map((d) => [
              <span key={d.department_id} className="flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                {d.department_name}
              </span>,
              d.people_count,
              formatCurrency(d.total),
              <span key="pct" className={d.total > 0 ? 'text-cyan-400' : 'text-slate-500'}>
                {pct(d.total, totalContributions)}
              </span>,
            ])}
          />
        </>
      )}

      {/* Contributions by Gender */}
      {byGender.length > 0 && (
        <>
          <SectionHeader title="Contributions by Gender" />
          <Table
            headers={['Gender', 'Count', 'Contributed', '% of Total', '% of Attendance']}
            rows={byGender.map((g) => [
              <span key={g.gender} className="capitalize">{g.gender ?? 'Unknown'}</span>,
              g.count,
              formatCurrency(g.total),
              <span key="cpct" className={g.total > 0 ? 'text-cyan-400' : 'text-slate-500'}>
                {pct(g.total, totalContributions)}
              </span>,
              <span key="apct" className="text-slate-400">
                {pct(g.count, totalPeople)}
              </span>,
            ])}
          />
        </>
      )}

      {/* Expenses */}
      <SectionHeader title="Expenses" />
      <Table
        headers={['Date', 'Description', 'Amount']}
        rows={[
          ...expenses.map((e) => [
            new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            e.description,
            formatCurrency(e.amount),
          ]),
          // Total row
          ...(expenses.length > 0 ? [[
            '',
            <span key="total-label" className="font-semibold text-slate-300">Total</span>,
            <span key="total-value" className="font-semibold text-slate-100">{formatCurrency(totalExpenses)}</span>,
          ]] : []),
        ]}
      />
    </div>
  )
}
