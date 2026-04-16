'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { District } from '@/types'

const DISTRICTS_CACHE_KEY = 'finance_districts'

export function useDistricts() {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [data, setData] = useState<District[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    if (authLoading) return

    if (!userId) {
      setData([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { data: rows, error: err } = await supabase
        .from('districts')
        .select('*')
        .order('name')
      if (err) {
        setError(err.message)
        // Offline fallback
        try {
          const cached = localStorage.getItem(DISTRICTS_CACHE_KEY)
          if (cached) setData(JSON.parse(cached))
        } catch { /* ignore */ }
      } else {
        const result = rows ?? []
        setData(result)
        localStorage.setItem(DISTRICTS_CACHE_KEY, JSON.stringify(result))
      }
    } catch {
      // Network error: offline fallback
      try {
        const cached = localStorage.getItem(DISTRICTS_CACHE_KEY)
        if (cached) setData(JSON.parse(cached))
      } catch { /* ignore */ }
    }
    setLoading(false)
  }, [authLoading, userId]) // eslint-disable-line

  useEffect(() => {
    if (authLoading) return

    const timeout = setTimeout(() => {
      void fetch()
    }, 0)

    return () => clearTimeout(timeout)
  }, [authLoading, fetch])

  const create = async (values: Omit<District, 'id' | 'created_at' | 'updated_at'>) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const res = await window.fetch('/api/districts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(values),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Failed to create district')
    await fetch()
  }

  const update = async (id: string, values: Partial<Omit<District, 'id' | 'created_at' | 'updated_at'>>) => {
    const { error: err } = await supabase.from('districts').update(values).eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('districts').delete().eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  return { data, loading, error, create, update, remove, refresh: fetch }
}
