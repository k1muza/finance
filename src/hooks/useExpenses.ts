'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Currency, Expense, PaymentMethod } from '@/types'

interface ExpenseFilter {
  district_id?: string | null
  search?: string
}

export function useExpenses(filter: ExpenseFilter = {}) {
  const [data, setData] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    if (filter.district_id === null) {
      setData([])
      setLoading(false)
      return
    }

    setLoading(true)
    let query = supabase
      .from('expenses')
      .select('*, district:districts(id,name), account:accounts(id,district_id,name,code,type,currency,status,description,created_at,updated_at), fund:funds(id,district_id,name,description,is_restricted,created_at,updated_at)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (filter.district_id) query = query.eq('district_id', filter.district_id)
    if (filter.search) query = query.ilike('description', `%${filter.search}%`)

    const { data: rows } = await query
    setData(rows ?? [])
    setLoading(false)
  }, [filter.district_id, filter.search]) // eslint-disable-line

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetch() }, [fetch])

  const add = async (values: {
    district_id: string
    account_id?: string | null
    description: string
    amount: number
    date: string
    category?: string | null
    fund_id?: string | null
    currency?: Currency
    payment_method?: PaymentMethod
  }) => {
    const { error } = await supabase.from('expenses').insert(values)
    if (error) throw new Error(error.message)
    await fetch()
  }

  const update = async (id: string, values: Partial<{
    account_id: string | null
    description: string
    amount: number
    date: string
    category: string | null
    fund_id: string | null
    currency: Currency
    payment_method: PaymentMethod
  }>) => {
    const { error } = await supabase.from('expenses').update(values).eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  const totalsByCurrency = data.reduce<Partial<Record<Currency, number>>>((acc, e) => {
    acc[e.currency] = (acc[e.currency] ?? 0) + e.amount
    return acc
  }, {})

  return { data, loading, totalsByCurrency, add, update, remove, refresh: fetch }
}
