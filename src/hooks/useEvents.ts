'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Event } from '@/types'

export function useEvents(sessionId: string | null) {
  const [data, setData] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    if (!sessionId) { setData([]); return }
    setLoading(true)
    const { data: rows } = await supabase
      .from('events')
      .select('*, person:people(id,name)')
      .eq('session_id', sessionId)
      .order('start_time')
    setData(rows ?? [])
    setLoading(false)
  }, [sessionId]) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  const create = async (values: Omit<Event, 'id' | 'created_at' | 'updated_at' | 'person'>) => {
    const { error } = await supabase.from('events').insert(values)
    if (error) throw new Error(error.message)
    await fetch()
  }

  const update = async (id: string, values: Partial<Omit<Event, 'id' | 'created_at' | 'updated_at' | 'person'>>) => {
    const { error } = await supabase.from('events').update(values).eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  return { data, loading, create, update, remove, refresh: fetch }
}
