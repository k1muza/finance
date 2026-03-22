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

      // Resolve region IDs when scoped to a district
      let regionIds: string[] | null = null
      if (districtId) {
        const { data: distRegions } = await supabase
          .from('regions')
          .select('id')
          .eq('district_id', districtId)
        regionIds = distRegions?.map((r) => r.id) ?? []
      }

      let peopleCountQuery = supabase.from('people').select('*', { count: 'exact', head: true })
      let fundsQuery = supabase.from('contributions').select('amount')
      let expensesQuery = supabase.from('expenses').select('amount')
      let topQuery = supabase.from('leaderboard').select('*').order('rank').limit(5)

      if (regionIds) {
        if (regionIds.length === 0) {
          // No regions in district yet — short-circuit
          setData({ totalPeople: 0, totalFunds: 0, totalExpenses: 0, netBalance: 0, totalDays: 0, totalDepartments: 0, topContributors: [] })
          setLoading(false)
          return
        }
        peopleCountQuery = peopleCountQuery.in('region_id', regionIds)
        // Fetch people IDs in these regions to filter contributions
        const { data: peopleInRegions } = await supabase.from('people').select('id').in('region_id', regionIds)
        const personIds = peopleInRegions?.map((p) => p.id) ?? []
        if (personIds.length > 0) {
          fundsQuery = fundsQuery.in('person_id', personIds)
        } else {
          fundsQuery = fundsQuery.eq('person_id', null) // No people = no contributions
        }
      }
      if (districtId) {
        expensesQuery = expensesQuery.eq('district_id', districtId)
        topQuery = topQuery.eq('district_id', districtId)
      }

      const [
        { count: totalPeople },
        { data: fundsData },
        { data: expensesData },
        { count: totalDays },
        { count: totalDepartments },
        { data: topContributors },
      ] = await Promise.all([
        peopleCountQuery,
        fundsQuery,
        expensesQuery,
        supabase.from('days').select('*', { count: 'exact', head: true }),
        supabase.from('departments').select('*', { count: 'exact', head: true }),
        topQuery,
      ])

      const totalFunds = (fundsData ?? []).reduce((sum, r) => sum + (r.amount ?? 0), 0)
      const totalExpenses = (expensesData ?? []).reduce((sum, r) => sum + (r.amount ?? 0), 0)

      setData({
        totalPeople: totalPeople ?? 0,
        totalFunds,
        totalExpenses,
        netBalance: totalFunds - totalExpenses,
        totalDays: totalDays ?? 0,
        totalDepartments: totalDepartments ?? 0,
        topContributors: topContributors ?? [],
      })
      setLoading(false)
    }
    load()
  }, [districtId]) // eslint-disable-line

  return { data, loading }
}
