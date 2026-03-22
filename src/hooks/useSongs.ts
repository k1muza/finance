'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Song } from '@/types'

export function useSongs() {
  const [data, setData] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data: rows } = await supabase
      .from('songs')
      .select('*')
      .order('sort_order')
      .order('title')
    setData(rows ?? [])
    setLoading(false)
  }, []) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  const create = async (values: Omit<Song, 'id' | 'created_at' | 'updated_at'>) => {
    const { error } = await supabase.from('songs').insert(values)
    if (error) throw new Error(error.message)
    await fetch()
  }

  const update = async (id: string, values: Partial<Omit<Song, 'id' | 'created_at' | 'updated_at'>>) => {
    const { error } = await supabase.from('songs').update(values).eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('songs').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  return { data, loading, create, update, remove, refresh: fetch }
}
