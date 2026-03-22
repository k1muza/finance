'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Session } from '@/types'

export function useSessions(dayId: string | null) {
  const [data, setData] = useState<Session[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    if (!dayId) { setData([]); return }
    setLoading(true)
    const { data: rows } = await supabase
      .from('sessions')
      .select('*')
      .eq('day_id', dayId)
      .order('start_time')
    setData(rows ?? [])
    setLoading(false)
  }, [dayId]) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  const create = async (values: Omit<Session, 'id' | 'created_at' | 'updated_at' | 'events'>) => {
    const { error } = await supabase.from('sessions').insert(values)
    if (error) throw new Error(error.message)
    await fetch()
  }

  const update = async (id: string, values: Partial<Omit<Session, 'id' | 'created_at' | 'updated_at' | 'events'>>) => {
    const { error } = await supabase.from('sessions').update(values).eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('sessions').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  return { data, loading, create, update, remove, refresh: fetch }
}
