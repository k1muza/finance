'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Budget, BudgetType } from '@/types'

interface BudgetFilter {
  district_id?: string
}

export function useBudgets(filter: BudgetFilter = {}) {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<Budget[]>([])
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
      .from('budgets')
      .select('*, district:districts(id,name), fund:funds(id,district_id,name,description,is_restricted,created_at,updated_at)')
      .order('period_start', { ascending: false })
      .order('created_at', { ascending: false })

    if (filter.district_id) query = query.eq('district_id', filter.district_id)

    const { data: rows, error: err } = await query
    if (err) {
      setError(err.message)
      setData([])
    } else {
      setData((rows ?? []) as Budget[])
    }
    setLoading(false)
  }, [authLoading, filter.district_id, user?.id]) // eslint-disable-line

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (!authLoading) fetch()
  }, [authLoading, fetch])

  const add = async (values: {
    district_id: string
    fund_id?: string | null
    type: BudgetType
    category: string
    amount: number
    period_start: string
    period_end: string
    notes?: string | null
  }) => {
    const { error: err } = await supabase.from('budgets').insert({
      district_id: values.district_id,
      fund_id: values.fund_id || null,
      type: values.type,
      category: values.category.trim(),
      amount: values.amount,
      period_start: values.period_start,
      period_end: values.period_end,
      notes: values.notes?.trim() || null,
    })
    if (err) throw new Error(err.message)
    await fetch()
  }

  const update = async (
    id: string,
    values: Partial<{
      fund_id: string | null
      type: BudgetType
      category: string
      amount: number
      period_start: string
      period_end: string
      notes: string | null
    }>
  ) => {
    const payload = {
      ...(values.fund_id !== undefined ? { fund_id: values.fund_id || null } : {}),
      ...(values.type !== undefined ? { type: values.type } : {}),
      ...(values.category !== undefined ? { category: values.category.trim() } : {}),
      ...(values.amount !== undefined ? { amount: values.amount } : {}),
      ...(values.period_start !== undefined ? { period_start: values.period_start } : {}),
      ...(values.period_end !== undefined ? { period_end: values.period_end } : {}),
      ...(values.notes !== undefined ? { notes: values.notes?.trim() || null } : {}),
    }
    const { error: err } = await supabase.from('budgets').update(payload).eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('budgets').delete().eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  return { data, loading, error, add, update, remove, refresh: fetch }
}
