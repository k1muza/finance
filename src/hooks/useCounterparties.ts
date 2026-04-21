'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Counterparty, CounterpartyType } from '@/types'

interface CounterpartyFilter {
  district_id?: string | null
}

export function useCounterparties(filter: CounterpartyFilter = {}) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [data, setData] = useState<Counterparty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    if (authLoading) return

    if (!userId || filter.district_id === null) {
      setData([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    let query = supabase
      .from('counterparties')
      .select('*')
      .order('name')

    if (filter.district_id) query = query.eq('district_id', filter.district_id)

    const { data: rows, error: err } = await query
    if (err) {
      setError(err.message)
      setData([])
    } else {
      setData((rows ?? []) as Counterparty[])
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
    type: CounterpartyType
    name: string
    code?: string | null
    phone?: string | null
    email?: string | null
    address?: string | null
    notes?: string | null
    is_active?: boolean
  }) => {
    const { error: err } = await supabase.from('counterparties').insert({
      district_id: values.district_id,
      type: values.type,
      name: values.name.trim(),
      code: values.code?.trim() || null,
      phone: values.phone?.trim() || null,
      email: values.email?.trim() || null,
      address: values.address?.trim() || null,
      notes: values.notes?.trim() || null,
      is_active: values.is_active ?? true,
    })
    if (err) throw new Error(err.message)
    await fetch()
  }

  const update = async (
    id: string,
    values: Partial<{
      type: CounterpartyType
      name: string
      code: string | null
      phone: string | null
      email: string | null
      address: string | null
      notes: string | null
      is_active: boolean
    }>,
  ) => {
    const payload: Record<string, unknown> = {}
    if (values.type !== undefined) payload.type = values.type
    if (values.name !== undefined) payload.name = values.name.trim()
    if (values.code !== undefined) payload.code = values.code?.trim() || null
    if (values.phone !== undefined) payload.phone = values.phone?.trim() || null
    if (values.email !== undefined) payload.email = values.email?.trim() || null
    if (values.address !== undefined) payload.address = values.address?.trim() || null
    if (values.notes !== undefined) payload.notes = values.notes?.trim() || null
    if (values.is_active !== undefined) payload.is_active = values.is_active

    const { error: err } = await supabase.from('counterparties').update(payload).eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('counterparties').delete().eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  return { data, loading, error, add, update, remove, refresh: fetch }
}
