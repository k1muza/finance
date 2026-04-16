'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { CurrencyRow } from '@/types'

export function useCurrencies() {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<CurrencyRow[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false)
      return
    }

    const timeout = setTimeout(async () => {
      setLoading(true)
      const { data: rows } = await supabase
        .from('currencies')
        .select('*')
        .eq('is_active', true)
        .order('code')
      setData((rows ?? []) as CurrencyRow[])
      setLoading(false)
    }, 0)

    return () => clearTimeout(timeout)
  }, [authLoading, user]) // eslint-disable-line

  return { data, loading }
}
