'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import type { DistrictRole } from '@/lib/auth/permissions'
import { Department } from '@/types'

export type DepartmentInput = Pick<Department, 'name' | 'code' | 'description' | 'grants_finance_view' | 'is_active'>

export interface RosterPerson {
  user_id: string
  display_name: string | null
  email: string | null
}

export interface DepartmentRoster {
  leaders: (RosterPerson & { role: DistrictRole; department_id: string })[]
  members: (RosterPerson & { department_id: string })[]
  /** Active district users, only returned to people who can manage a department. */
  people: RosterPerson[]
  manageable_department_ids: string[]
}

const EMPTY_ROSTER: DepartmentRoster = { leaders: [], members: [], people: [], manageable_department_ids: [] }

/**
 * Departments in `districtId` plus their leaders and members. Pass
 * `withRoster: false` when only the department list is needed (pickers).
 */
export function useDepartments(districtId: string | null, { withRoster = true } = {}) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [data, setData] = useState<Department[]>([])
  const [roster, setRoster] = useState<DepartmentRoster>(EMPTY_ROSTER)
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

    if (!userId || !districtId) {
      setData([])
      setRoster(EMPTY_ROSTER)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [{ data: rows, error: err }, rosterJson] = await Promise.all([
        supabase.from('departments').select('*').eq('district_id', districtId).order('name'),
        withRoster
          ? request(`/api/districts/${encodeURIComponent(districtId)}/departments/roster`)
          : Promise.resolve(EMPTY_ROSTER),
      ])
      if (err) throw new Error(err.message)
      setData((rows ?? []) as Department[])
      setRoster(rosterJson as DepartmentRoster)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load departments')
      setData([])
      setRoster(EMPTY_ROSTER)
    }
    setLoading(false)
  }, [authLoading, districtId, request, userId, withRoster]) // eslint-disable-line

  useEffect(() => {
    if (authLoading) return

    const timeout = setTimeout(() => {
      void fetch()
    }, 0)

    return () => clearTimeout(timeout)
  }, [authLoading, fetch])

  const add = async (values: DepartmentInput) => {
    if (!districtId) throw new Error('Select a district first')
    const { error: err } = await supabase
      .from('departments')
      .insert({ ...values, district_id: districtId })
    if (err) throw new Error(err.message)
    await fetch()
  }

  const update = async (id: string, values: Partial<DepartmentInput>) => {
    const { error: err } = await supabase.from('departments').update(values).eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  const addMember = async (departmentId: string, memberUserId: string) => {
    if (!districtId) throw new Error('Select a district first')
    await request(
      `/api/districts/${encodeURIComponent(districtId)}/departments/${encodeURIComponent(departmentId)}/members`,
      { method: 'POST', body: JSON.stringify({ user_id: memberUserId }) },
    )
    await fetch()
  }

  const removeMember = async (departmentId: string, memberUserId: string) => {
    if (!districtId) throw new Error('Select a district first')
    await request(
      `/api/districts/${encodeURIComponent(districtId)}/departments/${encodeURIComponent(departmentId)}/members/${encodeURIComponent(memberUserId)}`,
      { method: 'DELETE' },
    )
    await fetch()
  }

  return { data, roster, loading, error, refetch: fetch, add, update, addMember, removeMember }
}
