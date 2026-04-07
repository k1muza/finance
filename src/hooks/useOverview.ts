'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { OverviewStats } from '@/types'

export function useOverview(districtId?: string | null) {
  const [data, setData] = useState<OverviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      setLoading(true)

      // Resolve district-scoped IDs first so we can filter downstream metrics.
      let scopedRegionIds: string[] | null = null
      let scopedDayIds: string[] | null = null
      if (districtId) {
        const [{ data: regionRows }, { data: dayRows }] = await Promise.all([
          supabase.from('regions').select('id').eq('district_id', districtId),
          supabase.from('days').select('id').eq('district_id', districtId),
        ])
        scopedRegionIds = regionRows?.map((row) => row.id) ?? []
        scopedDayIds = dayRows?.map((row) => row.id) ?? []
      }

      let scopedPersonIds: string[] | null = null
      if (scopedRegionIds !== null) {
        if (scopedRegionIds.length > 0) {
          const { data: personRows } = await supabase
            .from('people')
            .select('id')
            .in('region_id', scopedRegionIds)
          scopedPersonIds = personRows?.map((row) => row.id) ?? []
        } else {
          scopedPersonIds = []
        }
      }

      let scopedSessionIds: string[] | null = null
      if (scopedDayIds !== null) {
        if (scopedDayIds.length > 0) {
          const { data: sessionRows } = await supabase
            .from('sessions')
            .select('id')
            .in('day_id', scopedDayIds)
          scopedSessionIds = sessionRows?.map((row) => row.id) ?? []
        } else {
          scopedSessionIds = []
        }
      }

      const zeroCount = { count: 0 as number | null }

      let fundsQuery = supabase.from('contributions').select('amount, person_id')
      if (scopedPersonIds !== null) {
        if (scopedPersonIds.length > 0) {
          fundsQuery = fundsQuery.in('person_id', scopedPersonIds)
        } else {
          fundsQuery = fundsQuery.eq('person_id', null)
        }
      }

      let expensesQuery = supabase.from('expenses').select('amount')
      if (districtId) expensesQuery = expensesQuery.eq('district_id', districtId)

      let incomeQuery = supabase.from('income').select('amount')
      if (districtId) incomeQuery = incomeQuery.eq('district_id', districtId)

      let pagesQuery = supabase.from('pages').select('published')
      if (districtId) pagesQuery = pagesQuery.eq('district_id', districtId)

      let topQuery = supabase.from('leaderboard').select('*').limit(5)
      if (districtId) {
        topQuery = topQuery.eq('district_id', districtId).order('rank')
      } else {
        topQuery = topQuery.order('contribution', { ascending: false })
      }

      const peopleCountPromise = scopedPersonIds === null
        ? supabase.from('people').select('id', { count: 'exact', head: true })
        : Promise.resolve({ count: scopedPersonIds.length })

      const dayCountPromise = scopedDayIds === null
        ? supabase.from('days').select('id', { count: 'exact', head: true })
        : Promise.resolve({ count: scopedDayIds.length })

      const regionCountPromise = scopedRegionIds === null
        ? supabase.from('regions').select('id', { count: 'exact', head: true })
        : Promise.resolve({ count: scopedRegionIds.length })

      const sessionCountPromise = scopedSessionIds === null
        ? supabase.from('sessions').select('id', { count: 'exact', head: true })
        : Promise.resolve({ count: scopedSessionIds.length })

      const mealsCountPromise = scopedDayIds === null
        ? supabase.from('meals').select('id', { count: 'exact', head: true })
        : scopedDayIds.length > 0
          ? supabase.from('meals').select('id', { count: 'exact', head: true }).in('day_id', scopedDayIds)
          : Promise.resolve(zeroCount)

      const eventsCountPromise = scopedSessionIds === null
        ? supabase.from('events').select('id', { count: 'exact', head: true })
        : scopedSessionIds.length > 0
          ? supabase.from('events').select('id', { count: 'exact', head: true }).in('session_id', scopedSessionIds)
          : Promise.resolve(zeroCount)

      const mainEventsCountPromise = scopedSessionIds === null
        ? supabase.from('events').select('id', { count: 'exact', head: true }).eq('is_main_event', true)
        : scopedSessionIds.length > 0
          ? supabase.from('events').select('id', { count: 'exact', head: true }).eq('is_main_event', true).in('session_id', scopedSessionIds)
          : Promise.resolve(zeroCount)

      const [
        peopleCountResult,
        dayCountResult,
        regionCountResult,
        sessionCountResult,
        mealsCountResult,
        eventsCountResult,
        mainEventsCountResult,
        { count: totalDepartments },
        { data: fundsData },
        { data: manualIncomeData },
        { data: expensesData },
        { data: pagesData },
        { data: songsData },
        { count: totalDevices },
        { count: totalNotifications },
        { data: topContributors },
      ] = await Promise.all([
        peopleCountPromise,
        dayCountPromise,
        regionCountPromise,
        sessionCountPromise,
        mealsCountPromise,
        eventsCountPromise,
        mainEventsCountPromise,
        supabase.from('departments').select('id', { count: 'exact', head: true }),
        fundsQuery,
        incomeQuery,
        expensesQuery,
        pagesQuery,
        supabase.from('songs').select('published'),
        supabase.from('device_tokens').select('id', { count: 'exact', head: true }),
        supabase.from('notifications').select('id', { count: 'exact', head: true }),
        topQuery,
      ])

      const contributionRows = fundsData ?? []
      const contributionTotal = contributionRows.reduce((sum, row) => sum + (row.amount ?? 0), 0)
      const manualIncomeTotal = (manualIncomeData ?? []).reduce((sum, row) => sum + (row.amount ?? 0), 0)
      const totalFunds = contributionTotal + manualIncomeTotal
      const contributorIds = new Set(
        contributionRows
          .map((row) => row.person_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )

      const totalExpenses = (expensesData ?? []).reduce((sum, row) => sum + (row.amount ?? 0), 0)
      const publishedPages = (pagesData ?? []).filter((row) => row.published).length
      const publishedSongs = (songsData ?? []).filter((row) => row.published).length

      setData({
        totalPeople: peopleCountResult.count ?? 0,
        totalFunds,
        totalExpenses,
        netBalance: totalFunds - totalExpenses,
        totalDays: dayCountResult.count ?? 0,
        totalDepartments: totalDepartments ?? 0,
        totalRegions: regionCountResult.count ?? 0,
        totalSessions: sessionCountResult.count ?? 0,
        totalEvents: eventsCountResult.count ?? 0,
        totalMainEvents: mainEventsCountResult.count ?? 0,
        totalMeals: mealsCountResult.count ?? 0,
        totalPages: pagesData?.length ?? 0,
        publishedPages,
        totalSongs: songsData?.length ?? 0,
        publishedSongs,
        totalDevices: totalDevices ?? 0,
        totalNotifications: totalNotifications ?? 0,
        totalContributors: contributorIds.size,
        topContributors: topContributors ?? [],
      })
      setLoading(false)
    }
    load()
  }, [districtId]) // eslint-disable-line

  return { data, loading }
}
