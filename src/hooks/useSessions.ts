'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Session } from '@/types'

type SessionWriteValues = {
  day_id: string
  name: string
  start_time: string
  allocated_duration: number
  mc_ids?: string[]
  manager_ids?: string[]
}

type SessionUpdateValues = Partial<Omit<SessionWriteValues, 'day_id'>>

export function useSessions(dayId: string | null) {
  const [data, setData] = useState<Session[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    if (!dayId) { setData([]); return }
    setLoading(true)
    const { data: rows } = await supabase
      .from('sessions')
      .select('*, session_people(role, person:people(id,name))')
      .eq('day_id', dayId)
      .order('start_time')

    setData(
      (rows ?? []).map((s) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sp: { role: string; person: any }[] = s.session_people ?? []
        return {
          ...s,
          mcs: sp.filter((x) => x.role === 'mc').map((x) => x.person).filter(Boolean),
          managers: sp.filter((x) => x.role === 'manager').map((x) => x.person).filter(Boolean),
          session_people: undefined,
        }
      })
    )
    setLoading(false)
  }, [dayId]) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  const syncPeople = async (sessionId: string, mc_ids: string[], manager_ids: string[]) => {
    await supabase.from('session_people').delete().eq('session_id', sessionId)
    const rows = [
      ...mc_ids.map((person_id) => ({ session_id: sessionId, person_id, role: 'mc' })),
      ...manager_ids.map((person_id) => ({ session_id: sessionId, person_id, role: 'manager' })),
    ]
    if (rows.length > 0) {
      const { error } = await supabase.from('session_people').insert(rows)
      if (error) throw new Error(error.message)
    }
  }

  const create = async ({ mc_ids = [], manager_ids = [], ...values }: SessionWriteValues) => {
    const { data: session, error } = await supabase.from('sessions').insert(values).select().single()
    if (error) throw new Error(error.message)
    if (mc_ids.length > 0 || manager_ids.length > 0) {
      await syncPeople(session.id, mc_ids, manager_ids)
    }
    await fetch()
  }

  const update = async (id: string, { mc_ids, manager_ids, ...values }: SessionUpdateValues) => {
    if (Object.keys(values).length > 0) {
      const { error } = await supabase.from('sessions').update(values).eq('id', id)
      if (error) throw new Error(error.message)
    }
    if (mc_ids !== undefined || manager_ids !== undefined) {
      const session = data.find((s) => s.id === id)
      await syncPeople(
        id,
        mc_ids ?? session?.mcs?.map((p) => p.id) ?? [],
        manager_ids ?? session?.managers?.map((p) => p.id) ?? [],
      )
    }
    await fetch()
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('sessions').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  return { data, loading, create, update, remove, refresh: fetch }
}
