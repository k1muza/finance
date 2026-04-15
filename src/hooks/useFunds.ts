'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Fund } from '@/types'

interface FundFilter {
  district_id?: string
}

export function useFunds(filter: FundFilter = {}) {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<Fund[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    if (authLoading) return

    if (!user) {
      setData([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    let query = supabase
      .from('funds')
      .select('*, district:districts(id,name)')
      .order('name')

    if (filter.district_id) query = query.eq('district_id', filter.district_id)

    const { data: rows, error: err } = await query
    if (err) {
      setError(err.message)
      setData([])
    } else {
      setData((rows ?? []) as Fund[])
    }
    setLoading(false)
  }, [authLoading, filter.district_id, user?.id]) // eslint-disable-line

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (!authLoading) fetch()
  }, [authLoading, fetch])

  const add = async (values: { district_id: string; name: string; description?: string | null; is_restricted?: boolean }) => {
    const { error: err } = await supabase.from('funds').insert({
      district_id: values.district_id,
      name: values.name.trim(),
      description: values.description?.trim() || null,
      is_restricted: values.is_restricted ?? false,
    })
    if (err) throw new Error(err.message)
    await fetch()
  }

  const update = async (
    id: string,
    values: Partial<{ name: string; description: string | null; is_restricted: boolean }>
  ) => {
    const payload = {
      ...(values.name !== undefined ? { name: values.name.trim() } : {}),
      ...(values.description !== undefined ? { description: values.description?.trim() || null } : {}),
      ...(values.is_restricted !== undefined ? { is_restricted: values.is_restricted } : {}),
    }
    const { error: err } = await supabase.from('funds').update(payload).eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('funds').delete().eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  return { data, loading, error, add, update, remove, refresh: fetch }
}
