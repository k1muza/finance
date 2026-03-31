'use client'

import { useEffect, useState } from 'react'
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
import { Trophy, Award, Download, Camera, TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
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

      {entries.length === 0 ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
          <p className="text-slate-500">No contributors yet</p>
        </div>
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
      )}

      <CertificatesPanel open={certOpen} onClose={() => setCertOpen(false)} />
    </div>
  )
}

function buildLeaderboardPdfHtml({
  entries,
  scopeLabel,
  generatedAt,
}: {
  entries: LeaderboardEntry[]
  scopeLabel: string
  generatedAt: Date
}) {
  const totalContribution = entries.reduce((sum, entry) => sum + entry.contribution, 0)
  const topEntry = entries[0] ?? null
  const rows = entries.map((entry) => `
    <tr>
      <td class="rank">${entry.rank}</td>
      <td class="movement">${pdfMovementCell(entry.rank_change, entry.prev_rank)}</td>
      <td>
        <div class="name">${escapeHtml(entry.name)}</div>
      </td>
      <td>${escapeHtml(entry.region_name ?? '-')}</td>
      <td class="amount">${escapeHtml(formatCurrency(entry.contribution))}</td>
      <td>${escapeHtml(entry.certificate_name ?? '-')}</td>
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

      * {
        box-sizing: border-box;
      }

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
        margin-bottom: 18px;
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

      h1 {
        margin: 0;
        font-size: 30px;
        line-height: 1.1;
      }

      .subhead {
        margin: 8px 0 0;
        color: var(--muted);
        font-size: 14px;
      }

      .meta {
        margin-top: 14px;
        font-size: 12px;
        color: var(--muted);
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin: 18px 0 20px;
      }

      .stat {
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 14px 16px;
        background: var(--panel);
      }

      .stat-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
        margin-bottom: 6px;
      }

      .stat-value {
        font-size: 22px;
        font-weight: 700;
      }

      .table-wrap {
        border: 1px solid var(--line);
        border-radius: 18px;
        overflow: hidden;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      thead th {
        background: #e2e8f0;
        color: #334155;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        padding: 12px 14px;
        text-align: left;
      }

      tbody td {
        padding: 12px 14px;
        border-top: 1px solid #e2e8f0;
        vertical-align: top;
        font-size: 13px;
      }

      tbody tr:nth-child(even) {
        background: #f8fafc;
      }

      .rank {
        width: 52px;
        font-weight: 700;
        color: var(--accent);
      }

      .name {
        font-weight: 700;
      }

      .muted {
        color: var(--muted);
        font-size: 11px;
        margin-top: 2px;
      }

      .amount {
        font-weight: 700;
        text-align: right;
        white-space: nowrap;
      }

      .footer {
        margin-top: 12px;
        color: var(--muted);
        font-size: 11px;
        text-align: right;
      }

      .movement {
        width: 48px;
        text-align: center;
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
      }

      .mv-up   { color: #16a34a; }
      .mv-down { color: #dc2626; }
      .mv-flat { color: #94a3b8; }
      .mv-new  { color: #0f766e; }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <div class="eyebrow">Conference Dashboard</div>
        <h1>Leaderboard Report</h1>
        <p class="subhead">${escapeHtml(scopeLabel)} - ranked by contribution</p>
        <div class="meta">Generated ${escapeHtml(generatedAt.toLocaleString())}</div>
      </section>

      <section class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th></th>
              <th>Name</th>
              <th>Region</th>
              <th style="text-align: right;">Contribution</th>
              <th>Certificate</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>

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
