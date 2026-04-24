'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Award, Crown, Medal, Printer } from 'lucide-react'
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

type SummaryTone = 'sky' | 'emerald' | 'amber' | 'rose'

type RegionRankingRow = {
  region: string
  participantCount: number
  totalIncoming: number
}

type ReportSection = {
  group: FundLeaderboardCurrencyGroup
  contributors: FundLeaderboardEntry[]
  contributorCount: number
  averageGift: number
  regionRows: RegionRankingRow[]
  topRegion: RegionRankingRow | null
}

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
  if (!iso) return 'Not set'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function activeRangeLabel(preset: PeriodPreset, customFrom: string, customTo: string) {
  if (preset !== 'custom') return getPresetRange(preset).label
  if (customFrom && customTo) return `${formatDate(customFrom)} to ${formatDate(customTo)}`
  if (customFrom) return `From ${formatDate(customFrom)}`
  if (customTo) return `Up to ${formatDate(customTo)}`
  return 'Custom period'
}

function getOrdinalRank(rank: number) {
  const mod100 = rank % 100
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`

  const mod10 = rank % 10
  if (mod10 === 1) return `${rank}st`
  if (mod10 === 2) return `${rank}nd`
  if (mod10 === 3) return `${rank}rd`
  return `${rank}th`
}

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return 'NA'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()

  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

function amountsMatch(a: number, b: number) {
  return Math.abs(a - b) < 0.000001
}

function getCompetitionRank<T>(
  items: T[],
  index: number,
  getValue: (item: T) => number,
) {
  if (index <= 0) return 1

  let rank = 1
  for (let pointer = 1; pointer <= index; pointer += 1) {
    if (!amountsMatch(getValue(items[pointer - 1]), getValue(items[pointer]))) {
      rank += 1
    }
  }

  return rank
}

function buildRegionRankings(group: FundLeaderboardCurrencyGroup) {
  const regionMap = new Map<string, RegionRankingRow>()

  for (const entry of group.incoming_leaders) {
    const region = entry.participant_region?.trim() || 'Unassigned'
    const existing = regionMap.get(region)

    if (existing) {
      existing.participantCount += 1
      existing.totalIncoming += entry.incoming_total
      continue
    }

    regionMap.set(region, {
      region,
      participantCount: 1,
      totalIncoming: entry.incoming_total,
    })
  }

  return [...regionMap.values()].sort((a, b) => (
    b.totalIncoming - a.totalIncoming
    || b.participantCount - a.participantCount
    || a.region.localeCompare(b.region)
  ))
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: SummaryTone
}) {
  const toneStyles: Record<SummaryTone, string> = {
    sky: 'border-sky-100 bg-sky-50/90',
    emerald: 'border-emerald-100 bg-emerald-50/90',
    amber: 'border-amber-100 bg-amber-50/90',
    rose: 'border-rose-100 bg-rose-50/90',
  }

  return (
    <article
      data-print-card
      className={`print-color-exact rounded-[5px] border px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] ${toneStyles[tone]}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
    </article>
  )
}

function TopContributorDecoration({ rank }: { rank: number }) {
  if (rank < 1 || rank > 3) return null

  const decoration = {
    1: {
      icon: Crown,
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    },
    2: {
      icon: Medal,
      className: 'border-slate-200 bg-slate-100 text-slate-700',
    },
    3: {
      icon: Award,
      className: 'border-orange-200 bg-orange-50 text-orange-700',
    },
  } as const

  const { icon: Icon, className } = decoration[rank as 1 | 2 | 3]

  return (
    <span
      aria-label={`Top contributor rank ${rank}`}
      title={`Top contributor rank ${rank}`}
      className={`print-color-exact inline-flex h-5 w-5 items-center justify-center rounded-full border shadow-[0_4px_10px_rgba(15,23,42,0.12)] ${className}`}
    >
      <Icon className="h-2.5 w-2.5" />
    </span>
  )
}

