'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useDistricts } from '@/hooks/useDistricts'
import { LeaderboardEntry } from '@/types'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { ContributionBar } from '@/components/leaderboard/ContributionBar'
import { CertificateBadge } from '@/components/leaderboard/CertificateBadge'
import { CertificatesPanel } from '@/components/leaderboard/CertificatesPanel'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { Trophy, Award, Download, Camera, TrendingUp, TrendingDown, Minus, Users, MapPin, Percent } from 'lucide-react'

type Tab = 'individual' | 'region' | 'participation'

type RegionStat = {
  region_name: string
  total_contribution: number
  contributor_count: number
  avg_contribution: number
  rank: number
}

type ParticipationStat = {
  region_name: string
  contributor_count: number
  participation_pct: number
  total_contribution: number
  rank: number
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('individual')
  const [certOpen, setCertOpen] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [snapshotting, setSnapshotting] = useState(false)
  const { districtId, district, activeDistrictId } = useAuth()
  const { data: districts } = useDistricts()

  useEffect(() => {
    if (!districtId) { setEntries([]); setLoading(false); return }
    const supabase = createClient()
    supabase.from('leaderboard').select('*').eq('district_id', districtId).order('rank')
      .then(({ data }) => {
        setEntries(data ?? [])
        setLoading(false)
      })
  }, [districtId])

  const maxContribution = entries[0]?.contribution ?? 1
  const activeDistrictName = districts.find((item) => item.id === activeDistrictId)?.name ?? null
  const scopeLabel = district?.name ?? activeDistrictName ?? 'Selected district'

  const regionStats = useMemo<RegionStat[]>(() => {
    const map = new Map<string, { total: number; count: number }>()
    for (const e of entries) {
      const key = e.region_name ?? 'Unknown'
      const cur = map.get(key) ?? { total: 0, count: 0 }
      map.set(key, { total: cur.total + e.contribution, count: cur.count + 1 })
    }
    return Array.from(map.entries())
      .map(([region_name, { total, count }]) => ({
        region_name,
        total_contribution: total,
        contributor_count: count,
        avg_contribution: count > 0 ? total / count : 0,
        rank: 0,
      }))
      .sort((a, b) => b.total_contribution - a.total_contribution)
      .map((r, i) => ({ ...r, rank: i + 1 }))
  }, [entries])

  const participationStats = useMemo<ParticipationStat[]>(() => {
    const total = entries.length
    return regionStats
      .map((r) => ({
        region_name: r.region_name,
        contributor_count: r.contributor_count,
        participation_pct: total > 0 ? (r.contributor_count / total) * 100 : 0,
        total_contribution: r.total_contribution,
        rank: 0,
      }))
      .sort((a, b) => b.contributor_count - a.contributor_count)
      .map((r, i) => ({ ...r, rank: i + 1 }))
  }, [regionStats, entries.length])

  const handleTakeSnapshot = async () => {
    setSnapshotting(true)
    const supabase = createClient()
    await supabase.rpc('take_leaderboard_snapshot')
    setSnapshotting(false)
  }

  const movementIndicator = (rankChange: number | null, prevRank: number | null) => {
    if (prevRank === null) return <span className="text-slate-500 text-xs">NEW</span>
    if (rankChange === null || rankChange === 0) return <Minus className="h-3 w-3 text-slate-500 mx-auto" />
    if (rankChange > 0) return (
      <span className="flex items-center gap-0.5 text-emerald-400 text-xs font-semibold">
        <TrendingUp className="h-3 w-3" />{rankChange}
      </span>
    )
    return (
      <span className="flex items-center gap-0.5 text-red-400 text-xs font-semibold">
        <TrendingDown className="h-3 w-3" />{Math.abs(rankChange)}
      </span>
    )
  }

  const rankBadge = (rank: number) => {
    if (rank === 1) return <span className="text-yellow-400 font-bold text-lg">#1</span>
    if (rank === 2) return <span className="text-slate-300 font-bold text-lg">#2</span>
    if (rank === 3) return <span className="text-amber-600 font-bold text-lg">#3</span>
    return <span className="text-slate-500 text-sm font-semibold">#{rank}</span>
  }

  const handleDownloadPdf = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=900')
    if (!printWindow) return

    setPrinting(true)

    printWindow.document.open()
    printWindow.document.write(
      buildLeaderboardPdfHtml({
        entries,
        regionStats,
        participationStats,
        scopeLabel,
        generatedAt: new Date(),
      })
    )
    printWindow.document.close()
    printWindow.focus()

    const finish = () => setPrinting(false)
    printWindow.onafterprint = finish
    printWindow.onbeforeunload = finish

    window.setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'individual', label: 'Individual', icon: <Trophy className="h-4 w-4" /> },
    { id: 'region', label: 'By Region', icon: <MapPin className="h-4 w-4" /> },
    { id: 'participation', label: 'Participation %', icon: <Percent className="h-4 w-4" /> },
  ]

  if (loading) return <PageSpinner />

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Trophy className="h-7 w-7 text-yellow-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Leaderboard</h1>
            <p className="text-sm text-slate-400 mt-1">
              {scopeLabel} - Ranked by contribution
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleTakeSnapshot} disabled={entries.length === 0 || snapshotting}>
            <Camera className="h-4 w-4" />
            {snapshotting ? 'Saving...' : 'Snapshot'}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDownloadPdf} disabled={entries.length === 0 || printing}>
            <Download className="h-4 w-4" />
            {printing ? 'Preparing PDF...' : 'Download PDF'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCertOpen(true)}>
            <Award className="h-4 w-4" />
            Certificates
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Individual Tab */}
      {activeTab === 'individual' && (
        entries.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-4 py-3 text-slate-400 font-medium w-12">Rank</th>
                    <th className="text-center px-2 py-3 text-slate-400 font-medium w-10"></th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Gender</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Region</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Department</th>
                    <th className="text-right px-4 py-3 text-slate-400 font-medium">Contribution</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Certificate</th>
                    <th className="px-4 py-3 text-slate-400 font-medium">Bar</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition ${entry.rank <= 3 ? 'bg-slate-800/80' : ''}`}
                    >
                      <td className="px-4 py-3 text-center">{rankBadge(Number(entry.rank))}</td>
                      <td className="px-2 py-3 text-center">{movementIndicator(entry.rank_change, entry.prev_rank)}</td>
                      <td className="px-4 py-3 font-medium text-slate-100">{entry.name}</td>
                      <td className="px-4 py-3">
                        {entry.gender ? (
                          <Badge variant={entry.gender === 'male' ? 'teal' : entry.gender === 'female' ? 'purple' : 'default'}>
                            {entry.gender}
                          </Badge>
                        ) : <span className="text-slate-500">-</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{entry.region_name ?? '-'}</td>
                      <td className="px-4 py-3 text-slate-400">{entry.department_name ?? '-'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-cyan-400">
                        {formatCurrency(entry.contribution)}
                      </td>
                      <td className="px-4 py-3">
                        {entry.certificate_name
                          ? <CertificateBadge name={entry.certificate_name} />
                          : <span className="text-slate-600 text-xs">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        <ContributionBar value={entry.contribution} max={maxContribution} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* By Region Tab */}
      {activeTab === 'region' && (
        regionStats.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-4 py-3 text-slate-400 font-medium w-12">Rank</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Region</th>
                    <th className="text-right px-4 py-3 text-slate-400 font-medium">Contributors</th>
                    <th className="text-right px-4 py-3 text-slate-400 font-medium">Total Contribution</th>
                    <th className="text-right px-4 py-3 text-slate-400 font-medium">Avg Contribution</th>
                    <th className="px-4 py-3 text-slate-400 font-medium">Bar</th>
                  </tr>
                </thead>
                <tbody>
                  {regionStats.map((r) => (
                    <tr key={r.region_name} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
                      <td className="px-4 py-3 text-center">{rankBadge(r.rank)}</td>
                      <td className="px-4 py-3 font-medium text-slate-100">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-slate-500 shrink-0" />
                          {r.region_name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="flex items-center justify-end gap-1 text-slate-300">
                          <Users className="h-3.5 w-3.5 text-slate-500" />
                          {r.contributor_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-cyan-400">
                        {formatCurrency(r.total_contribution)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400">
                        {formatCurrency(r.avg_contribution)}
                      </td>
                      <td className="px-4 py-3">
                        <ContributionBar value={r.total_contribution} max={regionStats[0].total_contribution} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Participation % Tab */}
      {activeTab === 'participation' && (
        participationStats.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <p className="text-xs text-slate-500">
              Ranked by number of contributors per region as a share of all contributors in this district.
            </p>
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left px-4 py-3 text-slate-400 font-medium w-12">Rank</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Region</th>
                      <th className="text-right px-4 py-3 text-slate-400 font-medium">Contributors</th>
                      <th className="text-right px-4 py-3 text-slate-400 font-medium">% of Total</th>
                      <th className="text-right px-4 py-3 text-slate-400 font-medium">Total Contribution</th>
                      <th className="px-4 py-3 text-slate-400 font-medium">Participation Bar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participationStats.map((r) => (
                      <tr key={r.region_name} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
                        <td className="px-4 py-3 text-center">{rankBadge(r.rank)}</td>
                        <td className="px-4 py-3 font-medium text-slate-100">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-slate-500 shrink-0" />
                            {r.region_name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="flex items-center justify-end gap-1 text-slate-300">
                            <Users className="h-3.5 w-3.5 text-slate-500" />
                            {r.contributor_count}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold text-emerald-400">{r.participation_pct.toFixed(1)}%</span>
                        </td>
                        <td className="px-4 py-3 text-right text-cyan-400 font-semibold">
                          {formatCurrency(r.total_contribution)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="w-32 bg-slate-700 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-2 bg-emerald-500 rounded-full"
                              style={{ width: `${r.participation_pct}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      )}

      <CertificatesPanel open={certOpen} onClose={() => setCertOpen(false)} />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
      <p className="text-slate-500">No contributors yet</p>
    </div>
  )
}

