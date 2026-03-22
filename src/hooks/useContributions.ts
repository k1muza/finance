'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Contribution } from '@/types'

export function useContributions(personId: string | null) {
  const [data, setData] = useState<Contribution[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    if (!personId) { setData([]); return }
    setLoading(true)
    const { data: rows } = await supabase
      .from('contributions')
      .select('*')
      .eq('person_id', personId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    setData(rows ?? [])
    setLoading(false)
  }, [personId]) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  const add = async (values: { amount: number; note: string; date: string }) => {
    if (!personId) return
    const { error } = await supabase.from('contributions').insert({ person_id: personId, ...values })
    if (error) throw new Error(error.message)
    await fetch()
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('contributions').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  const total = data.reduce((sum, c) => sum + c.amount, 0)

  return { data, loading, total, add, remove, refresh: fetch }
}
