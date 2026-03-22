'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Meal } from '@/types'

export function useMeals(dayId: string | null) {
  const [data, setData] = useState<Meal[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    if (!dayId) { setData([]); return }
    setLoading(true)
    const { data: rows } = await supabase
      .from('meals')
      .select('*')
      .eq('day_id', dayId)
      .order('scheduled_time')
    setData(rows ?? [])
    setLoading(false)
  }, [dayId]) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  const create = async (values: Omit<Meal, 'id' | 'created_at' | 'updated_at'>) => {
    const { error } = await supabase.from('meals').insert(values)
    if (error) throw new Error(error.message)
    await fetch()
  }

  const update = async (id: string, values: Partial<Omit<Meal, 'id' | 'created_at' | 'updated_at'>>) => {
    const { error } = await supabase.from('meals').update(values).eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('meals').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  return { data, loading, create, update, remove, refresh: fetch }
}
