'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Member, MemberType, IndividualTitle } from '@/types'

interface MemberFilter {
  district_id?: string | null
}

export function useMembers(filter: MemberFilter = {}) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [data, setData] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetch = useCallback(async () => {
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
      .from('members')
      .select('*')
      .order('name')

    if (filter.district_id) query = query.eq('district_id', filter.district_id)

    const { data: rows, error: err } = await query
    if (err) {
      setError(err.message)
      setData([])
    } else {
      setData((rows ?? []) as Member[])
    }
    setLoading(false)
  }, [authLoading, filter.district_id, userId]) // eslint-disable-line

  useEffect(() => {
    if (authLoading) return

    const timeout = setTimeout(() => {
      void fetch()
    }, 0)

    return () => clearTimeout(timeout)
  }, [authLoading, fetch])

  const add = async (values: {
    district_id: string
    parent_id?: string | null
    type: MemberType
    name: string
    code?: string | null
    title?: IndividualTitle
    phone?: string | null
    email?: string | null
    address?: string | null
    notes?: string | null
    is_active?: boolean
  }): Promise<string> => {
    const { data, error: err } = await supabase.from('members').insert({
      district_id: values.district_id,
      parent_id: values.parent_id ?? null,
      type: values.type,
      name: values.name.trim(),
      code: values.code?.trim() || null,
      title: values.title ?? 'saint',
      phone: values.phone?.trim() || null,
      email: values.email?.trim() || null,
      address: values.address?.trim() || null,
      notes: values.notes?.trim() || null,
      is_active: values.is_active ?? true,
    }).select('id').single()
    if (err) throw new Error(err.message)
    await fetch()
    return data.id as string
  }

  const update = async (
    id: string,
    values: Partial<{
      parent_id: string | null
      type: MemberType
      name: string
      code: string | null
      title: IndividualTitle
      phone: string | null
      email: string | null
      address: string | null
      notes: string | null
      is_active: boolean
    }>,
  ) => {
    const payload: Record<string, unknown> = {}
    if (values.parent_id !== undefined) payload.parent_id = values.parent_id
    if (values.type !== undefined) payload.type = values.type
    if (values.name !== undefined) payload.name = values.name.trim()
    if (values.code !== undefined) payload.code = values.code?.trim() || null
    if (values.title !== undefined) payload.title = values.title
    if (values.phone !== undefined) payload.phone = values.phone?.trim() || null
    if (values.email !== undefined) payload.email = values.email?.trim() || null
    if (values.address !== undefined) payload.address = values.address?.trim() || null
    if (values.notes !== undefined) payload.notes = values.notes?.trim() || null
    if (values.is_active !== undefined) payload.is_active = values.is_active

    const { error: err } = await supabase.from('members').update(payload).eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('members').delete().eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  return { data, loading, error, add, update, remove, refresh: fetch }
}
