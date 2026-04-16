'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Fund, FundNature } from '@/types'

interface FundFilter {
  district_id?: string | null
}

export function useFunds(filter: FundFilter = {}) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [data, setData] = useState<Fund[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    if (authLoading) return

    if (!userId) {
      setData([])
      setError(null)
      setLoading(false)
      return
    }

    if (filter.district_id === null) {
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
  }, [authLoading, filter.district_id, userId]) // eslint-disable-line

  useEffect(() => {
    if (authLoading) return

    const timeout = setTimeout(() => {
      void fetch()
    }, 0)

    return () => clearTimeout(timeout)
  }, [authLoading, fetch])

  const add = async (values: {
    district_id: string
    name: string
    code?: string | null
    description?: string | null
    is_restricted?: boolean
    nature?: FundNature
    is_active?: boolean
    requires_individual_source?: boolean
  }) => {
    const { error: err } = await supabase.from('funds').insert({
      district_id: values.district_id,
      name: values.name.trim(),
      code: values.code?.trim() || null,
      description: values.description?.trim() || null,
      is_restricted: values.is_restricted ?? false,
      nature: values.nature ?? 'mixed',
      is_active: values.is_active ?? true,
      requires_individual_source: values.requires_individual_source ?? false,
    })
    if (err) throw new Error(err.message)
    await fetch()
  }

  const update = async (
    id: string,
    values: Partial<{
      name: string
      code: string | null
      description: string | null
      is_restricted: boolean
      nature: FundNature
      is_active: boolean
      requires_individual_source: boolean
    }>
  ) => {
    const payload: Record<string, unknown> = {}
    if (values.name !== undefined) payload.name = values.name.trim()
    if (values.code !== undefined) payload.code = values.code?.trim() || null
    if (values.description !== undefined) payload.description = values.description?.trim() || null
    if (values.is_restricted !== undefined) payload.is_restricted = values.is_restricted
    if (values.nature !== undefined) payload.nature = values.nature
    if (values.is_active !== undefined) payload.is_active = values.is_active
    if (values.requires_individual_source !== undefined) payload.requires_individual_source = values.requires_individual_source

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
