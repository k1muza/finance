'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { DistrictEvent } from '@/types'

export type DistrictEventInput = Pick<
  DistrictEvent,
  'title' | 'description' | 'location' | 'start_date' | 'end_date' | 'start_time' | 'end_time' | 'department_id'
>

/** Events in `districtId` that overlap the inclusive date range [from, to]. */
export function useDistrictEvents(districtId: string | null, from: string, to: string) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [data, setData] = useState<DistrictEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    if (authLoading) return

    if (!userId || !districtId) {
      setData([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data: rows, error: err } = await supabase
      .from('district_events')
      .select('*')
      .eq('district_id', districtId)
      .lte('start_date', to)
      .gte('end_date', from)
      .order('start_date')
      .order('start_time', { nullsFirst: true })

    if (err) {
      setError(err.message)
      setData([])
    } else {
      setData((rows ?? []) as DistrictEvent[])
    }
    setLoading(false)
  }, [authLoading, districtId, from, to, userId]) // eslint-disable-line

  useEffect(() => {
    if (authLoading) return

    const timeout = setTimeout(() => {
      void fetch()
    }, 0)

    return () => clearTimeout(timeout)
  }, [authLoading, fetch])

  const add = async (values: DistrictEventInput) => {
    if (!districtId) throw new Error('Select a district first')
    const { error: err } = await supabase
      .from('district_events')
      .insert({ ...values, district_id: districtId })
    if (err) throw new Error(err.message)
    await fetch()
  }

  const update = async (id: string, values: DistrictEventInput) => {
    const { error: err } = await supabase.from('district_events').update(values).eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('district_events').delete().eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  return { data, loading, error, refetch: fetch, add, update, remove }
}
