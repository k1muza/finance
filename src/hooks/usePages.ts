'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Page } from '@/types'

export function usePages() {
  const [data, setData] = useState<Page[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data: rows } = await supabase
      .from('pages')
      .select('*')
      .order('sort_order')
      .order('created_at')
    setData(rows ?? [])
    setLoading(false)
  }, []) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  const create = async (values: Omit<Page, 'id' | 'created_at' | 'updated_at'>) => {
    const { error } = await supabase.from('pages').insert(values)
    if (error) throw new Error(error.message)
    await fetch()
  }

  const update = async (id: string, values: Partial<Omit<Page, 'id' | 'created_at' | 'updated_at'>>) => {
    const { error } = await supabase.from('pages').update(values).eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('pages').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  return { data, loading, create, update, remove, refresh: fetch }
}
