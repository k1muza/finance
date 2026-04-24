'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft,
  Award,
  Crown,
  Medal,
  Printer,
} from 'lucide-react'
import { SelectDistrictHint } from '@/components/layout/SelectDistrictHint'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { useAuth } from '@/contexts/AuthContext'
import { useFunds } from '@/hooks/useFunds'
import {
  buildFundLeaderboard,
  type FundLeaderboardCurrencyGroup,
  type FundLeaderboardEntry,
} from '@/lib/finance/reporting'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import type { CashbookTransaction } from '@/types'

type PeriodPreset = 'all_time' | 'this_year' | 'this_month' | 'custom'

function toIsoDate(date: Date) {
  return date.toISOString().split('T')[0]
}

function firstOfMonth() {
  const date = new Date()
  date.setDate(1)
  return toIsoDate(date)
}

function firstOfYear() {
  const date = new Date()
  date.setMonth(0, 1)
  return toIsoDate(date)
}

function getPresetRange(preset: Exclude<PeriodPreset, 'custom'>) {
  const today = toIsoDate(new Date())
  if (preset === 'all_time') return { dateFrom: null, dateTo: null, label: 'All time' }
  if (preset === 'this_month') return { dateFrom: firstOfMonth(), dateTo: today, label: 'This month' }
  return { dateFrom: firstOfYear(), dateTo: today, label: 'This year' }
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function activeRangeLabel(preset: PeriodPreset, customFrom: string, customTo: string) {
  if (preset !== 'custom') return getPresetRange(preset).label
  if (customFrom && customTo) return `${formatDate(customFrom)} – ${formatDate(customTo)}`
  if (customFrom) return `From ${formatDate(customFrom)}`
  if (customTo) return `Up to ${formatDate(customTo)}`
  return 'Custom period'
}

function PodiumCard({ entry, rank, currency }: { entry: FundLeaderboardEntry; rank: 1 | 2 | 3; currency: string }) {
  const icons = { 1: Crown, 2: Medal, 3: Award }
  const Icon = icons[rank]

  return (
    <article className="relative flex flex-col border-t-4 border-slate-900 bg-white p-4 pt-6 shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
      <div className="absolute top-0 right-0 p-2 text-4xl font-black text-slate-100 select-none">
        {rank}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-900">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Rank {rank}</p>
          <h3 className="text-lg font-bold leading-tight text-slate-950">{entry.participant_name}</h3>
        </div>
      </div>

      <div className="mt-auto border-t border-slate-100 pt-4">
        <p className="text-[10px] uppercase tracking-wider text-slate-400">Total Contribution</p>
        <p className="text-2xl font-black text-slate-900 leading-none">
          {formatCurrency(entry.incoming_total, currency)}
        </p>
        <p className="mt-1 text-[11px] text-slate-500 italic">
          {entry.contribution_count} transaction{entry.contribution_count === 1 ? '' : 's'}
        </p>
      </div>
    </article>
  )
}

function LeaderboardTable({ group }: { group: FundLeaderboardCurrencyGroup }) {
  return (
    <section className="print-break-avoid mt-8">
      <div className="mb-4 flex items-end justify-between border-b-2 border-slate-900 pb-2">
        <h2 className="text-lg font-bold uppercase tracking-tighter">Full Ranking Report</h2>
        <span className="text-sm font-medium text-slate-600">
          Total: {formatCurrency(group.total_incoming, group.currency)}
        </span>
      </div>

      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-300 text-[11px] uppercase tracking-wider text-slate-500">
            <th className="py-2 font-bold w-16">Rank</th>
            <th className="py-2 font-bold">Name</th>
            <th className="py-2 font-bold">Assembly · Region</th>
            <th className="py-2 font-bold text-right">Count</th>
            <th className="py-2 font-bold text-right">Amount ({group.currency})</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {group.entries.map((entry, index) => (
            <tr key={entry.participant_key} className="border-b border-slate-100 last:border-0">
              <td className="py-3 font-mono font-bold text-slate-400">#{(index + 1).toString().padStart(2, '0')}</td>
              <td className="py-3 font-bold text-slate-900">{entry.participant_name}</td>
              <td className="py-3 text-slate-500 text-xs">
                {[entry.participant_context, entry.participant_region].filter(Boolean).join(' · ')}
              </td>
              <td className="py-3 text-right text-slate-500">{entry.contribution_count}</td>
              <td className="py-3 text-right font-bold text-slate-950">
                {formatCurrency(entry.incoming_total, group.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default function FundLeaderboardPage() {
  const { id } = useParams<{ id: string }>()
  const { districtId } = useAuth()
  const { data: funds, loading: fundsLoading } = useFunds({ district_id: districtId })
  const [supabase] = useState(() => createClient())
  const [transactions, setTransactions] = useState<CashbookTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [preset] = useState<PeriodPreset>('all_time')
  const [customFrom] = useState(firstOfYear())
  const [customTo] = useState(toIsoDate(new Date()))

  const activeRange = useMemo(() => {
    if (preset === 'custom') return { dateFrom: customFrom || null, dateTo: customTo || null }
    const range = getPresetRange(preset)
    return { dateFrom: range.dateFrom, dateTo: range.dateTo }
  }, [customFrom, customTo, preset])

  const fund = funds.find((item) => item.id === id)
  const leaderboard = useMemo(() => buildFundLeaderboard(transactions), [transactions])
  const rangeLabel = activeRangeLabel(preset, customFrom, customTo)

  useEffect(() => {
    document.body.dataset.printLayout = 'fund-leaderboard'
    return () => { delete document.body.dataset.printLayout }
  }, [])

  useEffect(() => {
    if (!id || !districtId) return

    let cancelled = false
    setLoading(true)

    let query = supabase
      .from('cashbook_transactions')
      .select(
        '*, member:members!cashbook_transactions_member_id_fkey(id,name,type,title,parent_id), counterparty_record:counterparties(id,name,type), region_member_snapshot:members!cashbook_transactions_region_member_snapshot_id_fkey(id,name)',
      )
      .eq('district_id', districtId)
      .eq('fund_id', id)
      .eq('status', 'posted')
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (activeRange.dateFrom) query = query.gte('transaction_date', activeRange.dateFrom)
    if (activeRange.dateTo) query = query.lte('transaction_date', activeRange.dateTo)

    query.then(({ data, error: queryError }) => {
      if (cancelled) return
      if (queryError) {
        setTransactions([])
        setError(queryError.message)
      } else {
        setTransactions((data ?? []) as CashbookTransaction[])
        setError(null)
      }
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [activeRange.dateFrom, activeRange.dateTo, districtId, id, supabase])

  if (!districtId) {
    return (
      <div className="p-6">
        <SelectDistrictHint description="Choose a district to view its fund leaderboard." />
      </div>
    )
  }

  if (fundsLoading || loading) return <PageSpinner />

  if (!fund) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <Link
          href="/dashboard/finance/funds"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to funds
        </Link>
        <p className="text-slate-500 text-sm">Fund not found.</p>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          body { background: white !important; font-size: 12pt; }
          .print-hidden { display: none !important; }
          .print-break-avoid { break-inside: avoid; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      <div data-print-root="fund-leaderboard" className="mx-auto max-w-5xl bg-white p-4 sm:p-10 text-slate-950">

        <div className="print-hidden mb-8 flex justify-between items-center">
          <Link href={`/dashboard/finance/funds/${id}`} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> Print Report
          </Button>
        </div>

        <header className="border-b-4 border-slate-900 pb-6 mb-8">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-1">Financial Report</p>
              <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase">{fund.name}</h1>
              <p className="mt-2 text-slate-600 max-w-xl text-sm italic">
                {fund.description || 'Contributor Ranking and Activity Summary'}
              </p>
            </div>
            <div className="text-right">
              <div className="inline-block bg-slate-900 text-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest mb-2">
                Official Document
              </div>
              <p className="text-xs font-medium text-slate-500">Report Date</p>
              <p className="text-sm font-bold">{formatDate(toIsoDate(new Date()))}</p>
            </div>
          </div>
        </header>

        {error && (
          <p className="mb-6 rounded border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="grid grid-cols-3 gap-0 border border-slate-200 mb-10">
          <div className="border-r border-slate-200 p-4">
            <span className="text-[10px] font-bold uppercase text-slate-400">Time Period</span>
            <p className="text-sm font-bold">{rangeLabel}</p>
          </div>
          <div className="border-r border-slate-200 p-4">
            <span className="text-[10px] font-bold uppercase text-slate-400">Total Participants</span>
            <p className="text-sm font-bold">{leaderboard[0]?.participant_count ?? 0}</p>
          </div>
          <div className="p-4 bg-slate-50">
            <span className="text-[10px] font-bold uppercase text-slate-400">Total Raised</span>
            <p className="text-sm font-black text-slate-900">
              {leaderboard[0] ? formatCurrency(leaderboard[0].total_incoming, leaderboard[0].currency) : '—'}
            </p>
          </div>
        </div>

        {leaderboard.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">No posted activity to display.</p>
        ) : (
          leaderboard.map((group) => (
            <div key={group.currency} className="space-y-12">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 text-center">Top Contributors</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {group.entries[1] && <PodiumCard entry={group.entries[1]} rank={2} currency={group.currency} />}
                  {group.entries[0] && <PodiumCard entry={group.entries[0]} rank={1} currency={group.currency} />}
                  {group.entries[2] && <PodiumCard entry={group.entries[2]} rank={3} currency={group.currency} />}
                </div>
              </div>

              <LeaderboardTable group={group} />
            </div>
          ))
        )}

        <footer className="mt-12 border-t border-slate-200 pt-6 text-[10px] text-slate-400 uppercase tracking-widest text-center">
          End of Report · Verified Transaction Records Only
        </footer>
      </div>
    </>
  )
}
