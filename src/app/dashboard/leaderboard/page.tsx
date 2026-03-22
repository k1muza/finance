'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { LeaderboardEntry } from '@/types'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { ContributionBar } from '@/components/leaderboard/ContributionBar'
import { CertificateBadge } from '@/components/leaderboard/CertificateBadge'
import { CertificatesPanel } from '@/components/leaderboard/CertificatesPanel'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { Trophy, Award } from 'lucide-react'

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [certOpen, setCertOpen] = useState(false)
  const { districtId, district, isAdmin } = useAuth()

  useEffect(() => {
    const supabase = createClient()
    let query = supabase.from('leaderboard').select('*').order('rank')
    if (districtId) query = query.eq('district_id', districtId)
    query.then(({ data }) => {
      setEntries(data ?? [])
      setLoading(false)
    })
  }, [districtId])

  const maxContribution = entries[0]?.contribution ?? 1

  const rankBadge = (rank: number) => {
    if (rank === 1) return <span className="text-yellow-400 font-bold text-lg">🥇</span>
    if (rank === 2) return <span className="text-slate-300 font-bold text-lg">🥈</span>
    if (rank === 3) return <span className="text-amber-600 font-bold text-lg">🥉</span>
    return <span className="text-slate-500 text-sm font-semibold">#{rank}</span>
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
              {isAdmin ? 'All districts · Ranked by contribution' : `${district?.name ?? 'District'} · Ranked by contribution`}
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setCertOpen(true)}>
          <Award className="h-4 w-4" />
          Certificates
        </Button>
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
                    <td className="px-4 py-3 font-medium text-slate-100">{entry.name}</td>
                    <td className="px-4 py-3">
                      {entry.gender ? (
                        <Badge variant={entry.gender === 'male' ? 'teal' : entry.gender === 'female' ? 'purple' : 'default'}>
                          {entry.gender}
                        </Badge>
                      ) : <span className="text-slate-500">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{entry.region_name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{entry.department_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-cyan-400">
                      {formatCurrency(entry.contribution)}
                    </td>
                    <td className="px-4 py-3">
                      {entry.certificate_name
                        ? <CertificateBadge name={entry.certificate_name} />
                        : <span className="text-slate-600 text-xs">—</span>}
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
