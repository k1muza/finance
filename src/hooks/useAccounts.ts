'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Account, AccountStatus, AccountType, Currency } from '@/types'

interface AccountFilter {
  district_id?: string | null
}

export function useAccounts(filter: AccountFilter = {}) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [data, setData] = useState<Account[]>([])
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
      .from('accounts')
      .select('*, district:districts(id,name)')
      .order('status')
      .order('name')

    if (filter.district_id) query = query.eq('district_id', filter.district_id)

    const { data: rows, error: err } = await query
    if (err) {
      setError(err.message)
      setData([])
    } else {
      setData((rows ?? []) as Account[])
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
    type: AccountType
    currency: Currency
    status?: AccountStatus
    description?: string | null
    sort_order?: number
    institution_name?: string | null
    institution_account_number?: string | null
  }) => {
    const { error: err } = await supabase.from('accounts').insert({
      district_id: values.district_id,
      name: values.name.trim(),
      code: values.code?.trim() || null,
      type: values.type,
      currency: values.currency,
      status: values.status ?? 'active',
      description: values.description?.trim() || null,
      sort_order: values.sort_order ?? 0,
      institution_name: values.institution_name?.trim() || null,
      institution_account_number: values.institution_account_number?.trim() || null,
    })
    if (err) throw new Error(err.message)
    await fetch()
  }

  const update = async (
    id: string,
    values: Partial<{
      name: string
      code: string | null
      type: AccountType
      currency: Currency
      status: AccountStatus
      description: string | null
      sort_order: number
      institution_name: string | null
      institution_account_number: string | null
    }>
  ) => {
    const payload: Record<string, unknown> = {}
    if (values.name !== undefined) payload.name = values.name.trim()
    if (values.code !== undefined) payload.code = values.code?.trim() || null
    if (values.type !== undefined) payload.type = values.type
    if (values.currency !== undefined) payload.currency = values.currency
    if (values.status !== undefined) payload.status = values.status
    if (values.description !== undefined) payload.description = values.description?.trim() || null
    if (values.sort_order !== undefined) payload.sort_order = values.sort_order
    if (values.institution_name !== undefined) payload.institution_name = values.institution_name?.trim() || null
    if (values.institution_account_number !== undefined) payload.institution_account_number = values.institution_account_number?.trim() || null

    const { error: err } = await supabase.from('accounts').update(payload).eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('accounts').delete().eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  return { data, loading, error, add, update, remove, refresh: fetch }
}
