'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import type { Collection, CollectionLine, CollectionType } from '@/types'

export type CollectionInput = Pick<Collection, 'scope_member_id' | 'collected_on' | 'reference' | 'notes' | 'currency'>
export type CollectionLineInput = Pick<CollectionLine, 'collection_type_id' | 'member_id' | 'contributor_name' | 'amount'>
export type CollectionTypeInput = Pick<CollectionType, 'name' | 'code' | 'suggested_fund_id' | 'is_active'>

export interface PostCollectionValues {
  account_id: string
  funds: Record<string, string>
  transaction_date?: string
}

/**
 * Collections the current user can see in `districtId` (RLS limits scoped roles
 * to their own unit), plus the district's collection types. A secretary's save
 * is final — mistakes are voided and recorded again. Hand-over and posting go
 * through the API.
 */
export function useCollections(districtId: string | null) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [data, setData] = useState<Collection[]>([])
  const [types, setTypes] = useState<CollectionType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const request = useCallback(async (path: string, body?: unknown) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const res = await window.fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body ?? {}),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Request failed')
    return json
  }, []) // eslint-disable-line

  const fetch = useCallback(async () => {
    if (authLoading) return

    if (!userId || !districtId) {
      setData([])
      setTypes([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const [collectionsResult, typesResult] = await Promise.all([
      supabase
        .from('collections')
        .select('*, lines:collection_lines(*)')
        .eq('district_id', districtId)
        .order('collected_on', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('collection_types').select('*').eq('district_id', districtId).order('name'),
    ])

    const err = collectionsResult.error ?? typesResult.error
    if (err) {
      setError(err.message)
      setData([])
      setTypes([])
    } else {
      setData((collectionsResult.data ?? []) as Collection[])
      setTypes((typesResult.data ?? []) as CollectionType[])
    }
    setLoading(false)
  }, [authLoading, districtId, userId]) // eslint-disable-line

  useEffect(() => {
    if (authLoading) return

    const timeout = setTimeout(() => {
      void fetch()
    }, 0)

    return () => clearTimeout(timeout)
  }, [authLoading, fetch])

  /** Saves header and lines in one call; the collection cannot be edited afterwards. */
  const add = async (values: CollectionInput, lines: CollectionLineInput[]) => {
    if (!districtId) throw new Error('Select a district first')
    const { error: err } = await supabase.rpc('record_collection', {
      p_collection: { ...values, district_id: districtId },
      p_lines: lines,
    })
    if (err) throw new Error(err.message)
    await fetch()
  }

  /** Withdraws a collection that has not been posted to funds. */
  const voidCollection = async (id: string) => {
    const { error: err } = await supabase
      .from('collections')
      .update({ status: 'voided', voided_at: new Date().toISOString(), voided_by: userId })
      .eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  const submit = async (id: string) => {
    await request(`/api/collections/${encodeURIComponent(id)}/submit`)
    await fetch()
  }

  const post = async (id: string, values: PostCollectionValues) => {
    try {
      await request(`/api/collections/${encodeURIComponent(id)}/post`, values)
    } finally {
      // Lines post one at a time, so refresh even after a part-way failure.
      await fetch()
    }
  }

  const addType = async (values: CollectionTypeInput) => {
    if (!districtId) throw new Error('Select a district first')
    const { error: err } = await supabase.from('collection_types').insert({ ...values, district_id: districtId })
    if (err) throw new Error(err.message)
    await fetch()
  }

  const updateType = async (id: string, values: Partial<CollectionTypeInput>) => {
    const { error: err } = await supabase.from('collection_types').update(values).eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  return { data, types, loading, error, refetch: fetch, add, voidCollection, submit, post, addType, updateType }
}
