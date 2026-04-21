'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import type { Transfer, TransferStatus } from '@/types'

interface TransferFilter {
  district_id?: string | null
  status?: TransferStatus | null
  date_from?: string | null
  date_to?: string | null
}

export function useTransfers(filter: TransferFilter = {}) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [data, setData] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [supabase] = useState(() => createClient())

  const refetch = useCallback(async () => {
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
      .from('transfers')
      .select('*')
      .order('transfer_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (filter.district_id) query = query.eq('district_id', filter.district_id)
    if (filter.status) query = query.eq('status', filter.status)
    if (filter.date_from) query = query.gte('transfer_date', filter.date_from)
    if (filter.date_to) query = query.lte('transfer_date', filter.date_to)

    const { data: rows, error: err } = await query
    if (err) {
      setError(err.message)
      setData([])
    } else {
      setData((rows ?? []) as Transfer[])
    }

    setLoading(false)
  }, [
    authLoading,
    filter.date_from,
    filter.date_to,
    filter.district_id,
    filter.status,
    supabase,
    userId,
  ])

  useEffect(() => {
    if (authLoading) return
    const timeout = setTimeout(() => { void refetch() }, 0)
    return () => clearTimeout(timeout)
  }, [authLoading, refetch])

  const callAction = async (
    id: string,
    action: 'post' | 'reverse' | 'void',
    body?: Record<string, unknown>,
  ) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const res = await fetch(`/api/transfers/${id}/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? `${action} failed`)
    await refetch()
    return json.data as Transfer
  }

  const createDraft = async (payload: {
    district_id: string
    transfer_date: string
    from_account_id: string
    to_account_id: string
    amount: number
    description?: string | null
    client_generated_id?: string | null
    device_id?: string | null
  }) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const res = await fetch('/api/transfers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    })

    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Failed to create transfer')
    await refetch()
    return json.data as Transfer
  }

  const updateDraft = async (id: string, payload: Partial<{
    transfer_date: string
    from_account_id: string
    to_account_id: string
    amount: number
    description: string | null
  }>) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const res = await fetch(`/api/transfers/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    })

    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Failed to update transfer')
    await refetch()
    return json.data as Transfer
  }

  return {
    data,
    loading,
    error,
    refresh: refetch,
    createDraft,
    updateDraft,
    post: (id: string) => callAction(id, 'post'),
    reverse: (id: string, narration?: string) => callAction(id, 'reverse', narration ? { narration } : undefined),
    voidDraft: (id: string) => callAction(id, 'void'),
  }
}
