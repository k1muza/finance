'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { CalendarClock, CalendarDays, CalendarRange } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageSpinner } from '@/components/ui/Spinner'
import { StatCard } from '@/components/ui/StatCard'
import { SelectDistrictHint } from '@/components/layout/SelectDistrictHint'
import { BarList, ChartCard, ColumnChart } from '@/components/analytics/Charts'
import { useAuth } from '@/contexts/AuthContext'
import { useDistrictEvents } from '@/hooks/useDistrictEvents'
import {
  buildCoordinationAnalytics,
  formatMonthLong,
  formatMonthShort,
  monthKeys,
} from '@/lib/analytics'
import { WEEKDAY_LABELS, addDays, addMonths, formatEventWhen, todayIso } from '@/lib/calendar'
import { districtPath } from '@/lib/district-routes'

const TITLE = 'Coordination Summary'
const DESCRIPTION = 'How busy the district calendar is — six months back and six months ahead.'
const UPCOMING_DAYS = 30

export function CoordinationAnalyticsPage() {
  const { districtId } = useAuth()
  const today = todayIso()
  const months = useMemo(() => monthKeys(addMonths(today, -6), 12), [today])
  const from = `${months[0]}-01`
  const to = addDays(addMonths(`${months[months.length - 1]}-01`, 1), -1)

  const { data: events, loading, error } = useDistrictEvents(districtId, from, to)
  const analytics = useMemo(
    () => buildCoordinationAnalytics(events, months, today, UPCOMING_DAYS),
    [events, months, today],
  )

  const count = (n: number) => `${n} ${n === 1 ? 'event' : 'events'}`

  if (!districtId) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <SelectDistrictHint description="Choose a district to see its calendar activity." />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeader title={TITLE} description={DESCRIPTION} />

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <PageSpinner />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label={`Next ${UPCOMING_DAYS} days`} value={analytics.upcomingCount} icon={<CalendarClock className="h-5 w-5" />} sub="Upcoming or in progress" />
            <StatCard label="Events in period" value={analytics.totalInRange} icon={<CalendarDays className="h-5 w-5" />} sub={`${formatMonthLong(months[0])} – ${formatMonthLong(months[months.length - 1])}`} />
            <StatCard label="Multi-day events" value={analytics.multiDayInRange} icon={<CalendarRange className="h-5 w-5" />} sub="Conferences, camps, retreats" />
          </div>

          <ChartCard title="Events by month" description="An event spanning two months counts in both.">
            <ColumnChart
              categories={months}
              categoryLabels={months.map(formatMonthShort)}
              categoryTitles={months.map(formatMonthLong)}
              series={[{ key: 'events', label: 'Events', color: 'var(--viz-series-1)', values: analytics.monthly.map((m) => m.events) }]}
              formatValue={count}
              height={180}
            />
          </ChartCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Start day of the week" description="Which days events tend to begin on.">
              <BarList
                rows={WEEKDAY_LABELS.map((label, i) => ({ key: label, label, amount: analytics.byWeekday[i] }))}
                color="var(--viz-series-1)"
                formatValue={(n) => String(n)}
              />
            </ChartCard>

            <Card>
              <CardHeader className="flex items-center justify-between gap-3 pb-2">
                <CardTitle>Coming up</CardTitle>
                <Link href={districtPath(districtId, 'calendar')} className="text-xs text-[var(--accent-solid)] hover:underline">
                  Open calendar
                </Link>
              </CardHeader>
              <CardContent className="pt-0">
                {analytics.upcoming.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[var(--text-tertiary)]">
                    Nothing scheduled in the next {UPCOMING_DAYS} days.
                  </p>
                ) : (
                  <ul className="divide-y [&>li]:[border-color:var(--border-subtle)]">
                    {analytics.upcoming.map((event) => (
                      <li key={event.id} className="py-2.5">
                        <p className="truncate text-sm font-medium text-[var(--text-primary)]">{event.title}</p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                          {formatEventWhen(event)}
                          {event.location ? ` · ${event.location}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