function RegionRankingsSection({
  section,
}: {
  section: ReportSection
}) {
  return (
    <section className="print-break-avoid space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Region Rankings</p>
        </div>
        <div className="print-color-exact inline-flex rounded-[5px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
          {section.group.currency} currency view
        </div>
      </div>

      {section.regionRows.length === 0 ? (
        <div className="rounded-[5px] border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No regional contribution data is available for this currency.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[5px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
          <table className="w-full border-collapse text-left">
            <thead className="print-color-exact bg-slate-100 text-[11px] uppercase tracking-[0.18em] text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Rank</th>
                <th className="px-4 py-3 font-semibold">Region</th>
                <th className="px-4 py-3 text-right font-semibold">Contributors</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700">
              {section.regionRows.map((row, index) => (
                <tr key={row.region} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-500">{getOrdinalRank(index + 1)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.region}</td>
                  <td className="px-4 py-3 text-right">{row.participantCount}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {formatCurrency(row.totalIncoming, section.group.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function ContributorsSection({
  section,
}: {
  section: ReportSection
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Individual Contributors</p>
        </div>
        <div className="rounded-[5px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
          {section.contributorCount} contributor{section.contributorCount === 1 ? '' : 's'}
        </div>
      </div>

      {section.contributors.length === 0 ? (
        <div className="rounded-[5px] border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No posted contribution activity to rank for this currency.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[5px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
          <table className="w-full border-collapse text-left">
            <thead className="print-color-exact bg-slate-100 text-[11px] uppercase tracking-[0.18em] text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Rank</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Region</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700">
              {section.contributors.map((entry, index) => {
                const displayRank = getCompetitionRank(
                  section.contributors,
                  index,
                  (item) => item.incoming_total,
                )

                return (
                  <tr key={entry.participant_key} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-slate-500">{getOrdinalRank(displayRank)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="relative inline-flex shrink-0">
                          <span className="print-color-exact inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                            {getInitials(entry.participant_name)}
                          </span>
                          <span className="absolute -right-1 -top-1 z-10">
                            <TopContributorDecoration rank={displayRank} />
                          </span>
                        </span>
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-slate-900">{entry.participant_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{entry.participant_region || 'Unassigned'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatCurrency(entry.incoming_total, section.group.currency)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
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
  const [reportDate] = useState(() => toIsoDate(new Date()))

  const activeRange = useMemo(() => {
    if (preset === 'custom') return { dateFrom: customFrom || null, dateTo: customTo || null }
    const range = getPresetRange(preset)
    return { dateFrom: range.dateFrom, dateTo: range.dateTo }
  }, [customFrom, customTo, preset])

  const fund = funds.find((item) => item.id === id)
  const leaderboard = useMemo(() => buildFundLeaderboard(transactions), [transactions])
  const rangeLabel = activeRangeLabel(preset, customFrom, customTo)

  const sections = useMemo<ReportSection[]>(() => (
    leaderboard.map((group) => {
      const contributors = group.incoming_leaders
      const contributionCount = contributors.reduce((sum, entry) => sum + entry.contribution_count, 0)
      const averageGift = contributionCount > 0 ? group.total_incoming / contributionCount : 0
      const regionRows = buildRegionRankings(group)

      return {
        group,
        contributors,
        contributorCount: contributors.length,
        averageGift,
        regionRows,
        topRegion: regionRows[0] ?? null,
      }
    })
  ), [leaderboard])

  const hasContributors = sections.some((section) => section.contributors.length > 0)

  useEffect(() => {
    document.body.dataset.printLayout = 'fund-leaderboard'
    document.documentElement.dataset.printLayout = 'fund-leaderboard'
    return () => {
      delete document.body.dataset.printLayout
      delete document.documentElement.dataset.printLayout
    }
  }, [])

  useEffect(() => {
    if (!id || !districtId) return

    let cancelled = false

    async function fetchTransactions() {
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

      const { data, error: queryError } = await query
      if (cancelled) return
      if (queryError) {
        setTransactions([])
        setError(queryError.message)
      } else {
        setTransactions((data ?? []) as CashbookTransaction[])
        setError(null)
      }
      setLoading(false)
    }

    fetchTransactions()

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
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to funds
        </Link>
        <p className="text-sm text-slate-500">Fund not found.</p>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html[data-print-layout='fund-leaderboard'],
          body[data-print-layout='fund-leaderboard'] { background: #ffffff !important; }
          html[data-print-layout='fund-leaderboard'],
          body[data-print-layout='fund-leaderboard'] {
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-hidden { display: none !important; }
          .print-break-avoid { break-inside: avoid; page-break-inside: avoid; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body[data-print-layout='fund-leaderboard'] [data-print-root='fund-leaderboard'] {
            padding: 12mm !important;
            max-width: none !important;
            min-height: 100vh !important;
            box-sizing: border-box !important;
            -webkit-box-decoration-break: clone;
            box-decoration-break: clone;
          }
          body[data-print-layout='fund-leaderboard'] [data-print-header-grid] {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) 220px !important;
            align-items: end !important;
          }
          body[data-print-layout='fund-leaderboard'] [data-print-summary-grid] {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }
          body[data-print-layout='fund-leaderboard'] [data-print-card] {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div
        data-print-root="fund-leaderboard"
        className="print-color-exact mx-auto max-w-5xl bg-[linear-gradient(180deg,#f8fbff_0%,#fcfdff_22%,#ffffff_40%)] px-4 py-4 text-slate-950 sm:px-6 sm:py-8"
      >
        <div className="space-y-8">
          <div className="print-hidden flex items-center justify-between gap-4">
            <Link
              href={`/dashboard/finance/funds/${id}`}
              className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <Button onClick={() => window.print()} className="gap-2 rounded-[5px]">
              <Printer className="h-4 w-4" />
              Print Report
            </Button>
          </div>

          <header className="print-color-exact rounded-[5px] border border-slate-200 bg-white/90 px-5 py-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)] sm:px-7">
            <div data-print-header-grid className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-sky-700">Fund Contributions Leaderboard</p>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{fund.name}</h1>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600">
                    {fund.description || 'Structured contribution summary with region rankings and individual contributor totals.'}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 text-sm text-slate-600 sm:min-w-[220px]">
                <div className="rounded-[5px] border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Period</p>
                    <p className="font-semibold text-slate-900 text-right whitespace-nowrap">{rangeLabel}</p>
                  </div>
                </div>
                <div className="rounded-[5px] border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Report Date</p>
                    <p className="font-semibold text-slate-900 text-right whitespace-nowrap">{formatDate(reportDate)}</p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {error && (
            <p className="rounded-[5px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          )}

          {!hasContributors ? (
            <div className="rounded-[5px] border border-slate-200 bg-white px-4 py-16 text-center text-sm text-slate-500 shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
              No posted contribution activity is available for this fund in the selected period.
            </div>
          ) : (
            sections.map((section) => (
              <section key={section.group.currency} className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Summary</p>
                  <div className="rounded-[5px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                    {section.group.transaction_count} transaction{section.group.transaction_count === 1 ? '' : 's'}
                  </div>
                </div>

                <div data-print-summary-grid className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard
                    label="Total Raised"
                    value={formatCurrency(section.group.total_incoming, section.group.currency)}
                    tone="sky"
                  />
                  <SummaryCard
                    label="Contributors"
                    value={section.contributorCount.toString()}
                    tone="emerald"
                  />
                  <SummaryCard
                    label="Average Contribution"
                    value={section.contributorCount > 0 ? formatCurrency(section.averageGift, section.group.currency) : 'Not available'}
                    tone="amber"
                  />
                  <SummaryCard
                    label="Top Region"
                    value={section.topRegion?.region ?? 'No region data'}
                    tone="rose"
                  />
                </div>

                <ContributorsSection section={section} />
                <RegionRankingsSection section={section} />
              </section>
            ))
          )}

          <footer className="border-t border-slate-200 pt-5 text-center text-[11px] uppercase tracking-[0.22em] text-slate-400">
            End of report - verified posted transaction records only
          </footer>
        </div>
      </div>
    </>
  )
}
