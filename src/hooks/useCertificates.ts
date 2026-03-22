'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Certificate } from '@/types'

export function useCertificates() {
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('certificates').select('*').order('sort_order')
    setCertificates(data ?? [])
    setLoading(false)
  }, []) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  const update = async (id: string, values: Pick<Certificate, 'min_amount' | 'max_amount'>) => {
    const { error } = await supabase.from('certificates').update(values).eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  return { certificates, loading, refresh: fetch, update }
}
