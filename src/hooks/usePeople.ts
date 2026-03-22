'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Person } from '@/types'

interface PeopleFilter {
  search?: string
  gender?: string
  region_id?: string
  department_id?: string
}

export function usePeople(filter: PeopleFilter = {}, districtId?: string | null) {
  const [data, setData] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    setLoading(true)

    // When scoped to a district, resolve region IDs first
    let allowedRegionIds: string[] | null = null
    if (districtId) {
      const { data: distRegions } = await supabase
        .from('regions')
        .select('id')
        .eq('district_id', districtId)
      allowedRegionIds = distRegions?.map((r) => r.id) ?? []
      if (allowedRegionIds.length === 0) {
        setData([])
        setLoading(false)
        return
      }
    }

    let query = supabase
      .from('people')
      .select('*, region:regions(id,name), department:departments(id,name)')
      .order('name')

    if (allowedRegionIds) query = query.in('region_id', allowedRegionIds)
    if (filter.search) query = query.ilike('name', `%${filter.search}%`)
    if (filter.gender) query = query.eq('gender', filter.gender)
    if (filter.region_id) query = query.eq('region_id', filter.region_id)
    if (filter.department_id) query = query.eq('department_id', filter.department_id)

    const { data: rows, error: err } = await query
    if (err) { setError(err.message); setLoading(false); return }

    // Aggregate contribution totals from the contributions table
    const { data: contribRows } = await supabase
      .from('contributions')
      .select('person_id, amount')

    const totals = (contribRows ?? []).reduce((map, c) => {
      map[c.person_id] = (map[c.person_id] ?? 0) + (c.amount ?? 0)
      return map
    }, {} as Record<string, number>)

    setData((rows ?? []).map((p) => ({ ...p, contribution: totals[p.id] ?? 0 })))
    setLoading(false)
  }, [filter.search, filter.gender, filter.region_id, filter.department_id, districtId]) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  const create = async (values: Omit<Person, 'id' | 'created_at' | 'updated_at' | 'region' | 'department' | 'contribution'>) => {
    const { error: err } = await supabase.from('people').insert(values)
    if (err) throw new Error(err.message)
    await fetch()
  }

  const update = async (id: string, values: Partial<Omit<Person, 'id' | 'created_at' | 'updated_at' | 'region' | 'department' | 'contribution'>>) => {
    const { error: err } = await supabase.from('people').update(values).eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('people').delete().eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  return { data, loading, error, create, update, remove, refresh: fetch }
}
