'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { performCashbookBulkAction, submitCashbookTransactions } from '@/lib/finance/cashbook-client'
import type { CashbookBulkAction } from '@/lib/finance/cashbook-bulk-actions'
import { useAuth } from '@/contexts/AuthContext'
import { CashbookTransaction, TransactionKind, TransactionStatus } from '@/types'

interface CashbookFilter {
  district_id?: string | null
  account_id?: string | null
  status?: TransactionStatus | null
  kind?: TransactionKind | null
  date_from?: string | null
  date_to?: string | null
}

// Reads cashbook transactions via the Supabase client (RLS-enforced).
// All writes go through server routes under /api/cashbook/transactions.
export function useCashbook(filter: CashbookFilter = {}) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [data, setData] = useState<CashbookTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

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

    try {
      if (filter.district_id) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setData([])
          setError(null)
          setLoading(false)
          return
        }

        const params = new URLSearchParams({ district_id: filter.district_id })
        if (filter.account_id) params.set('account_id', filter.account_id)
        if (filter.status) params.set('status', filter.status)
        if (filter.kind) params.set('kind', filter.kind)
        if (filter.date_from) params.set('date_from', filter.date_from)
        if (filter.date_to) params.set('date_to', filter.date_to)

        const res = await fetch(`/api/cashbook/transactions?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Failed to load cashbook transactions')

        setData((json.data ?? []) as CashbookTransaction[])
        setLoading(false)
        return
      }

      let query = supabase
        .from('cashbook_transactions')
        .select(
          '*, account:accounts(id,name,type,currency,status), fund:funds(id,name), member:members!cashbook_transactions_member_id_fkey(id,name,type,title,parent_id), counterparty_record:counterparties(id,name,type)',
        )
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (filter.account_id) query = query.eq('account_id', filter.account_id)
      if (filter.status) query = query.eq('status', filter.status)
      if (filter.kind) query = query.eq('kind', filter.kind)
      if (filter.date_from) query = query.gte('transaction_date', filter.date_from)
      if (filter.date_to) query = query.lte('transaction_date', filter.date_to)

      const { data: rows, error: err } = await query
      if (err) throw new Error(err.message)

      setData((rows ?? []) as CashbookTransaction[])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setData([])
    } finally {
      setLoading(false)
    }
  }, [ // eslint-disable-line
    authLoading,
    userId,
    filter.district_id,
    filter.account_id,
    filter.status,
    filter.kind,
    filter.date_from,
    filter.date_to,
  ])

  useEffect(() => {
    if (authLoading) return
    const timeout = setTimeout(() => { void refetch() }, 0)
    return () => clearTimeout(timeout)
  }, [authLoading, refetch])

  // Helper to call a lifecycle route with the current user's access token.
  // The caller provides the route path segment (e.g., 'submit', 'approve', 'post', 'void').
  const callLifecycle = async (
    id: string,
    action: 'submit' | 'approve' | 'post' | 'void',
    body?: Record<string, unknown>
  ) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const res = await fetch(`/api/cashbook/transactions/${id}/${action}`, {
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
    return json.data
  }

  const submit = (id: string) => callLifecycle(id, 'submit')
  const runBulkAction = async (action: CashbookBulkAction, ids: string[]) => {
    const result = await performCashbookBulkAction(ids, action)
    await refetch()
    return result
  }
  const submitMany = async (ids: string[]) => {
    const result = await submitCashbookTransactions(ids)
    await refetch()
    return result.data
  }
  const approve = (id: string) => callLifecycle(id, 'approve')
  const post = (id: string) => callLifecycle(id, 'post')
  const voidDraft = (id: string) => callLifecycle(id, 'void')

  const reverse = async (id: string, narration?: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const res = await fetch(`/api/cashbook/transactions/${id}/reverse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ narration }),
    })

    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Reversal failed')
    await refetch()
    return json.data
  }

  const updateDraft = async (id: string, payload: Partial<{
    account_id: string
    fund_id: string | null
    member_id: string | null
    counterparty_id: string | null
    kind: TransactionKind
    effect_direction: 'in' | 'out'
    transaction_date: string
    counterparty: string | null
    narration: string | null
    currency: string
    total_amount: number
  }>) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const res = await fetch(`/api/cashbook/transactions/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    })

    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Failed to update transaction')
    await refetch()
    return json.data
  }

  const createDraft = async (payload: {
    district_id: string
    account_id: string
    fund_id?: string | null
    member_id?: string | null
    counterparty_id?: string | null
    kind: TransactionKind
    effect_direction?: 'in' | 'out'
    transaction_date: string
    counterparty?: string | null
    narration?: string | null
    currency: string
    total_amount: number
    lines?: Array<{
      account_id: string
      fund_id?: string | null
      category?: string | null
      amount: number
      direction: 'debit' | 'credit'
      narration?: string | null
    }>
  }) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const res = await fetch('/api/cashbook/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    })

    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Failed to create transaction')
    await refetch()
    return json.data
  }

  return {
    data,
    loading,
    error,
    refresh: refetch,
    createDraft,
    updateDraft,
    submit,
    runBulkAction,
    submitMany,
    approve,
    post,
    voidDraft,
    reverse,
  }
}
