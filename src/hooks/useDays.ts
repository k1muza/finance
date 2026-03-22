'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Day } from '@/types'

export function useDays(districtId?: string | null) {
  const [data, setData] = useState<Day[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('days').select('*').order('date')
    if (districtId) query = query.eq('district_id', districtId)
    const { data: rows, error: err } = await query
    if (err) setError(err.message)
    else setData(rows ?? [])
    setLoading(false)
  }, [districtId]) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  const create = async (values: Omit<Day, 'id' | 'created_at' | 'updated_at'>) => {
    const { error: err } = await supabase.from('days').insert(values)
    if (err) throw new Error(err.message)
    await fetch()
  }

  const update = async (id: string, values: Partial<Omit<Day, 'id' | 'created_at' | 'updated_at'>>) => {
    const { error: err } = await supabase.from('days').update(values).eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('days').delete().eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  return { data, loading, error, create, update, remove, refresh: fetch }
}
