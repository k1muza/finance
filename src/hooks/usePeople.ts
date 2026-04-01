'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Person } from '@/types'

interface PeopleFilter {
  search?: string
  gender?: string
  region_id?: string
  department_id?: string
}

interface FetchOptions {
  withLoading?: boolean
}

function sortPeople(people: Person[]) {
  return [...people].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

export function usePeople(filter: PeopleFilter = {}, districtId?: string | null) {
  const [data, setData] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = useRef(createClient()).current
  const requestIdRef = useRef(0)

  const fetch = useCallback(async ({ withLoading = true }: FetchOptions = {}) => {
    const requestId = ++requestIdRef.current
    if (withLoading) setLoading(true)
    setError(null)

    let query = supabase
      .from('people')
      .select('*, region:regions(id,name), department:departments(id,name)')
      .order('name')

    if (districtId) query = query.eq('district_id', districtId)
    if (filter.search) query = query.ilike('name', `%${filter.search}%`)
    if (filter.gender) query = query.eq('gender', filter.gender)
    if (filter.region_id) query = query.eq('region_id', filter.region_id)
    if (filter.department_id) query = query.eq('department_id', filter.department_id)

    const { data: rows, error: err } = await query
    if (requestId !== requestIdRef.current) return

    if (err) {
      setError(err.message)
      if (withLoading) setLoading(false)
      return
    }

    const personIds = (rows ?? []).map((person) => person.id)
    let contribRows: { person_id: string; amount: number | null }[] = []

    if (personIds.length > 0) {
      const { data: contributionRows, error: contributionsError } = await supabase
        .from('contributions')
        .select('person_id, amount')
        .in('person_id', personIds)

      if (requestId !== requestIdRef.current) return

      if (contributionsError) {
        setError(contributionsError.message)
      } else {
        contribRows = contributionRows ?? []
      }
    }

    const totals = (contribRows ?? []).reduce((map, c) => {
      map[c.person_id] = (map[c.person_id] ?? 0) + (c.amount ?? 0)
      return map
    }, {} as Record<string, number>)

    setData(sortPeople((rows ?? []).map((p) => ({ ...p, contribution: totals[p.id] ?? 0 }))))
    if (withLoading) setLoading(false)
  }, [filter.search, filter.gender, filter.region_id, filter.department_id, districtId]) // eslint-disable-line

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetch() }, [fetch])

  const create = useCallback(async (values: Omit<Person, 'id' | 'created_at' | 'updated_at' | 'region' | 'department' | 'contribution'>) => {
    const { error: err } = await supabase.from('people').insert(values)
    if (err) throw new Error(err.message)
    await fetch()
  }, [fetch, supabase])

  const update = useCallback(async (id: string, values: Partial<Omit<Person, 'id' | 'created_at' | 'updated_at' | 'region' | 'department' | 'contribution'>>) => {
    const { error: err } = await supabase.from('people').update(values).eq('id', id)
    if (err) throw new Error(err.message)

    // Patch local state immediately to keep inline edits feeling instant.
    setData((prev) => sortPeople(prev.map((p) => {
      if (p.id !== id) return p

      const nextRegionId = values.region_id !== undefined ? values.region_id : p.region_id
      const nextDepartmentId = values.department_id !== undefined ? values.department_id : p.department_id

      return {
        ...p,
        ...values,
        region: values.region_id === undefined
          ? p.region
          : nextRegionId && nextRegionId === p.region_id
            ? p.region
            : null,
        department: values.department_id === undefined
          ? p.department
          : nextDepartmentId && nextDepartmentId === p.department_id
            ? p.department
            : null,
      }
    })))
  }, [supabase])

  const remove = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('people').delete().eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }, [fetch, supabase])

  return { data, loading, error, create, update, remove, refresh: fetch }
}
