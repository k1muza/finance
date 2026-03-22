'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Department } from '@/types'

export function useDepartments() {
  const [data, setData] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data: rows, error: err } = await supabase
      .from('departments')
      .select('*')
      .order('name')
    if (err) { setError(err.message); setLoading(false); return }

    // Get member counts
    const { data: counts } = await supabase
      .from('people')
      .select('department_id')
      .not('department_id', 'is', null)

    const countMap: Record<string, number> = {}
    counts?.forEach((r) => {
      if (r.department_id) countMap[r.department_id] = (countMap[r.department_id] ?? 0) + 1
    })

    setData((rows ?? []).map((d) => ({ ...d, member_count: countMap[d.id] ?? 0 })))
    setLoading(false)
  }, []) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  const create = async (values: Omit<Department, 'id' | 'created_at' | 'updated_at' | 'member_count'>) => {
    const { error: err } = await supabase.from('departments').insert(values)
    if (err) throw new Error(err.message)
    await fetch()
  }

  const update = async (id: string, values: Partial<Omit<Department, 'id' | 'created_at' | 'updated_at' | 'member_count'>>) => {
    const { error: err } = await supabase.from('departments').update(values).eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('departments').delete().eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  return { data, loading, error, create, update, remove, refresh: fetch }
}
