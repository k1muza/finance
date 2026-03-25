'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Event } from '@/types'

type EventWriteValues = {
  session_id: string
  title: string
  start_time: string
  duration: number
  is_main_event?: boolean
  person_ids?: string[]
}

type EventUpdateValues = Partial<Omit<EventWriteValues, 'session_id'>>

export function useEvents(sessionId: string | null) {
  const [data, setData] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    if (!sessionId) { setData([]); return }
    setLoading(true)
    const { data: rows } = await supabase
      .from('events')
      .select('*, event_people(person:people(id,name))')
      .eq('session_id', sessionId)
      .order('start_time')

    setData(
      (rows ?? []).map((r) => ({
        ...r,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        people: (r.event_people ?? []).map((ep: any) => ep.person).filter(Boolean),
        event_people: undefined,
      }))
    )
    setLoading(false)
  }, [sessionId]) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  const create = async ({ person_ids, is_main_event, ...values }: EventWriteValues) => {
    const { data: evt, error } = await supabase
      .from('events')
      .insert({ ...values, is_main_event: is_main_event ?? false })
      .select()
      .single()
    if (error) throw new Error(error.message)
    if (person_ids?.length && evt) {
      const { error: peErr } = await supabase
        .from('event_people')
        .insert(person_ids.map((person_id) => ({ event_id: evt.id, person_id })))
      if (peErr) throw new Error(peErr.message)
    }
    await fetch()
  }

  const update = async (id: string, { person_ids, is_main_event, ...values }: EventUpdateValues) => {
    const updatePayload = Object.keys(values).length > 0 || is_main_event !== undefined
      ? { ...values, ...(is_main_event !== undefined ? { is_main_event } : {}) }
      : null
    if (updatePayload) {
      const { error } = await supabase.from('events').update(updatePayload).eq('id', id)
      if (error) throw new Error(error.message)
    }
    if (person_ids !== undefined) {
      await supabase.from('event_people').delete().eq('event_id', id)
      if (person_ids.length > 0) {
        const { error: peErr } = await supabase
          .from('event_people')
          .insert(person_ids.map((person_id) => ({ event_id: id, person_id })))
        if (peErr) throw new Error(peErr.message)
      }
    }
    await fetch()
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  /** Toggle main event status. The DB trigger handles unsetting the previous main event. */
  const setMainEvent = async (id: string, value: boolean) => {
    const { error } = await supabase.from('events').update({ is_main_event: value }).eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  return { data, loading, create, update, remove, setMainEvent, refresh: fetch }
}
