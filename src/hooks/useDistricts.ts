'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { District } from '@/types'

export function useDistricts() {
  const [data, setData] = useState<District[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data: rows, error: err } = await supabase
      .from('districts')
      .select('*')
      .order('name')
    if (err) setError(err.message)
    else setData(rows ?? [])
    setLoading(false)
  }, []) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  const create = async (values: Omit<District, 'id' | 'created_at' | 'updated_at'>) => {
    const { error: err } = await supabase.from('districts').insert(values)
    if (err) throw new Error(err.message)
    await fetch()
  }

  const update = async (id: string, values: Partial<Omit<District, 'id' | 'created_at' | 'updated_at'>>) => {
    const { error: err } = await supabase.from('districts').update(values).eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('districts').delete().eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  return { data, loading, error, create, update, remove, refresh: fetch }
}
