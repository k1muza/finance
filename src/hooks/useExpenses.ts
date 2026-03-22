'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Expense } from '@/types'

interface ExpenseFilter {
  district_id?: string
  search?: string
}

export function useExpenses(filter: ExpenseFilter = {}) {
  const [data, setData] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('expenses')
      .select('*, district:districts(id,name)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (filter.district_id) query = query.eq('district_id', filter.district_id)
    if (filter.search) query = query.ilike('description', `%${filter.search}%`)

    const { data: rows } = await query
    setData(rows ?? [])
    setLoading(false)
  }, [filter.district_id, filter.search]) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  const add = async (values: { district_id: string; description: string; amount: number; date: string }) => {
    const { error } = await supabase.from('expenses').insert(values)
    if (error) throw new Error(error.message)
    await fetch()
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  const total = data.reduce((sum, e) => sum + e.amount, 0)

  return { data, loading, total, add, remove, refresh: fetch }
}
