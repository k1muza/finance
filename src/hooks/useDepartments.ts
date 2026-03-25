'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Department, Person } from '@/types'

export function useDepartments(districtId?: string | null) {
  const [data, setData] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data: rows, error: err } = await supabase
      .from('departments')
      .select('*')
      .order('name')
    if (err) { setError(err.message); setLoading(false); return }

    // Count members scoped to the active district (via region → district)
    let countsQuery = supabase
      .from('people')
      .select('department_id, region:regions(district_id)')
      .not('department_id', 'is', null)

    const { data: counts } = await countsQuery

    const countMap: Record<string, number> = {}
    counts?.forEach((r) => {
      if (!r.department_id) return
      const regionDistrictId = (r.region as unknown as { district_id: string } | null)?.district_id
      if (districtId && regionDistrictId !== districtId) return
      countMap[r.department_id] = (countMap[r.department_id] ?? 0) + 1
    })

    // Fetch HOD assignments from department_roles
    const { data: hodRoles } = await supabase
      .from('department_roles')
      .select('department_id, person:people(id, name, phone, gender, district_id, region_id, department_id, created_at, updated_at)')
      .eq('role', 'hod')

    const hodMap: Record<string, Person> = {}
    hodRoles?.forEach((r) => {
      if (r.department_id && r.person) hodMap[r.department_id] = r.person as unknown as Person
    })

    setData((rows ?? []).map((d) => ({
      ...d,
      member_count: countMap[d.id] ?? 0,
      hod: hodMap[d.id] ?? null,
    })))
    setLoading(false)
  }, [districtId]) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  const create = async (values: { name: string; hod_person_id?: string | null }) => {
    const { hod_person_id, ...deptValues } = values
    const { data: dept, error: err } = await supabase
      .from('departments')
      .insert(deptValues)
      .select()
      .single()
    if (err) throw new Error(err.message)

    if (hod_person_id && dept) {
      const { error: roleErr } = await supabase.from('department_roles').insert({
        person_id: hod_person_id,
        department_id: dept.id,
        role: 'hod',
      })
      if (roleErr) throw new Error(roleErr.message)
    }

    await fetch()
  }

  const update = async (id: string, values: { name?: string; hod_person_id?: string | null }) => {
    const { hod_person_id, ...deptValues } = values

    if (Object.keys(deptValues).length > 0) {
      const { error: err } = await supabase.from('departments').update(deptValues).eq('id', id)
      if (err) throw new Error(err.message)
    }

    if (hod_person_id !== undefined) {
      // Remove existing HOD role for this department
      await supabase
        .from('department_roles')
        .delete()
        .eq('department_id', id)
        .eq('role', 'hod')

      if (hod_person_id) {
        const { error: roleErr } = await supabase.from('department_roles').insert({
          person_id: hod_person_id,
          department_id: id,
          role: 'hod',
        })
        if (roleErr) throw new Error(roleErr.message)
      }
    }

    await fetch()
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('departments').delete().eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  return { data, loading, error, create, update, remove, refresh: fetch }
}
