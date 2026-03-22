'use client'

import { useState } from 'react'
import { useOverview } from '@/hooks/useOverview'
import { useAuth } from '@/contexts/AuthContext'
import { StatsRow } from '@/components/overview/StatsRow'
import { LeaderboardPreview } from '@/components/overview/LeaderboardPreview'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { ReportPanel } from '@/components/report/ReportPanel'
import { PageSpinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils/cn'

type Tab = 'overview' | 'report' | 'settings'

export default function OverviewPage() {
  const { districtId, district, isAdmin } = useAuth()
  const { data, loading } = useOverview(districtId)
  const [tab, setTab] = useState<Tab>('overview')

  if (loading) return <PageSpinner />

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header + tabs */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Overview</h1>
        <p className="text-sm text-slate-400 mt-1">
          {`${district?.name ?? 'District'} summary`}
        </p>

        <div className="flex gap-1 mt-4 border-b border-slate-700">
          <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>
            Dashboard
          </TabButton>
          <TabButton active={tab === 'report'} onClick={() => setTab('report')}>
            Report
          </TabButton>
          <TabButton active={tab === 'settings'} onClick={() => setTab('settings')}>
            Project Settings
          </TabButton>
        </div>
      </div>

      {tab === 'overview' && data && (
        <>
          <StatsRow stats={data} />
          <div className="max-w-xl">
            <LeaderboardPreview entries={data.topContributors} />
          </div>
        </>
      )}

      {tab === 'report' && <ReportPanel districtId={districtId} />}

      {tab === 'settings' && <SettingsPanel />}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
        active
          ? 'border-cyan-400 text-cyan-400'
          : 'border-transparent text-slate-400 hover:text-slate-200'
      )}
    >
      {children}
    </button>
  )
}
