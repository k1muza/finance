'use client'

import { useOverview } from '@/hooks/useOverview'
import { useAuth } from '@/contexts/AuthContext'
import { StatsRow } from '@/components/overview/StatsRow'
import { LeaderboardPreview } from '@/components/overview/LeaderboardPreview'
import { PageSpinner } from '@/components/ui/Spinner'

export default function OverviewPage() {
  const { districtId, district, isAdmin } = useAuth()
  const { data, loading } = useOverview(districtId)

  if (loading) return <PageSpinner />

  if (!data) return null

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Overview</h1>
        <p className="text-sm text-slate-400 mt-1">
          {isAdmin ? 'Conference summary — all districts' : `${district?.name ?? 'District'} summary`}
        </p>
      </div>
      <StatsRow stats={data} />
      <div className="max-w-xl">
        <LeaderboardPreview entries={data.topContributors} />
      </div>
    </div>
  )
}
