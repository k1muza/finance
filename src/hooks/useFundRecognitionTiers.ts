'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { FundRecognitionTier, RecognitionTierColor } from '@/types'

export function useFundRecognitionTiers(fundId: string | null | undefined) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [data, setData] = useState<FundRecognitionTier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    if (authLoading) return

    if (!userId || !fundId) {
      setData([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data: rows, error: err } = await supabase
      .from('fund_recognition_tiers')
      .select('*')
      .eq('fund_id', fundId)
      .order('min_amount', { ascending: false })
      .order('display_order', { ascending: true })

    if (err) {
      setError(err.message)
      setData([])
    } else {
      setData((rows ?? []) as FundRecognitionTier[])
    }
    setLoading(false)
  }, [authLoading, fundId, userId]) // eslint-disable-line

  useEffect(() => {
    if (authLoading) return

    const timeout = setTimeout(() => {
      void fetch()
    }, 0)

    return () => clearTimeout(timeout)
  }, [authLoading, fetch])

  const add = async (values: {
    name: string
    min_amount: number
    currency: string
    color: RecognitionTierColor
    display_order?: number
  }) => {
    if (!fundId) throw new Error('No fund selected')

    const { error: err } = await supabase.from('fund_recognition_tiers').insert({
      fund_id: fundId,
      name: values.name.trim(),
      min_amount: values.min_amount,
      currency: values.currency,
      color: values.color,
      display_order: values.display_order ?? 0,
      is_active: true,
    })
    if (err) throw new Error(err.message)
    await fetch()
  }

  const update = async (
    id: string,
    values: Partial<{
      name: string
      min_amount: number
      currency: string
      color: RecognitionTierColor
      display_order: number
      is_active: boolean
    }>,
  ) => {
    const payload: Record<string, unknown> = {}
    if (values.name !== undefined) payload.name = values.name.trim()
    if (values.min_amount !== undefined) payload.min_amount = values.min_amount
    if (values.currency !== undefined) payload.currency = values.currency
    if (values.color !== undefined) payload.color = values.color
    if (values.display_order !== undefined) payload.display_order = values.display_order
    if (values.is_active !== undefined) payload.is_active = values.is_active

    const { error: err } = await supabase.from('fund_recognition_tiers').update(payload).eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('fund_recognition_tiers').delete().eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  return { data, loading, error, add, update, remove, refresh: fetch }
}
