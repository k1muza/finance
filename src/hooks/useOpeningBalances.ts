'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { AccountOpeningBalance, Currency } from '@/types'

interface OpeningBalanceFilter {
  account_id?: string | null
  district_id?: string | null
}

export function useOpeningBalances(filter: OpeningBalanceFilter = {}) {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<AccountOpeningBalance[]>([])
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

    if (filter.account_id === null || filter.district_id === null) {
      setData([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    let query = supabase
      .from('account_opening_balances')
      .select('*, account:accounts(id,name,currency,type,status)')
      .order('effective_date', { ascending: false })

    if (filter.account_id) query = query.eq('account_id', filter.account_id)
    if (filter.district_id) query = query.eq('district_id', filter.district_id)

    const { data: rows, error: err } = await query
    if (err) {
      setError(err.message)
      setData([])
    } else {
      setData((rows ?? []) as AccountOpeningBalance[])
    }
    setLoading(false)
  }, [authLoading, filter.account_id, filter.district_id, user]) // eslint-disable-line

  useEffect(() => {
    if (authLoading) return

    const timeout = setTimeout(() => {
      void fetch()
    }, 0)

    return () => clearTimeout(timeout)
  }, [authLoading, fetch])

  const add = async (values: {
    account_id: string
    district_id: string
    effective_date: string
    amount: number
    currency: Currency
    notes?: string | null
  }) => {
    const { error: err } = await supabase.from('account_opening_balances').insert({
      account_id: values.account_id,
      district_id: values.district_id,
      effective_date: values.effective_date,
      amount: values.amount,
      currency: values.currency,
      notes: values.notes?.trim() || null,
    })
    if (err) throw new Error(err.message)
    await fetch()
  }

  const update = async (
    id: string,
    values: Partial<{
      effective_date: string
      amount: number
      notes: string | null
    }>
  ) => {
    const payload = {
      ...(values.effective_date !== undefined ? { effective_date: values.effective_date } : {}),
      ...(values.amount !== undefined ? { amount: values.amount } : {}),
      ...(values.notes !== undefined ? { notes: values.notes?.trim() || null } : {}),
    }
    const { error: err } = await supabase
      .from('account_opening_balances')
      .update(payload)
      .eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase
      .from('account_opening_balances')
      .delete()
      .eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  return { data, loading, error, add, update, remove, refresh: fetch }
}
