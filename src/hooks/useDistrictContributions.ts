'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface ContributionRow {
  id: string
  amount: number
  note: string | null
  date: string
  created_at: string
  person_id: string
  person_name: string
}

interface Filter {
  district_id?: string
  search?: string
}

export function useDistrictContributions(filter: Filter = {}) {
  const [data, setData] = useState<ContributionRow[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    setLoading(true)

    // Scope to district via regions → people
    let peopleIds: string[] | null = null
    if (filter.district_id) {
      const { data: regions } = await supabase
        .from('regions')
        .select('id')
        .eq('district_id', filter.district_id)
      const regionIds = regions?.map((r) => r.id) ?? []

      if (regionIds.length === 0) {
        setData([])
        setLoading(false)
        return
      }

      const { data: people } = await supabase
        .from('people')
        .select('id, name')
        .in('region_id', regionIds)
      peopleIds = people?.map((p) => p.id) ?? []

      if (peopleIds.length === 0) {
        setData([])
        setLoading(false)
        return
      }
    }

    let query = supabase
      .from('contributions')
      .select('*, person:people(id, name)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (peopleIds) query = query.in('person_id', peopleIds)
    if (filter.search) query = query.ilike('note', `%${filter.search}%`)

    const { data: rows } = await query

    setData(
      (rows ?? []).map((r) => ({
        id: r.id,
        amount: r.amount,
        note: r.note,
        date: r.date,
        created_at: r.created_at,
        person_id: r.person_id,
        person_name: (r.person as { name?: string } | null)?.name ?? 'Unknown',
      }))
    )
    setLoading(false)
  }, [filter.district_id, filter.search]) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  const total = data.reduce((sum, c) => sum + c.amount, 0)

  return { data, loading, total, refresh: fetch }
}
