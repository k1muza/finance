'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowRight,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  Circle,
  ClipboardList,
  FileText,
  Globe,
  Megaphone,
  Music,
  Receipt,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useOverview } from '@/hooks/useOverview'
import { useAuth } from '@/contexts/AuthContext'
import { StatsRow } from '@/components/overview/StatsRow'
import { LeaderboardPreview } from '@/components/overview/LeaderboardPreview'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { ReportPanel } from '@/components/report/ReportPanel'
import { PageSpinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils/cn'

type Tab = 'overview' | 'report' | 'settings'

type HealthCardMetric = {
  label: string
  value: string
}

type ChecklistItem = {
  label: string
  hint: string
  done: boolean
  href: string
}

type QuickLink = {
  href: string
  label: string
  hint: string
  icon: LucideIcon
}

export default function OverviewPage() {
  const { districtId, district, isAdmin } = useAuth()
  const { data, loading } = useOverview(districtId)
  const [tab, setTab] = useState<Tab>('overview')

  const scopeSummary = isAdmin && !districtId
    ? 'All districts summary'
    : `${district?.name ?? 'Selected district'} summary`

  const checklistItems: ChecklistItem[] = data ? [
    {
      label: 'Regions configured',
      hint: countLabel(data.totalRegions, 'region'),
      done: data.totalRegions > 0,
      href: '/dashboard/regions',
    },
    {
      label: 'People loaded',
      hint: countLabel(data.totalPeople, 'attendee'),
      done: data.totalPeople > 0,
      href: '/dashboard/people',
    },
    {
      label: 'Schedule drafted',
      hint: `${countLabel(data.totalDays, 'day')} and ${countLabel(data.totalEvents, 'event')}`,
      done: data.totalDays > 0 && data.totalEvents > 0,
      href: '/dashboard/schedule',
    },
    {
      label: 'Main events marked',
      hint: data.totalSessions > 0
        ? `${data.totalMainEvents.toLocaleString()}/${data.totalSessions.toLocaleString()} sessions have a main event`
        : 'Create sessions first',
      done: data.totalSessions > 0 && data.totalMainEvents >= data.totalSessions,
      href: '/dashboard/schedule',
    },
    {
      label: 'Mobile content published',
      hint: `${data.publishedPages.toLocaleString()} pages, ${data.publishedSongs.toLocaleString()} songs`,
      done: data.publishedPages > 0 || data.publishedSongs > 0,
      href: '/dashboard/pages',
    },
    {
      label: 'Push channel ready',
      hint: countLabel(data.totalDevices, 'registered device'),
      done: data.totalDevices > 0,
      href: '/dashboard/notifications',
    },
    {
      label: 'Finance activity captured',
      hint: `${data.totalContributors.toLocaleString()} contributors and ${data.totalExpenses.toLocaleString()} expenses`,
      done: data.totalContributors > 0 || data.totalExpenses > 0,
      href: '/dashboard/expenses',
    },
  ] : []

  const quickLinks: QuickLink[] = data ? [
    {
      href: '/dashboard/schedule',
      label: 'Schedule',
      hint: `${countLabel(data.totalDays, 'day')} and ${countLabel(data.totalEvents, 'event')}`,
      icon: Calendar,
    },
    {
      href: '/dashboard/people',
      label: 'People',
      hint: `${countLabel(data.totalPeople, 'attendee')} across ${countLabel(data.totalRegions, 'region')}`,
      icon: Users,
    },
    {
      href: '/dashboard/regions',
      label: 'Regions',
      hint: `${countLabel(data.totalRegions, 'region')} and ${countLabel(data.totalDepartments, 'department')}`,
      icon: Globe,
    },
    {
      href: '/dashboard/pages',
      label: 'Pages',
      hint: `${data.publishedPages.toLocaleString()}/${data.totalPages.toLocaleString()} published`,
      icon: FileText,
    },
    {
      href: '/dashboard/songs',
      label: 'Songs',
      hint: `${data.publishedSongs.toLocaleString()}/${data.totalSongs.toLocaleString()} published`,
      icon: Music,
    },
    {
      href: '/dashboard/expenses',
      label: 'Finances',
      hint: `${countLabel(data.totalContributors, 'contributor')} and ${countLabel(data.totalExpenses, 'expense')}`,
      icon: Receipt,
    },
    {
      href: '/dashboard/notifications',
      label: 'Notifications',
      hint: `${countLabel(data.totalDevices, 'device')} and ${countLabel(data.totalNotifications, 'message', 'messages')} sent`,
      icon: Bell,
    },
    {
      href: '/dashboard/leaderboard',
      label: 'Leaderboard',
      hint: `Top ${Math.min(data.topContributors.length, 5).toLocaleString()} visible on overview`,
      icon: Trophy,
    },
  ] : []

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Overview</h1>
        <p className="text-sm text-slate-400 mt-1">{scopeSummary}</p>

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

      {tab === 'overview' && (
        loading ? <PageSpinner /> : data ? (
          <>
            <StatsRow stats={data} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <HealthCard
                icon={Calendar}
                title="Program Coverage"
                description="How much of the conference flow has been mapped."
                metrics={[
                  { label: 'Regions', value: countLabel(data.totalRegions, 'region') },
                  { label: 'Days', value: countLabel(data.totalDays, 'day') },
                  { label: 'Sessions', value: countLabel(data.totalSessions, 'session') },
                  { label: 'Events', value: `${countLabel(data.totalEvents, 'event')} (${data.totalMainEvents.toLocaleString()} main)` },
                  { label: 'Meals', value: countLabel(data.totalMeals, 'meal') },
                ]}
              />

              <HealthCard
                icon={BookOpen}
                title="Content Readiness"
                description="What mobile app users can currently access."
                metrics={[
                  { label: 'Pages', value: `${data.publishedPages.toLocaleString()}/${data.totalPages.toLocaleString()} published` },
                  { label: 'Songs', value: `${data.publishedSongs.toLocaleString()}/${data.totalSongs.toLocaleString()} published` },
                  { label: 'Departments', value: countLabel(data.totalDepartments, 'department') },
                ]}
              />

              <HealthCard
                icon={Megaphone}
                title="Reach & Communication"
                description="Contribution reach and push communication footprint."
                metrics={[
                  { label: 'Contributors', value: countLabel(data.totalContributors, 'contributor') },
                  { label: 'Registered devices', value: countLabel(data.totalDevices, 'device') },
                  { label: 'Notifications sent', value: countLabel(data.totalNotifications, 'message', 'messages') },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <ChecklistPanel items={checklistItems} className="lg:col-span-3" />

              <div className="space-y-4 lg:col-span-2">
                <QuickLinksPanel links={quickLinks} />
                <LeaderboardPreview entries={data.topContributors} />
              </div>
            </div>
          </>
        ) : null
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

function HealthCard({
  icon: Icon,
  title,
  description,
  metrics,
}: {
  icon: LucideIcon
  title: string
  description: string
  metrics: HealthCardMetric[]
}) {
  return (
    <section className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <div className="flex items-start gap-3">
        <div className="bg-cyan-500/10 rounded-lg p-2.5 text-cyan-400 shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          <p className="text-xs text-slate-400 mt-1">{description}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400">{metric.label}</span>
            <span className="text-sm font-medium text-slate-200 text-right">{metric.value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function ChecklistPanel({ items, className }: { items: ChecklistItem[]; className?: string }) {
  const completed = items.filter((item) => item.done).length
  const completionPct = items.length === 0 ? 0 : Math.round((completed / items.length) * 100)

  return (
    <section className={cn('bg-slate-800 rounded-xl border border-slate-700 p-5', className)}>
      <div className="flex items-start gap-3">
        <div className="bg-cyan-500/10 rounded-lg p-2.5 text-cyan-400 shrink-0">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-100">Setup Checklist</h2>
          <p className="text-xs text-slate-400 mt-1">
            {completed.toLocaleString()}/{items.length.toLocaleString()} complete ({completionPct}%)
          </p>
          <div className="mt-3 h-2 rounded-full bg-slate-700 overflow-hidden">
            <div className="h-2 rounded-full bg-cyan-500" style={{ width: `${completionPct}%` }} />
          </div>
        </div>
      </div>

      <ul className="mt-4 space-y-2.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-start gap-2.5">
            {item.done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
            )}
            <div className="min-w-0">
              <Link href={item.href} className="text-sm text-slate-200 hover:text-cyan-300 transition-colors">
                {item.label}
              </Link>
              <p className="text-xs text-slate-500 mt-0.5">{item.hint}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function QuickLinksPanel({ links }: { links: QuickLink[] }) {
  return (
    <section className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <h2 className="text-sm font-semibold text-slate-100">Quick Access</h2>
      <p className="text-xs text-slate-400 mt-1">Jump to key modules with current context counts.</p>

      <div className="mt-4 space-y-1.5">
        {links.map((link) => {
          const Icon = link.icon
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 border border-transparent hover:border-slate-600 hover:bg-slate-700/30 transition-colors"
            >
              <Icon className="h-4 w-4 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 truncate">{link.label}</p>
                <p className="text-xs text-slate-500 truncate">{link.hint}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            </Link>
          )
        })}
      </div>
    </section>
  )
}

function countLabel(value: number, singular: string, plural?: string) {
  const suffix = value === 1 ? singular : (plural ?? `${singular}s`)
  return `${value.toLocaleString()} ${suffix}`
}
