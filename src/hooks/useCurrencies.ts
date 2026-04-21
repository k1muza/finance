'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { CurrencyRow } from '@/types'

export function useCurrencies() {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<CurrencyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      const timeout = setTimeout(() => {
        setData([])
        setLoading(false)
      }, 0)

      return () => clearTimeout(timeout)
    }

    let cancelled = false
    const timeout = setTimeout(async () => {
      setLoading(true)
      const { data: rows } = await supabase
        .from('currencies')
        .select('*')
        .eq('is_active', true)
        .order('code')

      if (cancelled) return

      setData((rows ?? []) as CurrencyRow[])
      setLoading(false)
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [authLoading, user, supabase])

  return { data, loading }
}