function buildLeaderboardPdfHtml({
  entries,
  regionStats,
  participationStats,
  scopeLabel,
  generatedAt,
}: {
  entries: LeaderboardEntry[]
  regionStats: RegionStat[]
  participationStats: ParticipationStat[]
  scopeLabel: string
  generatedAt: Date
}) {
  const individualRows = entries.map((entry) => `
    <tr>
      <td class="rank">#${entry.rank}</td>
      <td class="movement">${pdfMovementCell(entry.rank_change, entry.prev_rank)}</td>
      <td><div class="name">${escapeHtml(entry.name)}</div></td>
      <td>${escapeHtml(entry.region_name ?? '-')}</td>
      <td class="amount">${escapeHtml(formatCurrency(entry.contribution))}</td>
      <td>${escapeHtml(entry.certificate_name ?? '-')}</td>
    </tr>
  `).join('')

  const regionRows = regionStats.map((r) => `
    <tr>
      <td class="rank">#${r.rank}</td>
      <td><div class="name">${escapeHtml(r.region_name)}</div></td>
      <td style="text-align:center;">${r.contributor_count}</td>
      <td class="amount">${escapeHtml(formatCurrency(r.total_contribution))}</td>
      <td class="amount">${escapeHtml(formatCurrency(r.avg_contribution))}</td>
    </tr>
  `).join('')

  const participationRows = participationStats.map((r) => `
    <tr>
      <td class="rank">#${r.rank}</td>
      <td><div class="name">${escapeHtml(r.region_name)}</div></td>
      <td style="text-align:center;">${r.contributor_count}</td>
      <td style="text-align:right; color:#16a34a; font-weight:700;">${r.participation_pct.toFixed(1)}%</td>
      <td class="amount">${escapeHtml(formatCurrency(r.total_contribution))}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Leaderboard PDF</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #0f172a;
        --muted: #475569;
        --line: #cbd5e1;
        --panel: #f8fafc;
        --accent: #0f766e;
      }

      * { box-sizing: border-box; }

      @page {
        size: A4 portrait;
        margin: 16mm;
      }

      body {
        margin: 0;
        font-family: "Segoe UI", Arial, sans-serif;
        color: var(--ink);
        background: white;
      }

      .hero {
        border: 1px solid var(--line);
        background:
          radial-gradient(circle at top right, rgba(13, 148, 136, 0.16), transparent 32%),
          linear-gradient(135deg, #f8fafc, #ecfeff);
        border-radius: 20px;
        padding: 24px;
        margin-bottom: 24px;
      }

      .eyebrow {
        display: inline-block;
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--accent);
        font-weight: 700;
        margin-bottom: 10px;
      }

      h1 { margin: 0; font-size: 30px; line-height: 1.1; }

      .subhead { margin: 8px 0 0; color: var(--muted); font-size: 14px; }

      .meta { margin-top: 14px; font-size: 12px; color: var(--muted); }

      .section-title {
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--accent);
        margin: 28px 0 10px;
        padding-bottom: 6px;
        border-bottom: 2px solid var(--line);
      }

      .table-wrap {
        border: 1px solid var(--line);
        border-radius: 14px;
        overflow: hidden;
        margin-bottom: 8px;
      }

      table { width: 100%; border-collapse: collapse; }

      thead th {
        background: #e2e8f0;
        color: #334155;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        padding: 10px 12px;
        text-align: left;
      }

      tbody td {
        padding: 10px 12px;
        border-top: 1px solid #e2e8f0;
        vertical-align: top;
        font-size: 12px;
      }

      tbody tr:nth-child(even) { background: #f8fafc; }

      .rank { width: 48px; font-weight: 700; color: var(--accent); }
      .name { font-weight: 700; }
      .amount { font-weight: 700; text-align: right; white-space: nowrap; }

      .movement {
        width: 44px;
        text-align: center;
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
      }

      .mv-up   { color: #16a34a; }
      .mv-down { color: #dc2626; }
      .mv-flat { color: #94a3b8; }
      .mv-new  { color: #0f766e; }

      .footer {
        margin-top: 16px;
        color: var(--muted);
        font-size: 11px;
        text-align: right;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <div class="eyebrow">Conference Dashboard</div>
        <h1>Leaderboard Report</h1>
        <p class="subhead">${escapeHtml(scopeLabel)} — ranked by contribution</p>
        <div class="meta">Generated ${escapeHtml(generatedAt.toLocaleString())}</div>
      </section>

      <div class="section-title">Individual Rankings</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th></th>
              <th>Name</th>
              <th>Region</th>
              <th style="text-align:right;">Contribution</th>
              <th>Certificate</th>
            </tr>
          </thead>
          <tbody>${individualRows}</tbody>
        </table>
      </div>

      <div class="section-title">By Region</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Region</th>
              <th style="text-align:center;">Contributors</th>
              <th style="text-align:right;">Total Contribution</th>
              <th style="text-align:right;">Avg Contribution</th>
            </tr>
          </thead>
          <tbody>${regionRows}</tbody>
        </table>
      </div>

      <div class="section-title">Participation %</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Region</th>
              <th style="text-align:center;">Contributors</th>
              <th style="text-align:right;">% of Total</th>
              <th style="text-align:right;">Total Contribution</th>
            </tr>
          </thead>
          <tbody>${participationRows}</tbody>
        </table>
      </div>

      <div class="footer">Prepared from the live leaderboard view</div>
    </main>
  </body>
</html>`
}

function pdfMovementCell(rankChange: number | null, prevRank: number | null): string {
  if (prevRank === null) return '<span class="mv-new">NEW</span>'
  if (rankChange === null || rankChange === 0) return '<span class="mv-flat">—</span>'
  if (rankChange > 0) return `<span class="mv-up">▲ ${rankChange}</span>`
  return `<span class="mv-down">▼ ${Math.abs(rankChange)}</span>`
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
