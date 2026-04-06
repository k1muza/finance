'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface Category {
  id: string
  name: string
  sort_order: number
  created_at: string
}

type CategoryTable = 'expense_categories' | 'income_categories'

export function useCategories(table: CategoryTable) {
  const [data, setData] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data: rows } = await supabase
      .from(table)
      .select('*')
      .order('sort_order')
      .order('name')
    setData(rows ?? [])
    setLoading(false)
  }, [table]) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  const add = async (name: string) => {
    const maxOrder = data.reduce((m, c) => Math.max(m, c.sort_order), 0)
    const { error } = await supabase.from(table).insert({ name: name.trim(), sort_order: maxOrder + 1 })
    if (error) throw new Error(error.message)
    await fetch()
  }

  const update = async (id: string, name: string) => {
    const { error } = await supabase.from(table).update({ name: name.trim() }).eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  return { data, loading, add, update, remove, refresh: fetch }
}
