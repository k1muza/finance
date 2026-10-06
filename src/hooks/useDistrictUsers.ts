'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import type { DistrictRole } from '@/lib/auth/permissions'

export interface DistrictUser {
  user_id: string
  role: DistrictRole
  is_active: boolean
  created_at: string
  display_name: string | null
  email: string | null
}

/** District user accounts and their roles. Reads and writes go through the admin-only API. */
export function useDistrictUsers(districtId: string | null, enabled = true) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [data, setData] = useState<DistrictUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const res = await window.fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Request failed')
    return json
  }, []) // eslint-disable-line

  const fetch = useCallback(async () => {
    if (authLoading) return

    if (!userId || !districtId || !enabled) {
      setData([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const json = await request(`/api/districts/${encodeURIComponent(districtId)}/members`)
      setData(json.members as DistrictUser[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
      setData([])
    }
    setLoading(false)
  }, [authLoading, districtId, enabled, request, userId])

  useEffect(() => {
    if (authLoading) return

    const timeout = setTimeout(() => {
      void fetch()
    }, 0)

    return () => clearTimeout(timeout)
  }, [authLoading, fetch])

  const add = async (email: string, role: DistrictRole) => {
    if (!districtId) throw new Error('Select a district first')
    await request(`/api/districts/${encodeURIComponent(districtId)}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    })
    await fetch()
  }

  const update = async (targetUserId: string, patch: { role?: DistrictRole; is_active?: boolean }) => {
    if (!districtId) throw new Error('Select a district first')
    await request(
      `/api/districts/${encodeURIComponent(districtId)}/members/${encodeURIComponent(targetUserId)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    )
    await fetch()
  }

  return { data, loading, error, refetch: fetch, add, update }
}
