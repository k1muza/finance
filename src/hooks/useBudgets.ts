'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import type { Budget, BudgetLine, BudgetStatus, Currency } from '@/types'

interface BudgetFilter {
  district_id?: string | null
  status?: BudgetStatus | null
  id?: string | null
}

function normalizeBudgetLine(row: BudgetLine) {
  return {
    ...row,
    amount: Number(row.amount),
  } satisfies BudgetLine
}

function normalizeBudget(row: Budget) {
  return {
    ...row,
    lines: (row.lines ?? [])
      .map(normalizeBudgetLine)
      .sort((a, b) =>
        a.currency.localeCompare(b.currency)
        || (a.fund?.name ?? '').localeCompare(b.fund?.name ?? '')
        || a.line_description.localeCompare(b.line_description)
        || (a.scope_member?.name ?? '').localeCompare(b.scope_member?.name ?? '')
      ),
  } satisfies Budget
}

export function useBudgets(filter: BudgetFilter = {}) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [data, setData] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [supabase] = useState(() => createClient())

  const refetch = useCallback(async () => {
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
      .from('budgets')
      .select(`
        *,
        district:districts(id,name),
        lines:budget_lines(
          *,
          fund:funds(id,district_id,name,code,description,is_restricted,nature,is_active,requires_individual_member,created_at,updated_at),
          scope_member:members!budget_lines_scope_member_id_fkey(id,district_id,parent_id,type,name,code,title,phone,email,address,notes,is_active,created_at,updated_at)
        )
      `)
      .order('start_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (filter.district_id) query = query.eq('district_id', filter.district_id)
    if (filter.status) query = query.eq('status', filter.status)
    if (filter.id) query = query.eq('id', filter.id)

    const { data: rows, error: err } = await query
    if (err) {
      setError(err.message)
      setData([])
    } else {
      setData((rows ?? []).map((row) => normalizeBudget(row as Budget)))
    }

    setLoading(false)
  }, [
    authLoading,
    filter.district_id,
    filter.id,
    filter.status,
    supabase,
    userId,
  ])

  useEffect(() => {
    if (authLoading) return

    const timeout = setTimeout(() => {
      void refetch()
    }, 0)

    return () => clearTimeout(timeout)
  }, [authLoading, refetch])

  const createDraft = async (values: {
    district_id: string
    name: string
    start_date: string
    end_date: string
    description?: string | null
    client_generated_id?: string | null
    device_id?: string | null
  }) => {
    const { data: row, error: err } = await supabase.from('budgets').insert({
      district_id: values.district_id,
      name: values.name.trim(),
      start_date: values.start_date,
      end_date: values.end_date,
      description: values.description?.trim() || null,
      client_generated_id: values.client_generated_id?.trim() || null,
      device_id: values.device_id?.trim() || null,
      status: 'draft',
    })
      .select('id')
      .single()

    if (err) throw new Error(err.message)
    await refetch()
    return row as { id: string }
  }

  const updateDraft = async (
    id: string,
    values: Partial<{
      name: string
      start_date: string
      end_date: string
      description: string | null
    }>,
  ) => {
    const payload: Record<string, unknown> = {}
    if (values.name !== undefined) payload.name = values.name.trim()
    if (values.start_date !== undefined) payload.start_date = values.start_date
    if (values.end_date !== undefined) payload.end_date = values.end_date
    if (values.description !== undefined) payload.description = values.description?.trim() || null

    const { error: err } = await supabase
      .from('budgets')
      .update(payload)
      .eq('id', id)
      .eq('status', 'draft')

    if (err) throw new Error(err.message)
    await refetch()
  }

  const deleteDraft = async (id: string) => {
    const { error: err } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id)
      .eq('status', 'draft')

    if (err) throw new Error(err.message)
    await refetch()
  }

  const addLine = async (values: {
    district_id: string
    budget_id: string
    fund_id: string
    line_description: string
    currency?: Currency
    amount: number
    scope_member_id?: string | null
    notes?: string | null
  }) => {
    const { error: err } = await supabase.from('budget_lines').insert({
      district_id: values.district_id,
      budget_id: values.budget_id,
      fund_id: values.fund_id,
      line_description: values.line_description.trim(),
      currency: values.currency ?? 'USD',
      amount: values.amount,
      scope_member_id: values.scope_member_id || null,
      notes: values.notes?.trim() || null,
    })

    if (err) {
      if (err.code === '23505' && err.message.includes('idx_budget_lines_unique_scope')) {
        throw new Error('A budget line with the same fund, currency, scope, and line description already exists.')
      }
      throw new Error(err.message)
    }
    await refetch()
  }

  const updateLine = async (
    id: string,
    values: Partial<{
      fund_id: string
      line_description: string
      currency: Currency
      amount: number
      scope_member_id: string | null
      notes: string | null
    }>,
  ) => {
    const payload: Record<string, unknown> = {}
    if (values.fund_id !== undefined) payload.fund_id = values.fund_id
    if (values.line_description !== undefined) payload.line_description = values.line_description.trim()
    if (values.currency !== undefined) payload.currency = values.currency
    if (values.amount !== undefined) payload.amount = values.amount
    if (values.scope_member_id !== undefined) payload.scope_member_id = values.scope_member_id || null
    if (values.notes !== undefined) payload.notes = values.notes?.trim() || null

    const { error: err } = await supabase
      .from('budget_lines')
      .update(payload)
      .eq('id', id)

    if (err) {
      if (err.code === '23505' && err.message.includes('idx_budget_lines_unique_scope')) {
        throw new Error('A budget line with the same fund, currency, scope, and line description already exists.')
      }
      throw new Error(err.message)
    }
    await refetch()
  }

  const deleteLine = async (id: string) => {
    const { error: err } = await supabase
      .from('budget_lines')
      .delete()
      .eq('id', id)

    if (err) throw new Error(err.message)
    await refetch()
  }

  const callAction = async (id: string, action: 'activate' | 'close') => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const res = await fetch(`/api/budgets/${id}/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? `Failed to ${action} budget`)
    await refetch()
    return json.data as Budget
  }

  return {
    data,
    loading,
    error,
    refresh: refetch,
    createDraft,
    updateDraft,
    deleteDraft,
    addLine,
    updateLine,
    deleteLine,
    activate: (id: string) => callAction(id, 'activate'),
    close: (id: string) => callAction(id, 'close'),
  }
}
